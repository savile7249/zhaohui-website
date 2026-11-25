# 兆辉化工设备官网首页 Demo V1 — Design QA

## Evidence

- Source visual truth: `W:\Workspace\zhaohui\效果图.png`
- Implementation URL: `http://127.0.0.1:3000/`
- Implementation screenshot: `W:\Workspace\zhaohui\homepage-desktop-final.png`
- Source pixels: `1024 × 1536`
- Implementation pixels: `1024 × 1536`
- CSS viewport: `1024 × 1536`; device pixel ratio: `1`
- Density normalization: none; source and implementation were compared at equal pixel dimensions.
- State: homepage top, default desktop state, production build.
- Full-view comparison: `W:\Workspace\zhaohui\design-qa-comparison-desktop.png`
- Focused hero/manifesto comparison: `W:\Workspace\zhaohui\design-qa-comparison-hero.png`
- Focused product comparison: `W:\Workspace\zhaohui\design-qa-comparison-products.png`
- Mobile evidence: `W:\Workspace\zhaohui\homepage-mobile-final.png`, `W:\Workspace\zhaohui\homepage-mobile-equipment-final.png` at `390 × 844`, DPR `1`.
- Extended desktop evidence: `W:\Workspace\zhaohui\homepage-projects-final.png`, `W:\Workspace\zhaohui\homepage-manufacturing-final.png` at `1440 × 900`, DPR `1`.

## Findings

- No actionable P0/P1/P2 findings remain.
- [P3] Placeholder photography is art-direction accurate but not asset-identical.
  Location: Hero, three product heroes, Projects, Manufacturing.
  Evidence: subject category, negative-space side, dark/light sequence and sharp rectangular treatment match the reference; equipment geometry and exact camera framing differ because the supplied project contained no formal photography.
  Impact: acceptable for the explicitly requested Demo placeholder state, but not final brand-authentic production imagery.
  Fix: replace files in `public/images` with approved photography while keeping current filenames, aspect ratios and subject placement.
- [P3] Official brand typography and vector logo are unavailable.
  Location: global typography, header/footer logo.
  Evidence: the implementation uses Arial/PingFang SC/Microsoft YaHei fallbacks and a cleaned raster crop from the reference; Chinese stroke weight is slightly heavier than the source at some sizes.
  Impact: minor optical drift and limited logo scalability.
  Fix: supply the licensed brand font files and vector/transparent master logo, then update the font stack and logo asset only.
- [P3] CTA arrow glyphs from the reference are reduced to underlined text links.
  Location: product and project CTAs.
  Evidence: the reference includes a small directional arrow; no approved icon asset or icon library existed in the empty project.
  Impact: minor fidelity gap; navigation and affordance remain clear.
  Fix: add the approved arrow/icon asset when brand assets are supplied.

## Required Fidelity Surfaces

- Fonts and typography: hierarchy, wrapping, line height, tracking and optical weights were checked at desktop and mobile sizes. Residual font-family drift is classified P3 pending official font assets.
- Spacing and layout rhythm: the 12-column desktop grid, `58px` left content rail, alternating product copy alignment and all reference-section heights match the source at `1024px`: `422 / 254 / 273 / 237 / 194px`; Projects begins at `y=1380`.
- Colors and visual tokens: near-black, warm off-white, steel gray and restrained red accents match the reference language. No blue-purple gradient, glow, particles, rounded cards or SaaS surface treatment was introduced.
- Image quality and asset fidelity: all image slots use real raster assets or a transparent raster engineering line drawing; there are no CSS/HTML-drawn replacement illustrations. Generated placeholder subject geometry differs from the source as noted above.
- Copy and content: the requested three product names are exact and supporting copy remains short, industrial and brand-led. No form, catalog UI or secondary-page copy was added.
- Responsiveness and accessibility: desktop navigation switches to a semantic native mobile menu below `900px`; `390px` has no horizontal overflow; image alt text, navigation labels, focus-visible outlines and reduced-motion handling are present.

## Comparison History

1. Earlier P1: the first desktop render used overly tall sections and switched to mobile navigation at the reference width.
   Fix: calibrated viewport-relative section heights from the measured source bands and moved the desktop breakpoint to `900px`.
   Post-fix evidence: final full-view comparison; exact measured section heights and Projects `y=1380`.
2. Earlier P2: blueprint paper rectangle, logo matte, product copy rail, hero crop and Projects top spacing visibly drifted.
   Fix: produced true-alpha logo/blueprint assets, corrected blueprint scale/placement, aligned copy rails and tuned image object positions and Projects spacing.
   Post-fix evidence: final hero and product focused comparisons.
