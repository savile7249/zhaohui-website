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
