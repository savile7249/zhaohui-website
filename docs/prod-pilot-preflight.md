# 兆辉首个生产试点（`jszhff.cn`）源站只读预检报告与上线审批清单

> **检查时间**：2026-11-26
>
> **目标源站**：`zhaohui`（主机名 `iZuf680ykik578hkf71sq1Z`，公网 IP `47.102.192.214`）
>
> **本轮执行边界**：**100% 只读预检 + 本地准备部署包**；未写入/修改/删除源站任何文件、数据库、Nginx 配置或系统服务；未输出源站任何密码、私钥或无关业务数据；未启用 `zhaohuifangfu.com` 公网；未启用在线询盘收件；未推送远端或合并 `main`。

---

## 一、源站 `zhaohui` 只读预检实测摘要与兼容性结论

### 1.1 系统环境与资源余量

| 检查项 | 实测结果 | 兼容性与评估 |
|---|---|---|
| **操作系统与内核** | Ubuntu `24.04.4 LTS` (Noble Numbat)，Kernel `6.8.0-63-generic x86_64` | **完全兼容**；systemd `255 (255.4-1ubuntu8.18)` 可用 |
| **CPU 与当前负载** | **2 vCPU**，已连续运行 122 天，当前负载 `0.05 / 0.02 / 0.00` | **负载极低**；坚持离线/本地构建 Next.js，源站仅跑 Gunicorn + 轻量转发 |
| **内存与 Swap** | 总内存 **3499 MiB**，已用 **732 MiB**，**可用 2766 MiB**；Swap `0 MiB` | **余量充裕**；新增常驻内存预计 `< 200 MiB`（Gunicorn 2w ~130 MiB + 事件转发器 ~15 MiB + MariaDB 缓冲增量），总占用仍在 1 GiB 内 |
| **磁盘空间** | `/` (`/dev/vda3`) 总容量 **49G**，已用 **5.6G（12%）**，**剩余 42G** | **充裕**；保留 5 个静态版本 + 30 天压缩备份预计占用 `< 500 MiB` |
| **常用运维工具** | `rsync`、`curl`、`gzip`、`tar`、`openssl`、`jq` 均已安装 | **开箱可用** |

### 1.2 MariaDB 现状与隔离评估

| 检查项 | 实测结果 | 兼容性与评估 |
|---|---|---|
| **精确版本** | `10.11.14-MariaDB-0ubuntu0.24.04.1`（`mariadb-server` / `mariadb-client` / `mariadb-dump 10.19`） | **完全兼容**（Django 5.2 LTS 最低要求 MariaDB 10.5，已满足且属 Ubuntu 24.04 官方维护版） |
| **运行状态与监听** | `mariadb.service` `active (running)`，仅监听 `127.0.0.1:3306` 与 `/run/mysqld/mysqld.sock`，当前内存约 `84–112 MiB` | **安全合规**，未向公网暴露 3306 |
| **字符集与 SQL 模式** | `character_set_server=utf8mb4`、`collation_server=utf8mb4_general_ci`、`default_storage_engine=InnoDB`、`sql_mode=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION`、`innodb_buffer_pool_size=128 MiB`、`max_connections=151` | **100% 匹配 Django 配置**（连接层仍显式指定 `utf8mb4` 与 `STRICT_TRANS_TABLES`） |
| **既有数据库列表** | `information_schema`、`mysql`、`performance_schema`、`sys`、**`zhaohui_site`** | **无冲突**：新建独立隔离库 **`zhaohui_admin`** 与专属账号 `zhaohui_admin_app@127.0.0.1`、只读备份账号 `zhaohui_backup@localhost`，**绝对不触碰既有 `zhaohui_site`** |

### 1.3 Nginx、现有站点结构、日志与 TLS 现状