3. Earlier P2: direct mobile anchor navigation could expose an unloaded first product image in the test browser.
   Fix: eagerly load the full-bleed content imagery while retaining Next.js responsive image selection.
   Post-fix evidence: `homepage-mobile-equipment-final.png`; selected image resolved at `640w`, target top `0`, no overflow.
4. Earlier P2: Projects heading scale and top rhythm were larger/lower than the visible reference band.
   Fix: reduced title scale, top padding and supporting-copy size.
   Post-fix evidence: final full-view comparison at the `y=1380` band.

## Runtime and Interaction Checks

- `npm run typecheck`: passed.
- `npm run build`: passed; `/` prerendered as static content.
- Desktop primary navigation: `#projects` reached target top `0`.
- Mobile native menu: opened; `#equipment` reached target top `0`; target image loaded successfully.
- Desktop and mobile horizontal overflow: none.
- Production browser console errors/warnings: none.
- Projects and Manufacturing were visually checked at `1440 × 900`.

## Open Questions

- The reference contains no mobile or Manufacturing screen. Their layouts are reasonable extensions of the confirmed desktop visual language, not source-identical states.
- Formal photography, CAD artwork, logo master and brand font licensing remain unverified.

## Implementation Checklist

- Replace placeholder image files with approved assets without changing layout contracts.
- Apply the official font and vector logo when supplied.
- Re-run the same desktop/mobile comparison after asset replacement.

## Follow-up Polish

- Add the approved CTA arrow/icon asset.
- Re-tune `object-position` per final photography rather than changing section structure.

final result: passed

---

# 兆辉化工设备产品页 V2 — Design QA（2026-08-29）

## 验证范围

- 实现地址：`http://127.0.0.1:3000/products`
- 产品总览：`/products`
- 静态详情页：`/products/tanks`、`/products/reactors`、`/products/towers`、`/products/piping`
- 视觉基准：`W:\Workspace\zhaohui\效果图.png`
- 比较状态：源图是首页视觉基准，产品页是同一设计语言下的新页面，不是相同内容状态的逐像素复刻。

## 视觉证据

- 同屏对照：`W:\Workspace\zhaohui\design-qa-products-comparison.png`，左侧为源图，右侧为产品总览顶部与首个设备分组。
- 产品总览桌面全页：`W:\Workspace\zhaohui\products-overview-desktop.png`，`1440 × 5192`。
- 产品分组桌面聚焦：`W:\Workspace\zhaohui\products-overview-equipment-desktop.png`，`1440 × 900`。
- 储罐详情桌面全页：`W:\Workspace\zhaohui\products-tanks-desktop.png`，`1440 × 3606`。
- 产品总览移动端全页：`W:\Workspace\zhaohui\products-overview-mobile.png`，`390 × 5973`。
- 塔器详情移动端全页：`W:\Workspace\zhaohui\products-towers-mobile.png`，`390 × 4944`。
- 首页回归：`W:\Workspace\zhaohui\homepage-products-regression.png`，`1024 × 1536`。

## 结论

- 无可执行的 P0、P1、P2 差异。
- 12 栏桌面网格、大留白、直角全幅摄影、近黑与暖灰连续明度、克制红色标记和左右交替产品叙事均延续源图。
- 未引入圆角卡片、蓝紫渐变、发光、粒子或 SaaS 面板式界面。
- 总览与详情页在 `1440 × 900`、`1024 × 1536` 和 `390 × 844` 下均无横向溢出。
- 四个详情路由均具有正确标题与一级标题；未知产品路由返回 404。
- 桌面导航、移动端原生菜单、首页三个“探索设备”入口和产品总览详情入口均已验证。
- 浏览器 console 无 error 或 warning。

## 剩余 P3 与内容依赖

- [P3] 正式产品摄影仍未提供。储罐、反应釜和塔器沿用首页占位摄影；管道页明确复用现有工程现场图，没有把生成图冒充正式产品图。收到核准摄影后，只需替换图片资产并复查裁切位置。
- [P3] 官方字体与矢量 Logo 仍未提供，当前沿用首页已经确认的系统字体和透明栅格 Logo。
- [P3] 未提供可公开的电话、邮箱或表单接收端。页面未虚构联系方式，暂以“提交给您的兆辉业务联系人”作为沟通路径；收到核准联系方式后再补公开 CTA。

## 内容边界

- 产品名称、型号范围、壳体材料牌号和防腐工艺范围来自已确认的员工参阅手册。
- 页面不输出固定价格、材料兼容性结论、性能或寿命承诺，也不提供自动选材。
- 具体喷涂材料、设备参数及最终方案继续按介质、浓度、温度、压力和结构条件审核。

