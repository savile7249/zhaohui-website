"""从仓库 content/managed-catalog.json 幂等导入子产品规格种类与关联技术文章种子。"""

import json
from datetime import date
from pathlib import Path
from django.conf import settings
from core.models import Site
from .models import ApprovedAsset, ManagedProductArticle, ManagedProductVariant


def seed_zhaohui_catalog_from_repo(site: Site, catalog_path: Path | None = None) -> dict:
    source_path = catalog_path or Path(settings.MANAGED_CATALOG_PATH)
    if not source_path.is_file():
        return {"variants_created": 0, "articles_created": 0, "assets_ensured": 0}

    doc = json.loads(source_path.read_text(encoding="utf-8"))
    variants_created = 0
    articles_created = 0
    assets_ensured = 0
    variant_map: dict[tuple[str, str], ManagedProductVariant] = {}

    # Clean up obsolete legacy tower viewpoint seeds if repo has migrated to full 4-model tower catalog
    repo_variant_keys = {
        (str(item.get("categorySlug") or "").strip(), str(item.get("variantSlug") or "").strip().lower())
        for item in (doc.get("variants") or [])
    }
    if ("towers", "ptfe") in repo_variant_keys:
        for legacy_slug in ("exterior", "spray", "grid"):
            if ("towers", legacy_slug) not in repo_variant_keys:
                ManagedProductVariant.objects.filter(
                    site=site,
                    category_slug="towers",
                    variant_slug=legacy_slug,
                ).delete()

    for idx, item in enumerate(doc.get("variants") or [], start=1):
        cat = str(item.get("categorySlug") or "").strip()
        vslug = str(item.get("variantSlug") or "").strip().lower()
        title = str(item.get("title") or "").strip()
        hero_path = str(item.get("heroImage") or "").strip()
        hero_alt = str(item.get("heroImageAlt") or title).strip()
        if not (cat and vslug and title and hero_path):
            continue

        hero_asset, _ = ApprovedAsset.objects.get_or_create(
            site=site,
            image_path=hero_path,
            defaults={
                "code": f"{cat}-{vslug}",
                "label": f"{title}实拍（已核准）",
                "image_alt": hero_alt,
                "is_approved": True,
            },
        )
        assets_ensured += 1

        try:
            display_order = int(str(item.get("index") or idx))
        except ValueError:
            display_order = idx

        variant, created = ManagedProductVariant.objects.get_or_create(
            site=site,
            category_slug=cat,
            variant_slug=vslug,
            defaults={
                "display_order": display_order,
                "title": title,
                "craft_tag": str(item.get("craftTag") or "板衬工艺").strip(),
                "summary": str(item.get("summary") or "").strip(),
                "seo_title": str(item.get("seoTitle") or title).strip(),
                "seo_description": str(item.get("seoDescription") or "").strip(),
                "hero_asset": hero_asset,
                "specs_json": item.get("standardSpecs") or [],
                "confirm_inputs_json": item.get("confirmChecklist") or [],
                "is_published": item.get("isPublished", True) is not False,
            },
        )
        if created:
            variants_created += 1
        variant_map[(cat, vslug)] = variant

        # Ensure any extra gallery images are also registered
        for media_idx, media in enumerate(item.get("galleryImages") or [], start=1):
            src = str(media.get("src") or "").strip()
            alt = str(media.get("alt") or hero_alt).strip()
            if not src or src == hero_path:
                continue
            extra_asset, _ = ApprovedAsset.objects.get_or_create(
                site=site,
                image_path=src,
                defaults={
                    "code": f"{cat}-{vslug}-{media_idx}",
                    "label": f"{title}实拍图 {media_idx}",
                    "image_alt": alt,
                    "is_approved": True,
                },
            )
            variant.gallery_assets.add(extra_asset)
            assets_ensured += 1

    for art in doc.get("articles") or []:
        cat = str(art.get("categorySlug") or "").strip()
        vslug = str(art.get("variantSlug") or "").strip().lower()
        aslug = str(art.get("articleSlug") or "").strip().lower()
        variant = variant_map.get((cat, vslug))
        if not variant or not aslug:
            continue

        cover_asset = None
        cover_src = str(art.get("coverImage") or "").strip()
        if cover_src:
            cover_asset, _ = ApprovedAsset.objects.get_or_create(
                site=site,
                image_path=cover_src,
                defaults={
                    "code": f"art-{aslug[:48]}",
                    "label": f"{art.get('title', aslug)[:60]}配图",
                    "image_alt": str(art.get("coverImageAlt") or art.get("title") or "").strip(),
                    "is_approved": True,
                },
            )

        raw_pub = str(art.get("publishedAt") or "2026-11-27").strip()
        try:
            pub_date = date.fromisoformat(raw_pub[:10])
        except ValueError:
            pub_date = date(2026, 11, 27)

        _, created = ManagedProductArticle.objects.get_or_create(
            variant=variant,
            article_slug=aslug,
            defaults={
                "site": site,
                "title": str(art.get("title") or "").strip(),
                "summary": str(art.get("summary") or "").strip(),
                "seo_title": str(art.get("seoTitle") or art.get("title") or "").strip(),
                "seo_description": str(art.get("seoDescription") or art.get("summary") or "").strip(),
                "cover_asset": cover_asset,
                "body_markdown": str(art.get("bodyMarkdown") or "").strip(),
                "status": ManagedProductArticle.STATUS_PUBLISHED
                if art.get("status") == "published"
                else ManagedProductArticle.STATUS_DRAFT,
                "published_at": pub_date,
            },
        )
        if created:
            articles_created += 1

    return {
        "variants_created": variants_created,
        "articles_created": articles_created,
        "assets_ensured": assets_ensured,
    }
