import json
import os
import re
from pathlib import Path
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import AuditLog, Domain, GatewayCredential, Site, SiteMembership
from publishing.catalog_seed import seed_zhaohui_catalog_from_repo
from publishing.models import ApprovedAsset, ContentSnapshot, ManagedContact, ManagedProduct
from publishing.pipeline import build_snapshot_payload

User = get_user_model()

TEST_ACCOUNTS = [
    ("platform_admin", "Plat@Adm2026!#80", True, True, None, None),
    ("zhaohui_admin", "Zh@Adm2026!#86", True, False, "zhaohui", SiteMembership.ROLE_ADMIN),
    ("zhaohui_publisher", "Zh@Pub2026!#83", True, False, "zhaohui", SiteMembership.ROLE_PUBLISHER),
    ("zhaohui_editor", "Zh@Edit2026!#81", True, False, "zhaohui", SiteMembership.ROLE_EDITOR),
    ("zhaohui_viewer", "Zh@View2026!#82", False, False, "zhaohui", SiteMembership.ROLE_VIEWER),
    ("sim_editor", "Sim@Edit2026!#84", True, False, "sim-site", SiteMembership.ROLE_EDITOR),
    ("sim_viewer", "Sim@View2026!#85", False, False, "sim-site", SiteMembership.ROLE_VIEWER),
]

DEFAULT_GATEWAY_ID = "local-test-gw-01"
DEFAULT_GATEWAY_SECRET = os.environ.get(
    "ZHAOHUI_GATEWAY_SECRET",
    "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff01",
)


def _extract_zhaohui_products_from_code() -> list[dict]:
    """Read initial product display_name, summary, image, imageAlt directly from app/products/product-data.ts."""
    src_path = Path(settings.REPO_ROOT) / "app" / "products" / "product-data.ts"
    text = src_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r'slug:\s*"(?P<slug>[^"]+)"[\s\S]*?'
        r'title:\s*"(?P<title>[^"]+)"[\s\S]*?'
        r'summary:\s*"(?P<summary>[^"]+)"[\s\S]*?'
        r'image:\s*"(?P<image>[^"]+)"[\s\S]*?'
        r'imageAlt:\s*"(?P<imageAlt>[^"]+)"',
        re.MULTILINE,
    )
    items = []
    for idx, m in enumerate(pattern.finditer(text), start=1):
        items.append(
            {
                "slug": m.group("slug"),
                "order": idx,
                "title": m.group("title"),
                "summary": m.group("summary"),
                "image": m.group("image"),
                "imageAlt": m.group("imageAlt"),
            }
        )
    if len(items) != 4:
        raise RuntimeError(f"从 app/products/product-data.ts 导入产品数量异常：{len(items)}")
    return items


def _extract_zhaohui_contact_from_code() -> dict:
    """Read initial public contact info directly from components/contact-data.ts."""
    src_path = Path(settings.REPO_ROOT) / "components" / "contact-data.ts"
    text = src_path.read_text(encoding="utf-8")
    phones = [
        {"display": m.group(1), "href": m.group(2)}
        for m in re.finditer(r'\{\s*display:\s*"([^"]+)",\s*href:\s*"(tel:[^"]+)"\s*\}', text)
    ]
    email_m = re.search(r'email:\s*\{\s*display:\s*"([^"]+)",\s*href:\s*"(mailto:[^"]+)"', text, re.S)
    addresses = [
        {"region": m.group(1), "address": m.group(2).replace("\\u00A0", "\u00A0")}
        for m in re.finditer(r'region:\s*"([^"]+)",\s*address:\s*"([^"]+)"', text)
    ]
    if not phones or not email_m or not addresses:
        raise RuntimeError("从 components/contact-data.ts 提取公开联系方式失败")
    return {
        "phones": phones,
        "email_display": email_m.group(1),
        "email_href": email_m.group(2),
        "addresses": addresses,
    }


def _extract_zhaohui_icp_from_code() -> str:
    src_path = Path(settings.REPO_ROOT) / "app" / "site-footer.tsx"
    text = src_path.read_text(encoding="utf-8")
    m = re.search(r"(苏ICP备[0-9A-Za-z-]+)", text)
    return m.group(1) if m else "苏ICP备20000966号-6"


