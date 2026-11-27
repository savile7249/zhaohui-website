"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductGalleryMedia } from "@/lib/product-catalog";
import { isFullBleedProductImage } from "@/lib/product-media";

interface VariantMediaShowcaseProps {
  readonly title: string;
  readonly images: readonly ProductGalleryMedia[];
}

export function VariantMediaShowcase({ title, images }: VariantMediaShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeImages = images.length > 0 ? images : [];
  const active = safeImages[activeIndex] ?? safeImages[0];

  if (!active) return null;

  const activeFullBleed = isFullBleedProductImage(active.src);

  return (
    <div className="pt-variant-media-wrap">
      <div className={`pt-variant-stage${activeFullBleed ? " is-full-bleed" : ""}`}>
        <Image
          src={active.src}
          alt={active.alt || title}
          fill
          priority
          sizes="(min-width: 1100px) 46vw, 100vw"
        />
      </div>

      {safeImages.length > 1 ? (
        <div className="pt-variant-thumbs" role="tablist" aria-label={`${title} 实拍图切换`}>
          {safeImages.map((img, idx) => {
            const thumbFullBleed = isFullBleedProductImage(img.src);
            return (
              <button
                key={`${img.src}-${idx}`}
                type="button"
                role="tab"
                aria-selected={idx === activeIndex}
                className="pt-variant-thumb"
                onClick={() => setActiveIndex(idx)}
              >
                <span className={`pt-variant-thumb-media${thumbFullBleed ? " is-full-bleed" : ""}`}>
                  <Image src={img.src} alt={img.alt || `${title} 实拍 ${idx + 1}`} fill sizes="120px" />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
