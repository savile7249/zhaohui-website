import json
from django.core.management.base import BaseCommand
from core.models import Domain
from monitoring.probes import probe_domain, run_all_active_probes


class Command(BaseCommand):
    help = "从外部探测已启用域名的 HTTPS、证书有效期与首页内容标记，并维护故障告警与恢复状态。"

    def add_arguments(self, parser):
        parser.add_argument("--domain", type=str, help="仅探测指定正式域名或测试主机名")
        parser.add_argument("--json", action="store_true", dest="as_json", help="输出 JSON 格式结果")

    def handle(self, *args, **options):
        domain_arg = options.get("domain")
        if domain_arg:
            domain = Domain.objects.filter(official_domain=domain_arg).first() or Domain.objects.filter(
                test_host=domain_arg
            ).first()
            if not domain:
                self.stderr.write(f"未找到域名: {domain_arg}")
                return
            results = [probe_domain(domain)]
        else:
            results = run_all_active_probes()

        summary = [
            {
                "domain": r.domain.official_domain,
                "test_host": r.domain.test_host,
                "is_success": r.is_success,
                "http_status": r.http_status,
                "tls_valid": r.tls_valid,
                "cert_days_remaining": r.cert_days_remaining,
                "cert_warning": r.cert_warning,
                "content_marker_ok": r.content_marker_ok,
                "error_code": r.error_code,
                "error_detail": r.error_detail,
            }
            for r in results
        ]
        if options.get("as_json"):
            self.stdout.write(json.dumps(summary, ensure_ascii=False, indent=2))
        else:
            for item in summary:
                self.stdout.write(
                    f"[{item['domain']}] ok={item['is_success']} http={item['http_status']} "
                    f"tls={item['tls_valid']} cert_days={item['cert_days_remaining']} "
                    f"warn={item['cert_warning']} marker={item['content_marker_ok']} err={item['error_code']}"
                )