## 验证命令

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过；`/products` 静态预渲染，4 个详情页由 `generateStaticParams` 生成。

final result: passed

---

# 兆辉 Topology 动效 Demo — Design QA（2026-11-12）

## 范围与结果

范围为独立路由 `/topology-demo/` 的首版动效预览：使用兆辉中文内容和现有设备图片，验证 Topology 黑底主体的运动机制与浏览体验。跳过「You jump / We jump」，本轮不替换正式首页。

原站与 Demo 的品牌、语言、图片和段落长度不同。本报告验收动效机制、页面可用性和适配，不声明逐像素复刻或所有原站细节已经完成。

## 证据

证据目录：`/home/savil/Artifacts/zhaohui/topology-demo-20261111/`。

- Source visual truth：`reference-about.png`、`reference-principles.png`、`reference-equipment.png`；源站 https://www.topology.vc/ 。手机原则区来源为前轮实测的 `topology-feasibility-20261111/08-mobile-principles.jpg`，复制为 `reference-mobile-principles.jpg`。
- 实现地址：http://127.0.0.1:3000/topology-demo/ 。浏览器验证使用实际静态生产构建。
- 桌面对照：`comparison-desktop-principles.png`；源图和实现均为 1440×900 CSS px / 图片像素，按原尺寸并排，没有密度缩放。
- 手机对照：`comparison-mobile-principles.png`；源图和实现均为 391×845 CSS px / 图片像素。请求尺寸为 390×844，Chrome 实际回报 391×845。比较同一原则区的首段，锚点偏移和中文文案长度差异已注明，不计算像素相似度。
- 局部对照：`comparison-focused-title.png`；分别裁取原图和实现的 650×420 标题区域并排，检查标题尺度、基线附近留白与色彩。
- 平板截图：`demo-tablet-principles.png`，768×1024。
- 实测数据：`e2e-results.json`、`reduced-motion-result.json`、`browser-check-result.json`。
- 重复验证：`e2e-runbook.md` 和只读自检脚本 `verify-browser.js`。

## Findings

当前 Demo 范围内没有剩余的可执行 P0/P1/P2 问题。

- [P3] Logo 使用现有透明栅格素材，首屏为普通入场，未制作原站式 Logo 形变。彩色三维开场及页尾也不在本次实现范围内。
- [P3] 影像沿用项目既有占位图；制造区从人物肖像换为设备图片，产品区从品牌 Logo 矩阵换为设备卡片。这是本轮内容适配，不能当成正式工厂或产品摄影验收。
- [P3] 字体沿用系统中文字体与 Arial，不复用原站英文字体。中文标题的笔画、字面和断行与英文参考存在预期差异。
- [P3] 原站线框角部的细小装饰尚未复刻；本轮完成横线延伸、上下分离、侧边展开和内容遮罩。

## Required Fidelity Surfaces

- 字体与排版：大标题、正文、辅助文字保持清晰层级；中文分行文本内容未丢失，自动分行随宽度重建。桌面、平板、手机均未发现正文溢出。标题使用轻字重，与原站大标题的视觉重量接近；不声明字形一致。
- 间距与布局节奏：保留大留白、左右错位介绍、桌面左右双栏、标题固定区间、居中制造图片和线框矩阵。桌面标题固定在视口约 180px；右侧内容在滚动后继续上移。手机取消固定。锚点统一保留约 96px 顶部空间。
- 色彩：背景 `#151515`，主文字 `#e1e2d9`，辅助文字 `#9b9b9b`，边框 `#4a4a47`；未增加渐变、发光或浮动玻璃面板。保留参考站的细线、索引及辅助英文标签，作为用户指定参考的组成部分，不另抽取设计方向。
- 图片与素材：全部图片来自本项目本地文件，无原站图片热链或绘制替代插画。设备区四张图片已加载；裁切、灰度处理和手机单列显示正常。Logo 素材分辨率有限。
- 文案与内容：使用兆辉现有设备类别及工况沟通内容。没有虚构客户、认证、电话号码、邮箱、材料兼容性或性能承诺。产品入口连接现有四个详情页。

## Comparison History

1. 初轮 [P2]：Lenis 已读取 CSS `scroll-margin-top: 96px`，点击处理又加入 `offset: -96`，造成锚点顶部空间约 192px。
   修复：移除重复 offset；返回顶部显式使用数值 0。
   修复后证据：手机原则区 top=95.789px，桌面 top=96.105px；返回顶部 scrollY=0。对应最新 `demo-mobile-principles.png`、`demo-desktop-principles.png` 和 `e2e-results.json`。
