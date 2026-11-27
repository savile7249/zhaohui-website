"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { contactInfo } from "@/components/contact-data";
import { ZhaohuiLogo, type BrandSurfaceTone } from "@/components/zhaohui-logo";

export type NavSectionId = "about" | "equipment" | "credentials" | "manufacturing";

const primaryNavigation: ReadonlyArray<{ readonly label: string; readonly id: NavSectionId }> = [
  { label: "关于", id: "about" },
  { label: "设备", id: "equipment" },
  { label: "应用与资质", id: "credentials" },
  { label: "制造", id: "manufacturing" },
];

function PhoneCallingIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M13.5 2.00006C13.5 2.00006 15.8335 2.21219 18.8033 5.18204C21.7731 8.15189 21.9853 10.4853 21.9853 10.4853"
        strokeLinecap="round"
        stroke="currentColor"
      />
      <path
        d="M14.207 5.53564C14.207 5.53564 15.197 5.81849 16.6819 7.30341C18.1668 8.78834 18.4497 9.77829 18.4497 9.77829"
        strokeLinecap="round"
        stroke="currentColor"
      />
      <path
        d="M19.0011 20.254C18.6399 20.6343 18.1917 20.9122 17.6763 20.9631C16.0468 21.1239 12.0621 20.9462 7.81536 16.4752C3.81072 12.259 3.09304 8.64546 3.00289 6.96594C2.96765 6.30945 3.25823 5.71766 3.69185 5.26114L5.26145 3.60864C6.13596 2.68795 7.61028 2.8305 8.37326 3.90961L9.63424 5.6931C10.2507 6.56497 10.1841 7.75924 9.47752 8.50311L9.1907 8.80507C9.1907 8.80507 8.10812 9.94484 11.0631 13.0559C14.0181 16.167 15.1007 15.0272 15.1007 15.0272L15.5562 14.5477C16.1858 13.8848 17.1672 13.7486 17.9728 14.2123L19.8833 15.312C21.1102 16.0182 21.3806 17.7489 20.4217 18.7584L19.0011 20.254Z"
        strokeLinecap="round"
        stroke="currentColor"
      />
    </svg>
  );
}

function DialogIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M18 14C18 18.4183 14.4183 22 10 22C8.76449 22 7.5944 21.7199 6.54976 21.2198C6.19071 21.0479 5.78393 20.9876 5.39939 21.0904L4.17335 21.4185C3.20701 21.677 2.32295 20.793 2.58151 19.8267L2.90955 18.6006C3.01245 18.2161 2.95209 17.8093 2.7802 17.4502C2.28008 16.4056 2 15.2355 2 14C2 9.58172 5.58172 6 10 6C14.4183 6 18 9.58172 18 14Z"
        strokeLinecap="round"
        stroke="currentColor"
      />
      <path
        d="M18 14.5018C18.0665 14.4741 18.1324 14.4453 18.1977 14.4155C18.5598 14.2501 18.9661 14.1882 19.3506 14.2911L19.8267 14.4185C20.793 14.677 21.677 13.793 21.4185 12.8267L21.2911 12.3506C21.1882 11.9661 21.2501 11.5598 21.4155 11.1977C21.7908 10.376 22 9.46242 22 8.5C22 4.91015 19.0899 2 15.5 2C12.7977 2 10.4806 3.64899 9.5 5.9956"
        strokeLinecap="round"
        stroke="currentColor"
      />
      <path
        d="M6.51779 14H6.52679M10.0085 14H10.0175M13.4995 14H13.5085"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      />
    </svg>
  );
}

export interface SiteHeaderProps {
  /** 是否在首页内渲染（首页使用页内锚点，子页面使用 /#... 与返回首页） */
  isHome?: boolean;
  /** 当前高亮的主导航分区（首页随滚动更新，产品页固定为 "equipment"） */
  activeSection?: string;
  /** 询价准备目标链接（保留产品页的预选上下文） */
  briefHref?: string;
  /** 页头是否处于滚动实底态 */
  scrolled?: boolean;
  /** 当前页头下方区块明暗 */
  surface?: BrandSurfaceTone;
}

