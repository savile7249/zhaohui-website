from django.apps import AppConfig


class PublishingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "publishing"
    verbose_name = "受管内容、预览与版本发布"
