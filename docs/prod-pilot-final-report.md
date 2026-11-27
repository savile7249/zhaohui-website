# 兆辉首个生产试点（`jszhff.cn` + `admin.wuxifangfu.cn`）正式上线最终验收报告

> **完成时间**：2026-11-27
>
> **目标源站**：`zhaohui`（`iZuf680ykik578hkf71sq1Z`，公网 IP `47.102.192.214`，Ubuntu 24.04.4 LTS）
>
> **交付边界确认**：阶段 A（基础与试点采集上线）与阶段 B（管理子域正式 HTTPS 证书与公网启用）均已完成并通过端到端公网实测；**老站 `wuxifangfu.cn`（Nginx/PHP 5.6/`zhaohui_site` 库）全程零改动**；**`zhaohuifangfu.com` 继续保持公网暂停**；**在线询盘收件保持关闭**；管理入口严格保持**仅账号 + 强密码登录（无验证码、无 mTLS、无硬性 IP 白名单）**；未向远端 push 且未合并 `main`。

---

## 一、生产入口、证书与凭据信息

| 项 | 生产状态 | 说明 |
|---|---|---|
| **管理后台正式入口** | `https://admin.wuxifangfu.cn/login/` | HTTP 自动 `301` 跳转 HTTPS；登录方式为仅账号 + 强密码（无 CAPTCHA / 无 mTLS / 无 IP 白名单） |
| **运营总览 / 发布台 / Admin** | `/overview/`、`/publishing/zhaohui/`、`/admin/` | 均实测 **HTTP 200**，所有写入与导出记入只读审计日志 |
| **首个试点官网入口** | `https://jszhff.cn/` | 当前生效版本 `releases/20261126-233711`，静态完全解耦（Gunicorn 停机不影响 HTTP 200） |
| **管理员兼发布者账号** | 用户名 `zhaohui_owner` | 超级管理员 + `zhaohui` 站点管理员/发布者（库内唯一账号，无任何测试账号） |
| **本机初始凭据文件** | `/home/savil/.config/zhaohui-admin-prod-credentials.txt` | `chmod 600` 仅本机保存，已同步登录地址为 `https://admin.wuxifangfu.cn/login/`（报告与仓库均不含明文密码） |
| **管理子域 TLS 证书** | Let's Encrypt ECDSA（`/etc/letsencrypt/live/admin.wuxifangfu.cn/fullchain.pem`） | `CN=admin.wuxifangfu.cn`（SAN：`DNS:admin.wuxifangfu.cn`），签发方 `Let's Encrypt YE1`，有效期 **`2026-11-27 05:16:03 GMT` 至 `2027-02-25 05:16:02 GMT`** |
| **证书自动续期验证** | **PASS** | `certbot renew --dry-run --cert-name admin.wuxifangfu.cn` 模拟续期全部通过，由系统 `certbot.timer` 自动维护 |
| **公网安全隔离策略** | **PASS** | `X-Robots-Tag: noindex, nofollow`、`Strict-Transport-Security: max-age=31536000`、`X-Frame-Options: DENY`、`/robots.txt` 禁止抓取、`POST /api/ingest/event` 返回 **HTTP 403** 封堵公网写入 |

---

## 二、阶段 B 端到端公网实测验收结果

### 2.1 公网 DNS、HTTPS 与安全头验收
- **DNS A 记录**：`@223.5.5.5`、`@114.114.114.114` 与源站 `getent ahosts admin.wuxifangfu.cn` 均解析至 `47.102.192.214`。
- **HTTP → HTTPS 跳转**：`curl -sSI http://admin.wuxifangfu.cn/` → `HTTP/1.1 301 Moved Permanently` → `Location: https://admin.wuxifangfu.cn/`。
- **HTTPS 登录页与响应头**：`https://admin.wuxifangfu.cn/login/` → `HTTP/2 200`，响应头实测包含 `x-robots-tag: noindex, nofollow`、`strict-transport-security: max-age=31536000`、`x-frame-options: DENY`、`x-content-type-options: nosniff`、`referrer-policy: same-origin`、`csrftoken` Cookie 具备 `HttpOnly; SameSite=Lax; Secure`。
- **无验证码核验**：页面源码确认不含任何 `captcha` / `recaptcha` / `hcaptcha` / `turnstile` 组件。
- **公网 ingest 封堵**：`POST https://admin.wuxifangfu.cn/api/ingest/event` → **HTTP 403**。

