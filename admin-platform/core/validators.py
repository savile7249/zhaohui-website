import re
from django.core.exceptions import ValidationError


class StrongComplexityPasswordValidator:
    """Require uppercase, lowercase, digit, and special symbol."""

    def validate(self, password, user=None):
        checks = [
            (r"[A-Z]", "至少包含一个大写字母"),
            (r"[a-z]", "至少包含一个小写字母"),
            (r"\d", "至少包含一位数字"),
            (r"[^A-Za-z0-9]", "至少包含一个特殊符号"),
        ]
        missing = [msg for pattern, msg in checks if not re.search(pattern, password)]
        if missing:
            raise ValidationError(
                "密码强度不足：" + "、".join(missing) + "。",
                code="password_weak_complexity",
            )

    def get_help_text(self):
        return "密码长度至少 12 位，且必须同时包含大写字母、小写字母、数字和特殊符号。"
