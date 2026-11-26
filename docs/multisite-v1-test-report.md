# 兆辉多域名网站监测与管理后台 v1.0 — 本地隔离测试环境交付与验收报告

> **依据文档**：《多域名网站监测与管理后台计划书》v1.0（`/home/savil/Artifacts/zhaohui-multisite-plan/多域名网站监测与管理后台计划书-v1.0.pdf`，SHA-256：`820ba361e6beaf048534f807157e1abb09781f42222af8082c27d6db4a52c7dc`）  
> **执行环境**：隔离本地子工作树 `/home/savil/orca/workspaces/zhaohui/multisite-monitor-admin-v1`（分支 `savile7249/multisite-monitor-admin-v1`）  
> **安全边界确认**：全程未触碰任何线上服务器、生产数据库、生产 Nginx、DNS 或公网域名；`zhaohuifangfu.com` 保持「待备案」且公网关闭；未实现或启用在线询盘收件功能；未 push 至远端且未合并 `main`。

---

## 1. 本地隔离测试环境说明与一键入口

### 1.1 技术栈与数据库环境说明
- **公开官网静态导出**：保持 Next.js 16（`output: "export"`、`trailingSlash: true`）完整静态导出与现有设计/内容口径，新增极轻量相对路径匿名埋点（`/_track/event`）与构建期快照覆盖能力（未传 `ZHAOHUI_SNAPSHOT_PATH` 时与原版官网完全一致）。
- **管理后台与总览**：Django 5.2.19 LTS + `mysqlclient 2.3.2` + Gunicorn 27.0.1（绑定 `127.0.0.1:18000`），提供 Django Admin 与面向运营的中文总览页、受管内容与发布工作台。
- **真实隔离 MariaDB 测试库（用户态 LTS 二进制实例）**：
  - 因本机未安装系统 `mariadbd` 且当前用户不在 `docker` 组，经协调者批准采用官方 MariaDB LTS Linux 二进制包在隔离目录运行完整真实 MariaDB 服务端（未降级为 SQLite，不触碰系统目录或默认 `3306` 端口）：
  - **精确版本**：MariaDB `11.4.14-MariaDB` (`mariadb-11.4.14-linux-systemd-x86_64.tar.gz`)
  - **官方下载源**：`https://downloads.mariadb.org/rest-api/mariadb/11.4.14/mariadb-11.4.14-linux-systemd-x86_64.tar.gz`
  - **官方 SHA-256 校验和**：`6fa13ea11d07a53ae4795c8c3736dc5aa99c2ef22ece754cff07363dc1faba0d`（已通过 `sha256sum -c` 核验）
  - **本地隔离位置**：二进制缓存于 `~/.cache/zhaohui-mariadb/mariadb-11.4.14-linux-systemd-x86_64/`，数据目录与 Socket 隔离于仓库 `.local-test-env/mariadb/`，监听 `127.0.0.1:13306`（测试库 `zhaohui_admin_test`）。
  - **上线兼容性提醒**：源站按计划书已自带 MariaDB；正式上线前需核对源站 MariaDB 具体小版本、字符集（`utf8mb4`）与 `STRICT_TRANS_TABLES` 模式兼容性。
- **本地隔离可信网关**：`admin-platform/gateway/server.py`，绑定 `127.0.0.1:18080`（HTTP）与 `127.0.0.1:18443`（HTTPS，本地自签测试 CA），直接从 `.local-test-env/sites/<host>/current` 与 `preview` 提供静态文件服务（Django 停机不影响访客访问），代理 `/_track/event` 并注入 HMAC 签名头（`X-Gateway-Id` / `X-Gateway-Timestamp` / `X-Matched-Domain` / `X-Gateway-Signature`），按域名汇总页面文档请求、静态资源请求、耗时与 4xx/5xx 指标。

### 1.2 一键启停与复验命令
> 说明：为避免会话结束后残留孤立后台进程占用端口，交付前已执行 `ops/test-env/stop.sh` 干净停机。用户随时可在仓库根目录一条命令拉起并复验：

