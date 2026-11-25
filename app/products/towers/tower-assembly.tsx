"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { towerAssemblySteps, type TowerPieceId } from "./tower-data";
import { TOWER_GEOMETRY } from "./tower-geometry.generated";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Vertical gap heights for top-to-bottom column assembly:
// base=0, lower=14, packing=+20, mid=+28, spray=+20, upper=+26, demister=+20, topHead=+30
const GAP_LOWER_BASE = 14;
const GAP_PACKING_LOWER = 18;
const GAP_MID_LOWER = 26;
const GAP_SPRAY_UPPER = 18;
const GAP_UPPER_MID = 28;
const GAP_DEMISTER_UPPER = 18;
const GAP_TOP_UPPER = 38;

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

function easeOutCubic(t: number) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function gapRemaining(progress: number, start: number, end: number) {
  const local = clamp((progress - start) / (end - start), 0, 1);
  return 1 - smoothstep(local);
}

// Compute 3D world offsets [dx, dy, dz] combining top-to-bottom vertical stacking
// with diagonal front-left cutaway closure (front PTFE lining closes in Step 03, front steel shell closes in Step 04).
function computeTierOffsets(progress: number): Record<string, readonly [number, number, number]> {
  const { pullDir, pullLining, pullShell } = TOWER_GEOMETRY;

  // Vertical closure (top-to-bottom):
  const gDem = gapRemaining(progress, 0.02, 0.16);
  const gTop = gapRemaining(progress, 0.06, 0.22);
  const gSpray = gapRemaining(progress, 0.2, 0.34);
  const gUpper = gapRemaining(progress, 0.24, 0.42);
  const gPack = gapRemaining(progress, 0.4, 0.56);
  const gMid = gapRemaining(progress, 0.58, 0.74);
  const gLow = gapRemaining(progress, 0.8, 0.94);

  // Diagonal split cutaway closure:
  // 03 (44%..64%): all 3 front continuous PTFE/PO lining halves glide into the back lining trough
  const gPullLining = gapRemaining(progress, 0.44, 0.64);
  // 04 (64%..84%): all 3 front steel shell halves (carrying manways & nozzles) glide back to seal the column
  const gPullShell = gapRemaining(progress, 0.64, 0.84);

  const zBase = 0;
  const zLower = GAP_LOWER_BASE * gLow;
  const zMid = zLower + GAP_MID_LOWER * gMid;
  const zPacking = zMid + GAP_PACKING_LOWER * gPack;
  const zUpper = zMid + GAP_UPPER_MID * gUpper;
  const zSpray = zUpper + GAP_SPRAY_UPPER * gSpray;
  const zDemister = zUpper + GAP_DEMISTER_UPPER * gDem;
  const zTop = zUpper + GAP_TOP_UPPER * gTop;

  const dLining = pullLining * gPullLining;
  const dShell = pullShell * gPullShell;
  const lx = pullDir[0] * dLining;
  const ly = pullDir[1] * dLining;
  const sx = pullDir[0] * dShell;
  const sy = pullDir[1] * dShell;

  return {
    base: [0, 0, zBase],
    lowerBack: [0, 0, zLower],
    lowerLiningBack: [0, 0, zLower],
    lowerLiningFront: [lx, ly, zLower],
    lowerFront: [sx, sy, zLower],
    packing: [0, 0, zPacking],
    midBack: [0, 0, zMid],
    midLiningBack: [0, 0, zMid],
    midLiningFront: [lx, ly, zMid],
    midFront: [sx, sy, zMid],
    spray: [0, 0, zSpray],
    upperBack: [0, 0, zUpper],
    upperLiningBack: [0, 0, zUpper],
    upperLiningFront: [lx, ly, zUpper],
    upperFront: [sx, sy, zUpper],
    demister: [0, 0, zDemister],
    topHead: [0, 0, zTop],
  };
}

interface NodeRecord {
  el: SVGGElement;
  piece: string;
  ride: string;
  role: "common" | "split" | "whole";
  key: number;
  index: number;
  lastTransform: string;
  lastOpacity: string;
}

