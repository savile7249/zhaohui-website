from django.contrib import admin
from core.admin import SiteScopedAdminMixin
from .models import AlertEvent, GatewayMetricBucket, PageEvent, ProbeResult


class ReadOnlyMonitoringAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PageEvent)
class PageEventAdmin(ReadOnlyMonitoringAdmin):
    list_display = ("occurred_at", "site", "domain", "event_type", "page_path", "product_category", "is_spa_navigation", "gateway_id")
    list_filter = ("site", "domain", "event_type", "product_category", "is_spa_navigation")
    search_fields = ("page_path", "product_category", "domain__official_domain")


@admin.register(GatewayMetricBucket)
class GatewayMetricBucketAdmin(ReadOnlyMonitoringAdmin):
    list_display = ("bucket_start", "site", "domain", "total_requests", "html_requests", "static_asset_requests", "status_4xx", "status_5xx", "max_latency_ms")
    list_filter = ("site", "domain", "gateway_id")


@admin.register(ProbeResult)
class ProbeResultAdmin(ReadOnlyMonitoringAdmin):
    list_display = ("checked_at", "site", "domain", "is_success", "http_status", "tls_valid", "cert_days_remaining", "cert_warning", "content_marker_ok", "error_code")
    list_filter = ("site", "domain", "is_success", "cert_warning", "error_code")


@admin.register(AlertEvent)
class AlertEventAdmin(ReadOnlyMonitoringAdmin):
    list_display = ("opened_at", "site", "domain", "alert_type", "severity", "status", "last_success_at", "resolved_at")
    list_filter = ("site", "domain", "alert_type", "status", "severity")