```bash
cd /home/savil/orca/workspaces/zhaohui/multisite-monitor-admin-v1

# 一键启动完整本地隔离测试环境（MariaDB + Django + 本地 HTTP/HTTPS 网关 + 初始发布与探测）
bash ops/test-env/start.sh

# 查看运行状态、PID、内存 RSS 与端口
bash ops/test-env/status.sh

# 一键执行全部四阶段端到端自动化复验（Django 单元测试 + Playwright E2E + 截图 + 停机验证 + 备份恢复 + 资源压测）
bash ops/test-env/verify-all.sh

# 单独执行 MariaDB 全库备份与灾难恢复演练
bash ops/test-env/backup_restore_drill.sh

# 一键优雅停止全部本地隔离服务
bash ops/test-env/stop.sh
```

### 1.3 本地测试访问入口（无需修改 `/etc/hosts`）

| 入口用途 | 访问地址 | 备注 |
|---|---|---|
| 运营总览与登录 | `http://127.0.0.1:18000/overview/` | 先选站点，再切换单域名或全部已启用域名 |
| 内容编辑与发布工作台 | `http://127.0.0.1:18000/publishing/zhaohui/` | 编辑草稿、生成快照、预览、审核、发布与回滚 |
| Django Admin | `http://127.0.0.1:18000/admin/` | 站点、域名、成员角色、网关凭据、审计日志 |
| 兆辉主域测试页 (`jszhff.cn`) | `http://jszhff.localhost:18080/` / `https://jszhff.localhost:18443/` | 首个试点域，备案号 `苏ICP备20000966号-6`，Canonical 指向 `https://jszhff.cn/` |
| 兆辉主域预览 | `http://preview-jszhff.localhost:18080/` | 预览流量自动排除不入账 |
| 兆辉待备案域离线预览 (`zhaohuifangfu.com`) | `http://preview-zhaohuifangfu.localhost:18080/` | 状态「待备案」且公网关闭，独立备案字段，Canonical 默认指向 `https://jszhff.cn/` |
| 模拟独立测试站 (`sim-site`) | `http://sim-site.localhost:18080/` / `https://sim-site.localhost:18443/` | 独立品牌、独立内容、独立备案 `沪ICP备00000001号-测试`，Canonical 指向自身 |
| MariaDB 隔离测试库 | `127.0.0.1:13306`（库名 `zhaohui_admin_test`） | 用户 `zhaohui_app`，仅本地监听 |

### 1.4 测试账号与角色矩阵（均满足 ≥12 位强密码校验）

| 账号 | 密码（仅限本地测试） | 授权站点 | 角色 | 权限边界 |
|---|---|---|---|---|
| `platform_admin` | `Plat@Adm2026!#80` | 全站 | 平台超级管理员 | 管理站点、域名、成员、网关凭据、只读审计日志 |
| `zhaohui_admin` | `Zh@Adm2026!#86` | `zhaohui` | 站点管理员 | 仅限管理兆辉站点域名与成员，无法查看模拟站 |
| `zhaohui_publisher` | `Zh@Pub2026!#83` | `zhaohui` | 兆辉发布者 | 审核快照、选择目标域名发布与一键回滚，无法跨站 |
| `zhaohui_editor` | `Zh@Edit2026!#81` | `zhaohui` | 兆辉编辑 | 修改兆辉受管产品/联系草稿并触发预览，无法审核/发布/跨站 |
| `zhaohui_viewer` | `Zh@View2026!#82` | `zhaohui` | 兆辉查看者 | 只读兆辉总览与导出报表，禁止进入编辑/发布/Admin |
| `sim_editor` | `Sim@Edit2026!#84` | `sim-site` | 模拟站编辑 | 仅编辑模拟站草稿与预览，无法读写兆辉任何数据 |
| `sim_viewer` | `Sim@View2026!#85` | `sim-site` | 模拟站查看者 | 仅只读模拟站总览与导出 |

---

## 2. 四阶段逐项验收结果与证据（对照计划书第 4 页）

