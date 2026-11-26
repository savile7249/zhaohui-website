# 兆辉首个生产试点（`jszhff.cn`）阶段 A 上线交付与验收报告

> **完成时间**：2026-11-26
>
> **目标源站**：`zhaohui`（`iZuf680ykik578hkf71sq1Z`，公网 IP `47.102.192.214`，Ubuntu 24.04.4 LTS）
>
> **阶段 A 边界确认**：已完成全部不依赖 `admin.jszhff.cn` DNS 解析与 Certbot 证书的生产试点部署并全部实测通过；**严格未执行 Certbot、未启用公网 `admin.jszhff.cn` Nginx 站点**；未触碰 `zhaohui_site` 库、`wuxifangfu.cn`、`zhaohuifangfu.com`（继续保持公网暂停）及 `lego` 证书；未启用线上询盘收件；未向远端 push 或合并 `main`。

---

## 一、阶段 A 部署变更与上线清单

| 模块 | 实际部署状态 | 关键路径与配置 |
|---|---|---|
| **前置安全快照** | 已完成 | 备份原配置 `/etc/nginx/sites-available/jszhff.cn.bak.pre-pilot`；上线前原基线版本 `/var/www/jszhff.cn/releases/20261126-143000` 完整保留 |
| **系统编译与虚拟环境依赖** | 已安装（零重启 DB/Nginx） | `python3-venv 3.12.3-0ubuntu2.1`、`libmariadb-dev 1:10.11.14-0ubuntu0.24.04.1`、`pkg-config 1.8.1-2build1`；`mariadbd`（PID `1014941`）与 `nginx`（master PID `1115648`）全程未重启 |
| **应用代码与虚拟环境** | 已就绪 | 专属系统用户 `zhaohui-admin`（附属 `adm` 组）；代码部署至 `/opt/zhaohui-admin`；虚拟环境 `/opt/zhaohui-admin/admin-platform/.venv`（Django `5.2.19`、`mysqlclient 2.3.2`、Gunicorn `27.0.1`） |
| **MariaDB 独立隔离库** | 已创建并完成 21 项迁移 | 新建 `zhaohui_admin`（`utf8mb4_unicode_ci`，24 张表）；专属账号 `zhaohui_admin_app@127.0.0.1` 与只读备份账号 `zhaohui_backup@localhost` 经 `SHOW GRANTS` 核实**仅限 `zhaohui_admin.*`**；既有 `zhaohui_site`（31 张表）完全未触碰 |
| **生产密钥与受管账号** | 已配置（无明文落盘 Git） | 源站 `/etc/zhaohui-admin/admin.env`（`0600`）与 `/etc/zhaohui-admin/backup.my.cnf`（`0600`）；`DJANGO_DEBUG=0`、`ZHAOHUI_ALLOW_ON_SERVER_BUILD=0`、无验证码/无 mTLS/无 IP 白名单；已运行 `init_prod_pilot` 仅导入 `zhaohui` 站点 4 类受管产品与公开联系方式；仅创建单个管理员兼发布者账号 **`zhaohui_owner`**（`is_superuser=True, is_staff=True` + `SiteMembership(zhaohui, admin)`，库内总用户数 = `1`） |
| **初始凭据安全存放路径** | 仅本机 `chmod 600` | **`/home/savil/.config/zhaohui-admin-prod-credentials.txt`**（本报告与 Git 仓库均不含任何明文密码） |
| **systemd 服务与定时器** | 2 常驻 + 4 定时全部 `active` | `zhaohui-admin-gunicorn.service`（`127.0.0.1:18000`）、`zhaohui-event-forwarder.service`（`127.0.0.1:18081`）；`zhaohui-log-aggregator.timer`（每 60s）、`zhaohui-probe.timer`（每 5min，仅写总览不发外部通知）、`zhaohui-db-backup.timer`（每日 03:15 CST）、`zhaohui-data-prune.timer`（每日 03:45 CST，180d 事件 / 365d 审计） |
| **Nginx 配置** | `nginx -t` 通过并零停机 reload | 新增 `/etc/nginx/conf.d/zhaohui-metrics-log-format.conf`；更新 `/etc/nginx/sites-available/jszhff.cn`（新增 `jszhff.cn.metrics.log` 与 `/_track/event` 回环转发）；管理子域配置仅暂存为 `/etc/nginx/sites-available/admin.jszhff.cn.pending-dns`（**未软链至 `sites-enabled/`，未签发证书**） |
| **`jszhff.cn` 试点静态版本** | 本地构建 + 原子切换上线 | 当前生效版本 `/var/www/jszhff.cn/current -> releases/20261126-233711`（保留最近 5 个版本，含上线前基线 `20261126-143000`） |