| 检查项 | 实测结果 | 兼容性与评估 |
|---|---|---|
| **Nginx 版本与模块** | `nginx/1.24.0 (Ubuntu)`，OpenSSL 3.0.13，支持 HTTP/2、TLS SNI、gzip；动态模块仅启用 `50-mod-stream.conf`，**未安装 `njs` 或 `lua` 模块** | **无需改造 Nginx 二进制或加装第三方模块**：采用本机回环轻量 Python 签名转发器（`127.0.0.1:18081`）+ 定时 Nginx 结构化日志汇聚方案，零侵入 |
| **`jszhff.cn` 现状** | `/etc/nginx/sites-available/jszhff.cn` 已启用：`root /var/www/jszhff.cn/current`（软链指向 `releases/20261126-143000`，现有 4 个历史版本目录共 `49 MiB`）；已含 `www.jszhff.cn -> jszhff.cn` 301、HTTP->HTTPS 301（保留 `/.well-known/acme-challenge/`）、`/products` 与 `/prototype/*` 301 重定向及静态资源缓存头 | **高度契合**：源站已采用 `/var/www/jszhff.cn/releases/<ts>` + `current` 软链结构，直接沿用该路径即可，无需迁移站点根目录，且完整保留 Certbot `webroot` 续期路径 |
| **`jszhff.cn` TLS 证书** | Let's Encrypt ECDSA（`/etc/letsencrypt/live/jszhff.cn/fullchain.pem`），SAN：`jszhff.cn, www.jszhff.cn`，有效期 `2026-11-01` 至 `2027-01-30`；由 `certbot 2.9.0`（`webroot=/var/www/jszhff.cn/current`）配合 `certbot.timer` 自动续期 | **正常有效**（剩余约 65 天） |
| **`wuxifangfu.cn` 现状** | `/etc/nginx/sites-available/wuxifangfu` 已启用，老站 PHP 5.6（`/var/www/wuxifangfu`，`281 MiB`，`php5.6-fpm`） | **完全隔离，严禁触碰**（附注观察：其既有证书 `/etc/letsencrypt/live/wuxifangfu.cn/` 显示于 `2026-11-02` 过期，属老站独立事项，本试点不改动） |
| **`zhaohuifangfu.com` 现状（重要发现）** | 1) 当前已启用的 `/etc/nginx/sites-available/zhaohuifangfu.com` **处于安全暂停状态**（443 端口 `ssl_reject_handshake on;`，80 端口 `return 444;`，注释标明等待 ICP 备案审核）；<br>2) 目录下另存在未启用的预备配置 `/etc/nginx/sites-available/zhaohuifangfu.com.ready`（`root` 当前指向 `/var/www/jszhff.cn/current`），并引用 `lego` 签发的正式证书 `/etc/lego/certificates/zhaohuifangfu.com.{crt,key}`（有效期 `2026-11-26` 至 `2027-02-24`，SAN：`zhaohuifangfu.com, www.zhaohuifangfu.com`） | **严格保持公网暂停不动**：本轮试点不启用 `zhaohuifangfu.com`、不改其 Nginx 文件。后续备案通过拟正式启用时，建议将其 `root` 改为独立的 `/var/www/zhaohuifangfu.com/current`（由后台按自身备案号构建、Canonical 指向 `https://jszhff.cn/`），避免页脚误显示 `jszhff.cn` 的备案号 |
| **`admin.jszhff.cn` DNS 与证书** | 实测 `getent ahosts admin.jszhff.cn` **尚无 DNS 解析记录**；源站已安装 `certbot 2.9.0` 与 `python3-certbot-nginx 2.9.0`，且 `certbot.timer` 正常运行 | **上线前置条件**：需由用户先添加 A 记录 `admin.jszhff.cn -> 47.102.192.214`，上线时通过 `certbot` 签发独立 HTTPS 证书并自动纳入 `certbot.timer` 续期 |
| **日志切分机制** | `/etc/logrotate.d/nginx` 覆盖 `/var/log/nginx/*.log`，按天切分、保留 14 份、延迟压缩（`.1` 未压缩） | **完全兼容**：新增 `/var/log/nginx/jszhff.cn.metrics.log` 将自动纳入每日轮转；汇聚脚本内置 `inode + offset` 书签并在切分瞬间自动补读 `.1` 尾部，不丢指标 |

### 1.4 Python 3 与编译依赖预检

