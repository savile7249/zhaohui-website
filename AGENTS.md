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
| 样式 | Tailwind CSS 4（仅旧页面使用）+ 页面级原生 CSS（主线） |
| 动效 | GSAP 3 + ScrollTrigger（只用于滚动淡入与导航高亮） |
| 输出 | 静态导出：`output: "export"`、`trailingSlash: true`、`images.unoptimized: true`（见 `next.config.mjs`） |
| 语言 | 简体中文（`<html lang="zh-CN">`） |

## 2. 路由与状态

| 路由 | 状态 | 说明 |
|---|---|---|
| `/` | **主线，线上正式版** | 遵循 `DESIGN.md`，已正式替换旧版首页并部署至 `https://jszhff.cn/` |
| `/products/{tanks,reactors,towers,piping}` | **主线，线上正式版** | 四类设备独立交互详情页，遵循 `DESIGN.md`；`/products` 总览页已由首页 `#equipment` 取代（Nginx 301 重定向） |

## 3. 目录地图

```
app/
  layout.tsx              根布局（全站 SEO 元信息、viewport、globals.css）
  globals.css             基础全局重置
  site.css                主线全部样式与设计令牌（.pt-root）
  page.tsx                正式首页 /
  home-client.tsx         页头、导航高亮、滚动淡入（客户端）
  home-data.ts            首页文案与媒体数据（里程碑、合作客户、行业、资质专利、制造步骤等）
  brief-workbench.tsx     询价简报生成器（客户端）
  credentials-explorer.tsx 资质证书与专利展示（客户端）
  partner-orbit-wall.tsx  合作客户轨道墙（客户端）
  site-footer.tsx         全站页脚（客户端/服务端共享）
  not-found.tsx           自定义 404 页面（导出为 404.html）
  robots.txt / sitemap.xml / icon.svg / favicon.ico / apple-icon.png   SEO 与浏览器图标
  products/
    product-data.ts       四类设备唯一数据源
    product-gallery.tsx   产品实拍图集（客户端）
    product-page.css      产品详情页共享样式
    tanks/ | reactors/ | towers/ | piping/   四类设备独立详情页与结构交互
components/
  zhaohui-mark.tsx        矢量 Logo（tone="inverse" 深底 / "dark" 浅底）
  zhaohui-logo.tsx        页头自适应明暗双版 Logo
  contact-data.ts         联系方式、双厂区地址与官方二维码数据
public/images/
  brand/                  页头明暗双版 Logo
  contact/                微信、公众号、抖音二维码
  site/                   实拍与业务 WebP 素材
DESIGN.md                 设计系统规范
design-qa.md              历次设计验收记录（只追加，不改历史）
```

根目录的 `*.png` 截图、`效果图.png`、`*.xlsx`、`*.tar.gz`、`*.mp4`、`*.blend` 是参考资料或历史产物，**不要修改、移动、删除，也不要引用到页面里**。

## 4. 内容红线（来自《防腐设备员工参阅手册》）

手册是 `防腐设备员工参阅手册_v1.xlsx`，属于内部资料，**不要把它放进 `public/` 或在页面中链接**。

- 只使用手册中标记为**"已确认"**的产品、材料与工艺。"待确认 / 候选 / 待补充"一律不上页面。
  - 例：喷涂的具体涂层材料（F30 / F40 / F46 等）、壳体具体牌号（Q235B / Q345R / 304 / 316L）目前**都是待确认**。
- 不输出耐温、压力、寿命、厚度、价格等**未经审核的参数**；改为写"需要确认哪些条件"。
- 氢氟酸、高氯酸、氯磺酸、液溴、过氧化氢、混酸等**高危介质只写"专项审核"**，不给选材结论。
- 喷涂是**工艺**，不是独立产品。
- 禁用绝对化表述：耐所有酸碱、永不腐蚀、零维护、行业第一。
- 行业应用在手册中均为"待销售确认"，不要做成行业矩阵或客户案例。
- **不虚构**联系方式、工程师、专利、资质、合作伙伴、客户名称。资料缺失时删掉该区块，不放"待填 / 预留"占位。
- 文案用对用户说话的语气，不描述界面自身（禁止"左侧标题保持锁定""点击下方体验"之类）。