class Command(BaseCommand):
    help = "初始化多站点隔离测试环境（兆辉官网双域名、模拟独立站点、受管内容、网关凭据与6类测试角色账号）。"

    def handle(self, *args, **options):
        now = timezone.now()
        zhaohui_icp = _extract_zhaohui_icp_from_code()

        # 1. Sites
        zhaohui_site, _ = Site.objects.update_or_create(
            slug="zhaohui",
            defaults={
                "name": "兆辉官网",
                "brand_name": "兆辉化工设备",
                "description": "江苏兆辉防腐科技有限公司主站，四类设备、核准图片与公开联系方式按站点统一维护。",
                "adapter_type": Site.ADAPTER_NEXTJS_ZHAOHUI,
                "online_inquiry_enabled": False,
            },
        )
        sim_site, _ = Site.objects.update_or_create(
            slug="sim-site",
            defaults={
                "name": "模拟独立测试站",
                "brand_name": "华东耐蚀演示站",
                "description": "用于验证多站点数据隔离、权限边界、独立备案号与独立规范网址的模拟站点。",
                "adapter_type": Site.ADAPTER_STATIC_SIM,
                "online_inquiry_enabled": False,
            },
        )

        # 2. Domains
        Domain.objects.update_or_create(
            official_domain="jszhff.cn",
            defaults={
                "site": zhaohui_site,
                "test_host": "jszhff.localhost",
                "preview_host": "preview-jszhff.localhost",
                "is_primary": True,
                "icp_number": zhaohui_icp,
                "domain_status": Domain.STATUS_ACTIVE,
                "public_enabled": True,
                "canonical_policy": Domain.CANONICAL_PRIMARY,
                "collection_status": Domain.COLLECTION_ACTIVE,
                "collection_started_at": now,
                "expected_home_marker": "兆辉化工设备",
            },
        )
        Domain.objects.update_or_create(
            official_domain="zhaohuifangfu.com",
            defaults={
                "site": zhaohui_site,
                "test_host": "zhaohuifangfu.localhost",
                "preview_host": "preview-zhaohuifangfu.localhost",
                "is_primary": False,
                "icp_number": "待备案（zhaohuifangfu.com 离线预配置）",
                "domain_status": Domain.STATUS_PENDING_ICP,
                "public_enabled": False,  # MUST remain False (公网关闭)
                "canonical_policy": Domain.CANONICAL_PRIMARY,
                "collection_status": Domain.COLLECTION_PENDING_ICP,
                "collection_started_at": None,
                "expected_home_marker": "兆辉化工设备",
            },
        )
        Domain.objects.update_or_create(
            official_domain="sim-site.localhost",
            defaults={
                "site": sim_site,
                "test_host": "sim-site.localhost",
                "preview_host": "preview-sim-site.localhost",
                "is_primary": True,
                "icp_number": "沪ICP备00000001号-测试",
                "domain_status": Domain.STATUS_ACTIVE,
                "public_enabled": True,
                "canonical_policy": Domain.CANONICAL_SELF,
                "collection_status": Domain.COLLECTION_ACTIVE,
                "collection_started_at": now,
                "expected_home_marker": "华东耐蚀演示站",
            },
        )

        # 3. Trusted Gateway Credential
        GatewayCredential.objects.update_or_create(
            gateway_id=DEFAULT_GATEWAY_ID,
            defaults={
                "name": "本地隔离测试网关（HTTP 18080 / HTTPS 18443）",
                "shared_secret": DEFAULT_GATEWAY_SECRET,
                "site": None,
                "is_active": True,
            },
        )

        # 4. Import Zhaohui managed content from existing repo source code
        zh_products = _extract_zhaohui_products_from_code()
        zh_contact = _extract_zhaohui_contact_from_code()

        # Approved asset library for Zhaohui (existing approved WebP photos only)
        extra_zh_assets = [
            ("tanks-ptfe", "储罐实拍（钢衬四氟）", "/images/site/products/tanks-ptfe.webp", "钢衬四氟储罐实拍，可见内部白色 PTFE 衬里与法兰翻边"),
            ("tanks-po", "储罐实拍（钢衬 PO）", "/images/site/products/tanks-po.webp", "钢衬 PO 储罐实拍，可见滚塑成型内衬层"),
            ("reactors-ptfe", "反应釜实拍（钢衬四氟）", "/images/site/products/reactors-ptfe.webp", "钢衬四氟反应釜实拍，可见釜盖主法兰与接管"),
            ("towers-exterior", "塔器实拍（整塔外观）", "/images/site/products/towers-exterior.webp", "衬氟塔器整塔外观实拍"),
            ("piping-ptfe", "管道实拍（钢衬四氟）", "/images/site/products/piping-ptfe.webp", "钢衬四氟管道与管件批量实拍"),
        ]
        for code, label, path, alt in extra_zh_assets:
            ApprovedAsset.objects.update_or_create(
                site=zhaohui_site,
                image_path=path,
                defaults={"code": code, "label": label, "image_alt": alt, "is_approved": True},
            )

        for item in zh_products:
            asset, _ = ApprovedAsset.objects.update_or_create(
                site=zhaohui_site,
                image_path=item["image"],
                defaults={
                    "code": f"product-{item['slug']}",
                    "label": f"{item['title']}主图（已核准）",
                    "image_alt": item["imageAlt"],
                    "is_approved": True,
                },
            )
            ManagedProduct.objects.get_or_create(
                site=zhaohui_site,
                slug=item["slug"],
                defaults={
                    "display_order": item["order"],
                    "display_name": item["title"],
                    "summary": item["summary"],
                    "approved_asset": asset,
                },
            )

        ManagedContact.objects.get_or_create(
            site=zhaohui_site,
            defaults={
                "phones_json": zh_contact["phones"],
                "email_display": zh_contact["email_display"],
                "email_href": zh_contact["email_href"],
                "addresses_json": zh_contact["addresses"],
            },
        )
        seed_zhaohui_catalog_from_repo(zhaohui_site)

        # 5. Seed Sim-Site independent managed content
        sim_asset_1, _ = ApprovedAsset.objects.update_or_create(
            site=sim_site,
            image_path="/images/site/products/tanks-pe.webp",
            defaults={
                "code": "sim-vessel-main",
                "label": "模拟站点演示容器图",
                "image_alt": "华东耐蚀演示站演示容器实拍",
                "is_approved": True,
            },
        )
        sim_asset_2, _ = ApprovedAsset.objects.update_or_create(
            site=sim_site,
            image_path="/images/site/products/piping-po.webp",
            defaults={
                "code": "sim-pipe-main",
                "label": "模拟站点演示管路图",
                "image_alt": "华东耐蚀演示站演示管路实拍",
                "is_approved": True,
            },
        )
        ManagedProduct.objects.get_or_create(
            site=sim_site,
            slug="sim-vessel",
            defaults={
                "display_order": 1,
                "display_name": "演示耐蚀容器",
                "summary": "模拟独立测试站专用容器样例，用于验证跨站点内容发布隔离。",
                "approved_asset": sim_asset_1,
            },
        )
        ManagedProduct.objects.get_or_create(
            site=sim_site,
            slug="sim-pipe",
            defaults={
                "display_order": 2,
                "display_name": "演示防腐管路",
                "summary": "模拟独立测试站专用管路样例，内容与兆辉官网保持完全独立。",
                "approved_asset": sim_asset_2,
            },
        )
        ManagedContact.objects.get_or_create(
            site=sim_site,
            defaults={
                "phones_json": [{"display": "400-000-0199", "href": "tel:4000000199"}],
                "email_display": "demo-sim@example.invalid",
                "email_href": "mailto:demo-sim@example.invalid",
                "addresses_json": [{"region": "上海测试区", "address": "上海市浦东新区演示工业路 99 号"}],
            },
        )

        # 6. Users & RBAC Memberships
        site_map = {"zhaohui": zhaohui_site, "sim-site": sim_site}
        # Grant Django model permissions to staff roles so SiteScopedAdminMixin governs strictly per-site
        all_app_models = ContentType.objects.filter(app_label__in=["core", "monitoring", "publishing"])
        all_perms = list(Permission.objects.filter(content_type__in=all_app_models))

        admin_user = None
        for username, password, is_staff, is_super, site_slug, role in TEST_ACCOUNTS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"is_staff": is_staff, "is_superuser": is_super, "is_active": True},
            )
            user.is_staff = is_staff
            user.is_superuser = is_super
            user.is_active = True
            user.set_password(password)
            user.save()
            if is_staff and not is_super:
                user.user_permissions.set(all_perms)
            if site_slug and role:
                SiteMembership.objects.update_or_create(
                    user=user,
                    site=site_map[site_slug],
                    defaults={"role": role},
                )
            if username == "platform_admin":
                admin_user = user

        # 7. Ensure initial baseline approved snapshot exists for each site
        for s in (zhaohui_site, sim_site):
            if not s.snapshots.exists():
                payload = build_snapshot_payload(s)
                checksum = ContentSnapshot.compute_checksum(payload)
                ContentSnapshot.objects.create(
                    site=s,
                    version=f"v{now:%Y%m%d}-001",
                    status=ContentSnapshot.STATUS_APPROVED,
                    payload=payload,
                    checksum=checksum,
                    note="首次从现有代码导入基线内容快照",
                    created_by=admin_user,
                    approved_by=admin_user,
                    approved_at=now,
                )

        AuditLog.objects.create(
            actor=admin_user,
            actor_username="platform_admin",
            site=None,
            action="system.seed_test_env",
            target_type="environment",
            target_id="local-test-env",
            summary="完成测试环境站点、域名、受管内容与角色账号初始化",
            metadata={"sites": ["zhaohui", "sim-site"], "domains": ["jszhff.cn", "zhaohuifangfu.com", "sim-site.localhost"]},
        )

        self.stdout.write(self.style.SUCCESS("已成功初始化多站点隔离测试环境（兆辉双域名 + 模拟独立站点 + 7个测试账号）。"))
