<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — 兆辉化工设备官网

> 上方区块由 `next dev` 自动维护，**不要改动标记之间的内容**；本文件其余部分可自由编辑，生成器只会替换标记之间的内容。
> `CLAUDE.md` 只包含 `@AGENTS.md`，保持不变。

## 0. 开工前必读

1. **改任何界面之前，先读 [`DESIGN.md`](DESIGN.md)。** 颜色、字号、组件、响应式与内容红线都以它为准。
2. 用到 Next.js API 时，先查 `node_modules/next/dist/docs/` 对应章节（见上方区块）。这里是 Next 16，不要凭记忆写。
3. 涉及产品、材料、工艺、参数的文案，先看第 4 节内容红线。

## 1. 项目概览

兆辉化工设备（钢衬四氟 / PO / PE 防腐储罐、反应釜、塔器、管道）的企业官网。面向化工企业的设备工程师、工艺工程师和采购。

| 项 | 现状 |
|---|---|
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript 7 |
| 样式 | 原生 CSS，通用设计令牌定义在 `app/site.css` 的 `.pt-root` |
| 动效 | CSS 入场，GSAP 3 + ScrollTrigger 处理滚动淡入、导航高亮和产品结构组装 |
| 输出 | 静态导出，配置见 [`next.config.mjs`](next.config.mjs)（`output: "export"`、`trailingSlash: true`、`images.unoptimized: true`） |
| 语言 | 简体中文（`<html lang="zh-CN">`） |

## 2. 正式路由

| 路由 | 源码 |
|---|---|
| `/` | [`app/page.tsx`](app/page.tsx)，设备入口在 `/#equipment`，询价简报在 `/#brief` |
| `/products/tanks/` | [`app/products/tanks/page.tsx`](app/products/tanks/page.tsx) |
| `/products/reactors/` | [`app/products/reactors/page.tsx`](app/products/reactors/page.tsx) |
| `/products/towers/` | [`app/products/towers/page.tsx`](app/products/towers/page.tsx) |
| `/products/piping/` | [`app/products/piping/page.tsx`](app/products/piping/page.tsx) |

官网域名为 `https://jszhff.cn/`。旧总览、动态产品页和演示页的迁移与历史重定向见 [`design-qa.md`](design-qa.md)。本地预览使用上表的正式路由。

## 3. 目录地图

```
app/
  layout.tsx              根布局（全站 SEO 元信息、viewport、globals.css）
  globals.css             基础全局重置
  site.css                首页与共用组件样式、设计令牌（.pt-root）
  page.tsx                正式首页 /
  home-client.tsx         页头、导航高亮、滚动淡入（客户端）
  home-data.ts            首页文案与媒体数据（里程碑、合作客户、行业、资质专利、制造步骤等）
  brief-workbench.tsx     询价简报生成器（客户端）
  credentials-explorer.tsx 资质证书与专利展示
  partner-orbit-wall.tsx  合作客户轨道墙（客户端）
  site-footer.tsx         全站页脚
  not-found.tsx           自定义 404 页面（导出为 404.html）
  robots.txt / sitemap.xml / icon.svg / favicon.ico / apple-icon.png   SEO 与浏览器图标
  products/
    product-data.ts       四类设备的共用资料与询价入口
    product-gallery.tsx   产品实拍图集（客户端）
    product-page.css      产品详情页共享样式
    tanks/ | reactors/ | towers/ | piping/
      page.tsx            各产品详情页
      *-data.ts           各产品的图集、工艺说明与结构步骤
      *-assembly.tsx      结构交互组件，读取 *-geometry.generated.ts
      build-*.mjs         几何生成脚本
components/
  zhaohui-mark.tsx        矢量 Logo（tone="inverse" 深底 / "dark" 浅底）
  zhaohui-logo.tsx        页头自适应明暗双版 Logo
  contact-data.ts         公开电话、邮箱、双厂区地址与官方二维码
public/images/
  brand/                  页头明暗双版 Logo
  contact/                微信、公众号、抖音二维码
  site/                   首屏、厂区、产品实拍及行业、证书、专利和合作伙伴素材
DESIGN.md                 设计系统规范
design-qa.md              历次设计验收记录（只追加，不改历史）
```

根目录的本地参考资料（如 `效果图.png`、员工手册、压缩包、视频和 Blender 源文件）留在本机。保护原件，禁止纳入网页、`public/` 或源码提交。`design-qa.md` 中的旧截图路径是历史验收证据，已归档的文件可按路径从 Git 历史取回。

## 4. 内容红线（来自《防腐设备员工参阅手册》）

手册是 `防腐设备员工参阅手册_v1.xlsx`，属于内部资料，**不要把它放进 `public/` 或在页面中链接**。

- 只使用手册中标记为**"已确认"**的产品、材料与工艺。"待确认 / 候选 / 待补充"一律不上页面。
  - 例：喷涂的具体涂层材料（F30 / F40 / F46 等）、壳体具体牌号（Q235B / Q345R / 304 / 316L）目前**都是待确认**。
