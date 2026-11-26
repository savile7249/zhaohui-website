from django.urls import path
from . import views

app_name = "overview"

urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("overview/", views.dashboard_view, name="dashboard"),
    path("overview/export.<str:fmt>", views.export_overview_view, name="export"),
    path("api/sites/<slug:site_slug>/overview/", views.api_site_overview, name="api_overview"),
]
