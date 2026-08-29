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