---

## 二、阶段 A 线上全量验收实测证据

### 2.1 公网页面、合规标识与静态资源（验收项 a）
- `https://jszhff.cn/` → **HTTP 200**
- `https://jszhff.cn/products/tanks/` → **HTTP 200**
- `https://jszhff.cn/products/reactors/` → **HTTP 200**
- `https://jszhff.cn/products/towers/` → **HTTP 200**
- `https://jszhff.cn/products/piping/` → **HTTP 200**
- 线上页面源码实测核验：包含备案号 `苏ICP备20000966号-6`、`<link rel="canonical" href="https://jszhff.cn/"/>`、首页标记 `兆辉化工设备`，且本地构建期已逐项核验 `index.html` 引用的全部 **105 项静态资源 0 缺失**。

### 2.2 `/_track/event` 匿名埋点、防伪造与脱敏验证（验收项 b）
- 向公网 `POST https://jszhff.cn/_track/event` 发送含伪造 `"site":"sim-site"`、查询参数 `?secret=123&phone=13300000000` 及敏感字段（`clipboard_text`、`phone`、`email`）的受控测试请求：
  - 返回 **HTTP 201**：`{"status": "accepted", "id": 1, "attributed_site": "zhaohui", "attributed_domain": "jszhff.cn", "site_override_applied": true, "dropped_non_whitelist_count": 3}`；
  - 核查数据库记录：归属站点强绑定 `zhaohui` / `jszhff.cn`，`page_path` 已剥离查询参数规范化为 `/products/tanks/`，`gateway_id=prod-zhaohui-nginx-01`，**零敏感字段落库**；
  - 验证完毕已清理该条合成测试事件（`remaining=0`），保持生产统计起点干净。

### 2.3 Nginx 指标汇聚与外部 HTTPS/TLS 探测（验收项 c）
- 手动触发 `zhaohui-log-aggregator.service`：
  - 日志：`[log-aggregator] ok lines=7 buckets=1 accepted=1 ignored=0 offset=1813`；
  - 入库核验：`GatewayMetricBucket` 已写入 2 个分钟桶（`2xx` 正常计数、平均响应耗时 `7.67 ms`），`Domain.last_gateway_heartbeat_at` 与 `collection_started_at` 正常更新。
- 手动触发 `zhaohui-probe.service`：
  - 日志：`[jszhff.cn] ok=True http=200 tls=True cert_days=64 warn=False marker=True err=`；
  - 入库核验：`ProbeResult` 记录 `probe_url=https://jszhff.cn/`、`http_status=200`、`tls_valid=True`、`cert_days_remaining=64`、`content_marker_ok=True`、`response_time_ms=35.98`，当前未恢复告警 `open_alerts=0`。

### 2.4 每日全库备份与 180/365 天清理预演（验收项 d）
- 手动触发 `zhaohui-db-backup.service`（使用只读 `zhaohui_backup@localhost` 凭据）：
  - 成功生成 `/var/backups/zhaohui-admin/zhaohui_admin-20261126-223803.sql.gz`（`9,608 bytes`）与 `.sha256`（`8b7d65f9015aab5e5e41f7e6b086d8b9cccd346351e772305d5a31d483f09162`）；
  - 执行 `sha256sum -c *.sha256` 返回 **`zhaohui_admin-20261126-223803.sql.gz: OK`**。
- 运行 `manage.py prune_old_data --dry-run`：
  - 输出 `[DRY-RUN] events(>=180d)=0 probes(>=180d)=0 metrics(>=365d)=0 resolved_alerts(>=365d)=0 audit_logs(>=365d)=0 total=0`，无报错。

### 2.5 静态解耦与后台停机韧性验证（验收项 e）
- 主动执行 `systemctl stop zhaohui-admin-gunicorn.service`（确认 `inactive`）期间：
  - `GET https://jszhff.cn/` → **HTTP 200**
  - `GET https://jszhff.cn/products/tanks/` → **HTTP 200**
  - `POST https://jszhff.cn/_track/event` → **HTTP 202**（转发器/Nginx 兜底降级，不报错、不阻塞访客页面）
- 立即执行 `systemctl start zhaohui-admin-gunicorn.service` 恢复为 `active`。

### 2.6 站点隔离与上线后源站资源实测（验收项 f）
- **数据库隔离**：`zhaohui_admin`（24 张表）与 `zhaohui_site`（31 张表）完全独立。
- **老站与待备案域隔离**：
  - `wuxifangfu.cn`：HTTP `301` / HTTPS `302`，服务完全正常；
  - `zhaohuifangfu.com`：443 端口 `tlsv1 unrecognized name`（`ssl_reject_handshake on`），80 端口 `Empty reply from server`（`return 444`），严格保持公网暂停不动；
  - `/etc/nginx/sites-enabled/` 仅含 `jszhff.cn`、`wuxifangfu`、`zhaohuifangfu.com`，未启用 `admin.jszhff.cn`。