### 自动化验证总览
- **Next.js 类型检查与默认构建**：`npm run typecheck` 通过，`npm run build` 静态导出 12/12 路由通过。
- **Django 自动化测试（真实 MariaDB 11.4.14 测试库）**：`manage.py test core --noinput --verbosity=2` **7/7 全部通过（0 失败，耗时 3.36s）**。
- **Playwright Chromium 端到端验证**：`ops/test-env/e2e_verify.mjs` **全部断言通过**，生成 11 张真实截图证据。
- **后台停机可用性测试**：停止 Gunicorn Django（`18000` 不可达）期间，访问 `http://jszhff.localhost:18080/`、`/products/tanks/` 及 `http://sim-site.localhost:18080/` 全部返回 **HTTP 200**。
- **MariaDB 备份恢复演练**：`mariadb-dump` 逻辑全备（94,921 字节，SHA-256 `9357055faa087cdf462cc94093c199810a59dc04c56992aa8607d84da9df096f`）→ 模拟篡改受管产品名并清空事件表 → 全库恢复 → 6 张核心表行数与受管内容 100% 一致恢复。

### 逐阶段验收对照表

| 阶段 | 计划书第 4 页通过条件 | 实测结果 | 关键证据与截图路径 |
|---|---|---|---|
| **阶段一：站点和权限** | 建立兆辉、两个域名及一个模拟独立站点；本站编辑从列表、详情、直接请求与导出均无法读取或修改另一站数据；独立查看者只能看报表；写入与导出留审计日志 | **PASS** | 1) 已初始化 `zhaohui`（`jszhff.cn` 已启用 + `zhaohuifangfu.com` 待备案且公网关闭）与 `sim-site`（`sim-site.localhost`）；<br>2) 双向跨站隔离测试（`zhaohui_editor` ↔ `sim_editor`）覆盖列表、Admin 详情页（HTTP 403）、`/overview/?site=`、JSON API、POST 保存与 CSV/JSON 导出（均 HTTP 403）；<br>3) `zhaohui_viewer` 仅可查看报表与导出，访问 `/publishing/zhaohui/` 返回 403，导出记录至 `AuditLog`；<br>4) 强密码校验拒绝弱口令。<br>截图：`01-django-admin-domains.png`、`02-django-admin-auditlog.png` |
| **阶段二：数据监测** | 用测试域名运行已知浏览与点击，汇总等于各域名计数之和；区分采集故障与真实零访问；模拟首页错误、证书告警与恢复；检查统计里没有表单正文 | **PASS** | 1) 真实 Chromium 驱动 `jszhff.localhost` 产生 5 次浏览（含 3 次 SPA 导航）、1 次简报复制成功（先注入剪贴板失败确认计数为 0，再成功计为 1）、1 次点击电话、1 次点击邮箱；伪造 `"site":"sim-site"` 请求经可信网关覆盖归属至 `zhaohui`；`preview-jszhff.localhost` 流量自动排除；`sim-site.localhost` 独立计 2 次浏览；站点汇总严格等于各已启用域名之和；<br>2) 单元测试与线上 E2E 完整验证 **真实零访问 / 数据中断 / 待备案 / 未接入** 四态；<br>3) 注入首页 503 错误并切换 5 天临期测试证书，外部探测触发 `home_error` 与 `tls_expiring`（余 4 天）双告警并保留最后成功时间；恢复后告警均转为「已恢复」；<br>4) 核验数据库与 JSON/CSV 导出零表单输入、零电话/邮箱正文、零剪贴板内容、零查询字符串；总览醒目标注「未启用线上收件」。<br>截图：`03-overview-fault-tls-warning.png`、`04-overview-zhaohui-recovered.png`、`05-overview-sim-site.png` |
| **阶段三：内容与发布** | 同一产品修改一次可预览到两个测试域名，备案字段分别正确；模拟独立站点内容保持原样；发布失败继续提供旧版；回滚后核对页面和资源；演练数据库备份恢复 | **PASS** | 1) `zhaohui_editor` 单次修改 `tanks` 为「防腐储罐（多域联动测试版）」，生成带 SHA-256 快照并同时预览到 `preview-jszhff.localhost`（页脚 `苏ICP备20000966号-6`、Canonical `https://jszhff.cn/`）与 `preview-zhaohuifangfu.localhost`（页脚 `待备案（zhaohuifangfu.com 离线预配置）`、Canonical 保留 `https://jszhff.cn/`）；`sim-site.localhost` 内容、备案号与自身 Canonical 完全不受影响；<br>2) `zhaohui_publisher` 审核后模拟冒烟失败发布（`release-v20261126-003-008`），`jszhff.localhost` 保持提供旧版并记录失败与审计日志；<br>3) 正式发布新版本后一键回滚至 v1（`rollback-v20261126-001-010`），Chromium 校验回滚后首页与产品页全部 JS/CSS/WebP 静态资源 0 报错；<br>4) Django 停机期间静态页全部 HTTP 200；MariaDB 全库备份与恢复演练 100% 通过。<br>截图：`06-preview-jszhff-equipment-and-footer.png`、`06b-preview-jszhff-footer-icp.png`、`07-preview-zhaohuifangfu-equipment.png`、`07b-preview-zhaohuifangfu-footer-icp.png`、`08-sim-site-untouched.png`、`09-publishing-studio-history-rollback.png` |
| **阶段四：交付审阅** | 提交测试结果、资源占用、正式域名启用条件与回滚步骤 | **PASS** | 已交付一键启停/复验脚本、11 张真实截图、负载资源实测数据、同机评估、正式启用清单、生产回滚与备份恢复手册及上线前待确认清单。 |

