from django.urls import path
from . import views

app_name = "publishing"

urlpatterns = [
    path("<slug:site_slug>/", views.content_studio, name="studio"),
    path("<slug:site_slug>/products/<int:product_id>/save/", views.update_product_draft, name="save_product"),
    path("<slug:site_slug>/contact/save/", views.update_contact_draft, name="save_contact"),
    path("<slug:site_slug>/snapshots/create/", views.create_snapshot_view, name="create_snapshot"),
    path("<slug:site_slug>/snapshots/<int:snapshot_id>/preview/", views.trigger_preview_view, name="preview_snapshot"),
    path("<slug:site_slug>/snapshots/<int:snapshot_id>/approve/", views.approve_snapshot_view, name="approve_snapshot"),
    path("<slug:site_slug>/snapshots/<int:snapshot_id>/publish/", views.publish_snapshot_view, name="publish_snapshot"),
    path("<slug:site_slug>/releases/<int:release_id>/rollback/", views.rollback_release_view, name="rollback_release"),
    path("api/<slug:site_slug>/products/", views.api_site_products, name="api_products"),
]
