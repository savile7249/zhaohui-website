from django.db import models
from core.models import Domain, Site


class PageEvent(models.Model):
    EVENT_PAGE_VIEW = "page_view"
    EVENT_BRIEF_COPY_SUCCESS = "brief_copy_success"
    EVENT_PHONE_CLICK = "phone_click"
    EVENT_EMAIL_CLICK = "email_click"

    EVENT_TYPE_CHOICES = [
        (EVENT_PAGE_VIEW, "页面浏览"),
        (EVENT_BRIEF_COPY_SUCCESS, "简报复制成功"),
        (EVENT_PHONE_CLICK, "点击电话"),
        (EVENT_EMAIL_CLICK, "点击邮箱"),
    ]

    ALLOWED_EVENT_TYPES = {
        EVENT_PAGE_VIEW,
        EVENT_BRIEF_COPY_SUCCESS,
        EVENT_PHONE_CLICK,
        EVENT_EMAIL_CLICK,
    }

    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="page_events",
    )
    domain = models.ForeignKey(
        Domain,
        verbose_name="归属域名",
        on_delete=models.CASCADE,
        related_name="page_events",
    )
    event_type = models.CharField("事件类型", max_length=32, choices=EVENT_TYPE_CHOICES, db_index=True)
    page_path = models.CharField("标准页面路径", max_length=255, db_index=True)
    product_category = models.CharField("产品类别", max_length=64, blank=True, db_index=True)
    is_spa_navigation = models.BooleanField("单页导航切换", default=False)
    gateway_id = models.CharField("可信网关标识", max_length=64)
    occurred_at = models.DateTimeField("发生时间", db_index=True)

    class Meta:
        verbose_name = "匿名页面事件"
        verbose_name_plural = "匿名页面事件"
        ordering = ["-occurred_at", "-id"]
        indexes = [
            models.Index(fields=["site", "occurred_at"]),
            models.Index(fields=["domain", "event_type", "occurred_at"]),
        ]

    def __str__(self):
        return f"{self.domain.official_domain} {self.event_type} {self.page_path}"


class GatewayMetricBucket(models.Model):
    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="gateway_metrics",
    )
    domain = models.ForeignKey(
        Domain,
        verbose_name="归属域名",
        on_delete=models.CASCADE,
        related_name="gateway_metrics",
    )
    gateway_id = models.CharField("网关标识", max_length=64)
    bucket_start = models.DateTimeField("统计分钟窗口", db_index=True)
    total_requests = models.PositiveIntegerField("总请求数", default=0)
    html_requests = models.PositiveIntegerField("页面文档请求数", default=0)
    static_asset_requests = models.PositiveIntegerField("静态资源请求数", default=0)
    status_2xx = models.PositiveIntegerField("2xx 响应数", default=0)
    status_4xx = models.PositiveIntegerField("4xx 响应数", default=0)
    status_5xx = models.PositiveIntegerField("5xx 响应数", default=0)
    latency_sum_ms = models.FloatField("耗时总和(ms)", default=0.0)
    latency_count = models.PositiveIntegerField("耗时样本数", default=0)
    max_latency_ms = models.FloatField("最大耗时(ms)", default=0.0)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        verbose_name = "网关请求汇总"
        verbose_name_plural = "网关请求汇总"
        unique_together = [("domain", "gateway_id", "bucket_start")]
        ordering = ["-bucket_start", "-id"]

    @property
    def avg_latency_ms(self) -> float:
        if not self.latency_count:
            return 0.0
        return round(self.latency_sum_ms / self.latency_count, 2)


class ProbeResult(models.Model):
    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="probe_results",
    )
    domain = models.ForeignKey(
        Domain,
        verbose_name="探测域名",
        on_delete=models.CASCADE,
        related_name="probe_results",
    )
    probe_url = models.CharField("探测地址", max_length=255)
    checked_at = models.DateTimeField("探测时间", db_index=True)
    is_success = models.BooleanField("探测成功", default=False)
    http_status = models.IntegerField("HTTP 状态码", null=True, blank=True)
    response_time_ms = models.FloatField("响应耗时(ms)", null=True, blank=True)
    tls_valid = models.BooleanField("TLS 证书有效", default=False)
    cert_not_after = models.DateTimeField("证书到期时间", null=True, blank=True)
    cert_days_remaining = models.IntegerField("证书剩余天数", null=True, blank=True)
    cert_warning = models.BooleanField("证书临期告警", default=False)
    content_marker_ok = models.BooleanField("首页内容标记正常", default=False)
    error_code = models.CharField("错误编码", max_length=64, blank=True)
    error_detail = models.TextField("错误说明", blank=True)

    class Meta:
        verbose_name = "外部探测记录"
        verbose_name_plural = "外部探测记录"
        ordering = ["-checked_at", "-id"]
        indexes = [
            models.Index(fields=["domain", "checked_at"]),
        ]

    def __str__(self):
        status = "正常" if self.is_success else f"异常({self.error_code})"
        return f"{self.domain.official_domain} [{status}] @ {self.checked_at:%Y-%m-%d %H:%M:%S}"


class AlertEvent(models.Model):
    TYPE_HOME_ERROR = "home_error"
    TYPE_TLS_EXPIRING = "tls_expiring"
    TYPE_TLS_ERROR = "tls_error"
    TYPE_COLLECTION_INTERRUPTED = "collection_interrupted"
    ALERT_TYPE_CHOICES = [
        (TYPE_HOME_ERROR, "首页访问或内容异常"),
        (TYPE_TLS_EXPIRING, "TLS 证书临期告警"),
        (TYPE_TLS_ERROR, "TLS 握手或证书异常"),
        (TYPE_COLLECTION_INTERRUPTED, "采集数据中断"),
    ]

    STATUS_OPEN = "open"
    STATUS_RESOLVED = "resolved"
    STATUS_CHOICES = [
        (STATUS_OPEN, "告警中"),
        (STATUS_RESOLVED, "已恢复"),
    ]

    SEVERITY_CRITICAL = "critical"
    SEVERITY_WARNING = "warning"
    SEVERITY_CHOICES = [
        (SEVERITY_CRITICAL, "严重"),
        (SEVERITY_WARNING, "预警"),
    ]

    site = models.ForeignKey(
        Site,
        verbose_name="归属站点",
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    domain = models.ForeignKey(
        Domain,
        verbose_name="关联域名",
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    alert_type = models.CharField("告警类型", max_length=32, choices=ALERT_TYPE_CHOICES, db_index=True)
    status = models.CharField("状态", max_length=16, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True)
    severity = models.CharField("级别", max_length=16, choices=SEVERITY_CHOICES, default=SEVERITY_WARNING)
    message = models.TextField("告警详情")
    last_success_at = models.DateTimeField("最后一次成功时间", null=True, blank=True)
    opened_at = models.DateTimeField("触发时间", auto_now_add=True)
    resolved_at = models.DateTimeField("恢复时间", null=True, blank=True)

    class Meta:
        verbose_name = "故障与恢复记录"
        verbose_name_plural = "故障与恢复记录"
        ordering = ["-opened_at", "-id"]

    def __str__(self):
        return f"[{self.get_status_display()}] {self.domain.official_domain} {self.get_alert_type_display()}"