- 不输出耐温、压力、寿命、厚度、价格等**未经审核的参数**；改为写"需要确认哪些条件"。
- 氢氟酸、高氯酸、氯磺酸、液溴、过氧化氢、混酸等**高危介质只写"专项审核"**，不给选材结论。
- 喷涂是**工艺**，不是独立产品。
- 禁用绝对化表述：耐所有酸碱、永不腐蚀、零维护、行业第一。
- 首页已展示应用行业。新增或修改行业应用须经销售确认，手册中标为「待销售确认」的条目不能据此扩展为行业矩阵或客户案例。
- **不虚构**联系方式、工程师、专利、资质、合作伙伴、客户名称。资料缺失时删掉该区块，不放"待填 / 预留"占位。
- 文案用对用户说话的语气，不描述界面自身（禁止"左侧标题保持锁定""点击下方体验"之类）。

## 5. 编码约定

- 样式沿用 `pt-` 前缀、`.pt-root` 作用域和现有 CSS 令牌。首页及共用组件使用 `app/site.css`，详情页专用规则使用 `app/products/product-page.css`。重置规则用 `:where()`，避免覆盖组件样式。主线使用原生 CSS，沿用现有色相。
- 默认使用服务端组件。状态和事件放在独立的 `"use client"` 组件中。共用设备资料和询价入口维护在 `app/products/product-data.ts`，首页内容维护在 `app/home-data.ts`，详情页专属资料维护在对应的 `*-data.ts`。复用已有数据，避免在 JSX 中重复定义。
- 首屏 CSS 入场保持首帧可见。滚动淡入使用 `data-rise`，由 `home-client.tsx` 或相应 `*-page-client.tsx` 处理。结构动效由 `*-assembly.tsx` 管理。新增动效须适配 `prefers-reduced-motion`。禁止滚动劫持、逐字飞入、锁屏和 `clip-path` 开幕。
- 图片使用 `next/image`，优先加载限于首屏关键图像，其他图片默认懒加载。使用 `fill` 时填写 `sizes`。
- 保留跳转链接、`aria-current`、可见焦点和图集键盘操作。Tab 保留 `role`、`aria-selected`、`aria-controls`。表单控件使用 `<label>`，字段组使用 `<legend>`。
- 更新结构几何时，从仓库根目录运行对应的 `build-*.mjs`（如 `node app/products/tanks/build-tank.mjs --audit`），并检查生成文件差异。生成脚本依赖本地的 `.agents/skills/anatomy/kit/`。普通构建直接读取已跟踪的几何数据。
- 新增依赖须经用户确认。`next-env.d.ts` 由 Next.js 生成，`package-lock.json` 随依赖变更更新。`.next/` 和 `out/` 由工具生成。

## 6. 本地预览与验证

```bash
npm ci
npm run dev
```

首次安装或锁文件变更后，在当前操作系统运行 `npm ci`。按终端显示的地址打开第 2 节路由（默认 `http://localhost:3000/`）。`next dev` 会维护本文件顶部自动区块。

每次改动后运行 `git diff --check`、`npm run typecheck` 和 `npm run build`。用静态 HTTP 服务预览导出的 `out/`。

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory out
```

- 改动涉及路由或资源时，在 `http://127.0.0.1:4173/` 核对受影响的正式入口、站内跳转、图片和静态资源。
- 界面改动须在 **1440 × 900** 和 **390 × 844** 逐区块滚动截图，检查横向溢出、14px 字号下限、中文标题断行、区块明暗和滚动后的页头底色。截图存到仓库外。
- 设计验收结论追加到 [`design-qa.md`](design-qa.md) 末尾，保留历史记录。

## 7. 内容与资源现状

- 首页和页脚使用 `components/contact-data.ts` 的公开电话、邮箱和双厂区地址。询价简报在浏览器生成和复制。新增在线提交前，先确认接收端和资料处理流程。
- 首页、制造现场和四类产品使用 WebP 实拍，行业配图、证书、专利、合作伙伴标识与二维码按各自用途维护。静态导出直接提供源图，替换素材时核对公开授权、实际内容、尺寸和体积。
- 页头使用明暗双版 Logo，页脚使用矢量字标，正文沿用系统中文字体。品牌资源更新以获准素材为准。

## 8. 提需求与交付

- 给 agent 的需求写明正式路由或区块锚点、要改的内容、可用素材、验收条件，以及是否授权提交、推送或部署。界面任务可参考 [`DESIGN.md` 的示例](DESIGN.md#9-agent-prompt-guide-代理提示指南)。
- 本地提交记录 Git 变更，推送更新远端源码。部署需单独授权，并验收官网实际提供的构建与路由。
- 用中文报告修改文件、类型检查、构建、冒烟检查和适用的截图尺寸。明确标出未验证项。资料不确定时向用户核实，禁止自行补写。
