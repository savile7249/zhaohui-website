from django.conf import settings
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include, path, re_path
from django.views.static import serve

admin.site.site_header = "兆辉多站点监测与管理后台"
admin.site.site_title = "兆辉管理后台"
admin.site.index_title = "站点、域名、权限与审计管理"

urlpatterns = [
    path("", lambda request: redirect("overview:dashboard")),
    path("admin/", admin.site.urls),
    path("api/ingest/", include("monitoring.urls")),
    path("publishing/", include("publishing.urls")),
    path("", include("overview.urls")),
    re_path(r"^static/(?P<path>.*)$", serve, {"document_root": settings.STATIC_ROOT}),
]