2. 最终回归发现 [P2]：快速跨过整节时，`onToggle` 不一定触发，导航可能保留旧高亮。
   修复：改为 `onEnter` 与 `onEnterBack` 更新章节。
   修复后证据：直接打开并刷新 `#applications`，章节 top=95.605px，导航高亮为「应用」；详见 `navigation-regression-result.json`。
3. 修复后将桌面全图、手机全图及标题局部与源图同屏查看。未发现剩余 P0/P1/P2；字体、内容与素材差异按本轮范围归类为预期适配或 P3。

## Runtime and Interaction Checks

- `npm run typecheck`：通过。
- `npm run build`：通过；Demo、首页、产品总览及四个详情页均可静态生成。
- Linux 原生依赖与命令入口已恢复；新增运行依赖仅 GSAP 3.15.1 与 Lenis 1.3.27。
- 1440×900：一个固定标题区；滚动前后 pinTop 均为 179.579px，右侧 listTop 从 136.105px 变为 -237.789px。
- 768×1024：无固定占位、无横向溢出；设备两列。
- 391×845：菜单可开合，选择章节后收起；无固定占位、无横向溢出；设备单列。
- 设备矩阵结束态 clipPath=`inset(0%)`，四张设备图加载完成；设备链接可进入现有详情页，返回后仍可使用 Demo。
- 离开 Demo 后，原产品页无 Lenis 类和固定占位，HTML 恢复原有平滑滚动规则。
- 页尾及四条应用行可显示；返回顶部 scrollY=0；重播从顶部重新建立动画，无重复固定占位。
- 模拟减少动态效果后：Lenis 关闭，固定占位为 0，隐藏文字为 0，三个内容遮罩均为 `none`。恢复正常模式后可重播。
- 浏览器控制台 error/warn 记录为空；可重复浏览器自检通过。
- 早期连续采样接口发生长时间延迟且只获得结束态，未用该数据推断帧率或时长精度。动态观察与参数核对不能代替真实设备性能测试。

## 验证边界与后续

真实手机、Safari、屏幕阅读器及性能基准未验证。后续可根据本轮视觉反馈调整动画节奏，再决定是否迁入首页；Logo 形变、正式摄影、原站角部细节和三维页尾另行迭代。

final result: passed

---

# SVG Logo 替换验证（2026-11-12）

- 使用根目录提供的 `ZHAOHUI_logo.svg`，原样复制到 `public/images/ZHAOHUI_logo.svg`；源文件、公开资源与静态导出 SHA-256 一致。
- 已替换共享页眉、共享页脚、Topology Demo 页眉和首屏共 4 处引用；代码中已无旧 PNG Logo 引用。
- 保留现有尺寸和 Demo 的白色滤镜。SVG 为路径图形，没有内嵌位图或外部依赖。
- `npm run typecheck`、`npm run build`、`git diff --check` 通过。首页、产品页和 Demo 在浏览器中均加载 SVG，自然尺寸为 1280×460；产品页页脚已确认加载。
- 截图与浏览器结果：`/home/savil/Artifacts/zhaohui/logo-svg-20261112/`。复查时重新构建并刷新这些页面，确认所有 Logo 请求为 `/images/ZHAOHUI_logo.svg`、图片加载成功且未改变布局。
- 此项解决前述栅格 Logo 分辨率限制，尚未制作 Logo 形变；本轮未做真实手机复测。

final result: passed

---

# Topology Demo 展示框架验证（2026-11-12）

## 本轮范围

按用户要求删除「制造原则」，包括内容、导航、专属样式及固定标题逻辑。新增 3 个工程师资料位、3 个专利资料位和 8 个合作伙伴 Logo 位。新素材保持空白，仅展示字段提示，不加载空图片或提供无目标的按钮。

页面顺序为：品牌介绍 → 杰出工程师 → 专利技术 → 制造现场 → 产品设备 → 合作伙伴 → 联系。原「工艺应用」区按前轮方案替换为合作伙伴。导航为关于、技术实力、制造、设备、合作伙伴；技术实力同时覆盖工程师和专利。

## 验证结果

