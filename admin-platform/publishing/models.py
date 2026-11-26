import hashlib
import json
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from core.models import Domain, Site


class ApprovedAsset(models.Model):
    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="approved_assets",
    )
    code = models.CharField("素材编码", max_length=64)
    label = models.CharField("素材名称", max_length=120)
    image_path = models.CharField("已核准图片路径", max_length=255)
    image_alt = models.CharField("图片替代文本", max_length=255)
    is_approved = models.BooleanField("已核准可用", default=True)
    created_at = models.DateTimeField("登记时间", auto_now_add=True)

    class Meta:
        verbose_name = "已核准图片清单"
        verbose_name_plural = "已核准图片清单"
        unique_together = [("site", "image_path")]
        ordering = ["site_id", "code"]

    def __str__(self):
        return f"{self.label} ({self.image_path})"


class ManagedProduct(models.Model):
    """Strictly limited v1 managed fields: display_name, summary, approved_asset.
    Technical parameters, craft commitments, and structural diagrams stay in code review.
    """

    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="managed_products",
    )
    slug = models.SlugField("产品标识", max_length=64)
    display_order = models.PositiveSmallIntegerField("排序", default=1)
    display_name = models.CharField("产品展示名称", max_length=120)
    summary = models.TextField("产品简介")
    approved_asset = models.ForeignKey(
        ApprovedAsset,
        verbose_name="已核准主图",
        on_delete=models.PROTECT,
        related_name="products",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="最后编辑人",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        verbose_name = "受管产品内容"
        verbose_name_plural = "受管产品内容"
        unique_together = [("site", "slug")]
        ordering = ["site_id", "display_order", "id"]

    def __str__(self):
        return f"[{self.site.slug}] {self.display_name} ({self.slug})"

    def clean(self):
        if self.approved_asset_id and self.site_id:
            if self.approved_asset.site_id != self.site_id:
                raise ValidationError("只能选择所属站点的已核准图片。")
            if not self.approved_asset.is_approved:
                raise ValidationError("所选图片尚未通过核准，不可用于展示。")


class ManagedContact(models.Model):
    """Strictly limited v1 public contact info (no online inquiry inbox)."""

    site = models.OneToOneField(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="managed_contact",
    )
    phones_json = models.JSONField(
        "公开联系电话列表",
        default=list,
        help_text='格式：[{"display": "133-0617-0776", "href": "tel:13306170776"}]',
    )
    email_display = models.CharField("公开联系邮箱", max_length=120)
    email_href = models.CharField("邮箱链接", max_length=140)
    addresses_json = models.JSONField(
        "公开厂区地址列表",
        default=list,
        help_text='格式：[{"region": "江苏无锡", "address": "..."}]',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="最后编辑人",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        verbose_name = "公开联系方式"
        verbose_name_plural = "公开联系方式"

    def __str__(self):
        return f"{self.site.name} 公开联系方式"


class ContentSnapshot(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PREVIEWED = "previewed"
    STATUS_APPROVED = "approved"
    STATUS_PUBLISHED = "published"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "草稿"),
        (STATUS_PREVIEWED, "已预览"),
        (STATUS_APPROVED, "已审核"),
        (STATUS_PUBLISHED, "已发布"),
        (STATUS_REJECTED, "已退回"),
    ]

    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="snapshots",
    )
    version = models.CharField("快照版本", max_length=64)
    status = models.CharField("审核状态", max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    payload = models.JSONField("快照内容(JSON)")
    checksum = models.CharField("SHA-256 校验和", max_length=64)
    note = models.CharField("变更说明", max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="创建人",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_snapshots",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="审核人",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_snapshots",
    )
    approved_at = models.DateTimeField("审核时间", null=True, blank=True)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)

    class Meta:
        verbose_name = "内容快照版本"
        verbose_name_plural = "内容快照版本"
        unique_together = [("site", "version")]
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.site.slug}@{self.version} ({self.get_status_display()})"

    @staticmethod
    def compute_checksum(payload: dict) -> str:
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class ReleaseRecord(models.Model):
    BUILD_PREVIEW = "preview"
    BUILD_RELEASE = "release"
    BUILD_ROLLBACK = "rollback"
    BUILD_TYPE_CHOICES = [
        (BUILD_PREVIEW, "预览构建"),
        (BUILD_RELEASE, "正式发布"),
        (BUILD_ROLLBACK, "版本回滚"),
    ]

    STATUS_BUILDING = "building"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_BUILDING, "构建中"),
        (STATUS_SUCCEEDED, "成功"),
        (STATUS_FAILED, "失败（保留旧版）"),
    ]

    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="releases",
    )
    domain = models.ForeignKey(
        Domain,
        verbose_name="目标域名",
        on_delete=models.CASCADE,
        related_name="releases",
    )
    snapshot = models.ForeignKey(
        ContentSnapshot,
        verbose_name="内容快照",
        on_delete=models.PROTECT,
        related_name="releases",
    )
    release_version = models.CharField("发布版本号", max_length=80)
    build_type = models.CharField("构建类型", max_length=16, choices=BUILD_TYPE_CHOICES)
    status = models.CharField("状态", max_length=16, choices=STATUS_CHOICES, default=STATUS_BUILDING)
    artifact_dir = models.CharField("静态产物目录", max_length=512, blank=True)
    smoke_check_passed = models.BooleanField("冒烟验证通过", default=False)
    smoke_check_report = models.JSONField("冒烟验证报告", default=dict, blank=True)
    error_message = models.TextField("失败原因", blank=True)
    is_current = models.BooleanField("当前生效版本", default=False)
    rolled_back_from = models.ForeignKey(
        "self",
        verbose_name="回滚前版本",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="操作人",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField("开始时间", auto_now_add=True)
    finished_at = models.DateTimeField("完成时间", null=True, blank=True)

    class Meta:
        verbose_name = "发布与回滚记录"
        verbose_name_plural = "发布与回滚记录"
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.domain.official_domain} {self.release_version} [{self.get_build_type_display()}/{self.get_status_display()}]"
