import re
from django.conf import settings
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0001_initial"),
        ("publishing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="approvedasset",
            name="file_size",
            field=models.PositiveIntegerField(default=0, verbose_name="文件大小(字节)"),
        ),
        migrations.AddField(
            model_name="approvedasset",
            name="height",
            field=models.PositiveIntegerField(default=0, verbose_name="图片高度"),
        ),
        migrations.AddField(
            model_name="approvedasset",
            name="uploaded_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="uploaded_assets",
                to=settings.AUTH_USER_MODEL,
                verbose_name="上传人",
            ),
        ),
        migrations.AddField(
            model_name="approvedasset",
            name="width",
            field=models.PositiveIntegerField(default=0, verbose_name="图片宽度"),
        ),
        migrations.CreateModel(
            name="ManagedProductVariant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "category_slug",
                    models.CharField(
                        choices=[
                            ("tanks", "储罐"),
                            ("reactors", "反应釜"),
                            ("towers", "塔器"),
                            ("piping", "管道与管件"),
                        ],
                        max_length=32,
                        verbose_name="设备大类",
                    ),
                ),
                (
                    "variant_slug",
                    models.CharField(
                        max_length=64,
                        validators=[
                            django.core.validators.RegexValidator(
                                message="子产品路径标识只能包含小写字母、数字、连字符或下划线，且以字母或数字开头。",
                                regex=re.compile("^[a-z0-9][a-z0-9_-]{0,63}$"),
                            )
                        ],
                        verbose_name="子产品路径标识",
                    ),
                ),
                ("display_order", models.PositiveSmallIntegerField(default=1, verbose_name="排序")),
                ("title", models.CharField(max_length=120, verbose_name="子产品名称")),
                ("craft_tag", models.CharField(default="板衬工艺", max_length=64, verbose_name="工艺/结构标签")),
                ("summary", models.TextField(verbose_name="产品概述")),
                ("seo_title", models.CharField(blank=True, max_length=180, verbose_name="SEO 标题")),
                ("seo_description", models.TextField(blank=True, verbose_name="SEO 摘要")),
                (
                    "specs_json",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text='格式：[{"group":"基本规格","label":"公称容积","value":"","unit":"m³","note":"..."}]',
                        verbose_name="标准化规格表(JSON)",
                    ),
                ),
                ("confirm_inputs_json", models.JSONField(blank=True, default=list, verbose_name="选型确认条件列表(JSON)")),
                ("is_published", models.BooleanField(default=True, verbose_name="参与前台构建与发布")),
                (
                    "redline_confirmed",
                    models.BooleanField(default=False, verbose_name="已经技术负责人审核确认（含数值/牌号警告时）"),
                ),
                ("redline_review_note", models.CharField(blank=True, max_length=255, verbose_name="技术审核备注")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                (
                    "gallery_assets",
                    models.ManyToManyField(
                        blank=True,
                        related_name="variant_gallery_set",
                        to="publishing.approvedasset",
                        verbose_name="附加实拍图",
                    ),
                ),
                (
                    "hero_asset",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="variant_hero_set",
                        to="publishing.approvedasset",
                        verbose_name="已核准主图",
                    ),
                ),
                (
                    "site",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="managed_variants",
                        to="core.site",
                        verbose_name="归属站点",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_variants",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="最后编辑人",
                    ),
                ),
            ],
            options={
                "verbose_name": "子产品与规格参数",
                "verbose_name_plural": "子产品与规格参数",
                "ordering": ["site_id", "category_slug", "display_order", "id"],
                "unique_together": {("site", "category_slug", "variant_slug")},
            },
        ),
        migrations.CreateModel(
            name="ManagedProductArticle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "article_slug",
                    models.CharField(
                        max_length=96,
                        validators=[
                            django.core.validators.RegexValidator(
                                message="文章路径标识必须以 article_ 开头，后接小写字母、数字、连字符或下划线。",
                                regex=re.compile("^article_[a-z0-9][a-z0-9_-]{0,95}$"),
                            )
                        ],
                        verbose_name="文章路径标识(article_开头)",
                    ),
                ),
                ("title", models.CharField(max_length=200, verbose_name="文章标题")),
                ("summary", models.TextField(verbose_name="文章摘要")),
                ("seo_title", models.CharField(blank=True, max_length=200, verbose_name="SEO 标题")),
                ("seo_description", models.TextField(blank=True, verbose_name="SEO 摘要")),
                ("body_markdown", models.TextField(verbose_name="Markdown 正文")),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "草稿（不参与上线）"), ("published", "已发布")],
                        default="draft",
                        max_length=20,
                        verbose_name="发布状态",
                    ),
                ),
                ("published_at", models.DateField(default=django.utils.timezone.localdate, verbose_name="发布日期")),
                (
                    "redline_confirmed",
                    models.BooleanField(default=False, verbose_name="已经技术负责人审核确认（含数值/牌号警告时）"),
                ),
                ("redline_review_note", models.CharField(blank=True, max_length=255, verbose_name="技术审核备注")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                (
                    "cover_asset",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="article_cover_set",
                        to="publishing.approvedasset",
                        verbose_name="文章配图（可选）",
                    ),
                ),
                (
                    "site",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="managed_articles",
                        to="core.site",
                        verbose_name="归属站点",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_articles",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="最后编辑人",
                    ),
                ),
                (
                    "variant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="articles",
                        to="publishing.managedproductvariant",
                        verbose_name="所属子产品",
                    ),
                ),
            ],
            options={
                "verbose_name": "产品关联技术文章",
                "verbose_name_plural": "产品关联技术文章",
                "ordering": ["-published_at", "article_slug"],
                "unique_together": {("variant", "article_slug")},
            },
        ),
    ]