- `npm run typecheck`、`npm run build`、`git diff --check` 通过。
- 浏览器实际静态构建地址：http://127.0.0.1:3000/topology-demo/ 。
- 1440×900：工程师三列，伙伴四列；占位数量为 3 / 3 / 8；无横向溢出。
- 768×1024：工程师三列，伙伴四列；无横向溢出。
- 手机请求 390×844，Chrome 实际报告 391×845：工程师单列，伙伴两列；专利文字与证书位均可显示，无横向溢出。
- 手机菜单使用键盘开合、选择章节后自动关闭；专利锚点 top=95.789px，归属「技术实力」高亮。
- 三个新区块均无图片元素及链接；原四个产品详情入口保留。
- 原则区、旧导航、固定标题及 `.pin-spacer` 均不存在；重播返回 scrollY=0，未残留固定占位。
- 正常动效观察：工程师错峰入场后 opacity 均为 1；伙伴线框与遮罩展开后 clipPath=`inset(0%)`。
- 减少动态效果：Lenis 关闭，内容无遮罩、无隐藏行。恢复正常设置后 Lenis 与重播均正常。
- 浏览器控制台 error/warn 为空。

## 视觉检查与证据

证据目录：`/home/savil/Artifacts/zhaohui/topology-framework-20261112/`。

- `desktop-engineers.png`、`desktop-patents.png`：工程师与专利框架，减少动态效果模式下检查完整布局。
- `desktop-partners.png`：伙伴正常动效结束态。
- `mobile-engineers.png`、`mobile-patents.png`、`mobile-partners.png`：手机布局；减少动态效果模式，便于检查所有预留位。
- `e2e-results.json`：实际尺寸、数量、列数、导航、动效与重播结果。
- `verify-framework.js`：只读浏览器自检，失败时抛出错误。

字体、留白、色彩延续既有 Demo。新标题和字段提示在桌面及手机均可读，未发现裁切或横向溢出。空肖像、证书和 Logo 区块属于用户明确要求的素材预留，不代表实际人物、专利或合作单位。没有新增素材、字体或依赖。

## 重复检查

1. 在项目目录执行 `npm run build`，打开本地预览并刷新。
2. 用开发工具设置上述 CSS 视口，以 `innerWidth` / `innerHeight` 实测为准。进入「技术实力」检查三个人物位和三个专利位；进入「合作伙伴」检查八个 Logo 位。
3. 在各尺寸执行本目录 `verify-framework.js`，确认列数、数量、旧区块删除及无横向溢出。
4. 开合手机菜单，选择技术实力或合作伙伴；检查菜单收起和章节高亮。
5. 模拟减少动态效果，确认全部区块可读；恢复设置后重播，确认从顶部重新入场。

测试期间使用临时视口与媒体特性模拟，已恢复，未修改浏览器原有缩放。真实手机和 Safari 未验证；正式素材填入后需复查裁切、长姓名及长专利名称。

final result: passed

---

# 正式上线验收（jszhff.cn，2026-11-26）

## 发布范围

- 正式首页：`/`（原 `/prototype` 迁正，移除 `noindex`）
- 四类产品详情页：`/products/tanks/`、`/products/reactors/`、`/products/towers/`、`/products/piping/`（由原 `/prototype/*` 迁正，首屏 Hero 图全部切换为实拍 WebP）
- 移除旧版首页、旧 `/products` 总览与旧动态详情页、废弃 `/topology-demo` 路由及 13 MB 未使用的占位 PNG；`/products` 与 `/prototype*` 由 Nginx 301 跳转至新路径
- 补全全站 SEO 与浏览器资产：`metadataBase`、OpenGraph、JSON-LD、`robots.txt`、`sitemap.xml`、`icon.svg`、`favicon.ico`、`apple-icon.png` 及自定义深色 `404.html`

## 验证结果

- `tsc --noEmit` 与 `next build`：通过；静态导出 `out/` 总体积由 25 MB 降至 12 MB
- 本机静态构建浏览器验收（Chromium，1440×900 与 390×844）：零控制台错误、零 4xx/5xx 资源请求、无横向溢出、无小于 14px 正文文字；修复自定义 404 页标签对比度后重构建通过
- 线上部署与实测（`https://jszhff.cn/`，软链切换至 `releases/20261126-043000`，保留 `releases/20260902-132524` 供回滚）：
  - Nginx 开启 HTTP/2、扩展 `gzip_types`、配置 `/_next/static/` 长期 `immutable` 与 `/images/` 30 天缓存，保留 `/.well-known/acme-challenge/`
  - `/`、四类产品详情页、`/robots.txt`、`/sitemap.xml`、`/favicon.ico`、`/icon.svg`、`/apple-icon.png` 均返回 HTTP/2 200
  - `/products`、`/products/`、`/prototype`、`/prototype/{tanks,reactors,towers,piping}` 均按预期返回 301 重定向；不存在路径返回 404
- 未验证项：真实手机设备与 Safari 实机复测

final result: passed
