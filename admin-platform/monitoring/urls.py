from django.urls import path
from . import views

app_name = "monitoring"

urlpatterns = [
    path("event", views.ingest_event, name="ingest_event"),
    path("gateway-metrics", views.ingest_gateway_metrics, name="ingest_gateway_metrics"),
]
