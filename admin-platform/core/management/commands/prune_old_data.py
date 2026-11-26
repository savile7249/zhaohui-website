import json
from datetime import timedelta
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from core.models import AuditLog
from core.permissions import record_audit
from monitoring.models import AlertEvent, GatewayMetricBucket, PageEvent, ProbeResult


class Command(BaseCommand):
    help = (
        "按数据保留策略清理过期监测明细与审计日志（默认：匿名页面事件/探测记录保留 180 天，"
        "网关分钟汇总/已恢复告警/审计日志保留 365 天；支持 --dry-run 预演，正式清理写入审计日志）。"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--events-days",
            type=int,
            default=getattr(settings, "DATA_RETENTION_EVENTS_DAYS", 180),
            help="匿名页面事件（PageEvent）保留天数，默认 180 天",
        )
        parser.add_argument(
            "--audit-days",
            type=int,
            default=getattr(settings, "DATA_RETENTION_AUDIT_DAYS", 365),
            help="审计日志（AuditLog）保留天数，默认 365 天",
        )
        parser.add_argument(
            "--probes-days",
            type=int,
            default=getattr(settings, "DATA_RETENTION_EVENTS_DAYS", 180),
            help="外部探测记录（ProbeResult）保留天数，默认 180 天",
        )
        parser.add_argument(
            "--metrics-days",
            type=int,
            default=getattr(settings, "DATA_RETENTION_AUDIT_DAYS", 365),
            help="网关请求分钟汇总（GatewayMetricBucket）保留天数，默认 365 天",
        )
        parser.add_argument(
            "--resolved-alerts-days",
            type=int,
            default=getattr(settings, "DATA_RETENTION_AUDIT_DAYS", 365),
            help="已恢复告警记录（AlertEvent, status=resolved）保留天数，默认 365 天（未恢复告警永不清理）",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="仅统计待清理行数，不执行实际删除且不写入数据库",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            dest="as_json",
            help="以 JSON 格式输出清理报告",
        )

    def handle(self, *args, **options):
        day_params = {
            "events_days": options["events_days"],
            "audit_days": options["audit_days"],
            "probes_days": options["probes_days"],
            "metrics_days": options["metrics_days"],
            "resolved_alerts_days": options["resolved_alerts_days"],
        }
        for key, val in day_params.items():
            if val is None or val < 1:
                raise CommandError(f"参数 --{key.replace('_', '-')} 必须为大于等于 1 的整数（收到 {val}）。")

        dry_run = bool(options["dry_run"])
        now = timezone.now()

        cutoffs = {
            "page_events": now - timedelta(days=day_params["events_days"]),
            "probe_results": now - timedelta(days=day_params["probes_days"]),
            "gateway_metrics": now - timedelta(days=day_params["metrics_days"]),
            "resolved_alerts": now - timedelta(days=day_params["resolved_alerts_days"]),
            "audit_logs": now - timedelta(days=day_params["audit_days"]),
        }

        qs_events = PageEvent.objects.filter(occurred_at__lt=cutoffs["page_events"])
        qs_probes = ProbeResult.objects.filter(checked_at__lt=cutoffs["probe_results"])
        qs_metrics = GatewayMetricBucket.objects.filter(bucket_start__lt=cutoffs["gateway_metrics"])
        qs_alerts = AlertEvent.objects.filter(
            status=AlertEvent.STATUS_RESOLVED,
            resolved_at__isnull=False,
            resolved_at__lt=cutoffs["resolved_alerts"],
        )
        qs_audits = AuditLog.objects.filter(created_at__lt=cutoffs["audit_logs"])

        if dry_run:
            counts = {
                "page_events": qs_events.count(),
                "probe_results": qs_probes.count(),
                "gateway_metrics": qs_metrics.count(),
                "resolved_alerts": qs_alerts.count(),
                "audit_logs": qs_audits.count(),
            }
        else:
            # Delete expired audit logs BEFORE recording this prune run's audit log
            counts = {
                "page_events": qs_events.delete()[0],
                "probe_results": qs_probes.delete()[0],
                "gateway_metrics": qs_metrics.delete()[0],
                "resolved_alerts": qs_alerts.delete()[0],
                "audit_logs": qs_audits.delete()[0],
            }
            record_audit(
                actor=None,
                action="system.prune_old_data",
                target_type="retention_policy",
                target_id=f"events:{day_params['events_days']}d,audit:{day_params['audit_days']}d",
                summary=(
                    f"执行数据保留清理：删除页面事件 {counts['page_events']} 条、"
                    f"探测记录 {counts['probe_results']} 条、网关汇总 {counts['gateway_metrics']} 条、"
                    f"已恢复告警 {counts['resolved_alerts']} 条、过期审计 {counts['audit_logs']} 条"
                ),
                site=None,
                metadata={
                    "retention_days": day_params,
                    "cutoffs": {k: v.isoformat() for k, v in cutoffs.items()},
                    "deleted": counts,
                },
            )

        report = {
            "dry_run": dry_run,
            "executed_at": now.isoformat(),
            "retention_days": day_params,
            "cutoffs": {k: v.isoformat() for k, v in cutoffs.items()},
            "counts": counts,
            "total": sum(counts.values()),
        }

        if options.get("as_json"):
            self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            prefix = "[DRY-RUN] " if dry_run else "[PRUNED] "
            self.stdout.write(
                f"{prefix}events(>={day_params['events_days']}d)={counts['page_events']} "
                f"probes(>={day_params['probes_days']}d)={counts['probe_results']} "
                f"metrics(>={day_params['metrics_days']}d)={counts['gateway_metrics']} "
                f"resolved_alerts(>={day_params['resolved_alerts_days']}d)={counts['resolved_alerts']} "
                f"audit_logs(>={day_params['audit_days']}d)={counts['audit_logs']} "
                f"total={report['total']}"
            )