### 截图证据清单（`/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/`）
1. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/01-django-admin-domains.png` — Django Admin 站点域名配置与 `zhaohuifangfu.com` 待备案关闭状态
2. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/02-django-admin-auditlog.png` — Django Admin 写入与导出审计日志列表
3. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/03-overview-fault-tls-warning.png` — 运营总览页：首页 HTTP 503 故障、TLS 证书临期（余 4 天）告警、四态说明与三路并排诊断
4. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/04-overview-zhaohui-recovered.png` — 兆辉官网运营总览页（故障与证书恢复后、「未启用线上收件」与时间口径完整展示）
5. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/05-overview-sim-site.png` — 模拟独立测试站运营总览页（跨站独立汇总）
6. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/06-preview-jszhff-equipment-and-footer.png` — `preview-jszhff.localhost` 产品更新预览（防腐储罐多域联动测试版）
7. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/06b-preview-jszhff-footer-icp.png` — `preview-jszhff.localhost` 页脚主域备案号（`苏ICP备20000966号-6`）
8. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/07-preview-zhaohuifangfu-equipment.png` — `preview-zhaohuifangfu.localhost` 离线预览复用同一更新产品
9. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/07b-preview-zhaohuifangfu-footer-icp.png` — `preview-zhaohuifangfu.localhost` 独立备案字段页脚
10. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/08-sim-site-untouched.png` — `sim-site.localhost` 内容、备案号与规范网址不受兆辉编辑影响
11. `/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots/09-publishing-studio-history-rollback.png` — 内容与发布工作台：受管字段边界、快照校验和、失败保护与一键回滚历史

---

## 3. 测试负载下资源占用实测与同机运行评估

### 3.1 实测数据（测试突发负载：60 次静态网关请求 + 20 次 Django 请求 + 网关指标汇总入库，耗时 0.11s）

| 组件 | 进程数 | 实测内存 RSS | 实测峰值 CPU | 磁盘占用 |
|---|---:|---:|---:|---:|
| MariaDB 11.4.14 隔离实例（`innodb_buffer_pool_size=128M`） | 1 | **158.2 MiB** | 14.4% | 159.3 MiB（数据目录） |
| Django 5.2 + Gunicorn（2 workers × 4 threads） | 3 | **126.2 MiB** | 15.7%（稳态 ~2.3%） | — |
| 本地测试网关（Python HTTP/HTTPS；生产由现有 Nginx 替代） | 1 | **31.6 MiB** | 0.7% | 124.3 MiB（多版本静态产物） |
| **合计（含测试网关）** | **5** | **315.9 MiB** | — | **285.7 MiB**（含备份 0.17 MiB） |

