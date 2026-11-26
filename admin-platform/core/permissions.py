from django.core.exceptions import PermissionDenied
from .models import AuditLog, Site, SiteMembership

ROLE_LEVEL = {
    SiteMembership.ROLE_VIEWER: 1,
    SiteMembership.ROLE_EDITOR: 2,
    SiteMembership.ROLE_PUBLISHER: 3,
    SiteMembership.ROLE_ADMIN: 4,
}


def get_user_role(user, site: Site):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return SiteMembership.ROLE_ADMIN
    membership = SiteMembership.objects.filter(user=user, site=site).first()
    return membership.role if membership else None


def user_has_site_role(user, site: Site, min_role: str = SiteMembership.ROLE_VIEWER) -> bool:
    role = get_user_role(user, site)
    if not role:
        return False
    return ROLE_LEVEL.get(role, 0) >= ROLE_LEVEL.get(min_role, 99)


def require_site_role(user, site: Site, min_role: str = SiteMembership.ROLE_VIEWER) -> str:
    role = get_user_role(user, site)
    if not role or ROLE_LEVEL.get(role, 0) < ROLE_LEVEL.get(min_role, 99):
        raise PermissionDenied("您没有访问或操作该站点的权限。")
    return role


def get_user_sites(user, min_role: str = SiteMembership.ROLE_VIEWER):
    if not user or not user.is_authenticated:
        return Site.objects.none()
    if user.is_superuser:
        return Site.objects.all()
    min_level = ROLE_LEVEL.get(min_role, 1)
    allowed_roles = [r for r, lvl in ROLE_LEVEL.items() if lvl >= min_level]
    site_ids = SiteMembership.objects.filter(
        user=user,
        role__in=allowed_roles,
    ).values_list("site_id", flat=True)
    return Site.objects.filter(id__in=site_ids)


def get_client_ip(request) -> str:
    if request is None:
        return ""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return (request.META.get("REMOTE_ADDR") or "")[:64]


def record_audit(
    *,
    actor,
    action: str,
    target_type: str,
    target_id: str,
    summary: str,
    site: Site | None = None,
    metadata: dict | None = None,
    request=None,
) -> AuditLog:
    username = getattr(actor, "username", None) or "system"
    user_obj = actor if getattr(actor, "is_authenticated", False) else None
    return AuditLog.objects.create(
        actor=user_obj,
        actor_username=username,
        site=site,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        summary=summary[:255],
        metadata=metadata or {},
        ip_address=get_client_ip(request),
    )
