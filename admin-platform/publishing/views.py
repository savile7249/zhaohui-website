import json
import mimetypes
from datetime import date
from pathlib import Path
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import FileResponse, Http404, HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST
from core.models import Domain, Site, SiteMembership
from core.permissions import get_user_role, get_user_sites, record_audit, require_site_role
from .models import (
    ApprovedAsset,
    ContentSnapshot,
    ManagedContact,
    ManagedProduct,
    ManagedProductArticle,
    ManagedProductVariant,
    VARIANT_SLUG_RE,
    normalize_article_slug,
    ReleaseRecord,
)
from .pipeline import (
    BuildPipelineError,
    approve_snapshot,
    build_and_deploy_domain,
    create_snapshot,
    rollback_domain,
    sync_site_catalog_to_workspace,
)
from .redline_validator import (
    scan_fields_redlines,
    validate_article_redlines,
    validate_payload_catalog_redlines,
    validate_variant_redlines,
)
from .uploads import (
    UploadValidationError,
    normalize_spec_rows,
    parse_markdown_upload,
    parse_specs_upload,
    save_uploaded_managed_image,
)

CATEGORY_LABELS = dict(ManagedProductVariant.CATEGORY_CHOICES)
CATEGORY_ORDER = ["tanks", "reactors", "towers", "piping"]


def _get_site_or_403(request, site_slug: str, min_role: str = SiteMembership.ROLE_VIEWER) -> Site:
    site = get_object_or_404(Site, slug=site_slug)
    require_site_role(request.user, site, min_role=min_role)
    return site


def _studio_base_context(request, site: Site, active_subnav: str) -> dict:
    role = get_user_role(request.user, site)
    return {
        "site": site,
        "sites": list(get_user_sites(request.user)),
        "role": role,
        "can_edit": True,
        "can_publish": role in (SiteMembership.ROLE_PUBLISHER, SiteMembership.ROLE_ADMIN),
        "active_subnav": active_subnav,
        "local_dev_sync_enabled": bool(
            getattr(settings, "LOCAL_DEV_SYNC_ENABLED", False)
            and site.adapter_type == Site.ADAPTER_NEXTJS_ZHAOHUI
        ),
    }


def _image_preview_url(site_slug: str, image_path: str) -> str:
    clean = (image_path or "").strip()
    if clean.startswith("/images/"):
        rel = clean[len("/images/") :].lstrip("/")
        return reverse("publishing:serve_image", kwargs={"site_slug": site_slug, "rel_path": rel})
    return clean


@login_required
def serve_site_image(request, site_slug: str, rel_path: str):
    """Serve approved/managed images safely inside authenticated admin views."""
    _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_VIEWER)
    clean_rel = (rel_path or "").lstrip("/")
    if not clean_rel or ".." in Path(clean_rel).parts:
        raise Http404("Invalid image path")

    candidates = [
        (Path(settings.REPO_ROOT) / "public" / "images").resolve() / clean_rel,
    ]
    if clean_rel.startswith("site/managed/"):
        sub = clean_rel[len("site/managed/") :]
        candidates.insert(0, Path(settings.MANAGED_UPLOAD_DIR).resolve() / sub)

    for candidate in candidates:
        resolved = candidate.resolve()
        allowed_roots = [
            (Path(settings.REPO_ROOT) / "public" / "images").resolve(),
            Path(settings.MANAGED_UPLOAD_DIR).resolve(),
        ]
        if any(resolved == root or root in resolved.parents for root in allowed_roots) and resolved.is_file():
            ctype, _ = mimetypes.guess_type(str(resolved))
            return FileResponse(resolved.open("rb"), content_type=ctype or "application/octet-stream")
    raise Http404("Image not found")


