"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type TrackEventType = "page_view" | "brief_copy_success" | "phone_click" | "email_click";

function normalizePathname(raw: string): string {
  const pathOnly = (raw || "/").split("?")[0].split("#")[0] || "/";
  if (pathOnly === "/") return "/";
  return pathOnly.endsWith("/") ? pathOnly : `${pathOnly}/`;
}

function extractProductCategory(pathname: string): string {
  const match = pathname.match(/^\/products\/([a-z0-9_-]+)\/$/);
  return match ? match[1] : "";
}

export function sendAnonymousEvent(payload: {
  event_type: TrackEventType;
  page_path: string;
  product_category?: string;
  is_spa_navigation?: boolean;
}) {
  if (typeof window === "undefined") return;
  const normalizedPath = normalizePathname(payload.page_path);
  const category = (payload.product_category || extractProductCategory(normalizedPath)).slice(0, 64);
  const body = JSON.stringify({
    event_type: payload.event_type,
    page_path: normalizedPath,
    product_category: category,
    is_spa_navigation: Boolean(payload.is_spa_navigation),
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/_track/event", blob)) {
        return;
      }
    }
    void fetch("/_track/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Monitoring never blocks visitor navigation or UI interactions.
  }
}

export function trackBriefCopySuccess(productCategory: string) {
  if (typeof window === "undefined") return;
  sendAnonymousEvent({
    event_type: "brief_copy_success",
    page_path: window.location.pathname || "/",
    product_category: productCategory,
    is_spa_navigation: false,
  });
}

export function SiteTracker() {
  const pathname = usePathname();
  const hasSentInitial = useRef(false);
  const lastSentPath = useRef<string | null>(null);

  useEffect(() => {
    const normalized = normalizePathname(pathname || "/");
    if (lastSentPath.current === normalized) return;
    const isSpa = hasSentInitial.current;
    hasSentInitial.current = true;
    lastSentPath.current = normalized;

    sendAnonymousEvent({
      event_type: "page_view",
      page_path: normalized,
      product_category: extractProductCategory(normalized),
      is_spa_navigation: isSpa,
    });
  }, [pathname]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      const currentPath = normalizePathname(window.location.pathname || "/");
      if (href.startsWith("tel:")) {
        sendAnonymousEvent({
          event_type: "phone_click",
          page_path: currentPath,
          product_category: extractProductCategory(currentPath),
        });
      } else if (href.startsWith("mailto:")) {
        sendAnonymousEvent({
          event_type: "email_click",
          page_path: currentPath,
          product_category: extractProductCategory(currentPath),
        });
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  return null;
}
