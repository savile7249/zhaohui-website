from django.contrib import admin
from django.core.exceptions import PermissionDenied
from .models import AuditLog, Domain, GatewayCredential, Site, SiteMembership
from .permissions import get_user_sites, record_audit, user_has_site_role


class SiteScopedAdminMixin:
    """Enforce strict site-level isolation across list, detail, change, delete in Django Admin."""

    site_field = "site"
    min_view_role = SiteMembership.ROLE_VIEWER
    min_change_role = SiteMembership.ROLE_ADMIN

    def _extract_site(self, obj):
        if obj is None:
            return None
        if isinstance(obj, Site):
            return obj
        return getattr(obj, self.site_field, None)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        allowed_sites = get_user_sites(request.user, min_role=self.min_view_role)
        if self.model is Site:
            return qs.filter(id__in=allowed_sites.values_list("id", flat=True))
        return qs.filter(**{f"{self.site_field}__in": allowed_sites})

    def get_object(self, request, object_id, from_field=None):
        obj = super().get_object(request, object_id, from_field=from_field)
        if obj is None and not request.user.is_superuser:
            # If the object exists in another site, return explicit 403 PermissionDenied
            if self.model._default_manager.filter(pk=object_id).exists():
                raise PermissionDenied("无权访问其他站点的对象详情。")
        return obj

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return get_user_sites(request.user, min_role=self.min_view_role).exists()

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is None:
            return get_user_sites(request.user, min_role=self.min_view_role).exists()
        site = self._extract_site(obj)
        return site is not None and user_has_site_role(request.user, site, min_role=self.min_view_role)

    def has_add_permission(self, request):
        if request.user.is_superuser:
            return True
        return get_user_sites(request.user, min_role=self.min_change_role).exists()

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is None:
            return get_user_sites(request.user, min_role=self.min_change_role).exists()
        site = self._extract_site(obj)
        return site is not None and user_has_site_role(request.user, site, min_role=self.min_change_role)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is None:
            return get_user_sites(request.user, min_role=SiteMembership.ROLE_ADMIN).exists()
        site = self._extract_site(obj)
        return site is not None and user_has_site_role(request.user, site, min_role=SiteMembership.ROLE_ADMIN)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "site" and not request.user.is_superuser:
            kwargs["queryset"] = get_user_sites(request.user, min_role=self.min_change_role)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        site = self._extract_site(obj)
        if not request.user.is_superuser:
            if site is None or not user_has_site_role(request.user, site, min_role=self.min_change_role):
                raise PermissionDenied("无权修改其他站点数据。")
        super().save_model(request, obj, form, change)
        model_label = self.model._meta.model_name
        record_audit(
            actor=request.user,
            action=f"{model_label}.{'update' if change else 'create'}",
            target_type=model_label,
            target_id=str(obj.pk),
            summary=f"{'更新' if change else '新增'} {self.model._meta.verbose_name}：{obj}",
            site=site,
            metadata={"changed_fields": list(form.changed_data)},
            request=request,
        )

    def delete_model(self, request, obj):
        site = self._extract_site(obj)
        if not request.user.is_superuser:
            if site is None or not user_has_site_role(request.user, site, min_role=SiteMembership.ROLE_ADMIN):
                raise PermissionDenied("无权删除其他站点数据。")
        target_id = str(obj.pk)
        obj_str = str(obj)
        super().delete_model(request, obj)
        model_label = self.model._meta.model_name
        record_audit(
            actor=request.user,
            action=f"{model_label}.delete",
            target_type=model_label,
            target_id=target_id,
            summary=f"删除 {self.model._meta.verbose_name}：{obj_str}",
            site=site,
            request=request,
        )


@admin.register(Site)
class SiteAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    list_display = ("name", "slug", "brand_name", "adapter_type", "online_inquiry_enabled", "updated_at")
    search_fields = ("name", "slug", "brand_name")
    readonly_fields = ("online_inquiry_enabled", "created_at", "updated_at")


@admin.register(Domain)
class DomainAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    list_display = (
        "official_domain",
        "site",
        "test_host",
        "is_primary",
        "domain_status",
        "public_enabled",
        "canonical_policy",
        "collection_status",
        "icp_number",
    )
    list_filter = ("site", "domain_status", "collection_status", "canonical_policy", "public_enabled")
    search_fields = ("official_domain", "test_host", "icp_number")
    readonly_fields = ("last_event_at", "last_gateway_heartbeat_at", "created_at", "updated_at")


@admin.register(SiteMembership)
class SiteMembershipAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    list_display = ("user", "site", "role", "updated_at")
    list_filter = ("site", "role")
    search_fields = ("user__username", "site__name", "site__slug")


@admin.register(GatewayCredential)
class GatewayCredentialAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    list_display = ("gateway_id", "name", "site", "is_active", "last_seen_at")
    list_filter = ("is_active", "site")
    readonly_fields = ("last_seen_at", "created_at")


@admin.register(AuditLog)
class AuditLogAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    list_display = ("created_at", "actor_username", "site", "action", "target_type", "target_id", "summary")
    list_filter = ("site", "action", "target_type")
    search_fields = ("actor_username", "action", "target_id", "summary")
    readonly_fields = (
        "actor",
        "actor_username",
        "site",
        "action",
        "target_type",
        "target_id",
        "summary",
        "metadata",
        "ip_address",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