@login_required
def content_studio(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    products = list(site.managed_products.select_related("approved_asset").order_by("display_order"))
    contact = getattr(site, "managed_contact", None)
    assets = list(site.approved_assets.filter(is_approved=True))
    domains = list(site.domains.all())
    snapshots_raw = list(site.snapshots.select_related("created_by", "approved_by")[:12])
    snapshots = []
    for snap in snapshots_raw:
        redline = validate_payload_catalog_redlines(snap.payload or {})
        snap.redline_warning_count = len(redline["warnings"])
        snap.redline_error_count = len(redline["errors"])
        snapshots.append(snap)
    releases = list(site.releases.select_related("domain", "snapshot", "triggered_by")[:20])

    variant_count = site.managed_variants.count()
    published_variant_count = site.managed_variants.filter(is_published=True).count()
    article_count = site.managed_articles.count()
    published_article_count = site.managed_articles.filter(status=ManagedProductArticle.STATUS_PUBLISHED).count()

    ctx = _studio_base_context(request, site, "studio")
    ctx.update(
        {
            "products": products,
            "contact": contact,
            "assets": assets,
            "domains": domains,
            "snapshots": snapshots,
            "releases": releases,
            "variant_count": variant_count,
            "published_variant_count": published_variant_count,
            "article_count": article_count,
            "published_article_count": published_article_count,
        }
    )
    return render(request, "publishing/studio.html", ctx)


@login_required
@require_POST
def update_product_draft(request, site_slug: str, product_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    product = get_object_or_404(ManagedProduct, id=product_id, site=site)

    display_name = (request.POST.get("display_name") or "").strip()
    summary = (request.POST.get("summary") or "").strip()
    asset_id = request.POST.get("approved_asset_id")

    if not display_name or not summary:
        messages.error(request, "产品展示名称与产品简介不能为空。")
        return redirect("publishing:studio", site_slug=site.slug)

    redline = scan_fields_redlines([("产品展示名称", display_name), ("产品简介", summary)])
    if not redline["passed"]:
        messages.error(request, "内容红线拦截：" + "；".join(e["message"] for e in redline["errors"]))
        return redirect("publishing:studio", site_slug=site.slug)

    asset = get_object_or_404(ApprovedAsset, id=asset_id, site=site, is_approved=True)
    old_name = product.display_name
    product.display_name = display_name
    product.summary = summary
    product.approved_asset = asset
    product.updated_by = request.user
    product.full_clean()
    product.save()

    record_audit(
        actor=request.user,
        action="draft.product_save",
        target_type="managed_product",
        target_id=str(product.id),
        summary=f"保存产品草稿：{product.slug}（{old_name} -> {display_name}）",
        site=site,
        metadata={"slug": product.slug, "asset_code": asset.code},
        request=request,
    )
    messages.success(request, f"已保存「{display_name}」草稿。请生成快照并在目标测试域名预览。")
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def update_contact_draft(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    contact = get_object_or_404(ManagedContact, site=site)

    email_display = (request.POST.get("email_display") or "").strip()
    phones_raw = (request.POST.get("phones_lines") or "").strip()
    addresses_raw = (request.POST.get("addresses_lines") or "").strip()

    phones = []
    for line in phones_raw.splitlines():
        val = line.strip()
        if not val:
            continue
        digits = "".join(ch for ch in val if ch.isdigit())
        phones.append({"display": val, "href": f"tel:{digits or val}"})

    addresses = []
    for line in addresses_raw.splitlines():
        val = line.strip()
        if not val:
            continue
        if "|" in val:
            region, addr = val.split("|", 1)
            addresses.append({"region": region.strip(), "address": addr.strip()})
        else:
            addresses.append({"region": "厂区地址", "address": val})

    if not email_display or not phones:
        messages.error(request, "公开联系电话与邮箱不能为空。")
        return redirect("publishing:studio", site_slug=site.slug)

    contact.phones_json = phones
    contact.email_display = email_display
    contact.email_href = f"mailto:{email_display}"
    contact.addresses_json = addresses
    contact.updated_by = request.user
    contact.save()

    record_audit(
        actor=request.user,
        action="draft.contact_save",
        target_type="managed_contact",
        target_id=str(contact.id),
        summary=f"更新站点 {site.slug} 公开联系方式草稿",
        site=site,
        metadata={"phone_count": len(phones), "address_count": len(addresses)},
        request=request,
    )
    messages.success(request, "已保存公开联系方式草稿。")
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def dev_sync_workspace_view(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    next_url = (request.POST.get("next") or "").strip()
    try:
        result = sync_site_catalog_to_workspace(site, request.user, request=request)
        msg = (
            f"已同步至本地前端工作区（{result['published_variants']} 款子产品，"
            f"{result['published_articles']} 篇已发布文章）。刷新本地 Next.js 开发页即可查看效果。"
        )
        if result["warnings"]:
            msg += f"（另有 {len(result['warnings'])} 项技术审核提醒，正式发布前需确认）"
        messages.success(request, msg)
    except BuildPipelineError as exc:
        messages.error(request, str(exc))
    if next_url.startswith("/publishing/"):
        return redirect(next_url)
    return redirect("publishing:studio", site_slug=site.slug)


# ---------- 核准图片素材库与上传 ----------


@login_required
def asset_library(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    assets = list(site.approved_assets.select_related("uploaded_by").order_by("-created_at", "code"))
    for a in assets:
        a.preview_url = _image_preview_url(site.slug, a.image_path)
    ctx = _studio_base_context(request, site, "assets")
    ctx.update({"assets": assets})
    return render(request, "publishing/assets.html", ctx)


@login_required
@require_POST
def upload_asset_view(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    wants_json = (
        request.headers.get("X-Requested-With") == "XMLHttpRequest"
        or "application/json" in (request.headers.get("Accept") or "")
    )
    next_url = (request.POST.get("next") or "").strip()

    label = (request.POST.get("label") or "").strip()
    image_alt = (request.POST.get("image_alt") or "").strip()
    uploaded = request.FILES.get("image_file")

    if not uploaded:
        if wants_json:
            return JsonResponse({"ok": False, "error": "请选择要上传的图片文件（WebP / PNG / JPG）。"}, status=400)
        messages.error(request, "请选择要上传的图片文件（WebP / PNG / JPG）。")
        return redirect(next_url if next_url.startswith("/publishing/") else reverse("publishing:assets", kwargs={"site_slug": site.slug}))

    if not label or not image_alt:
        if wants_json:
            return JsonResponse({"ok": False, "error": "素材名称与图片替代文本（Alt）均为必填项。"}, status=400)
        messages.error(request, "素材名称与图片替代文本（Alt）均为必填项。")
        return redirect(next_url if next_url.startswith("/publishing/") else reverse("publishing:assets", kwargs={"site_slug": site.slug}))

    redline = scan_fields_redlines([("素材名称", label), ("图片替代文本", image_alt)])
    if not redline["passed"]:
        err_msg = "内容红线拦截：" + "；".join(e["message"] for e in redline["errors"])
        if wants_json:
            return JsonResponse({"ok": False, "error": err_msg}, status=400)
        messages.error(request, err_msg)
        return redirect(next_url if next_url.startswith("/publishing/") else reverse("publishing:assets", kwargs={"site_slug": site.slug}))

    try:
        meta = save_uploaded_managed_image(uploaded, site_slug=site.slug, name_hint=label)
    except UploadValidationError as exc:
        if wants_json:
            return JsonResponse({"ok": False, "error": str(exc)}, status=400)
        messages.error(request, str(exc))
        return redirect(next_url if next_url.startswith("/publishing/") else reverse("publishing:assets", kwargs={"site_slug": site.slug}))

    asset, _ = ApprovedAsset.objects.update_or_create(
        site=site,
        image_path=meta["image_path"],
        defaults={
            "code": meta["code"],
            "label": label,
            "image_alt": image_alt,
            "file_size": meta["file_size"],
            "width": meta["width"],
            "height": meta["height"],
            "uploaded_by": request.user,
            "is_approved": True,
        },
    )

    record_audit(
        actor=request.user,
        action="asset.upload",
        target_type="approved_asset",
        target_id=str(asset.id),
        summary=f"上传受管图片：{label}（{asset.image_path}，{meta['width']}×{meta['height']}）",
        site=site,
        metadata={
            "image_path": asset.image_path,
            "file_size": meta["file_size"],
            "width": meta["width"],
            "height": meta["height"],
        },
        request=request,
    )

    if wants_json:
        return JsonResponse(
            {
                "ok": True,
                "id": asset.id,
                "label": asset.label,
                "image_path": asset.image_path,
                "image_alt": asset.image_alt,
                "preview_url": _image_preview_url(site.slug, asset.image_path),
                "markdown": f"![{asset.image_alt}]({asset.image_path})",
            },
            status=201,
        )

    messages.success(request, f"已上传并登记核准图片「{label}」（{asset.image_path}）。")
    if next_url.startswith("/publishing/"):
        return redirect(next_url)
    return redirect("publishing:assets", site_slug=site.slug)


# ---------- 子产品与标准化规格参数管理 ----------


@login_required
def variant_list(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    variants = list(
        site.managed_variants.select_related("hero_asset")
        .prefetch_related("articles")
        .all()
    )
    assets = list(site.approved_assets.filter(is_approved=True).order_by("-created_at", "code"))

    grouped = []
    for cat_slug in CATEGORY_ORDER:
        cat_variants = [v for v in variants if v.category_slug == cat_slug]
        cat_variants.sort(key=lambda x: (x.display_order, x.id))
        for v in cat_variants:
            specs = v.specs_json or []
            v.spec_total = len(specs)
            v.spec_filled = sum(1 for row in specs if isinstance(row, dict) and str(row.get("value") or "").strip())
            v.article_total = v.articles.count()
            v.article_published = v.articles.filter(status=ManagedProductArticle.STATUS_PUBLISHED).count()
            v.hero_preview_url = _image_preview_url(site.slug, v.hero_asset.image_path)
        grouped.append(
            {
                "slug": cat_slug,
                "label": CATEGORY_LABELS.get(cat_slug, cat_slug),
                "variants": cat_variants,
            }
        )

    ctx = _studio_base_context(request, site, "variants")
    ctx.update(
        {
            "grouped_variants": grouped,
            "category_choices": ManagedProductVariant.CATEGORY_CHOICES,
            "assets": assets,
        }
    )
    return render(request, "publishing/variants.html", ctx)


@login_required
@require_POST
def create_variant_view(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    category_slug = (request.POST.get("category_slug") or "").strip()
    variant_slug = (request.POST.get("variant_slug") or "").strip().lower()
    title = (request.POST.get("title") or "").strip()
    craft_tag = (request.POST.get("craft_tag") or "板衬工艺").strip()
    summary = (request.POST.get("summary") or "").strip()
    hero_asset_id = request.POST.get("hero_asset_id")

    if category_slug not in CATEGORY_LABELS:
        messages.error(request, "请选择有效的设备大类。")
        return redirect("publishing:variants", site_slug=site.slug)
    if not VARIANT_SLUG_RE.match(variant_slug):
        messages.error(request, "子产品路径标识只能包含小写字母、数字、连字符或下划线。")
        return redirect("publishing:variants", site_slug=site.slug)
    if not title or not summary:
        messages.error(request, "子产品名称与产品概述不能为空。")
        return redirect("publishing:variants", site_slug=site.slug)
    if ManagedProductVariant.objects.filter(site=site, category_slug=category_slug, variant_slug=variant_slug).exists():
        messages.error(request, f"子产品路径 {category_slug}/{variant_slug} 已存在。")
        return redirect("publishing:variants", site_slug=site.slug)

    redline = validate_variant_redlines(title=title, craft_tag=craft_tag, summary=summary)
    if not redline["passed"]:
        messages.error(request, "内容红线拦截：" + "；".join(e["message"] for e in redline["errors"]))
        return redirect("publishing:variants", site_slug=site.slug)

    hero_asset = get_object_or_404(ApprovedAsset, id=hero_asset_id, site=site, is_approved=True)
    next_order = site.managed_variants.filter(category_slug=category_slug).count() + 1

    # Copy specification category template (values empty) from first sibling if available
    sibling = site.managed_variants.filter(category_slug=category_slug).order_by("display_order", "id").first()
    template_specs = []
    template_inputs = []
    if sibling:
        template_specs = [
            {
                "group": r.get("group", "基本规格"),
                "label": r.get("label", ""),
                "value": "",
                "unit": r.get("unit", ""),
                "note": r.get("note", ""),
            }
            for r in (sibling.specs_json or [])
            if isinstance(r, dict) and r.get("label")
        ]
        template_inputs = list(sibling.confirm_inputs_json or [])

    variant = ManagedProductVariant.objects.create(
        site=site,
        category_slug=category_slug,
        variant_slug=variant_slug,
        display_order=next_order,
        title=title,
        craft_tag=craft_tag,
        summary=summary,
        seo_title=f"{title} | 标准化规格种类与工况说明",
        seo_description=summary[:160],
        hero_asset=hero_asset,
        specs_json=template_specs,
        confirm_inputs_json=template_inputs,
        is_published=True,
        updated_by=request.user,
    )
    record_audit(
        actor=request.user,
        action="variant.create",
        target_type="managed_variant",
        target_id=str(variant.id),
        summary=f"新增子产品：{variant.category_slug}/{variant.variant_slug}（{variant.title}）",
        site=site,
        metadata={"category_slug": category_slug, "variant_slug": variant_slug},
        request=request,
    )
    messages.success(request, f"已新增子产品「{variant.title}」，并已预填同大类规格种类模板。")
    return redirect("publishing:variant_edit", site_slug=site.slug, variant_id=variant.id)


@login_required
def variant_edit(request, site_slug: str, variant_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    variant = get_object_or_404(ManagedProductVariant, id=variant_id, site=site)
    assets = list(site.approved_assets.filter(is_approved=True).order_by("-created_at", "code"))
    for a in assets:
        a.preview_url = _image_preview_url(site.slug, a.image_path)

    redline_report = validate_variant_redlines(
        title=variant.title,
        craft_tag=variant.craft_tag,
        summary=variant.summary,
        seo_title=variant.seo_title,
        seo_description=variant.seo_description,
        specs_json=variant.specs_json,
        confirm_inputs_json=variant.confirm_inputs_json,
    )

    if request.method == "POST":
        title = (request.POST.get("title") or "").strip()
        craft_tag = (request.POST.get("craft_tag") or "").strip()
        summary = (request.POST.get("summary") or "").strip()
        seo_title = (request.POST.get("seo_title") or "").strip()
        seo_description = (request.POST.get("seo_description") or "").strip()
        hero_asset_id = request.POST.get("hero_asset_id")
        gallery_ids = request.POST.getlist("gallery_asset_ids")
        is_published = request.POST.get("is_published") == "1"
        redline_confirmed = request.POST.get("redline_confirmed") == "1"
        redline_review_note = (request.POST.get("redline_review_note") or "").strip()
        try:
            display_order = max(1, int(request.POST.get("display_order") or variant.display_order))
        except ValueError:
            display_order = variant.display_order

        # Parse visual specs editor rows (supports JSON payload or parallel form arrays)
        specs_payload_raw = (request.POST.get("specs_json_payload") or "").strip()
        parsed_specs: list[dict] = []
        if specs_payload_raw:
            try:
                parsed_specs = normalize_spec_rows(json.loads(specs_payload_raw))
            except json.JSONDecodeError:
                messages.error(request, "规格参数 JSON 格式异常，请检查后重试。")
                return redirect("publishing:variant_edit", site_slug=site.slug, variant_id=variant.id)
        else:
            groups = request.POST.getlist("spec_group")
            labels = request.POST.getlist("spec_label")
            values = request.POST.getlist("spec_value")
            units = request.POST.getlist("spec_unit")
            notes = request.POST.getlist("spec_note")
            rows_raw = []
            for idx, lbl in enumerate(labels):
                rows_raw.append(
                    {
                        "group": groups[idx] if idx < len(groups) else "基本规格",
                        "label": lbl,
                        "value": values[idx] if idx < len(values) else "",
                        "unit": units[idx] if idx < len(units) else "",
                        "note": notes[idx] if idx < len(notes) else "",
                    }
                )
            parsed_specs = normalize_spec_rows(rows_raw)

        checklist_lines = [
            line.strip()
            for line in (request.POST.get("confirm_inputs_lines") or "").splitlines()
            if line.strip()
        ]

        if not title or not summary:
            messages.error(request, "子产品名称与产品概述不能为空。")
            return redirect("publishing:variant_edit", site_slug=site.slug, variant_id=variant.id)

        redline_report = validate_variant_redlines(
            title=title,
            craft_tag=craft_tag,
            summary=summary,
            seo_title=seo_title,
            seo_description=seo_description,
            specs_json=parsed_specs,
            confirm_inputs_json=checklist_lines,
        )
        if not redline_report["passed"]:
            messages.error(
                request,
                "保存被内容红线拦截：" + "；".join(e["message"] for e in redline_report["errors"]),
            )
        else:
            hero_asset = get_object_or_404(ApprovedAsset, id=hero_asset_id, site=site, is_approved=True)
            variant.title = title
            variant.craft_tag = craft_tag or variant.craft_tag
            variant.summary = summary
            variant.seo_title = seo_title or title
            variant.seo_description = seo_description or summary[:160]
            variant.display_order = display_order
            variant.hero_asset = hero_asset
            variant.specs_json = parsed_specs
            variant.confirm_inputs_json = checklist_lines
            variant.is_published = is_published
            variant.redline_confirmed = redline_confirmed
            variant.redline_review_note = redline_review_note
            variant.updated_by = request.user
            variant.full_clean()
            variant.save()

            valid_gallery = list(
                ApprovedAsset.objects.filter(site=site, is_approved=True, id__in=gallery_ids)
            )
            variant.gallery_assets.set(valid_gallery)

            filled_count = sum(1 for r in parsed_specs if r.get("value"))
            record_audit(
                actor=request.user,
                action="variant.save",
                target_type="managed_variant",
                target_id=str(variant.id),
                summary=f"保存子产品规格：{variant.category_slug}/{variant.variant_slug}（{len(parsed_specs)} 项规格，已填 {filled_count} 项）",
                site=site,
                metadata={
                    "category_slug": variant.category_slug,
                    "variant_slug": variant.variant_slug,
                    "spec_total": len(parsed_specs),
                    "spec_filled": filled_count,
                    "redline_warnings": len(redline_report["warnings"]),
                    "redline_confirmed": redline_confirmed,
                },
                request=request,
            )
            if redline_report["warnings"] and not redline_confirmed:
                messages.warning(
                    request,
                    f"已保存「{variant.title}」，但检测到 {len(redline_report['warnings'])} 项技术审核提醒（具体数值或待确认牌号），正式发布前须经技术负责人确认。",
                )
            else:
                messages.success(request, f"已保存「{variant.title}」的文案与标准化规格表。")
            return redirect("publishing:variant_edit", site_slug=site.slug, variant_id=variant.id)

    ctx = _studio_base_context(request, site, "variants")
    ctx.update(
        {
            "variant": variant,
            "category_label": CATEGORY_LABELS.get(variant.category_slug, variant.category_slug),
            "assets": assets,
            "selected_gallery_ids": set(variant.gallery_assets.values_list("id", flat=True)),
            "specs_json_str": json.dumps(variant.specs_json or [], ensure_ascii=False),
            "confirm_inputs_text": "\n".join(variant.confirm_inputs_json or []),
            "redline": redline_report,
            "article_count": variant.articles.count(),
            "hero_preview_url": _image_preview_url(site.slug, variant.hero_asset.image_path),
        }
    )
    return render(request, "publishing/variant_edit.html", ctx)


@login_required
@require_POST
def import_variant_specs(request, site_slug: str, variant_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    variant = get_object_or_404(ManagedProductVariant, id=variant_id, site=site)
    uploaded = request.FILES.get("specs_file")
    if not uploaded:
        messages.error(request, "请选择要上传的 .csv 或 .json 参数表文件。")
        return redirect("publishing:variant_edit", site_slug=site.slug, variant_id=variant.id)

    try:
        imported_rows = parse_specs_upload(uploaded)
    except UploadValidationError as exc:
        messages.error(request, str(exc))
        return redirect("publishing:variant_edit", site_slug=site.slug, variant_id=variant.id)

    redline = validate_variant_redlines(
        title=variant.title,
        craft_tag=variant.craft_tag,
        summary=variant.summary,
        seo_title=variant.seo_title,
        seo_description=variant.seo_description,
        specs_json=imported_rows,
        confirm_inputs_json=variant.confirm_inputs_json,
    )
    if not redline["passed"]:
        messages.error(
            request,
            "导入被内容红线拦截：" + "；".join(e["message"] for e in redline["errors"]),
        )
        return redirect("publishing:variant_edit", site_slug=site.slug, variant_id=variant.id)

    variant.specs_json = imported_rows
    variant.updated_by = request.user
    variant.save(update_fields=["specs_json", "updated_by", "updated_at"])

    record_audit(
        actor=request.user,
        action="variant.import_specs",
        target_type="managed_variant",
        target_id=str(variant.id),
        summary=f"批量导入子产品参数表：{variant.category_slug}/{variant.variant_slug}（{len(imported_rows)} 行）",
        site=site,
        metadata={"filename": uploaded.name, "row_count": len(imported_rows)},
        request=request,
    )
    messages.success(request, f"已成功导入 {len(imported_rows)} 行规格参数（来源：{uploaded.name}）。")
    return redirect("publishing:variant_edit", site_slug=site.slug, variant_id=variant.id)


# ---------- 产品关联技术文章管理与上传 ----------


@login_required
def article_list(request, site_slug: str, variant_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    variant = get_object_or_404(ManagedProductVariant, id=variant_id, site=site)
    articles = list(variant.articles.select_related("cover_asset", "updated_by").order_by("-published_at", "article_slug"))
    assets = list(site.approved_assets.filter(is_approved=True).order_by("-created_at", "code"))

    ctx = _studio_base_context(request, site, "variants")
    ctx.update(
        {
            "variant": variant,
            "category_label": CATEGORY_LABELS.get(variant.category_slug, variant.category_slug),
            "articles": articles,
            "assets": assets,
            "today_iso": timezone.localdate().isoformat(),
        }
    )
    return render(request, "publishing/articles.html", ctx)


@login_required
@require_POST
def create_article_view(request, site_slug: str, variant_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    variant = get_object_or_404(ManagedProductVariant, id=variant_id, site=site)

    raw_slug = (request.POST.get("article_slug") or "").strip()
    title = (request.POST.get("title") or "").strip()
    summary = (request.POST.get("summary") or "").strip()
    body_markdown = (request.POST.get("body_markdown") or "").strip()
    status = request.POST.get("status") or ManagedProductArticle.STATUS_DRAFT
    if status not in (ManagedProductArticle.STATUS_DRAFT, ManagedProductArticle.STATUS_PUBLISHED):
        status = ManagedProductArticle.STATUS_DRAFT

    md_file = request.FILES.get("markdown_file")
    if md_file:
        try:
            parsed = parse_markdown_upload(md_file)
        except UploadValidationError as exc:
            messages.error(request, str(exc))
            return redirect("publishing:articles", site_slug=site.slug, variant_id=variant.id)
        if not title and parsed["title"]:
            title = parsed["title"]
        if not summary and parsed["summary"]:
            summary = parsed["summary"]
        body_markdown = parsed["body_markdown"]
        if not raw_slug:
            raw_slug = Path(md_file.name).stem

    article_slug = normalize_article_slug(raw_slug)
    if not article_slug:
        messages.error(request, "请填写有效的文章路径标识（如 ptfe-tank-selection，系统将自动补全 article_ 前缀）。")
        return redirect("publishing:articles", site_slug=site.slug, variant_id=variant.id)
    if ManagedProductArticle.objects.filter(variant=variant, article_slug=article_slug).exists():
        messages.error(request, f"文章路径 {article_slug} 在当前子产品下已存在。")
        return redirect("publishing:articles", site_slug=site.slug, variant_id=variant.id)
    if not title or not body_markdown:
        messages.error(request, "文章标题与 Markdown 正文不能为空。")
        return redirect("publishing:articles", site_slug=site.slug, variant_id=variant.id)

    summary = summary or title
    redline = validate_article_redlines(title=title, summary=summary, body_markdown=body_markdown)
    if not redline["passed"]:
        messages.error(request, "文章创建被内容红线拦截：" + "；".join(e["message"] for e in redline["errors"]))
        return redirect("publishing:articles", site_slug=site.slug, variant_id=variant.id)

    cover_asset = None
    cover_id = (request.POST.get("cover_asset_id") or "").strip()
    if cover_id:
        cover_asset = get_object_or_404(ApprovedAsset, id=cover_id, site=site, is_approved=True)

    raw_pub = (request.POST.get("published_at") or "").strip()
    try:
        pub_date = date.fromisoformat(raw_pub) if raw_pub else timezone.localdate()
    except ValueError:
        pub_date = timezone.localdate()

    article = ManagedProductArticle(
        site=site,
        variant=variant,
        article_slug=article_slug,
        title=title,
        summary=summary,
        seo_title=title,
        seo_description=summary[:160],
        cover_asset=cover_asset,
        body_markdown=body_markdown,
        status=status,
        published_at=pub_date,
        updated_by=request.user,
    )
    try:
        article.full_clean()
    except ValidationError as exc:
        messages.error(request, "文章字段校验失败：" + "；".join(exc.messages))
        return redirect("publishing:articles", site_slug=site.slug, variant_id=variant.id)
    article.save()

    record_audit(
        actor=request.user,
        action="article.create",
        target_type="managed_article",
        target_id=str(article.id),
        summary=f"新建关联文章：{article.get_public_path()}（{article.title}）",
        site=site,
        metadata={"variant": f"{variant.category_slug}/{variant.variant_slug}", "article_slug": article_slug, "status": status},
        request=request,
    )
    messages.success(request, f"已创建文章「{article.title}」（路径：{article.article_slug}）。")
    return redirect("publishing:article_edit", site_slug=site.slug, variant_id=variant.id, article_id=article.id)


@login_required
def article_edit(request, site_slug: str, variant_id: int, article_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    variant = get_object_or_404(ManagedProductVariant, id=variant_id, site=site)
    article = get_object_or_404(ManagedProductArticle, id=article_id, variant=variant, site=site)
    assets = list(site.approved_assets.filter(is_approved=True).order_by("-created_at", "code"))
    for a in assets:
        a.preview_url = _image_preview_url(site.slug, a.image_path)

    redline_report = validate_article_redlines(
        title=article.title,
        summary=article.summary,
        seo_title=article.seo_title,
        seo_description=article.seo_description,
        body_markdown=article.body_markdown,
    )

    if request.method == "POST":
        raw_slug = (request.POST.get("article_slug") or article.article_slug).strip()
        article_slug = normalize_article_slug(raw_slug)
        title = (request.POST.get("title") or "").strip()
        summary = (request.POST.get("summary") or "").strip()
        seo_title = (request.POST.get("seo_title") or "").strip()
        seo_description = (request.POST.get("seo_description") or "").strip()
        body_markdown = (request.POST.get("body_markdown") or "").strip()
        status = request.POST.get("status") or article.status
        if status not in (ManagedProductArticle.STATUS_DRAFT, ManagedProductArticle.STATUS_PUBLISHED):
            status = ManagedProductArticle.STATUS_DRAFT
        redline_confirmed = request.POST.get("redline_confirmed") == "1"
        redline_review_note = (request.POST.get("redline_review_note") or "").strip()

        md_file = request.FILES.get("markdown_file")
        if md_file:
            try:
                parsed = parse_markdown_upload(md_file)
                if parsed["title"] and request.POST.get("override_title_from_md") == "1":
                    title = parsed["title"]
                if parsed["summary"] and not summary:
                    summary = parsed["summary"]
                body_markdown = parsed["body_markdown"]
            except UploadValidationError as exc:
                messages.error(request, str(exc))
                return redirect(
                    "publishing:article_edit",
                    site_slug=site.slug,
                    variant_id=variant.id,
                    article_id=article.id,
                )

        if not article_slug or not title or not body_markdown:
            messages.error(request, "文章路径标识、标题与 Markdown 正文不能为空。")
            return redirect(
                "publishing:article_edit",
                site_slug=site.slug,
                variant_id=variant.id,
                article_id=article.id,
            )

        if (
            ManagedProductArticle.objects.filter(variant=variant, article_slug=article_slug)
            .exclude(id=article.id)
            .exists()
        ):
            messages.error(request, f"文章路径标识 {article_slug} 已被同机型下其他文章占用。")
            return redirect(
                "publishing:article_edit",
                site_slug=site.slug,
                variant_id=variant.id,
                article_id=article.id,
            )

        summary = summary or title
        redline_report = validate_article_redlines(
            title=title,
            summary=summary,
            seo_title=seo_title,
            seo_description=seo_description,
            body_markdown=body_markdown,
        )
        if not redline_report["passed"]:
            messages.error(
                request,
                "保存被内容红线拦截：" + "；".join(e["message"] for e in redline_report["errors"]),
            )
        else:
            cover_asset = None
            cover_id = (request.POST.get("cover_asset_id") or "").strip()
            if cover_id:
                cover_asset = get_object_or_404(ApprovedAsset, id=cover_id, site=site, is_approved=True)
            raw_pub = (request.POST.get("published_at") or "").strip()
            try:
                pub_date = date.fromisoformat(raw_pub) if raw_pub else article.published_at
            except ValueError:
                pub_date = article.published_at

            article.article_slug = article_slug
            article.title = title
            article.summary = summary
            article.seo_title = seo_title or title
            article.seo_description = seo_description or summary[:160]
            article.cover_asset = cover_asset
            article.body_markdown = body_markdown
            article.status = status
            article.published_at = pub_date
            article.redline_confirmed = redline_confirmed
            article.redline_review_note = redline_review_note
            article.updated_by = request.user
            article.full_clean()
            article.save()

            record_audit(
                actor=request.user,
                action="article.save",
                target_type="managed_article",
                target_id=str(article.id),
                summary=f"保存关联文章：{article.get_public_path()}（状态：{article.get_status_display()}）",
                site=site,
                metadata={
                    "article_slug": article.article_slug,
                    "status": article.status,
                    "redline_warnings": len(redline_report["warnings"]),
                    "redline_confirmed": redline_confirmed,
                },
                request=request,
            )
            if redline_report["warnings"] and not redline_confirmed:
                messages.warning(
                    request,
                    f"已保存文章「{article.title}」，但检测到 {len(redline_report['warnings'])} 项技术审核提醒，正式发布前须经技术负责人确认。",
                )
            else:
                messages.success(request, f"已保存文章「{article.title}」。")
            return redirect(
                "publishing:article_edit",
                site_slug=site.slug,
                variant_id=variant.id,
                article_id=article.id,
            )

    ctx = _studio_base_context(request, site, "variants")
    ctx.update(
        {
            "variant": variant,
            "category_label": CATEGORY_LABELS.get(variant.category_slug, variant.category_slug),
            "article": article,
            "assets": assets,
            "redline": redline_report,
            "image_media_base": reverse("publishing:serve_image", kwargs={"site_slug": site.slug, "rel_path": "__REL__"}).replace("__REL__", ""),
        }
    )
    return render(request, "publishing/article_edit.html", ctx)


@login_required
@require_POST
def delete_article_view(request, site_slug: str, variant_id: int, article_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    variant = get_object_or_404(ManagedProductVariant, id=variant_id, site=site)
    article = get_object_or_404(ManagedProductArticle, id=article_id, variant=variant, site=site)
    path_str = article.get_public_path()
    title = article.title
    article.delete()
    record_audit(
        actor=request.user,
        action="article.delete",
        target_type="managed_article",
        target_id=str(article_id),
        summary=f"删除关联文章：{path_str}（{title}）",
        site=site,
        metadata={"path": path_str, "title": title},
        request=request,
    )
    messages.success(request, f"已删除文章「{title}」。")
    return redirect("publishing:articles", site_slug=site.slug, variant_id=variant.id)


# ---------- 快照、预览、审核、发布与回滚 ----------


@login_required
@require_POST
def create_snapshot_view(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    note = (request.POST.get("note") or "").strip()
    try:
        snap = create_snapshot(site, request.user, note=note, request=request)
        messages.success(request, f"已生成内容快照 {snap.version}（SHA-256: {snap.checksum[:12]}）。")
    except BuildPipelineError as exc:
        messages.error(request, str(exc))
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def trigger_preview_view(request, site_slug: str, snapshot_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    snap = get_object_or_404(ContentSnapshot, id=snapshot_id, site=site)
    domain_id = request.POST.get("domain_id")
    if domain_id == "all":
        domains = list(site.domains.all())
    else:
        domains = [get_object_or_404(Domain, id=domain_id, site=site)]

    for dom in domains:
        rel = build_and_deploy_domain(
            snapshot=snap,
            domain=dom,
            build_type=ReleaseRecord.BUILD_PREVIEW,
            user=request.user,
            request=request,
        )
        if rel.status == ReleaseRecord.STATUS_SUCCEEDED:
            messages.success(request, f"预览已就绪：{dom.get_preview_http_url()}（{rel.release_version}）")
        else:
            messages.error(request, f"{dom.official_domain} 预览构建失败：{rel.error_message}")
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def approve_snapshot_view(request, site_slug: str, snapshot_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_PUBLISHER)
    snap = get_object_or_404(ContentSnapshot, id=snapshot_id, site=site)
    redline_confirmed = request.POST.get("redline_confirmed") == "1"
    try:
        approve_snapshot(snap, request.user, request=request, redline_confirmed=redline_confirmed)
        messages.success(request, f"快照 {snap.version} 已审核通过，可执行发布。")
    except BuildPipelineError as exc:
        messages.error(request, str(exc))
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def publish_snapshot_view(request, site_slug: str, snapshot_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_PUBLISHER)
    snap = get_object_or_404(ContentSnapshot, id=snapshot_id, site=site)
    domain = get_object_or_404(Domain, id=request.POST.get("domain_id"), site=site)
    simulate_failure = (request.POST.get("simulate_failure") or "").strip() or None

    try:
        rel = build_and_deploy_domain(
            snapshot=snap,
            domain=domain,
            build_type=ReleaseRecord.BUILD_RELEASE,
            user=request.user,
            request=request,
            simulate_failure=simulate_failure,
        )
        if rel.status == ReleaseRecord.STATUS_SUCCEEDED:
            messages.success(request, f"已发布 {domain.official_domain} 至 {rel.release_version}。")
        else:
            messages.warning(request, f"发布失败并已保留旧版：{rel.error_message}")
    except BuildPipelineError as exc:
        messages.error(request, str(exc))
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def rollback_release_view(request, site_slug: str, release_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_PUBLISHER)
    target = get_object_or_404(ReleaseRecord, id=release_id, site=site)
    try:
        rb = rollback_domain(target.domain, target, request.user, request=request)
        messages.success(request, f"已将 {target.domain.official_domain} 回滚至 {target.snapshot.version}（记录 {rb.release_version}）。")
    except BuildPipelineError as exc:
        messages.error(request, str(exc))
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
def api_site_products(request, site_slug: str):
    """Direct API endpoint for RBAC cross-site isolation verification."""
    try:
        site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_VIEWER)
    except PermissionDenied:
        return HttpResponseForbidden("Forbidden: cross-site access denied")
    products = [
        {
            "id": p.id,
            "slug": p.slug,
            "display_name": p.display_name,
            "summary": p.summary,
            "image": p.approved_asset.image_path,
        }
        for p in site.managed_products.select_related("approved_asset")
    ]
    variants = [
        {
            "id": v.id,
            "category_slug": v.category_slug,
            "variant_slug": v.variant_slug,
            "title": v.title,
            "is_published": v.is_published,
        }
        for v in site.managed_variants.all()
    ]
    return JsonResponse({"site": site.slug, "products": products, "variants": variants})
