"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SiteHeader } from "@/components/site-header";
import { detectHeaderSurface, type BrandSurfaceTone } from "@/components/zhaohui-logo";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function HomeClient({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const [headerSurface, setHeaderSurface] = useState<BrandSurfaceTone>("dark");

  useIsomorphicLayoutEffect(() => {
    const page = rootRef.current;
    if (!page) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    const cleanups: Array<() => void> = [];

    const context = gsap.context(() => {
      page.querySelectorAll<HTMLElement>("[data-section]").forEach((section) => {
        ScrollTrigger.create({
          trigger: section,
          start: "top 40%",
          end: "bottom 40%",
          onToggle: (self) => {
            if (self.isActive) setActive(section.id);
          },
        });
      });

      const onScroll = () => {
        setScrolled(window.scrollY > 24);
        setHeaderSurface(detectHeaderSurface(page));
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        // 首屏入场由 CSS 完成（首帧即可见），这里只处理滚动出现。
        page.querySelectorAll<HTMLElement>("[data-rise]").forEach((element) => {
          gsap.from(element, {
            y: 20,
            opacity: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: { trigger: element, start: "top 88%", once: true },
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
        isHome
        activeSection={active}
        briefHref="#brief"
        scrolled={scrolled}
        surface={headerSurface}
      />

      <main id="pt-main">{children}</main>
    </div>
  );
}
