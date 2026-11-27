import os
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from core.models import AuditLog, Domain, Site, SiteMembership
from core.management.commands.seed_test_env import (
    _extract_zhaohui_contact_from_code,
    _extract_zhaohui_icp_from_code,
    _extract_zhaohui_products_from_code,
)
from publishing.catalog_seed import seed_zhaohui_catalog_from_repo
from publishing.models import ApprovedAsset, ContentSnapshot, ManagedContact, ManagedProduct
from publishing.pipeline import build_snapshot_payload

User = get_user_model()


class Command(BaseCommand):
    help = (
        "初始化本地开发内容工作台（SQLite / MariaDB 通用）：自动导入 4 大类设备、13 款子产品规格种类与合规种子文章，"
        "并创建本地开发管理员账号，便于直接启动后台体验上传、修改与热同步。"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--admin-user",
            type=str,
            default=os.environ.get("ZHAOHUI_LOCAL_ADMIN_USER", "local_admin"),
        )
        parser.add_argument(
            "--admin-password",
            type=str,
            default=os.environ.get("ZHAOHUI_LOCAL_ADMIN_PASSWORD", "Zh@Local2026!#88"),
        )

    def handle(self, *args, **options):
        if getattr(settings, "IS_PRODUCTION", False):
            raise CommandError("init_local_cms 仅限本地开发环境使用，生产环境请使用 init_prod_pilot。")

        now = timezone.now()
        zhaohui_icp = _extract_zhaohui_icp_from_code()

        site, _ = Site.objects.update_or_create(
            slug="zhaohui",
            defaults={
                "name": "兆辉官网（本地开发）",
                "brand_name": "兆辉化工设备",
                "description": "本地内容工作台：支持子产品规格参数编辑、关联文章上传与一键热同步至本地 Next.js 工作区。",
                "adapter_type": Site.ADAPTER_NEXTJS_ZHAOHUI,
                "online_inquiry_enabled": False,
            },
        )

        Domain.objects.update_or_create(
            official_domain="jszhff.cn",
            defaults={
                "site": site,
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

        zh_products = _extract_zhaohui_products_from_code()
        zh_contact = _extract_zhaohui_contact_from_code()
        for item in zh_products:
            asset, _ = ApprovedAsset.objects.update_or_create(
                site=site,
                image_path=item["image"],
                defaults={
                    "code": f"product-{item['slug']}",
                    "label": f"{item['title']}主图（已核准）",
                    "image_alt": item["imageAlt"],
                    "is_approved": True,
                },
            )
            ManagedProduct.objects.get_or_create(
                site=site,
                slug=item["slug"],
                defaults={
                    "display_order": item["order"],
                    "display_name": item["title"],
                    "summary": item["summary"],
                    "approved_asset": asset,
                },
            )

        ManagedContact.objects.get_or_create(
            site=site,
            defaults={
                "phones_json": zh_contact["phones"],
                "email_display": zh_contact["email_display"],
                "email_href": zh_contact["email_href"],
                "addresses_json": zh_contact["addresses"],
            },
        )

        seed_stats = seed_zhaohui_catalog_from_repo(site)

        username = options["admin_user"].strip()
        password = options["admin_password"].strip()
        admin_user, _ = User.objects.get_or_create(
            username=username,
            defaults={"is_staff": True, "is_superuser": True, "is_active": True},
        )
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True
        admin_user.set_password(password)
        admin_user.save()

        SiteMembership.objects.update_or_create(
            user=admin_user,
            site=site,
            defaults={"role": SiteMembership.ROLE_ADMIN},
        )

        if not site.snapshots.exists():
            payload = build_snapshot_payload(site)
            checksum = ContentSnapshot.compute_checksum(payload)
            ContentSnapshot.objects.create(
                site=site,
                version=f"v{now:%Y%m%d}-001",
                status=ContentSnapshot.STATUS_APPROVED,
                payload=payload,
                checksum=checksum,
                note="本地开发工作台初始基线快照（含子产品规格种类与种子文章）",
                created_by=admin_user,
                approved_by=admin_user,
                approved_at=now,
            )

        AuditLog.objects.create(
            actor=admin_user,
            actor_username=username,
            site=site,
            action="system.init_local_cms",
            target_type="site",
            target_id="zhaohui",
            summary=f"初始化本地开发内容工作台（子产品 +{seed_stats['variants_created']}，文章 +{seed_stats['articles_created']}）",
            metadata=seed_stats,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"本地开发内容工作台初始化完成：共 {site.managed_variants.count()} 款子产品、"
                f"{site.managed_articles.count()} 篇关联文章、{site.approved_assets.count()} 项核准图片。\n"
                f"本地登录账号：{username} / {password}\n"
                "内容工作台入口：http://127.0.0.1:18000/publishing/zhaohui/variants/"
            )
        )