- **上线后源站资源实测**：
  - 负载：`load average: 0.19, 0.20, 0.09`
  - 内存：总计 `3499 MiB`，已用 **`816 MiB`**（较预检基线 `732 MiB` 仅净增 **`+84 MiB`**），**剩余可用 `2682 MiB`**（Swap `0`）
  - 进程 RSS 明细：Gunicorn（1 master + 2 workers）合计 **`110.5 MiB`**，`event_forwarder.py` **`22.6 MiB`**，`mariadbd` **`122.8 MiB`**，Nginx（3 进程）合计 **`28.0 MiB`**。

---

## 三、阶段 A 期间临时本机查看后台方式（可选）

在明天添加 `admin.jszhff.cn` DNS 之前，所有后台采集、指标汇聚、外部探测与每日备份**已经自动在后台运行**。如需今天提前查看总览页，可在本机通过 SSH 端口转发临时访问（Chrome/Edge 对 `localhost` 自动放行 Secure Cookie）：

```bash
ssh -N -L 18000:127.0.0.1:18000 zhaohui
# 浏览器打开 http://localhost:18000/login/ ，使用 /home/savil/.config/zhaohui-admin-prod-credentials.txt 中的账号登录
```

---

## 四、明天 DNS 生效后的阶段 B 收尾步骤（约 30 秒完成）

明天您在 DNS 服务商处添加 A 记录 **`admin.jszhff.cn -> 47.102.192.214`** 并确认生效后，只需在源站 `zhaohui` 执行以下 4 步即可启用 `https://admin.jszhff.cn/`：

```bash
# 1. 确认 DNS 已生效（应返回 47.102.192.214）
getent ahosts admin.jszhff.cn

# 2. 放行临时 80 端口配置并用 Certbot 签发 admin.jszhff.cn 正式 HTTPS 证书（自动纳入 certbot.timer 续期）
cat >/etc/nginx/sites-available/admin.jszhff.cn.acme-bootstrap <<'NGX'
server {
    listen 80;
    listen [::]:80;
    server_name admin.jszhff.cn;
    root /var/www/certbot;
    location ^~ /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 404; }
}
NGX
ln -sfn /etc/nginx/sites-available/admin.jszhff.cn.acme-bootstrap /etc/nginx/sites-enabled/admin.jszhff.cn
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/certbot -d admin.jszhff.cn --non-interactive --agree-tos

# 3. 切换为已预备好的正式 HTTPS 反代配置（仅账号密码登录，无验证码/无 mTLS/封堵公网 /api/ingest/）
cp /etc/nginx/sites-available/admin.jszhff.cn.pending-dns /etc/nginx/sites-available/admin.jszhff.cn
ln -sfn /etc/nginx/sites-available/admin.jszhff.cn /etc/nginx/sites-enabled/admin.jszhff.cn
rm -f /etc/nginx/sites-available/admin.jszhff.cn.acme-bootstrap
nginx -t && systemctl reload nginx

# 4. 验收管理后台 HTTPS 登录页与公网 ingest 封堵
curl -fsSI https://admin.jszhff.cn/login/ | head -n 10
curl -sS -o /dev/null -w 'public_ingest_status=%{http_code}\n' -X POST https://admin.jszhff.cn/api/ingest/event
# 预期：/login/ 返回 HTTP 200，/api/ingest/event 返回 HTTP 403
```

---

## 五、紧急秒级回滚命令（备查）

```bash
# 1. 秒级原子回滚 jszhff.cn 静态官网至上线前版本 20261126-143000
bash /opt/zhaohui-admin/ops/prod-pilot/rollback_prod.sh --version 20261126-143000

# 2. 如需连同 Nginx 配置与后台服务一并撤回
cp -a /etc/nginx/sites-available/jszhff.cn.bak.pre-pilot /etc/nginx/sites-available/jszhff.cn
rm -f /etc/nginx/sites-enabled/admin.jszhff.cn /etc/nginx/conf.d/zhaohui-metrics-log-format.conf
nginx -t && systemctl reload nginx
systemctl disable --now zhaohui-admin-gunicorn.service zhaohui-event-forwarder.service \
  zhaohui-log-aggregator.timer zhaohui-probe.timer zhaohui-db-backup.timer zhaohui-data-prune.timer
```