| 检查项 | 实测结果 | 上线前需补充依赖 |
|---|---|---|
| **Python 3 / 编译器** | `Python 3.12.3`、`python3-dev 3.12.3`、`python3-pip 24.0`、`build-essential`、`gcc 13.2.0` 均已安装 | 无需升级 Python |
| **缺失的 3 个标准 APT 包** | `python3-venv`（缺 `ensurepip`）、`libmariadb-dev`、`pkg-config` 尚未安装（均在当前配置的阿里云 Ubuntu Noble 官方源中可用：`libmariadb-dev 1:10.11.14-0ubuntu0.24.04.1`、`python3-venv 3.12.3-0ubuntu2.1`、`pkg-config 1.8.1-2build1`） | 上线时执行一次标准 `apt-get install -y python3-venv libmariadb-dev pkg-config` 即可编译安装 `mysqlclient`（Django 官方推荐 C 驱动，零影响运行中的 MariaDB） |

---

## 二、针对源站实情制定的架构落地细节（严格对齐 5 项决策）

本轮已在当前工作树补齐全部代码、模板与自动化单元测试，精准匹配 `zhaohui` 实情：

1. **静态官网与管理后台完全解耦（`ops/prod-pilot/nginx-jszhff-pilot.conf`）**：
   - `jszhff.cn` 继续直接由 Nginx 提供 `/var/www/jszhff.cn/current` 静态文件，保留原有全部 TLS、Certbot `webroot`、301 重定向和静态缓存策略；
   - **停止 Gunicorn 或事件转发器时，`jszhff.cn` 全部页面与资源仍保持 HTTP 200**；
   - 仅新增两条最小化配置：`access_log /var/log/nginx/jszhff.cn.metrics.log zhaohui_metrics;` 与 `location = /_track/event`（反代至本机回环 `127.0.0.1:18081`，硬绑定 `X-Matched-Domain $server_name`，且在后端重启时由 Nginx 兜底返回 HTTP 202，绝不阻塞访客页面）。

2. **零侵入可信网关接入（适配无 `njs`/`lua` 的库存 Nginx 1.24.0）**：
   - **事件签名转发器（`ops/prod-pilot/event_forwarder.py` + `zhaohui-event-forwarder.service`）**：纯 Python 3.12 标准库守护进程，仅监听 `127.0.0.1:18081`（约 15 MiB 内存），校对 `X-Matched-Domain` 白名单（`jszhff.cn`）后计算 HMAC-SHA256 签名并转发至 `127.0.0.1:18000/api/ingest/event`；
   - **分域名日志指标汇聚（`ops/prod-pilot/nginx-log-format.conf` + `ops/prod-pilot/nginx_log_aggregator.py` + `zhaohui-log-aggregator.timer`）**：采用隐私保护的 JSON-line 日志格式 `zhaohui_metrics`（刻意不含 `$remote_addr`、User-Agent、Referer、查询参数 `$args`），每 60 秒增量读取日志并处理 daily logrotate 轮转，排除 `/_track/` 与 `/.well-known/` 后按分钟桶区分页面文档/静态资源/2xx/4xx/5xx/耗时，签名上报至 `/api/ingest/gateway-metrics`；**即使零访问分钟也持续上报 `heartbeat_hosts`**，使总览页准确区分「真实零访问」与「数据中断」（心跳超时窗口设为 `180s` = 3 次容错）。

3. **独立管理后台子域（决策 #2：`ops/prod-pilot/nginx-admin-subdomain.conf` + `admin-platform/.env.production.example`）**：
   - 独立子域 `admin.jszhff.cn`（模板可按需替换）+ Let's Encrypt HTTPS 反代至本机 Gunicorn `127.0.0.1:18000`；
   - **严格执行仅账号 + 强密码登录**：`AUTH_CAPTCHA_ENABLED=False`、`AUTH_MTLS_REQUIRED=False`、`AUTH_IP_WHITELIST_ENABLED=False`（无任何验证码、无双向证书、无硬性 IP 白名单阻断）；
   - 生产安全加固：`DJANGO_DEBUG=0`、`SESSION_COOKIE_SECURE=True`、`CSRF_COOKIE_SECURE=True`、`SECURE_PROXY_SSL_HEADER`、`HSTS`、`X-Robots-Tag: noindex, nofollow`、启动时强制校验独立随机密钥与强数据库密码（拒绝默认测试密钥）；
   - 管理子域 Nginx 层明确封堵公网访问 `/api/ingest/`（`return 403;`），仅允许本机回环网关写入指标。