export function TowerAssemblyExplorer() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rootGroupRef = useRef<SVGGElement>(null);
  const calloutGroupRef = useRef<SVGGElement>(null);
  const calloutDotRef = useRef<SVGCircleElement>(null);
  const calloutRingRef = useRef<SVGCircleElement>(null);
  const connectorPathRef = useRef<SVGPathElement>(null);
  const connectorNodeRef = useRef<SVGRectElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const railFillRef = useRef<HTMLSpanElement>(null);
  const percentTextRef = useRef<HTMLSpanElement>(null);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const manualOverrideRef = useRef<number | null>(null);
  const activeStepRef = useRef<TowerPieceId | null>("top");

  const [activeStep, setActiveStep] = useState<TowerPieceId | null>("top");
  const [manualMode, setManualMode] = useState<"scroll" | "apart" | "assembled">("scroll");

  useEffect(() => {
    activeStepRef.current = activeStep;
    const svg = svgRef.current;
    if (!svg) return;
    if (activeStep) {
      svg.setAttribute("data-focus", "");
    } else {
      svg.removeAttribute("data-focus");
    }
    svg.querySelectorAll<SVGGElement>(".pt-tower-it").forEach((el) => {
      if (activeStep && el.dataset.piece === activeStep) {
        el.setAttribute("data-on", "");
      } else {
        el.removeAttribute("data-on");
      }
    });
    const el = sectionRef.current as (HTMLDivElement & { __syncCallout?: () => void }) | null;
    el?.__syncCallout?.();
  }, [activeStep]);

  useIsomorphicLayoutEffect(() => {
    const container = sectionRef.current;
    const svg = svgRef.current;
    const rootGroup = rootGroupRef.current;
    if (!container || !svg || !rootGroup) return;

    const { width, height, viewDir, ex, ey, ez, recenterAssembledX, recenterAssembledY, anchors } = TOWER_GEOMETRY;
    const elByName = new Map<string, SVGGElement>();
    rootGroup.querySelectorAll<SVGGElement>(".pt-tower-it").forEach((el) => {
      if (el.dataset.name) elByName.set(el.dataset.name, el);
    });
    const nodes: NodeRecord[] = TOWER_GEOMETRY.items.flatMap((item, idx) => {
      const el = elByName.get(item.name);
      if (!el) return [];
      return [
        {
          el,
          piece: item.piece,
          ride: item.ride,
          role: item.role,
          key: item.key,
          index: idx,
          lastTransform: "__init__",
          lastOpacity: "__init__",
        },
      ];
    });

    let currentOrder = nodes.map(() => -1);
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function cameraTransform(p: number) {
      const eased = easeOutCubic(p);
      const lateralRecenter = smoothstep(clamp((p - 0.5) / 0.36, 0, 1));
      const scale = 1 + 0.16 * eased;
      const recenterX = recenterAssembledX * lateralRecenter;
      const recenterY = recenterAssembledY * eased;
      return { scale, recenterX, recenterY };
    }

    function updateCallout(p: number, offsets: Record<string, readonly [number, number, number]>) {
      const group = calloutGroupRef.current;
      const dot = calloutDotRef.current;
      const ring = calloutRingRef.current;
      const connPath = connectorPathRef.current;
      const connNode = connectorNodeRef.current;
      const rail = railRef.current;
      if (!group || !dot || !ring) return;

      const stepId = activeStepRef.current;
      if (!stepId) {
        group.style.opacity = "0";
        if (connPath) connPath.style.opacity = "0";
        if (connNode) connNode.style.opacity = "0";
        return;
      }

      const anchor = anchors[stepId];
      const [dx, dy, dz] = offsets[anchor.ride] ?? [0, 0, 0];
      const tx = dx * ex[0] + dy * ey[0] + dz * ez[0];
      const ty = dx * ex[1] + dy * ey[1] + dz * ez[1];

      const { scale, recenterX, recenterY } = cameraTransform(p);
      const cx = width * 0.5;
      const cy = height * 0.5;

      const rawX = anchor.at[0] + tx + recenterX;
      const rawY = anchor.at[1] + ty + recenterY;
      const screenX = cx + (rawX - cx) * scale;
      const screenY = cy + (rawY - cy) * scale;

      dot.setAttribute("cx", screenX.toFixed(1));
      dot.setAttribute("cy", screenY.toFixed(1));
      ring.setAttribute("cx", screenX.toFixed(1));
      ring.setAttribute("cy", screenY.toFixed(1));
      group.style.opacity = "1";

      if (connPath && connNode && rail && container && svg) {
        const stepIdx = towerAssemblySteps.findIndex((s) => s.id === stepId);
        const activeCard = stepIdx >= 0 ? stepRefs.current[stepIdx] : null;
        if (!activeCard || window.innerWidth < 1100) {
          connPath.style.opacity = "0";
          connNode.style.opacity = "0";
          return;
        }
        const hostRect = container.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        const cardRect = activeCard.getBoundingClientRect();
        const headingEl = activeCard.querySelector("h3");
        const headingRect = headingEl ? headingEl.getBoundingClientRect() : cardRect;

        if (svgRect.width > 0 && svgRect.height > 0) {
          const x1 = svgRect.left - hostRect.left + (screenX / width) * svgRect.width + 8;
          const y1 = svgRect.top - hostRect.top + (screenY / height) * svgRect.height;
          const x2 = railRect.left - hostRect.left + railRect.width * 0.5;
          const visibleYViewport = clamp(
            headingRect.top + headingRect.height * 0.5,
            Math.max(cardRect.top + 16, 92),
            Math.max(cardRect.top + 16, Math.min(cardRect.bottom - 24, window.innerHeight - 36)),
          );
          const y2 = visibleYViewport - hostRect.top;
          const midX = Math.max(x1 + 16, x2 - 28);

          const d =
            Math.abs(y2 - y1) < 2
              ? `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y1.toFixed(1)}`
              : `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${midX.toFixed(1)} ${y1.toFixed(1)} L ${midX.toFixed(1)} ${y2.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
          connPath.setAttribute("d", d);
          connPath.style.opacity = "1";
          connNode.setAttribute("x", (x2 - 3.5).toFixed(1));
          connNode.setAttribute("y", (y2 - 3.5).toFixed(1));
          connNode.style.opacity = "1";
        }
      }
    }

    function applyProgress(progress: number) {
      const p = clamp(progress, 0, 1);
      const { scale, recenterX, recenterY } = cameraTransform(p);
      const cx = width * 0.5;
      const cy = height * 0.5;
      rootGroup!.setAttribute(
        "transform",
        `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${scale.toFixed(4)}) translate(${(recenterX - cx).toFixed(2)} ${(recenterY - cy).toFixed(2)})`,
      );

      const offsets = computeTierOffsets(p);

      // Seamless cross-fade at 92%..98%: remove longitudinal cutaway seam once front shells have fully seated
      const seamBlend = smoothstep(clamp((p - 0.92) / 0.06, 0, 1));
      const splitAlpha = (1 - seamBlend).toFixed(3);
      const wholeAlpha = seamBlend.toFixed(3);

      const keyed = nodes.map((node, i) => {
        const [dx, dy, dz] = offsets[node.ride] ?? [0, 0, 0];
        const tx = dx * ex[0] + dy * ey[0] + dz * ez[0];
        const ty = dx * ex[1] + dy * ey[1] + dz * ez[1];
        const nextTransform = Math.abs(tx) > 0.04 || Math.abs(ty) > 0.04 ? `translate(${tx.toFixed(2)} ${ty.toFixed(2)})` : "";
        if (nextTransform !== node.lastTransform) {
          if (nextTransform) node.el.setAttribute("transform", nextTransform);
          else node.el.removeAttribute("transform");
          node.lastTransform = nextTransform;
        }

        if (node.role !== "common") {
          const nextOpacity = node.role === "split" ? splitAlpha : wholeAlpha;
          if (nextOpacity !== node.lastOpacity) {
            node.el.style.opacity = nextOpacity;
            node.lastOpacity = nextOpacity;
          }
        }

        return { i, k: node.key + dx * viewDir[0] + dy * viewDir[1] + dz * viewDir[2] };
      });

      keyed.sort((a, b) => a.k - b.k || a.i - b.i);
      let changed = false;
      for (let idx = 0; idx < keyed.length; idx++) {
        if (keyed[idx].i !== currentOrder[idx]) {
          changed = true;
          break;
        }
      }
      if (changed) {
        const frag = document.createDocumentFragment();
        for (let idx = 0; idx < keyed.length; idx++) {
          const nodeIdx = keyed[idx].i;
          currentOrder[idx] = nodeIdx;
          frag.appendChild(nodes[nodeIdx].el);
        }
        rootGroup!.appendChild(frag);
      }

      updateCallout(p, offsets);

      if (railFillRef.current) {
        railFillRef.current.style.transform = `scaleY(${p.toFixed(4)})`;
      }
      if (percentTextRef.current) {
        percentTextRef.current.textContent = `${Math.round(p * 100)}%`;
      }
    }

    let rafId = 0;
    let lastTime = 0;

    function tick(now: number) {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 1 / 30) : 1 / 60;
      lastTime = now;
      const target = manualOverrideRef.current ?? targetProgressRef.current;

      if (reducedQuery.matches) {
        currentProgressRef.current = target;
        applyProgress(target);
        rafId = 0;
        return;
      }

      const diff = target - currentProgressRef.current;
      if (Math.abs(diff) < 0.0008) {
        currentProgressRef.current = target;
        applyProgress(target);
        rafId = 0;
        return;
      }

      currentProgressRef.current += diff * (1 - Math.exp(-dt / 0.1));
      applyProgress(currentProgressRef.current);
      rafId = requestAnimationFrame(tick);
    }

    function kick() {
      if (!rafId) {
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }
    }

    const syncCalloutOnly = () => {
      const p = currentProgressRef.current;
      updateCallout(p, computeTierOffsets(p));
    };

    const host = container as HTMLElement & { __kickTower?: () => void; __syncCallout?: () => void };
    host.__kickTower = kick;
    host.__syncCallout = syncCalloutOnly;

    if (reducedQuery.matches) {
      targetProgressRef.current = 1;
      currentProgressRef.current = 1;
      activeStepRef.current = null;
      applyProgress(1);
      setActiveStep(null);
      return;
    }

    applyProgress(0);

    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      ScrollTrigger.create({
        trigger: container,
        start: "top 18%",
        end: "bottom 92%",
        onUpdate: (self) => {
          targetProgressRef.current = self.progress;
          if (manualOverrideRef.current === null) {
            if (self.progress >= 0.96) {
              setActiveStep(null);
            } else {
              const found = towerAssemblySteps.find(
                (step) => self.progress >= step.scrollRange[0] && self.progress < step.scrollRange[1],
              );
              setActiveStep(found ? found.id : "skirt");
            }
          }
          kick();
        },
      });
    }, container);

    const onScrollOrResize = () => syncCalloutOnly();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    const onReducedChange = () => {
      if (reducedQuery.matches) {
        manualOverrideRef.current = null;
        targetProgressRef.current = 1;
        currentProgressRef.current = 1;
        activeStepRef.current = null;
        applyProgress(1);
        setActiveStep(null);
      }
    };
    reducedQuery.addEventListener("change", onReducedChange);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      reducedQuery.removeEventListener("change", onReducedChange);
      context.revert();
    };
  }, []);

  function kickLoop() {
    const el = sectionRef.current as (HTMLDivElement & { __kickTower?: () => void }) | null;
    el?.__kickTower?.();
  }

  function setPoseMode(mode: "scroll" | "apart" | "assembled") {
    setManualMode(mode);
    if (mode === "apart") {
      manualOverrideRef.current = 0;
      setActiveStep("top");
    } else if (mode === "assembled") {
      manualOverrideRef.current = 1;
      setActiveStep(null);
    } else {
      manualOverrideRef.current = null;
    }
    kickLoop();
  }

  function handleStepClick(stepId: TowerPieceId, index: number) {
    setActiveStep(stepId);
    const targetEl = stepRefs.current[index];
    if (manualMode !== "scroll") {
      const step = towerAssemblySteps[index];
      manualOverrideRef.current = (step.scrollRange[0] + step.scrollRange[1]) / 2;
      kickLoop();
      return;
    }
    targetEl?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const activeInfo = towerAssemblySteps.find((s) => s.id === activeStep);

  return (
    <div ref={sectionRef} className="pt-tower-assembly">
      {/* 跨列工程引出折线层 */}
      <svg className="pt-tower-connector" aria-hidden="true">
        <path ref={connectorPathRef} className="pt-tower-connector-path" d="" />
        <rect ref={connectorNodeRef} className="pt-tower-connector-node" width="7" height="7" x="0" y="0" />
      </svg>

      {/* 左侧无框大幅塔器舞台 */}
      <div className="pt-tower-visual-col">
        <div className="pt-tower-stage">
          <div className="pt-tower-canvas">
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${TOWER_GEOMETRY.width} ${TOWER_GEOMETRY.height}`}
              className="pt-tower-svg"
              role="img"
              aria-labelledby="pt-tower-caption"
            >
              <g ref={rootGroupRef}>
                {TOWER_GEOMETRY.items.map((item) => (
                  <g
                    key={item.name}
                    className={`pt-tower-it${item.extraClass ? ` ${item.extraClass}` : ""}`}
                    data-name={item.name}
                    data-piece={item.piece}
                    data-ride={item.ride}
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />
                ))}
              </g>

              {/* 锁定当前部件边缘的红色工程锚点 */}
              <g ref={calloutGroupRef} className="pt-tower-callout" aria-hidden="true">
                <circle ref={calloutRingRef} className="pt-tower-callout-ring" cx="0" cy="0" r="8" />
                <circle ref={calloutDotRef} className="pt-tower-callout-dot" cx="0" cy="0" r="3.6" />
              </g>
            </svg>
          </div>

          <div className="pt-tower-stage-foot">
            <div className="pt-tower-stage-meta" aria-live="polite">
              <strong className="pt-tower-active-label">
                {activeInfo ? `${activeInfo.index} ${activeInfo.title}` : "整塔合拢完成"}
              </strong>
              <span className="pt-tower-percent" ref={percentTextRef}>
                0%
              </span>
            </div>

            <div className="pt-tower-state-toggle" role="group" aria-label="装配视图状态">
              <button
                type="button"
                className="pt-tower-pill"
                aria-pressed={manualMode === "scroll"}
                onClick={() => setPoseMode("scroll")}
              >
                随滚装配
              </button>
              <button
                type="button"
                className="pt-tower-pill"
                aria-pressed={manualMode === "apart"}
                onClick={() => setPoseMode("apart")}
              >
                剖切拆解
              </button>
              <button
                type="button"
                className="pt-tower-pill"
                aria-pressed={manualMode === "assembled"}
                onClick={() => setPoseMode("assembled")}
              >
                整塔态
              </button>
            </div>
          </div>
          <p id="pt-tower-caption" className="pt-tower-caption">
            钢衬填料塔纵向剖切与合拢结构示意（非比例）
          </p>
        </div>
      </div>

      {/* 右侧带纵向装配进尺的焦点叙事列 */}
      <div className="pt-tower-steps-wrap">
        <div ref={railRef} className="pt-tower-rail" aria-hidden="true">
          <span ref={railFillRef} className="pt-tower-rail-fill" style={{ transform: "scaleY(0)" }} />
        </div>

        <ol className="pt-tower-steps-col">
          {towerAssemblySteps.map((step, index) => {
            const isActive = activeStep === step.id;
            const isDimmed = activeStep !== null && !isActive;
            return (
              <li
                key={step.id}
                ref={(el) => {
                  stepRefs.current[index] = el;
                }}
                className="pt-tower-step"
                data-active={isActive ? "true" : undefined}
                data-dimmed={isDimmed ? "true" : undefined}
              >
                <button
                  type="button"
                  className="pt-tower-step-trigger"
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => handleStepClick(step.id, index)}
                >
                  <div className="pt-tower-step-head">
                    <span className="pt-num">{step.index}</span>
                    <h3>{step.title}</h3>
                  </div>
                </button>

                <p className="pt-tower-step-body">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