### 2.2 真实 Chromium 公网登录与实时数据验收（Playwright 实测 0 报错）
- 使用真实 Chromium 访问 `https://admin.wuxifangfu.cn/login/`，读取本机 `chmod 600` 凭据以 `zhaohui_owner` 实测登录：
  - **`/overview/`（HTTP 200）**：已实时展示自 `2026-11-26 22:37:53` 上线以来的真实公网采集数据：页面浏览量 **`37`**（产品详情 `13` 次、单页导航 `17` 次）、Nginx 网关请求 **`3141`**（文档 `1850` / 静态资源 `1291` / `5xx: 0`）、外部 HTTPS 探测 `HTTP 200`（`jszhff.cn` 证书剩余 `63` 天、首页标记正常、耗时 `40.12 ms`）、4 类产品浏览排行、`zhaohuifangfu.com` 标记为「待备案（公网关闭）」、以及醒目的「**未启用线上收件**」状态与审计日志（含 11-27 `03:46:35` 自动执行的 `system.prune_old_data` 记录）。
  - **`/publishing/zhaohui/`（HTTP 200）**：完整加载 4 类受管产品（储罐、反应釜、塔器、管道与管件）与公开联系方式。
  - **`/admin/`（HTTP 200）**：Django Admin 正常加载并受站点权限控制。
  - **登出验证**：测试完毕通过 `/logout/` 正常登出跳转回 `/login/`；全程 `0` JS 报错、`0` HTTP ≥400 请求错误。

### 2.3 公网验收截图证据（已核查不含密码或隐私）
1. 登录页（无验证码、仅账号密码）：
   - `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots-prod/01-prod-admin-login.png`
2. 运营总览页（实时公网监测数据、外部探测与未启用线上收件）：
   - `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots-prod/02-prod-admin-overview.png`

### 2.4 回归、隔离与源站实时资源复验
- **官网全路由回归**：`https://jszhff.cn/` 及 `/products/{tanks,reactors,towers,piping}/` 全部 **HTTP 200**。
- **老站与待备案域零影响**：
  - `/etc/nginx/sites-available/wuxifangfu`（原时间 `Aug 4 13:01`、`1540` 字节）未改动，`wuxifangfu.cn` 返回正常（HTTP `301` / HTTPS `302`）；
  - `zhaohui_site` 数据库完好（31 张表未动），`zhaohui_admin` 独立隔离（24 张表）；
  - `zhaohuifangfu.com` 保持暂停不动（443 拒握手 `tlsv1 unrecognized name` / 80 关闭连接 `444`），未触碰 `.ready` 与 `lego` 证书。
- **后台服务与定时任务（含隔夜自动执行验证）**：
  - `zhaohui-admin-gunicorn.service`、`zhaohui-event-forwarder.service` 均为 `active`；
  - `zhaohui-log-aggregator.timer`（每 60s）、`zhaohui-probe.timer`（每 5min）、`zhaohui-db-backup.timer`（已于 `2026-11-27 03:15:24 CST` 自动运行）、`zhaohui-data-prune.timer`（已于 `2026-11-27 03:46:34 CST` 自动运行）全部 `active`。
- **源站实时资源占用**：
  - 负载：`load average: 0.03, 0.03, 0.00`
  - 内存：总计 `3499 MiB`，已用 **`836 MiB`**，**剩余可用 `2662 MiB`**（Swap `0`）
  - 进程 RSS：Gunicorn 合计 `114.4 MiB`，`event_forwarder.py` `22.6 MiB`，`mariadbd` `125.3 MiB`，Nginx 合计 `30.6 MiB`。

---

## 三、已同步的仓库模板与应急回滚命令

- 仓库内生产模板（`ops/prod-pilot/nginx-admin-subdomain.conf`、`admin-platform/.env.production.example`、`admin-platform/config/settings.py`）已同步默认管理域名为 `admin.wuxifangfu.cn` 并完成本地提交（未推送远端、未合并 `main`）。

### 应急秒级回滚命令（备查）

```bash
# 1. 仅下线公网管理后台入口（不影响 jszhff.cn 官网与老站 wuxifangfu.cn）
rm -f /etc/nginx/sites-enabled/admin.wuxifangfu.cn
nginx -t && systemctl reload nginx

# 2. 秒级原子回滚 jszhff.cn 静态官网至试点前基线版本 20261126-143000
bash /opt/zhaohui-admin/ops/prod-pilot/rollback_prod.sh --version 20261126-143000

# 3. 如需完整撤回试点 Nginx 与后台服务
cp -a /etc/nginx/sites-available/jszhff.cn.bak.pre-pilot /etc/nginx/sites-available/jszhff.cn
rm -f /etc/nginx/sites-enabled/admin.wuxifangfu.cn /etc/nginx/conf.d/zhaohui-metrics-log-format.conf
nginx -t && systemctl reload nginx
systemctl disable --now zhaohui-admin-gunicorn.service zhaohui-event-forwarder.service \
  zhaohui-log-aggregator.timer zhaohui-probe.timer zhaohui-db-backup.timer zhaohui-data-prune.timer
```