4. **MariaDB 独立隔离库与每日全备（决策 #4：`ops/prod-pilot/mariadb-init-template.sql` + `backup_mariadb.sh` + `zhaohui-db-backup.timer`）**：
   - 新建独立库 `zhaohui_admin`（`utf8mb4_unicode_ci`），应用账号 `zhaohui_admin_app@127.0.0.1` 与只读备份账号 `zhaohui_backup@localhost` 均仅授予 `zhaohui_admin.*` 最小权限；
   - 每日 `03:15 CST` 自动执行 `mariadb-dump --single-transaction --routines --triggers --hex-blob --databases zhaohui_admin | gzip -9`，输出至 `/var/backups/zhaohui-admin/` 并生成 `.sha256` 校验文件，本地滚动保留 30 天（异地副本后续按需追加）。

5. **外部探测与数据保留自动清理（决策 #3 & #4）**：
   - **外部探测（`zhaohui-probe.timer`）**：每 5 分钟执行 `manage.py run_probes`（使用系统根证书校验 `https://jszhff.cn/` 的 TLS 证书有效期、HTTP 200 与首页标记「兆辉化工设备」），**仅写入后台总览与故障/恢复记录，不接入任何外部付费或消息告警**；
   - **数据保留清理（`manage.py prune_old_data` + `zhaohui-data-prune.timer`）**：每日 `03:45 CST` 执行，默认清理超期 **180 天** 的匿名页面事件与外部探测记录、超期 **365 天** 的网关分钟汇总、已恢复告警与审计日志（**永不清理未恢复的 `open` 告警**），支持 `--dry-run` 只读预演，正式清理自动写入 `system.prune_old_data` 审计日志。

6. **受管字段与离线构建发布（决策 #5：`ops/prod-pilot/build_and_stage.sh` + `rollback_prod.sh`）**：
   - 生产初始化命令 `manage.py init_prod_pilot` 仅导入 `zhaohui` 站点的 4 类受管产品（展示名称、简介、已核准 WebP 图片）与公开联系方式，**不创建测试账号或 `sim-site`**，线上询盘保持关闭；
   - 生产环境设置 `ZHAOHUI_ALLOW_ON_SERVER_BUILD=0` 禁止在 2 vCPU 源站跑 `next build`；新版本一律在本地开发机/CI 通过 `ops/prod-pilot/build_and_stage.sh` 构建并完成 HTML/备案号/Canonical/105 项静态资源冒烟校验后，`rsync` 同步至 `/var/www/jszhff.cn/releases/<VERSION>` 并原子切换 `current` 软链（保留最近 5 个版本）。

### 本地验证结果（本轮已实测 100% 通过）
- **Django 全量测试（真实隔离 MariaDB 11.4.14）**：`manage.py test core --noinput --verbosity=2` **10/10 全部通过（0 失败，耗时 4.38s）**，覆盖原有四阶段全部测试 + 新增 `prune_old_data`（`--dry-run`、180/365 天清理、未恢复告警保护、审计落库）、生产配置强安全与无验证码策略校验、`init_prod_pilot` 初始化与 `event_forwarder.py`/`nginx_log_aggregator.py`（含模拟 logrotate 切分补读）HMAC 签名联调；
- **本地离线构建与产物冒烟**：`bash ops/prod-pilot/build_and_stage.sh --local-only` 通过（`npm run typecheck` + `npm run build` 12/12 静态页 + 校验备案号/Canonical/105 项静态资源 0 缺失）；
- **脚本与代码语法检查**：`bash -n`、`py_compile`、`git diff --check` 全部通过。

---

## 三、正式上线执行步骤（批准后零停机实施 SOP）

### 3.1 预计变更范围清单

