import os
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from core.models import AuditLog, Domain, GatewayCredential, Site
from core.management.commands.seed_test_env import (
    _extract_zhaohui_contact_from_code,
    _extract_zhaohui_icp_from_code,
    _extract_zhaohui_products_from_code,
)
from publishing.catalog_seed import seed_zhaohui_catalog_from_repo
from publishing.models import ApprovedAsset, ContentSnapshot, ManagedContact, ManagedProduct
from publishing.pipeline import build_snapshot_payload


class Command(BaseCommand):
    help = (
        "初始化首个生产试点（jszhff.cn）站点、域名、受管产品/联系基线与可信网关凭据。"
        "绝不创建测试账号或模拟站点，zhaohuifangfu.com 保持「待备案」且公网关闭。"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--gateway-id",
            type=str,
            default=os.environ.get("ZHAOHUI_GATEWAY_ID", "prod-zhaohui-nginx-01"),
            help="生产可信网关标识，默认 prod-zhaohui-nginx-01",
        )
        parser.add_argument(
            "--gateway-secret",
            type=str,
            default=os.environ.get("ZHAOHUI_GATEWAY_SECRET", ""),
            help="生产网关 HMAC 共享密钥（建议通过环境变量 ZHAOHUI_GATEWAY_SECRET 传入，≥32字符）",
        )
        parser.add_argument(
            "--skip-pending-domain",
            action="store_true",
            help="跳过登记待备案域名 zhaohuifangfu.com（默认登记为 pending_icp 且公网关闭）",
        )

    def handle(self, *args, **options):
        gw_id = (options["gateway_id"] or "").strip()
        gw_secret = (options["gateway_secret"] or "").strip()
        if not gw_id:
            raise CommandError("必须提供 --gateway-id 或 ZHAOHUI_GATEWAY_ID。")
        if (
            not gw_secret
            or gw_secret == settings.DEFAULT_TEST_GATEWAY_SECRET
            or len(gw_secret) < 32
        ):
            raise CommandError(
                "生产初始化必须提供独立且长度 ≥ 32 的 ZHAOHUI_GATEWAY_SECRET，严禁使用测试默认密钥。"
            )

        now = timezone.now()
        zhaohui_icp = _extract_zhaohui_icp_from_code()

        # 1. Production site: zhaohui only (online_inquiry_enabled strictly False)
        zhaohui_site, _ = Site.objects.update_or_create(
            slug="zhaohui",
            defaults={
                "name": "兆辉官网",
                "brand_name": "兆辉化工设备",
                "description": "江苏兆辉防腐科技有限公司官网，首版受管字段仅限产品展示名称、简介、已核准图片与公开联系方式。",
                "adapter_type": Site.ADAPTER_NEXTJS_ZHAOHUI,
                "online_inquiry_enabled": False,
            },
        )

        # 2. Primary pilot domain: jszhff.cn
        Domain.objects.update_or_create(
            official_domain="jszhff.cn",
            defaults={
                "site": zhaohui_site,
                "test_host": "jszhff.cn",
                "preview_host": "preview.jszhff.cn",
                "is_primary": True,
                "icp_number": zhaohui_icp,
                "domain_status": Domain.STATUS_ACTIVE,
                "public_enabled": True,
                "canonical_policy": Domain.CANONICAL_PRIMARY,
                "collection_status": Domain.COLLECTION_ACTIVE,
                "expected_home_marker": "兆辉化工设备",
            },
        )

        # Optional offline record for pending ICP domain (STRICTLY public_enabled=False)
        if not options["skip_pending_domain"]:
            Domain.objects.update_or_create(
                official_domain="zhaohuifangfu.com",
                defaults={
                    "site": zhaohui_site,
                    "test_host": "zhaohuifangfu.com",
                    "preview_host": "preview.zhaohuifangfu.com",
                    "is_primary": False,
                    "icp_number": "待备案（暂未启用）",
                    "domain_status": Domain.STATUS_PENDING_ICP,
                    "public_enabled": False,
                    "canonical_policy": Domain.CANONICAL_PRIMARY,
                    "collection_status": Domain.COLLECTION_PENDING_ICP,
                    "collection_started_at": None,
                    "expected_home_marker": "兆辉化工设备",
                },
            )

        # 3. Trusted Gateway Credential
        GatewayCredential.objects.update_or_create(
            gateway_id=gw_id,
            defaults={
                "name": "兆辉源站 Nginx 可信接入网关（本机回环）",
                "shared_secret": gw_secret,
                "site": zhaohui_site,
                "is_active": True,
            },
        )

        # 4. Import approved products, assets, and public contacts from repo code
        zh_products = _extract_zhaohui_products_from_code()
        zh_contact = _extract_zhaohui_contact_from_code()

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

        # 5. Baseline approved snapshot if none exists
        if not zhaohui_site.snapshots.exists():
            payload = build_snapshot_payload(zhaohui_site)
            checksum = ContentSnapshot.compute_checksum(payload)
            ContentSnapshot.objects.create(
                site=zhaohui_site,
                version=f"v{now:%Y%m%d}-001",
                status=ContentSnapshot.STATUS_APPROVED,
                payload=payload,
                checksum=checksum,
                note="生产试点初始化基线快照（同步自当前代码仓库）",
                approved_at=now,
            )

        AuditLog.objects.create(
            actor=None,
            actor_username="system",
            site=zhaohui_site,
            action="system.init_prod_pilot",
            target_type="site",
            target_id="zhaohui",
            summary="完成生产试点（jszhff.cn）基线初始化；未创建测试账号，未启用 zhaohuifangfu.com 公网与线上收件",
            metadata={
                "primary_domain": "jszhff.cn",
                "gateway_id": gw_id,
                "pending_domain_registered": not options["skip_pending_domain"],
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"生产试点初始化完成：站点 zhaohui，主域 jszhff.cn（{zhaohui_icp}），网关 {gw_id}。"
                "请继续交互式创建您的管理员与发布者账号（manage.py createsuperuser）。"
            )
        )
