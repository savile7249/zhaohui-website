# 兆辉化工设备官网更新日志

本仓库维护兆辉化工设备官网（`https://jszhff.cn/`）静态站点源码，以及配套的多域名网站监测与内容发布管理后台。本文档按时间倒序记录仓库各阶段变更；开发约定、设计规范与历次设计验收记录分别见 [AGENTS.md](AGENTS.md)、[DESIGN.md](DESIGN.md) 与 [design-qa.md](design-qa.md)。

## 2026-11-27

### 18 款子产品页、技术文章、顶部导航栏重设计与内容发布工作台（`0db2ede`）

- **产品目录与子详情页**：在 `content/managed-catalog.json` 中将四类设备的细分目录扩展为 18 款独立静态子产品页（储罐 5 款、反应釜 6 款、塔器 4 款、管道与管件 3 款），配套 18 篇选型与工艺技术文章，通过受控 Markdown 渲染器（`lib/markdown.ts`）静态输出；子产品页展示标准化规格种类表（未核定参数项前台显示「按项目工况核定」）、关联文章与同系设备切换。
- **图集跳转与视觉适配**：将四类设备大类页 `#gallery` 实拍图集调整为直达对应子产品页的入口，按设备数量适配桌面均衡网格；为复用大类实拍主图的机型新增满幅暗底展示样式，白底精修图保留原有呈现方式。
- **全站顶部导航栏重设计**：新增共享页头组件 `components/site-header.tsx`，统一接入首页、四类设备大类页、子产品与文章页以及自定义 404 页面；左侧采用品牌标识、竖向分隔线与主导航排布，右侧保留双行公开联系电话与携带设备上下文的「询价准备」入口，适配深浅区块切换、`prefers-reduced-motion` 及 900 px 以下移动端抽屉菜单，并同步更新 [DESIGN.md](DESIGN.md)。
- **SEO 与询价联动**：以可编程 `app/sitemap.ts`（`force-static`）替换静态 `app/sitemap.xml`；为子产品页和技术文章页补充 `BreadcrumbList`、`Product` 与 `TechArticle` JSON-LD 结构化数据；支持通过 `/?product=<category>&variant=<variant>#brief` 预填细分机型询价简报并记录子路径归因。
- **内容发布工作台扩展**：扩展 `admin-platform/` 下的 `/publishing/zhaohui/` 发布工作台，新增图片素材库与上传格式和尺寸校验、子产品规格可视化编辑与 CSV 和 JSON 批量导入、关联文章 Markdown 导入与实时预览、内容红线自动校验及审核门禁；新增本地 SQLite 快捷启动脚本 `ops/local-cms/start.sh` 并补充发布模块自动化测试。

### 生产试点阶段 B 配置同步与最终验收（`facb8ee`）

- 将管理后台生产配置模板（`ops/prod-pilot/nginx-admin-subdomain.conf`、`admin-platform/.env.production.example`、`admin-platform/config/settings.py`）中的默认管理域名同步为 `admin.wuxifangfu.cn`。
- 新增阶段 B 正式上线最终验收报告 [docs/prod-pilot-final-report.md](docs/prod-pilot-final-report.md)，记录管理子域 HTTPS 证书、安全响应头与后台公网访问验收结论。

## 2026-11-26

### `jszhff.cn` 生产试点部署包与阶段 A 上线验证（`23092c5`、`0c652fe`）

- 新增生产试点预检报告 [docs/prod-pilot-preflight.md](docs/prod-pilot-preflight.md) 与阶段 A 部署验收报告 [docs/prod-pilot-phaseA-report.md](docs/prod-pilot-phaseA-report.md)。
- 新增生产部署与运维脚本包 `ops/prod-pilot/`，包含静态构建与版本切换脚本（`build_and_stage.sh`）、版本回滚脚本（`rollback_prod.sh`）、Nginx 配置与指标日志格式模板、`/_track/event` 回环转发器、Nginx 日志汇总脚本、MariaDB 备份脚本及 systemd 服务与定时器配置。
- 在管理后台新增生产试点初始化命令 `init_prod_pilot` 与历史数据定期清理命令 `prune_old_data`（事件与探测记录保留 180 天，汇总指标与审计日志保留 365 天）。

### 多域名网站监测与管理后台 v1.0（`2d37485`）