| 类型 | 变更路径 / 对象 | 说明 |
|---|---|---|
| **新增系统包** | `python3-venv`、`libmariadb-dev`、`pkg-config` | Ubuntu Noble 官方源标准包 |
| **新增系统用户与目录** | 用户 `zhaohui-admin`（附属 `adm` 组只读 Nginx 日志）；`/opt/zhaohui-admin`、`/etc/zhaohui-admin`（`750`）、`/var/lib/zhaohui-admin`、`/var/backups/zhaohui-admin`、`/var/www/certbot` | 与老站目录完全隔离 |
| **新增 MariaDB 库/账号** | 数据库 `zhaohui_admin`；账号 `zhaohui_admin_app@127.0.0.1`、`zhaohui_backup@localhost` | **绝不触碰 `zhaohui_site`** |
| **新增 Nginx 配置** | `/etc/nginx/conf.d/zhaohui-metrics-log-format.conf`、`/etc/nginx/sites-available/admin.jszhff.cn`（软链至 `sites-enabled/`） | 新增管理子域与指标日志格式 |
| **小幅更新 Nginx 配置** | `/etc/nginx/sites-available/jszhff.cn`（改动前先备份为 `jszhff.cn.bak.pre-pilot`） | 仅新增 `metrics.log` 与 `/_track/event` 转发 |
| **新增 systemd 单元** | 2 个常驻服务（`zhaohui-admin-gunicorn`、`zhaohui-event-forwarder`）+ 4 组定时器（`log-aggregator`、`probe`、`db-backup`、`data-prune`） | 均绑定回环或后台定时任务 |
| **新增静态发布版本** | `/var/www/jszhff.cn/releases/<PILOT_TS>` 并原子切换 `current` 软链 | 引入极轻量匿名埋点，原版本 `20261126-143000` 完整保留用于秒级回滚 |
| **严禁触碰（只读保留）** | 数据库 `zhaohui_site`；`/var/www/wuxifangfu` 及 `sites-enabled/wuxifangfu`；`sites-enabled/zhaohuifangfu.com` 与 `zhaohuifangfu.com.ready`；`/etc/lego/certificates/*` | 全程零改动 |

### 3.2 分步零停机上线流程与逐项验证

1. **步骤 1（DNS 与管理子域 TLS 证书）**：
   - 验证 `dig +short admin.jszhff.cn` 指向 `47.102.192.214`；
   - 创建 `/var/www/certbot`，临时放行 80 端口 ACME 验证并运行 `certbot certonly --webroot -w /var/www/certbot -d admin.jszhff.cn`，核验 `/etc/letsencrypt/live/admin.jszhff.cn/fullchain.pem` 签发成功。
2. **步骤 2（安装 3 个 APT 依赖与部署代码）**：
   - `apt-get update && apt-get install -y python3-venv libmariadb-dev pkg-config`；
   - 创建系统用户 `zhaohui-admin`（加入 `adm` 组），同步仓库至 `/opt/zhaohui-admin`，在 `/opt/zhaohui-admin/admin-platform/.venv` 安装 `requirements.txt`。
3. **步骤 3（初始化隔离 MariaDB 与生产配置）**：
   - 按 `ops/prod-pilot/mariadb-init-template.sql` 生成强随机密码创建 `zhaohui_admin` 与双账号，核对 `SHOW GRANTS` 仅限 `zhaohui_admin.*`；
   - 基于 `.env.production.example` 生成 `/etc/zhaohui-admin/admin.env`（`chmod 600`）与 `/etc/zhaohui-admin/backup.my.cnf`（`chmod 600`）；
   - 执行 `manage.py migrate --noinput`、`manage.py collectstatic --noinput`、`manage.py init_prod_pilot`；
   - 按用户确认的用户名交互式创建管理员与发布者账号（强密码 ≥12 位，不落盘日志或仓库）。
4. **步骤 4（启动 systemd 服务与定时器）**：
   - 安装 `ops/prod-pilot/systemd/*.{service,timer}` 至 `/etc/systemd/system/`，`systemctl daemon-reload` 并启动 `zhaohui-admin-gunicorn`、`zhaohui-event-forwarder` 与 4 个 timer；
   - **验证**：`curl -fsS http://127.0.0.1:18000/login/` 返回 200，`curl -fsS http://127.0.0.1:18081/healthz` 返回 `{"status":"ok",...}`。
5. **步骤 5（Nginx 灰度生效，零停机 reload）**：
   - 备份原 `/etc/nginx/sites-available/jszhff.cn` 为 `jszhff.cn.bak.pre-pilot`；
   - 安装 `nginx-log-format.conf`、`nginx-admin-subdomain.conf` 与 `nginx-jszhff-pilot.conf`；
   - 执行 `nginx -t` 通过后 `systemctl reload nginx`；
   - **验证**：`https://jszhff.cn/`、`https://jszhff.cn/products/tanks/` 返回 200；`https://admin.jszhff.cn/login/` 返回 200（仅账号密码框，无验证码）；`https://admin.jszhff.cn/api/ingest/event` 返回 403；`wuxifangfu.cn` 与 `zhaohuifangfu.com` 状态无变化。
