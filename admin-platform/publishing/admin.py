from django.contrib import admin
from core.admin import SiteScopedAdminMixin
from core.models import SiteMembership
from core.permissions import get_user_sites
from .models import ApprovedAsset, ContentSnapshot, ManagedContact, ManagedProduct, ReleaseRecord


@admin.register(ApprovedAsset)
class ApprovedAssetAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    min_change_role = SiteMembership.ROLE_ADMIN
    list_display = ("site", "code", "label", "image_path", "is_approved", "created_at")
    list_filter = ("site", "is_approved")
    search_fields = ("code", "label", "image_path")


@admin.register(ManagedProduct)
class ManagedProductAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    min_change_role = SiteMembership.ROLE_EDITOR
    list_display = ("site", "display_order", "slug", "display_name", "approved_asset", "updated_by", "updated_at")
    list_filter = ("site",)
    search_fields = ("slug", "display_name", "summary")
    readonly_fields = ("slug", "updated_by", "updated_at")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "approved_asset" and not request.user.is_superuser:
            allowed = get_user_sites(request.user, min_role=SiteMembership.ROLE_EDITOR)
            kwargs["queryset"] = ApprovedAsset.objects.filter(site__in=allowed, is_approved=True)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ManagedContact)
class ManagedContactAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    min_change_role = SiteMembership.ROLE_EDITOR
    list_display = ("site", "email_display", "updated_by", "updated_at")
    readonly_fields = ("updated_by", "updated_at")

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ContentSnapshot)
class ContentSnapshotAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    min_change_role = SiteMembership.ROLE_PUBLISHER
    list_display = ("site", "version", "status", "checksum_short", "created_by", "approved_by", "created_at")
    list_filter = ("site", "status")
    readonly_fields = ("version", "payload", "checksum", "created_by", "approved_by", "approved_at", "created_at")

    @admin.display(description="校验和(前12位)")
    def checksum_short(self, obj):
        return obj.checksum[:12]


@admin.register(ReleaseRecord)
class ReleaseRecordAdmin(SiteScopedAdminMixin, admin.ModelAdmin):
    min_change_role = SiteMembership.ROLE_PUBLISHER
    list_display = (
        "created_at",
        "site",
        "domain",
        "release_version",
        "build_type",
        "status",
        "smoke_check_passed",
        "is_current",
        "triggered_by",
    )
    list_filter = ("site", "domain", "build_type", "status", "is_current")
    readonly_fields = (
        "site",
        "domain",
        "snapshot",
        "release_version",
        "build_type",
        "status",
        "artifact_dir",
        "smoke_check_passed",
        "smoke_check_report",
        "error_message",
        "is_current",
        "rolled_back_from",
        "triggered_by",
        "created_at",
        "finished_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