- 新增基于 Django 5.2、MariaDB 与 Gunicorn 的管理后台 `admin-platform/`，提供多站点与多域名隔离、基于角色的访问控制（RBAC）及只读审计日志。
- 实现三路监测能力：前台轻量匿名埋点组件 `components/site-tracker.tsx`、网关访问日志指标汇总及外部 HTTPS 与 TLS 可用性探测；自动剥离查询参数与表单敏感字段，在运营总览页区分「真实零访问」「数据中断」「待备案」「未接入」四种状态。
- 实现受管内容草稿编辑、带 SHA-256 校验的构建快照、多域名独立备案字段预览、审核发布与回滚机制，保持静态官网服务与后台运行解耦。
- 新增 `ops/test-env/` 本地隔离测试环境启停、端到端自动化验证与 MariaDB 备份恢复演练脚本，并补充测试报告 [docs/multisite-v1-test-report.md](docs/multisite-v1-test-report.md)。

### 文档更新与历史截图清理（`4244814`）

- 更新 [AGENTS.md](AGENTS.md)、[DESIGN.md](DESIGN.md) 与 `.gitignore`，清理早期纳入仓库的对比截图与设计原型原图，将验收截图移出版本控制；同步整理四类设备几何生成脚本与生成文件中的路径注释。

### 询价上下文保留与图集交互优化（`2ed463f`）

- 修复从四类设备详情页进入首页询价简报时未保留对应设备类型的问题，完善 `app/brief-workbench.tsx` 与 `app/products/product-data.ts` 的询价参数传递。
- 优化 `app/products/product-gallery.tsx` 的产品实拍查看交互与样式表现。

### 网站图标矢量化替换（`61fc9ba`）

- 使用官方矢量品牌标识重新生成 `app/icon.svg`、`app/favicon.ico` 与 `app/apple-icon.png`。

### 首页设备区排版修正（`557e0de`）

- 移除首页设备展示区中的细分型号标签框，保持工业信息层级简洁。

### 首页与四类产品详情页正式改版上线 `jszhff.cn`（`fc24979`）

- **全新首页上线**：正式启用改版后的首页 `/`，覆盖企业概况、核心设备入口、应用行业、资质证书与专利浏览（`app/credentials-explorer.tsx`）、合作客户轨道墙（`app/partner-orbit-wall.tsx`）、制造流程与浏览器端询价简报生成器（`app/brief-workbench.tsx`）；建立 `app/site.css` 原生 CSS 设计令牌体系与 GSAP 滚动显现交互。
- **四类设备详情页升级**：上线 `/products/tanks/`、`/products/reactors/`、`/products/towers/` 与 `/products/piping/` 四个独立详情页，切换为实拍 WebP 影像并配备轴测结构装配演示组件（`*-assembly.tsx` 与 `build-*.mjs`）；移除旧版 `/products` 总览页、旧动态详情页及未使用的占位大图。
- **静态导出与 SEO 基础设施**：新增 `next.config.mjs` 并启用静态导出（`output: "export"`、`trailingSlash: true`、`images.unoptimized: true`），补齐 `metadataBase`、OpenGraph、JSON-LD、`robots.txt`、`sitemap.xml`、自定义深色 `404.html`、明暗双版页头 Logo 及全站页脚公开联系方式。
- **项目规范建立**：新增 [DESIGN.md](DESIGN.md) 设计规范，完善 [AGENTS.md](AGENTS.md) 工程与内容边界说明，并在 [design-qa.md](design-qa.md) 中补充正式上线验收结论。

## 2026-08-29

### 新增产品总览与设备详情页（V2，`0ba8536`）

- 新增产品总览页 `/products` 与静态预渲染详情页 `/products/[slug]`（覆盖储罐、反应釜、塔器与管道），抽取共用页眉页脚组件 `components/site-chrome.tsx` 与产品数据模块 `app/products/product-data.ts`。
- 在 [design-qa.md](design-qa.md) 中补充产品页 V2 的桌面端与移动端设计验收记录。

## 2026-08-16

### 项目初始化与首页初版（Demo V1，`10205b0`）

- 初始化基于 Next.js（App Router）、React 与 TypeScript 的官网代码仓库。
- 实现首页初版 12 栏工业布局、色彩令牌、滚动显现组件 `components/reveal.tsx` 及移动端响应式菜单，并记录首轮 [design-qa.md](design-qa.md) 设计验收结论。