export function SiteHeader({
  isHome = false,
  activeSection = "",
  briefHref = "/#brief",
  scrolled = false,
  surface = "dark",
}: SiteHeaderProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const headerPhones = contactInfo.phones.slice(0, 2);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const menu = menuRef.current;
      if (!menu?.open) return;
      if (!menu.contains(event.target as Node)) {
        menu.removeAttribute("open");
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key === "Escape" && menuRef.current?.open) {
      event.preventDefault();
      closeMenu();
      summaryRef.current?.focus();
    }
  }

  return (
    <header
      className="pt-header"
      data-scrolled={scrolled ? "true" : undefined}
      data-surface={surface}
    >
      <div className="pt-header-inner">
        <div className="pt-header-primary">
          {isHome ? (
            <a href="#top" aria-label="兆辉智能装备 · 返回顶部" className="pt-logo-link">
              <ZhaohuiLogo surface={surface} className="pt-brand-logo" priority />
            </a>
          ) : (
            <Link href="/" aria-label="兆辉智能装备 · 返回首页" className="pt-logo-link">
              <ZhaohuiLogo surface={surface} className="pt-brand-logo" priority />
            </Link>
          )}

          <nav className="pt-desktop-nav" aria-label="主导航">
            {primaryNavigation.map(({ label, id }) => {
              const isActive = activeSection === id;
              const ariaCurrent = isActive ? (isHome ? "location" : "true") : undefined;
              return isHome ? (
                <a key={id} href={`#${id}`} aria-current={ariaCurrent}>
                  {label}
                </a>
              ) : (
                <Link key={id} href={`/#${id}`} aria-current={ariaCurrent}>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-header-actions">
          {headerPhones.length > 0 && (
            <div className="pt-header-phones" aria-label="联系电话">
              <span className="pt-header-phone-icon" aria-hidden="true">
                <PhoneCallingIcon />
              </span>
              <div className="pt-header-phone-list">
                {headerPhones.map((phone) => (
                  <a key={phone.href} href={phone.href} className="pt-header-phone-link">
                    {phone.display}
                  </a>
                ))}
              </div>
            </div>
          )}

          {isHome ? (
            <a href={briefHref} className="pt-header-cta">
              <DialogIcon className="pt-header-cta-icon" />
              <span>询价准备</span>
            </a>
          ) : (
            <Link href={briefHref} className="pt-header-cta">
              <DialogIcon className="pt-header-cta-icon" />
              <span>询价准备</span>
            </Link>
          )}

          <details className="pt-mobile-menu" ref={menuRef} onKeyDown={onMenuKeyDown}>
            <summary ref={summaryRef}>菜单</summary>
            <div className="pt-mobile-drawer">
              <nav className="pt-mobile-nav" aria-label="移动端导航" onClick={closeMenu}>
                {primaryNavigation.map(({ label, id }) => {
                  const isActive = activeSection === id;
                  const ariaCurrent = isActive ? (isHome ? "location" : "true") : undefined;
                  return isHome ? (
                    <a key={id} href={`#${id}`} aria-current={ariaCurrent}>
                      {label}
                    </a>
                  ) : (
                    <Link key={id} href={`/#${id}`} aria-current={ariaCurrent}>
                      {label}
                    </Link>
                  );
                })}
              </nav>

              {contactInfo.phones.length > 0 && (
                <div className="pt-mobile-phones" aria-label="联系电话">
                  {contactInfo.phones.map((phone) => (
                    <a key={phone.href} href={phone.href} className="pt-mobile-phone-link" onClick={closeMenu}>
                      <PhoneCallingIcon className="pt-mobile-phone-icon" />
                      <span>{phone.display}</span>
                    </a>
                  ))}
                </div>
              )}

              <div className="pt-mobile-cta-wrap" onClick={closeMenu}>
                {isHome ? (
                  <a href={briefHref} className="pt-mobile-cta">
                    <DialogIcon className="pt-header-cta-icon" />
                    <span>询价准备</span>
                  </a>
                ) : (
                  <Link href={briefHref} className="pt-mobile-cta">
                    <DialogIcon className="pt-header-cta-icon" />
                    <span>询价准备</span>
                  </Link>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