6. **步骤 6（本地构建并原子发布含匿名埋点的 `jszhff.cn` 版本）**：
   - 在本地开发机运行 `bash ops/prod-pilot/build_and_stage.sh --activate --target zhaohui`；
   - 浏览器访问 `https://jszhff.cn/` 及产品页并触发一次简报复制，60 秒后在 `https://admin.jszhff.cn/overview/` 核对：页面浏览量、简报复制成功、Nginx 网关请求数、外部 HTTPS 探测（证书剩余天数）、`未启用线上收件` 标识均正常入账；
   - 执行一次 `systemctl start zhaohui-db-backup.service` 验证首份 `.sql.gz` + `.sha256` 落盘，以及 `manage.py prune_old_data --dry-run` 确认正常退出；
   - **解耦复验**：短暂 `systemctl stop zhaohui-admin-gunicorn` 3 秒期间验证 `https://jszhff.cn/` 返回 HTTP 200，随后恢复启动。

### 3.3 秒级回滚方法（任一步骤异常均可即时回退）

1. **官网静态页秒级回滚（不依赖 Django）**：
   ```bash
   # 在源站直接原子切回上线前的既有版本 20261126-143000
   bash /opt/zhaohui-admin/ops/prod-pilot/rollback_prod.sh --version 20261126-143000
   ```
2. **Nginx 配置回滚**：
   ```bash
   cp -a /etc/nginx/sites-available/jszhff.cn.bak.pre-pilot /etc/nginx/sites-available/jszhff.cn
   rm -f /etc/nginx/sites-enabled/admin.jszhff.cn /etc/nginx/conf.d/zhaohui-metrics-log-format.conf
   nginx -t && systemctl reload nginx
   ```
3. **后台服务与定时任务停用（零影响官网）**：
   ```bash
   systemctl disable --now \
     zhaohui-admin-gunicorn.service \
     zhaohui-event-forwarder.service \
     zhaohui-log-aggregator.timer \
     zhaohui-probe.timer \
     zhaohui-db-backup.timer \
     zhaohui-data-prune.timer
   ```

---

## 四、正式点击「批准部署上线」前需用户确认的极简清单

在您下达「批准正式部署上线」指令前，请最后确认以下 **4 项**：

1. **管理后台子域名与 DNS 解析**：
   - 是否确定使用 **`admin.jszhff.cn`** 作为独立管理子域？（若改用其他子域请直接告知）；
   - 当前 `admin.jszhff.cn` 尚无 DNS 解析记录，请确认您已（或即将）在 DNS 服务商处添加 A 记录 **`admin.jszhff.cn -> 47.102.192.214`**，以便 Certbot 签发正式 HTTPS 证书。
2. **首批个人运营账号用户名**：
   - 请确认您本人需要创建的**管理员账号**与**发布者账号**的登录用户名（或是否合并为同一个超级管理员账号兼任发布，还是分设两个用户名，例如 `zhaohui_owner` 与 `zhaohui_pub`）。初始密码将在部署时安全生成并通过受控方式交付，不写入代码仓库。
3. **对 `zhaohuifangfu.com` 源站现状的确认**：
   - 预检发现源站当前已将 `zhaohuifangfu.com` 安全暂停（`ssl_reject_handshake on` / `444`），另存有未启用的 `zhaohuifangfu.com.ready` 与 `lego` 证书。请确认本次试点**继续保持 `zhaohuifangfu.com` 原状不动**（后续取得 ICP 备案号后再按独立目录与独立备案号单独放行）。
4. **授权执行部署与 3 个标准 APT 包安装**：
   - 确认批准按上述步骤在 `zhaohui` 安装 `python3-venv`、`libmariadb-dev`、`pkg-config`，创建独立库 `zhaohui_admin`，部署 systemd 服务、Nginx 配置及 `jszhff.cn` 首个试点版本。