## 5. 编码约定

### 主线（`app/prototype/`）

- **样式**：全部写在 `prototype.css`，类名统一 `pt-` 前缀，挂在 `.pt-root` 作用域下。只用文件顶部的 CSS 变量，不写裸色值、不加新色相。
- **重置规则**用 `:where()` 归零优先级。新增元素重置时沿用这个写法，否则会覆盖组件类的 margin。
- **不要在主线里用 Tailwind 工具类**，避免两套体系混用。
- **组件**默认是服务端组件；只有需要状态或事件时才加 `"use client"`，并拆成独立文件。
- **数据**：设备数据只从 `app/products/product-data.ts` 读取；主线其余文案放在 `prototype-data.ts`。不要在 JSX 里硬编码重复数据。
- **动效**：
  - 首屏入场用 CSS 动画（`@keyframes pt-hero-*`），保证首帧可见。
  - 滚动出现只给元素加 `data-rise`，由 `prototype-client.tsx` 统一处理。
  - 必须在 `prefers-reduced-motion: no-preference` 条件下运行。
  - 不引入 Lenis、SplitText、pin 锁屏、clip-path 开幕。`lenis` 仍在 `package.json` 里，只给废弃的 `/topology-demo` 用，主线禁止导入。
- **图片**：用 `next/image`。只有首屏图加 `priority`，其余默认懒加载；`fill` 时必须写 `sizes`。
- **无障碍**：保留跳转链接、`aria-current`、Tab 的 `role` / `aria-selected` / `aria-controls`、可见焦点框。表单控件都要有 `<label>` 或 `<legend>`。

### 通用

- 不新增依赖，除非用户明确同意。
- 不要修改 `next-env.d.ts`、`package-lock.json`，除非是依赖变更的必然结果。
- `out/`、`.next/` 是构建产物，已被 git 忽略，不要手动编辑。

## 6. 命令与验证

```bash
npm run typecheck     # tsc --noEmit
npm run build         # 静态导出到 out/
npm run dev           # 开发服务器（会重写本文件上方的 Next 区块，属正常现象）
```

- 项目没有配置 lint 和测试。**每次改动后至少跑 `typecheck` 和 `build`**，两者都要通过。
- `node_modules` 是在 Windows 上安装的（带 `.cmd` 脚本），Linux 下可直接用 `node_modules/.bin/next` 与 `node_modules/.bin/tsc`。
- **界面改动必须截图自查**：
  1. `npm run build` 后，静态服务 `out/`（如 `python3 -m http.server -d out`）。
  2. 至少在 **1440×900** 和 **390×844** 两个尺寸截图，逐区块滚动检查（GSAP 的淡入依赖滚动触发，一次性超高视口截图会看到半透明内容，不代表真实效果）。
  3. 检查清单：无横向溢出；没有小于 14px 的文字；标题没有单字成行；深浅区块交替正确；页头在页面底部仍为实色。
- 截图放到临时目录，**不要提交到仓库根目录**。

## 7. 已知待办（按优先级）

1. 联系方式：没有可公开的电话、邮箱或表单接收端。拿到核准信息前，页面只写"请将询价简报发送给您的兆辉业务联系人"。
2. 图片：`public/images` 全是 AI 生成的占位图，单张约 2 MB，且关闭了图片优化。需要替换为实拍照片，并转成 WebP/AVIF（1920 宽约 200–300 KB）。
3. 产品页 `/products`、`/products/[slug]` 迁移到 `DESIGN.md` 体系。
4. 主线替换 `/`：迁移完成后，把 `/prototype` 内容移到 `app/page.tsx`，去掉 `noindex`，删除旧首页与 `/topology-demo`。
5. 品牌资产：官方字体授权与 Logo 母版尚未提供，目前使用系统字体与 `zhaohui-mark.tsx` 矢量 Logo。

## 8. 交付与沟通

- 用中文回复用户。
- 改完后说明：改了哪些文件、是否通过 `typecheck` / `build`、截图检查了哪些尺寸、还有哪些没验证。
- 遇到内容不确定（手册里没有、或标为待确认）时，**停下来问**，不要自行补写。
- 做设计验收时，把结论追加到 `design-qa.md` 末尾，不要改写历史记录。
