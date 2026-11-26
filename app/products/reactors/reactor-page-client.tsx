"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getProductBriefHref } from "@/app/products/product-data";
import { detectHeaderSurface, ZhaohuiLogo, type BrandSurfaceTone } from "@/components/zhaohui-logo";

const navigation = [
  ["反应釜结构", "#structure"],
  ["产品实拍", "#gallery"],
  ["沟通条件", "#inputs"],
  ["储罐", "/products/tanks"],
  ["塔器", "/products/towers"],
  ["管道", "/products/piping"],
  ["返回首页", "/"],
] as const;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ReactorPageClient({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [active, setActive] = useState<string>("structure");
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

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  return (
    <div id="top" ref={rootRef} className="pt-root">
      <a className="pt-skip-link" href="#pt-main">
        跳到主要内容
      </a>

      <header
        className="pt-header"
        data-scrolled={scrolled ? "true" : undefined}
        data-surface={headerSurface}
      >
        <div className="pt-header-inner">
          <Link href="/" aria-label="兆辉智能装备 · 返回首页" className="pt-logo-link">
            <ZhaohuiLogo surface={headerSurface} className="pt-brand-logo" priority />
          </Link>

          <nav className="pt-desktop-nav" aria-label="主导航">
            {navigation.map(([label, href]) =>
              href.startsWith("#") ? (
                <a key={href} href={href} aria-current={active === href.slice(1) ? "location" : undefined}>
                  {label}
                </a>
              ) : (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ),
            )}
          </nav>

          <div className="pt-header-actions">
            <Link href={getProductBriefHref("reactors")} className="pt-header-cta">
              询价准备
            </Link>
            <details className="pt-mobile-menu" ref={menuRef}>
              <summary>菜单</summary>
              <nav aria-label="移动端导航" onClick={closeMenu}>
                {navigation.map(([label, href]) =>
                  href.startsWith("#") ? (
                    <a key={href} href={href} aria-current={active === href.slice(1) ? "location" : undefined}>
                      {label}
                    </a>
                  ) : (
                    <Link key={href} href={href}>
                      {label}
                    </Link>
                  ),
                )}
                <Link href={getProductBriefHref("reactors")}>询价准备</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="pt-main">{children}</main>
    </div>
  );
}