### 3.2 对照源站规格（2 vCPU / ~3.4 GiB 内存）的客观评估
- **常驻运行评估（可同机运行）**：生产环境无需运行 Python 测试网关（直接使用源站现有 Nginx 静态服务与日志/代理），实际新增常驻内存仅约 **130–180 MiB**（Gunicorn 2 workers）+ 独立 MariaDB 数据库表空间占用（复用源站 MariaDB 实例或限额 `innodb_buffer_pool_size` 增量约 **128–256 MiB**），合计增量 **< 400 MiB**，远低于 3.4 GiB 内存上限，日常 CPU 开销处于个位数百分比区间。
- **静态构建约束（严禁在源站直接执行 `next build`）**：Next.js 16 静态构建在瞬时编译阶段会拉起多线程编译并消耗较多 CPU/内存（测试机 11 workers 编译耗时 ~4.6s）。严格遵守计划书第 3 页建议：**静态构建必须放在本地开发机或 CI 完成，仅将校验通过的版本化静态产物同步至源站 `releases/<version>` 并原子切换 `current` 软链**。
- **综合结论**：在遵守「构建离线/CI 化、旧站数据库独立保留、Nginx 静态服务与后台解耦、配置定时逻辑备份与版本保留上限（如保留最近 5 个静态发布版本）」的前提下，**Django 管理后台与独立 MariaDB 业务库可以在现有 2 vCPU / 3.4 GiB 源站安全同机运行**。

---

## 4. 正式域名启用条件清单（生产试点与分步放行）

> **试点策略**：**首个生产试点域名固定为 `jszhff.cn`**；**`zhaohuifangfu.com` 在取得 ICP 备案核准并完成下方全套核验前，严禁开启公网解析与 Nginx 放行**。

### 4.1 首个生产试点（`jszhff.cn`）上线前必查项
1. **源站隔离**：在源站 MariaDB 创建独立数据库与专属账号，**不触碰旧站既有数据库**；核对源站 MariaDB 版本与 `utf8mb4` 配置。
2. **后台强安全配置**：
   - 生成独立高强度 `DJANGO_SECRET_KEY`、`ZHAOHUI_GATEWAY_SECRET` 与数据库密码；
   - 后台管理入口（`/admin/`、`/overview/`、`/publishing/`）仅通过内网/VPN/IP 白名单 + HTTPS 访问，`DEBUG=0`，开启 `SESSION_COOKIE_SECURE=True`、`CSRF_COOKIE_SECURE=True`；
   - 更换全部测试默认账号，按实际审批名单创建强密码运营账号。
3. **Nginx 静态解耦与可信网关接入**：
   - Nginx 直接以 `/srv/sites/jszhff.cn/current` 为 `root` 提供静态页（确保停止 Gunicorn 后官网访问仍返回 HTTP 200）；
   - Nginx 独立 `location = /_track/event` 反代至本机 `127.0.0.1:18000/api/ingest/event`，由 Nginx/可信前置组件注入网关签名头与匹配的 `$host`；
   - Nginx 配置包含 `$host`、`$status`、`$request_time`、`$uri` 的分域名访问日志，定时汇总推送 `/api/ingest/gateway-metrics`。
4. **内容与合规核验**：
   - 核对导出首页与 4 个产品页内容、`<link rel="canonical">`、`苏ICP备20000966号-6`、已核准图片与公开联系方式；
   - 确认总览页显示「从开始采集之日起」与「未启用线上收件」，且监测统计不包含任何表单输入、电话、邮箱或剪贴板正文。
5. **外部探测与告警联调**：确认外部探测源可独立探测 `https://jszhff.cn/` 的 HTTPS 握手、证书到期日与首页标记，并打通告警通知接收人。

### 4.2 待备案域名（`zhaohuifangfu.com`）后续单独启用条件
1. 取得管局正式 **ICP 备案核准号**，并在后台将该域名的 `icp_number` 更新为真实核准备案号；
2. 审核 `canonical_policy`（与 `jszhff.cn` 共用完全相同内容时，保持 `primary_domain` 指向 `https://jszhff.cn/`，避免重复页面降权）；
3. 先在离线预览环境核对页脚备案号、备案查询链接、全站页面与静态资源；
4. 完成 DNS 解析配置与有效 HTTPS 证书签发；
5. 由项目负责人书面批准后，在后台将状态由「待备案」切换为「已启用」并放行公网 Nginx 虚拟主机与外部探测。

---

## 5. 生产回滚步骤与 MariaDB 备份恢复操作手册

