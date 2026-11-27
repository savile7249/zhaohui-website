"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ProductSlug } from "@/app/products/product-data";
import { SiteHeader } from "@/components/site-header";
import { detectHeaderSurface, type BrandSurfaceTone } from "@/components/zhaohui-logo";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface ProductSubpageShellProps {
  readonly categorySlug: ProductSlug;
  readonly briefHref: string;
  readonly children: ReactNode;
}

export function ProductSubpageShell({ briefHref, children }: ProductSubpageShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [headerSurface, setHeaderSurface] = useState<BrandSurfaceTone>("dark");

  useIsomorphicLayoutEffect(() => {
    const page = rootRef.current;
    if (!page) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    const cleanups: Array<() => void> = [];

    const context = gsap.context(() => {
      const onScroll = () => {
        setScrolled(window.scrollY > 24);
        setHeaderSurface(detectHeaderSurface(page));
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      const onAnchorClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest?.('a[href="#top"]');
        if (!anchor) return;
        event.preventDefault();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      };
      page.addEventListener("click", onAnchorClick);
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        page.removeEventListener("click", onAnchorClick);
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        page.querySelectorAll<HTMLElement>("[data-rise]").forEach((element) => {
          gsap.from(element, {
            y: 20,
            opacity: 0,
            duration: 0.75,
            ease: "power2.out",
            scrollTrigger: { trigger: element, start: "top 90%", once: true },
          });
        });
      });
    }, page);

    let disposed = false;
    void document.fonts.ready.then(() => {
      if (!disposed) ScrollTrigger.refresh();
    });

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
      media.revert();
      context.revert();
    };
  }, []);

  return (
    <div id="top" ref={rootRef} className="pt-root">
      <a className="pt-skip-link" href="#pt-main">
        跳到主要内容
      </a>

      <SiteHeader
        activeSection="equipment"
        briefHref={briefHref}
        scrolled={scrolled}
        surface={headerSurface}
      />

      <main id="pt-main">{children}</main>
    </div>
  );
}
