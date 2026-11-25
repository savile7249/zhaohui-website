"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type BrandSurfaceTone = "dark" | "light";

interface ZhaohuiLogoProps {
  /**
   * 背景明暗类型：
   * - "dark"：黑色或暗色背景，使用黑底规范（白色文字版）透明素材
   * - "light"：白色或明亮背景，使用白底规范（黑色文字版）透明素材
   * - "auto"：自动读取最近不透明祖先背景亮度切换
   */
  surface?: BrandSurfaceTone | "auto";
  priority?: boolean;
  className?: string;
}

const LOGO_WIDTH = 1200;
const LOGO_HEIGHT = 177;

function parseRgba(color: string): { r: number; g: number; b: number; a: number } | null {
  const match = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * 判断元素的背景属于明亮（"light"）还是暗色（"dark"）。
 */
export function resolveElementSurface(element: HTMLElement | null): BrandSurfaceTone {
  let node: HTMLElement | null = element;
  while (node) {
    const explicit = node.dataset.surface;
    if (explicit === "light" || explicit === "dark") {
      return explicit;
    }
    if (node.classList.contains("is-paper")) return "light";
    if (node.classList.contains("is-dark")) return "dark";

    const bg = window.getComputedStyle(node).backgroundColor;
    const rgba = parseRgba(bg);
    if (rgba && rgba.a > 0.1) {
      return relativeLuminance(rgba.r, rgba.g, rgba.b) >= 0.45 ? "light" : "dark";
    }
    node = node.parentElement;
  }
  return "dark";
}

/**
 * 检测固定页头中线下方当前区块的背景明暗，供主线页面页头与左上角 Logo 实时适配。
 */
export function detectHeaderSurface(root: HTMLElement, probeY = 34): BrandSurfaceTone {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("main > section, main > footer"));
  if (blocks.length === 0) return "dark";

  const hit =
    blocks.find((block) => {
      const rect = block.getBoundingClientRect();
      return rect.top <= probeY && rect.bottom > probeY;
    }) ?? (blocks[0].getBoundingClientRect().top > probeY ? blocks[0] : blocks[blocks.length - 1]);

  return resolveElementSurface(hit);
}

export function ZhaohuiLogo({
  surface = "dark",
  priority = true,
  className,
}: ZhaohuiLogoProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [autoSurface, setAutoSurface] = useState<BrandSurfaceTone>("dark");

  useEffect(() => {
    if (surface !== "auto") return;
    const update = () => {
      setAutoSurface(resolveElementSurface(hostRef.current?.parentElement ?? null));
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [surface]);

  const resolved: BrandSurfaceTone = surface === "auto" ? autoSurface : surface;

  return (
    <span
      ref={hostRef}
      className={className ? `zh-brand-logo ${className}` : "zh-brand-logo"}
      data-surface={resolved}
      style={{
        position: "relative",
        display: "block",
        aspectRatio: `${LOGO_WIDTH} / ${LOGO_HEIGHT}`,
      }}
    >
      <Image
        src="/images/brand/zhaohui-logo-on-dark.png"
        alt={resolved === "dark" ? "ZHAOHUI 兆辉智能装备" : ""}
        aria-hidden={resolved !== "dark" || undefined}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        className="zh-brand-logo-img"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: resolved === "dark" ? 1 : 0,
        }}
      />
      <Image
        src="/images/brand/zhaohui-logo-on-light.png"
        alt={resolved === "light" ? "ZHAOHUI 兆辉智能装备" : ""}
        aria-hidden={resolved !== "light" || undefined}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        className="zh-brand-logo-img"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: resolved === "light" ? 1 : 0,
        }}
      />
    </span>
  );
}
