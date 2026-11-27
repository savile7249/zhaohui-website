from django.urls import path
from . import views

app_name = "publishing"

urlpatterns = [
    path("<slug:site_slug>/", views.content_studio, name="studio"),
    path("<slug:site_slug>/dev-sync/", views.dev_sync_workspace_view, name="dev_sync"),
    path("<slug:site_slug>/assets/", views.asset_library, name="assets"),
    path("<slug:site_slug>/assets/upload/", views.upload_asset_view, name="upload_asset"),
    path("<slug:site_slug>/media/<path:rel_path>", views.serve_site_image, name="serve_image"),
    path("<slug:site_slug>/variants/", views.variant_list, name="variants"),
    path("<slug:site_slug>/variants/create/", views.create_variant_view, name="create_variant"),
    path("<slug:site_slug>/variants/<int:variant_id>/edit/", views.variant_edit, name="variant_edit"),
    path("<slug:site_slug>/variants/<int:variant_id>/import-specs/", views.import_variant_specs, name="import_variant_specs"),
    path("<slug:site_slug>/variants/<int:variant_id>/articles/", views.article_list, name="articles"),
    path("<slug:site_slug>/variants/<int:variant_id>/articles/create/", views.create_article_view, name="create_article"),
    path(
        "<slug:site_slug>/variants/<int:variant_id>/articles/<int:article_id>/edit/",
        views.article_edit,
        name="article_edit",
    ),
    path(
        "<slug:site_slug>/variants/<int:variant_id>/articles/<int:article_id>/delete/",
        views.delete_article_view,
        name="delete_article",
    ),
    path("<slug:site_slug>/products/<int:product_id>/save/", views.update_product_draft, name="save_product"),
    path("<slug:site_slug>/contact/save/", views.update_contact_draft, name="save_contact"),
    path("<slug:site_slug>/snapshots/create/", views.create_snapshot_view, name="create_snapshot"),
    path("<slug:site_slug>/snapshots/<int:snapshot_id>/preview/", views.trigger_preview_view, name="preview_snapshot"),
    path("<slug:site_slug>/snapshots/<int:snapshot_id>/approve/", views.approve_snapshot_view, name="approve_snapshot"),
    path("<slug:site_slug>/snapshots/<int:snapshot_id>/publish/", views.publish_snapshot_view, name="publish_snapshot"),
    path("<slug:site_slug>/releases/<int:release_id>/rollback/", views.rollback_release_view, name="rollback_release"),
    path("api/<slug:site_slug>/products/", views.api_site_products, name="api_products"),
]
