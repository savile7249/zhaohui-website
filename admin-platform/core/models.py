import hashlib
import hmac
import secrets
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Site(models.Model):
    ADAPTER_NEXTJS_ZHAOHUI = "nextjs_zhaohui"
    ADAPTER_STATIC_SIM = "static_sim"
    ADAPTER_CHOICES = [
        (ADAPTER_NEXTJS_ZHAOHUI, "Next.js 静态导出（兆辉官网）"),
        (ADAPTER_STATIC_SIM, "独立静态站点适配器（模拟站点）"),
    ]

    slug = models.SlugField("站点标识", max_length=64, unique=True)
    name = models.CharField("站点名称", max_length=120)
    brand_name = models.CharField("品牌名称", max_length=120)
    description = models.TextField("站点说明", blank=True)
    adapter_type = models.CharField(
        "发布适配器",
        max_length=32,
        choices=ADAPTER_CHOICES,
        default=ADAPTER_NEXTJS_ZHAOHUI,
    )
    online_inquiry_enabled = models.BooleanField(
        "是否启用线上收件",
        default=False,
        help_text="首版固定关闭，总览页展示「未启用线上收件」。",
    )
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        verbose_name = "业务站点"
        verbose_name_plural = "业务站点"
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def clean(self):
        if self.online_inquiry_enabled:
            raise ValidationError("首版未批准启用线上询盘收件功能，必须保持关闭。")

    def get_primary_domain(self):
        return self.domains.filter(is_primary=True).first() or self.domains.first()


class Domain(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_PENDING_ICP = "pending_icp"
    STATUS_NOT_ONBOARDED = "not_onboarded"
    STATUS_DISABLED = "disabled"
    DOMAIN_STATUS_CHOICES = [
        (STATUS_ACTIVE, "已启用"),
        (STATUS_PENDING_ICP, "待备案"),
        (STATUS_NOT_ONBOARDED, "未接入"),
        (STATUS_DISABLED, "已停用"),
    ]

    CANONICAL_PRIMARY = "primary_domain"
    CANONICAL_SELF = "self_domain"
    CANONICAL_POLICY_CHOICES = [
        (CANONICAL_PRIMARY, "保留站点主域为规范网址"),
        (CANONICAL_SELF, "指向本域名自身"),
    ]

    COLLECTION_ACTIVE = "active"
    COLLECTION_PENDING_ICP = "pending_icp"
    COLLECTION_NOT_ONBOARDED = "not_onboarded"
    COLLECTION_INTERRUPTED = "interrupted"
    COLLECTION_STATUS_CHOICES = [
        (COLLECTION_ACTIVE, "正常采集"),
        (COLLECTION_PENDING_ICP, "待备案"),
        (COLLECTION_NOT_ONBOARDED, "未接入"),
        (COLLECTION_INTERRUPTED, "数据中断"),
    ]

    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="domains",
    )
    official_domain = models.CharField("正式域名", max_length=255, unique=True)
    test_host = models.CharField("本地测试主机名", max_length=255, unique=True)
    preview_host = models.CharField("本地预览主机名", max_length=255, unique=True)
    is_primary = models.BooleanField("是否主域", default=False)
    icp_number = models.CharField("备案号", max_length=128, blank=True)
    domain_status = models.CharField(
        "域名状态",
        max_length=24,
        choices=DOMAIN_STATUS_CHOICES,
        default=STATUS_NOT_ONBOARDED,
    )
    public_enabled = models.BooleanField(
        "公网是否启用",
        default=False,
        help_text="待备案域名必须保持公网关闭，仅做本地离线配置与预览验证。",
    )
    canonical_policy = models.CharField(
        "规范网址策略",
        max_length=24,
        choices=CANONICAL_POLICY_CHOICES,
        default=CANONICAL_PRIMARY,
    )
    collection_status = models.CharField(
        "采集状态",
        max_length=24,
        choices=COLLECTION_STATUS_CHOICES,
        default=COLLECTION_NOT_ONBOARDED,
    )
    collection_started_at = models.DateTimeField("采集开始时间", null=True, blank=True)
    last_event_at = models.DateTimeField("最近页面事件时间", null=True, blank=True)
    last_gateway_heartbeat_at = models.DateTimeField("最近网关心跳时间", null=True, blank=True)
    expected_home_marker = models.CharField(
        "首页内容核验标记",
        max_length=120,
        default="兆辉化工设备",
    )
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        verbose_name = "站点域名"
        verbose_name_plural = "站点域名"
        ordering = ["site_id", "-is_primary", "id"]

    def __str__(self):
        return f"{self.official_domain} -> {self.site.name}"

    def clean(self):
        if self.domain_status == self.STATUS_PENDING_ICP and self.public_enabled:
            raise ValidationError("处于「待备案」状态的域名严禁开启公网访问。")

    def get_canonical_base(self) -> str:
        if self.canonical_policy == self.CANONICAL_PRIMARY:
            primary = self.site.get_primary_domain()
            if primary:
                return f"https://{primary.official_domain}"
        return f"https://{self.official_domain}"

    def get_test_http_url(self) -> str:
        return f"http://{self.test_host}:{settings.GATEWAY_HTTP_PORT}/"

    def get_test_https_url(self) -> str:
        return f"https://{self.test_host}:{settings.GATEWAY_HTTPS_PORT}/"

    def get_preview_http_url(self) -> str:
        return f"http://{self.preview_host}:{settings.GATEWAY_HTTP_PORT}/"

    def is_heartbeat_fresh(self, now=None) -> bool:
        if not self.last_gateway_heartbeat_at:
            return False
        now = now or timezone.now()
        delta = (now - self.last_gateway_heartbeat_at).total_seconds()
        return delta <= settings.GATEWAY_HEARTBEAT_STALE_SECONDS

    def classify_operational_state(self, window_page_views: int, latest_probe=None, now=None) -> dict:
        """Return unambiguous 4-state + normal operational classification."""
        now = now or timezone.now()
        if self.domain_status == self.STATUS_PENDING_ICP:
            return {
                "code": "pending_icp",
                "label": "待备案",
                "detail": "公网保持关闭，仅用于本地离线配置与预览验证，不计入正式访问统计。",
            }
        if self.domain_status == self.STATUS_NOT_ONBOARDED or self.collection_status == self.COLLECTION_NOT_ONBOARDED:
            return {
                "code": "not_onboarded",
                "label": "未接入",
                "detail": "尚未完成域名控制权校验与网关接入，未开始采集。",
            }
        if self.domain_status == self.STATUS_DISABLED:
            return {
                "code": "disabled",
                "label": "已停用",
                "detail": "域名已停用。",
            }
        if self.collection_status == self.COLLECTION_INTERRUPTED or not self.is_heartbeat_fresh(now=now):
            return {
                "code": "interrupted",
                "label": "数据中断",
                "detail": "网关上报或采集链路中断（未收到近期网关心跳或已标记中断），当前计数不可视作真实零访问。",
            }
        if latest_probe is not None and not latest_probe.is_success:
            return {
                "code": "fault",
                "label": "站点故障",
                "detail": latest_probe.error_detail or "外部探测异常，请并排核对页面事件、网关请求和外部探测。",
            }
        if window_page_views == 0:
            return {
                "code": "true_zero",
                "label": "真实零访问",
                "detail": "域名已启用、外部探测正常、网关心跳在线，选定时间范围内确无访客页面浏览。",
            }
        return {
            "code": "active_traffic",
            "label": "正常采集",
            "detail": "网关在线、外部探测正常，已收到有效页面浏览与请求汇总。",
        }


