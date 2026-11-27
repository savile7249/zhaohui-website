import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

ZHAOHUI_ENV = os.environ.get("ZHAOHUI_ENV", "test").strip().lower()
IS_PRODUCTION = ZHAOHUI_ENV == "production"

DEFAULT_TEST_SECRET_KEY = (
    "local-test-only-zhaohui-multisite-admin-secret-key-change-in-production-9f8e7d6c5b4a"
)
DEFAULT_TEST_DB_PASSWORD = "ZhDb@Test2026!#99"
DEFAULT_TEST_GATEWAY_SECRET = (
    "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff01"
)

RUNTIME_DIR = Path(
    os.environ.get(
        "ZHAOHUI_RUNTIME_DIR",
        "/var/lib/zhaohui-admin" if IS_PRODUCTION else str(REPO_ROOT / ".local-test-env"),
    )
)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", DEFAULT_TEST_SECRET_KEY)

DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "admin.wuxifangfu.cn,127.0.0.1,localhost" if IS_PRODUCTION else "127.0.0.1,localhost,admin.localhost",
    ).split(",")
    if h.strip()
]

CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "DJANGO_CSRF_TRUSTED_ORIGINS",
        "https://admin.wuxifangfu.cn"
        if IS_PRODUCTION
        else "http://127.0.0.1:18000,http://localhost:18000,http://admin.localhost:18000",
    ).split(",")
    if o.strip()
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

# Real isolated MariaDB database (never defaults to SQLite)
DB_NAME = os.environ.get("ZHAOHUI_DB_NAME", "zhaohui_admin" if IS_PRODUCTION else "zhaohui_admin_test")
DB_USER = os.environ.get("ZHAOHUI_DB_USER", "zhaohui_admin_app" if IS_PRODUCTION else "zhaohui_app")
DB_PASSWORD = os.environ.get("ZHAOHUI_DB_PASSWORD", "" if IS_PRODUCTION else DEFAULT_TEST_DB_PASSWORD)
DB_HOST = os.environ.get("ZHAOHUI_DB_HOST", "127.0.0.1")
DB_PORT = os.environ.get("ZHAOHUI_DB_PORT", "3306" if IS_PRODUCTION else "13306")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": DB_NAME,
        "USER": DB_USER,
        "PASSWORD": DB_PASSWORD,
        "HOST": DB_HOST,
        "PORT": DB_PORT,
        "CONN_MAX_AGE": int(os.environ.get("ZHAOHUI_DB_CONN_MAX_AGE", "60")),
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

# Explicit auth policy (Decision #2: independent HTTPS subdomain + username/password only)
AUTH_CAPTCHA_ENABLED = False
AUTH_MTLS_REQUIRED = False
AUTH_IP_WHITELIST_ENABLED = False

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = Path(os.environ.get("ZHAOHUI_STATIC_ROOT", str(RUNTIME_DIR / "django-static")))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Security & Session hardening
SECURE_HTTPS = os.environ.get("ZHAOHUI_SECURE_HTTPS", "1" if IS_PRODUCTION else "0") == "1"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = SECURE_HTTPS
CSRF_COOKIE_SECURE = SECURE_HTTPS
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_AGE = int(os.environ.get("ZHAOHUI_SESSION_COOKIE_AGE", str(60 * 60 * 4)))  # 4 hours
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
if SECURE_HTTPS:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False
    SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "0") == "1"

LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = "/overview/"
LOGOUT_REDIRECT_URL = "/login/"

