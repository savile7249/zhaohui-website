import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
RUNTIME_DIR = Path(os.environ.get("ZHAOHUI_RUNTIME_DIR", str(REPO_ROOT / ".local-test-env")))

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "local-test-only-zhaohui-multisite-admin-secret-key-change-in-production-9f8e7d6c5b4a",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "127.0.0.1,localhost,admin.localhost",
    ).split(",")
    if h.strip()
]

CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:18000",
    "http://localhost:18000",
    "http://admin.localhost:18000",
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core.apps.CoreConfig",
    "monitoring.apps.MonitoringConfig",
    "publishing.apps.PublishingConfig",
    "overview.apps.OverviewConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Real isolated MariaDB test database (never defaults to SQLite)
DB_NAME = os.environ.get("ZHAOHUI_DB_NAME", "zhaohui_admin_test")
DB_USER = os.environ.get("ZHAOHUI_DB_USER", "zhaohui_app")
DB_PASSWORD = os.environ.get("ZHAOHUI_DB_PASSWORD", "ZhDb@Test2026!#99")
DB_HOST = os.environ.get("ZHAOHUI_DB_HOST", "127.0.0.1")
DB_PORT = os.environ.get("ZHAOHUI_DB_PORT", "13306")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": DB_NAME,
        "USER": DB_USER,
        "PASSWORD": DB_PASSWORD,
        "HOST": DB_HOST,
        "PORT": DB_PORT,
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
        "TEST": {
            "NAME": os.environ.get("ZHAOHUI_TEST_DB_NAME", "test_zhaohui_admin_test"),
            "CHARSET": "utf8mb4",
            "COLLATION": "utf8mb4_unicode_ci",
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "core.validators.StrongComplexityPasswordValidator"},
]

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = RUNTIME_DIR / "django-static"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Security & Session hardening
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_AGE = 60 * 60 * 4  # 4 hours
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True

LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = "/overview/"
LOGOUT_REDIRECT_URL = "/login/"

# Local isolated test gateway & probe settings
GATEWAY_HTTP_PORT = int(os.environ.get("ZHAOHUI_GATEWAY_HTTP_PORT", "18080"))
GATEWAY_HTTPS_PORT = int(os.environ.get("ZHAOHUI_GATEWAY_HTTPS_PORT", "18443"))
GATEWAY_HEARTBEAT_STALE_SECONDS = int(os.environ.get("ZHAOHUI_HEARTBEAT_STALE_SECONDS", "60"))
PROBE_CERT_WARNING_DAYS = int(os.environ.get("ZHAOHUI_CERT_WARNING_DAYS", "14"))
PROBE_CA_CERT_PATH = os.environ.get(
    "ZHAOHUI_CA_CERT_PATH",
    str(RUNTIME_DIR / "certs" / "local-ca.pem"),
)
PROBE_TARGET_HOST = os.environ.get("ZHAOHUI_PROBE_TARGET_HOST", "127.0.0.1")
PROBE_TARGET_PORT = int(os.environ.get("ZHAOHUI_PROBE_TARGET_PORT", str(GATEWAY_HTTPS_PORT)))
SITES_ROOT = RUNTIME_DIR / "sites"
SNAPSHOTS_ROOT = RUNTIME_DIR / "snapshots"
BACKUPS_ROOT = RUNTIME_DIR / "backups"