class SiteMembership(models.Model):
    ROLE_VIEWER = "viewer"
    ROLE_EDITOR = "editor"
    ROLE_PUBLISHER = "publisher"
    ROLE_ADMIN = "admin"
    ROLE_CHOICES = [
        (ROLE_VIEWER, "查看者（只读报表与汇总）"),
        (ROLE_EDITOR, "编辑（修改本站草稿与预览）"),
        (ROLE_PUBLISHER, "发布者（审核、发布与回滚）"),
        (ROLE_ADMIN, "管理员（域名、成员与权限配置）"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="用户",
        on_delete=models.CASCADE,
        related_name="site_memberships",
    )
    site = models.ForeignKey(
        Site,
        verbose_name="授权站点",
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField("角色", max_length=20, choices=ROLE_CHOICES)
    created_at = models.DateTimeField("授权时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        verbose_name = "站点成员与角色"
        verbose_name_plural = "站点成员与角色"
        unique_together = [("user", "site")]
        ordering = ["site_id", "user_id"]

    def __str__(self):
        return f"{self.user.username} @ {self.site.slug} ({self.role})"


class GatewayCredential(models.Model):
    gateway_id = models.CharField("网关标识", max_length=64, unique=True)
    name = models.CharField("网关名称", max_length=120)
    shared_secret = models.CharField("签名密钥", max_length=128)
    site = models.ForeignKey(
        Site,
        verbose_name="限定站点（留空为共享可信网关）",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="gateways",
    )
    is_active = models.BooleanField("启用", default=True)
    last_seen_at = models.DateTimeField("最近通信时间", null=True, blank=True)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)

    class Meta:
        verbose_name = "可信网关凭据"
        verbose_name_plural = "可信网关凭据"
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} ({self.gateway_id})"

    def save(self, *args, **kwargs):
        if not self.shared_secret:
            self.shared_secret = secrets.token_hex(32)
        super().save(*args, **kwargs)

    def sign_payload(self, timestamp: str, matched_domain: str, raw_body: bytes) -> str:
        body_hash = hashlib.sha256(raw_body).hexdigest()
        msg = f"{self.gateway_id}:{timestamp}:{matched_domain}:{body_hash}".encode("utf-8")
        return hmac.new(self.shared_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    def verify_signature(self, timestamp: str, matched_domain: str, raw_body: bytes, signature: str) -> bool:
        if not self.is_active or not signature:
            return False
        expected = self.sign_payload(timestamp, matched_domain, raw_body)
        return hmac.compare_digest(expected, signature.strip().lower())


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="操作人",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    actor_username = models.CharField("操作人账号", max_length=150, db_index=True)
    site = models.ForeignKey(
        Site,
        verbose_name="关联站点",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField("操作类型", max_length=64, db_index=True)
    target_type = models.CharField("目标类型", max_length=64)
    target_id = models.CharField("目标标识", max_length=128, blank=True)
    summary = models.CharField("操作摘要", max_length=255)
    metadata = models.JSONField("附加元数据", default=dict, blank=True)
    ip_address = models.CharField("来源地址", max_length=64, blank=True)
    created_at = models.DateTimeField("记录时间", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "审计日志"
        verbose_name_plural = "审计日志"
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M:%S}] {self.actor_username} {self.action} {self.target_type}:{self.target_id}"