### 5.1 静态站点一键回滚 SOP（秒级原子切换）
1. **方式一（后台一键回滚，推荐）**：
   - 由发布者登录 `内容与发布工作台` → `05 发布历史、失败保护与一键回滚`；
   - 找到目标域名最近一次「成功」的历史版本，点击「回滚到此版本」；
   - 系统自动复核目标产物目录的 HTML、备案号、Canonical 与全部本地 JS/CSS/WebP 资源 → 原子替换 `current` 软链 → 写入 `release.rollback` 审计日志。
2. **方式二（Django 停机时的源站应急手工回滚）**：
   ```bash
   # 1. 查看目标域名历史版本目录
   ls -lt /srv/sites/jszhff.cn/releases/

   # 2. 原子切换软链（ln -sfn + mv -Tf 避免切换瞬间 404）
   ln -sfn /srv/sites/jszhff.cn/releases/<目标历史版本> /srv/sites/jszhff.cn/.current.rollback
   mv -Tf /srv/sites/jszhff.cn/.current.rollback /srv/sites/jszhff.cn/current

   # 3. 核验首页、产品页与静态资源
   curl -fsSI https://jszhff.cn/
   curl -fsSI https://jszhff.cn/products/tanks/
   ```

### 5.2 MariaDB 逻辑备份与恢复操作手册
1. **每日定时全库逻辑备份（建议 cron 凌晨执行并同步异地副本）**：
   ```bash
   TS=$(date +%Y%m%d-%H%M%S)
   mariadb-dump \
     --single-transaction \
     --routines \
     --triggers \
     --hex-blob \
     --databases zhaohui_admin \
     | gzip > /var/backups/zhaohui-admin/zhaohui_admin-${TS}.sql.gz
   sha256sum /var/backups/zhaohui-admin/zhaohui_admin-${TS}.sql.gz \
     > /var/backups/zhaohui-admin/zhaohui_admin-${TS}.sql.gz.sha256
   ```
2. **故障恢复步骤（已在本地隔离测试环境实测通过）**：
   ```bash
   # 1. 停止 Django 写入（不影响 Nginx 静态官网服务）
   systemctl stop zhaohui-admin-gunicorn

   # 2. 校验备份文件 SHA-256
   sha256sum -c /var/backups/zhaohui-admin/zhaohui_admin-<TS>.sql.gz.sha256

   # 3. 导入恢复
   gzip -dc /var/backups/zhaohui-admin/zhaohui_admin-<TS>.sql.gz | mariadb -u root

   # 4. 核对核心表行数与最近审计记录，重启 Django 并检查总览
   systemctl start zhaohui-admin-gunicorn
   ```

---

## 6. 剩余问题与正式上线前需用户确认事项

1. **首批正式运营人员名单与角色分配**：确认管理员、发布审核人、编辑、查看者的具体人员清单及初始账号分发方式（本地测试密码仅限测试环境，严禁带入生产）。
2. **允许编辑的受管字段范围复核**：首版已严格限定为产品展示名称、产品简介、预核准图片清单与公开联系方式；正式启用前请确认是否维持该最小范围不变。
3. **告警通知接收人与通道**：确认首页故障、TLS 证书临期（默认 ≤14 天）与采集数据中断告警的接收人及通知渠道（邮件 / 企微 / 钉钉 / 短信）。
4. **监测与审计数据保留期限**：确认匿名页面事件明细、网关分钟汇总、探测日志与审计日志的保留周期与归档清理策略（例如明细 90/180 天、审计日志 ≥365 天）。
5. **外部探测服务商与付费配额**：本地测试环境采用独立外部探测命令 `manage.py run_probes`；生产环境需确认是否接入阿里云站点探测或自有异地探针节点及探测频率预算。
6. **Nginx 生产侧网关签名与日志汇总接入方式**：生产上线前需按源站现有 Nginx 模块环境确认签名注入方式（如轻量本机转发守护进程或 Nginx njs/Lua）及访问日志切分周期。
7. **后续是否需要开启在线询盘收件**：首版严格按计划保持「未启用线上收件」；若未来销售决定启用在线收件，须另行立项补充隐私告知、最小字段、销售权限、删除期限与通知失败重试机制。