# Gateway, probe, publishing, and retention settings
GATEWAY_HTTP_PORT = int(os.environ.get("ZHAOHUI_GATEWAY_HTTP_PORT", "18080"))
GATEWAY_HTTPS_PORT = int(os.environ.get("ZHAOHUI_GATEWAY_HTTPS_PORT", "18443"))
GATEWAY_HEARTBEAT_STALE_SECONDS = int(
    os.environ.get("ZHAOHUI_HEARTBEAT_STALE_SECONDS", "180" if IS_PRODUCTION else "60")
)
PROBE_CERT_WARNING_DAYS = int(os.environ.get("ZHAOHUI_CERT_WARNING_DAYS", "14"))
PROBE_USE_OFFICIAL_DOMAIN = os.environ.get(
    "ZHAOHUI_PROBE_USE_OFFICIAL_DOMAIN", "1" if IS_PRODUCTION else "0"
) == "1"
PROBE_CA_CERT_PATH = os.environ.get(
    "ZHAOHUI_CA_CERT_PATH",
    "" if IS_PRODUCTION else str(RUNTIME_DIR / "certs" / "local-ca.pem"),
)
PROBE_TARGET_HOST = os.environ.get(
    "ZHAOHUI_PROBE_TARGET_HOST",
    "" if IS_PRODUCTION else "127.0.0.1",
)
PROBE_TARGET_PORT = int(
    os.environ.get(
        "ZHAOHUI_PROBE_TARGET_PORT",
        "443" if IS_PRODUCTION else str(GATEWAY_HTTPS_PORT),
    )
)
SITES_ROOT = Path(
    os.environ.get("ZHAOHUI_SITES_ROOT", "/var/www" if IS_PRODUCTION else str(RUNTIME_DIR / "sites"))
)
USE_OFFICIAL_DOMAIN_PATHS = os.environ.get(
    "ZHAOHUI_USE_OFFICIAL_DOMAIN_PATHS", "1" if IS_PRODUCTION else "0"
) == "1"
ALLOW_ON_SERVER_BUILD = os.environ.get(
    "ZHAOHUI_ALLOW_ON_SERVER_BUILD", "0" if IS_PRODUCTION else "1"
) == "1"
SNAPSHOTS_ROOT = Path(os.environ.get("ZHAOHUI_SNAPSHOTS_ROOT", str(RUNTIME_DIR / "snapshots")))
BACKUPS_ROOT = Path(
    os.environ.get(
        "ZHAOHUI_BACKUPS_ROOT",
        "/var/backups/zhaohui-admin" if IS_PRODUCTION else str(RUNTIME_DIR / "backups"),
    )
)
DATA_RETENTION_EVENTS_DAYS = int(os.environ.get("ZHAOHUI_DATA_RETENTION_EVENTS_DAYS", "180"))
DATA_RETENTION_AUDIT_DAYS = int(os.environ.get("ZHAOHUI_DATA_RETENTION_AUDIT_DAYS", "365"))


def validate_production_config(
    *,
    debug: bool,
    secret_key: str,
    db_password: str,
    allowed_hosts: list[str],
    csrf_trusted_origins: list[str],
    secure_https: bool,
) -> list[str]:
    """Validate mandatory production hardening invariants; returns list of error messages."""
    errors: list[str] = []
    if debug:
        errors.append("生产环境严禁开启 DJANGO_DEBUG=1。")
    if not secret_key or secret_key == DEFAULT_TEST_SECRET_KEY or len(secret_key) < 32:
        errors.append("生产环境必须配置长度 ≥ 32 字符的独立 DJANGO_SECRET_KEY，禁止使用本地测试默认密钥。")
    if not db_password or db_password == DEFAULT_TEST_DB_PASSWORD or len(db_password) < 12:
        errors.append("生产环境必须配置强数据库密码 ZHAOHUI_DB_PASSWORD（≥12位），禁止使用测试默认密码。")
    if not allowed_hosts or "*" in allowed_hosts:
        errors.append("生产环境必须显式配置 DJANGO_ALLOWED_HOSTS，严禁留空或使用通配符 '*'。")
    if not csrf_trusted_origins or not any(o.startswith("https://") for o in csrf_trusted_origins):
        errors.append("生产环境必须在 DJANGO_CSRF_TRUSTED_ORIGINS 中配置管理后台的 https:// 域名。")
    if not secure_https:
        errors.append("生产环境必须启用 ZHAOHUI_SECURE_HTTPS=1（HTTPS Cookie 安全属性）。")
    return errors


if IS_PRODUCTION:
    _prod_errors = validate_production_config(
        debug=DEBUG,
        secret_key=SECRET_KEY,
        db_password=DB_PASSWORD,
        allowed_hosts=ALLOWED_HOSTS,
        csrf_trusted_origins=CSRF_TRUSTED_ORIGINS,
        secure_https=SECURE_HTTPS,
    )
    if _prod_errors:
        raise ImproperlyConfigured("生产环境配置校验未通过：" + "；".join(_prod_errors))
