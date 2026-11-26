"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

export interface ProductPhotoItem {
  readonly id: string;
  readonly index: string;
  readonly tag: string;
  readonly title: string;
  readonly caption: string;
  readonly image: string;
  readonly imageAlt: string;
}

interface ProductPhotoGalleryProps {
  readonly productTitle: string;
  readonly photos: readonly ProductPhotoItem[];
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("inert") && element.getClientRects().length > 0,
  );
}

export function ProductPhotoGallery({ productTitle, photos }: ProductPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const isOpen = activeIndex !== null;

  const restoreFocusToOpener = useCallback(() => {
    const opener = openerRef.current;
    if (opener && opener.isConnected) {
      opener.focus();
    }
  }, []);

  const closeLightbox = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
    setActiveIndex(null);
    restoreFocusToOpener();
  }, [restoreFocusToOpener]);

  const showPrev = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev === null) return null;
      return (prev - 1 + photos.length) % photos.length;
    });
  }, [photos.length]);

  const showNext = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev === null) return null;
      return (prev + 1) % photos.length;
    });
  }, [photos.length]);

  function openLightbox(index: number, trigger: HTMLElement | null) {
    openerRef.current = trigger;
    setActiveIndex(index);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!isOpen) {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) {
      dialog.showModal();
    }
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [isOpen]);

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrev();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
      return;
    }

    if (event.key === "Tab") {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = getFocusableElements(dialog);
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === first || !dialog.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (!activeElement || activeElement === last || !dialog.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const count = photos.length;
  const gridClass =
    count === 2 ? "is-count-2" : count === 3 ? "is-count-3" : count === 5 ? "is-count-5" : "is-count-default";
  const activePhoto = activeIndex !== null ? photos[activeIndex] : null;

  return (
    <>
      <ol className={`pt-gallery-grid ${gridClass}`} aria-label={`${productTitle}产品实拍图`}>
        {photos.map((photo, idx) => {
          const isWide = count === 2 || (count === 5 && idx < 2);
          return (
            <li key={photo.id} className={isWide ? "is-wide" : ""} data-rise>
              <figure className="pt-gallery-card">
                <button
                  type="button"
                  className="pt-gallery-trigger"
                  onClick={(event) => openLightbox(idx, event.currentTarget)}
                  aria-label={`放大查看 ${photo.title} 实拍图`}
                >
                  <span className="pt-gallery-media">
                    <Image
                      src={photo.image}
                      alt={photo.imageAlt}
                      fill
                      sizes={isWide ? "(min-width: 900px) 46vw, 100vw" : "(min-width: 900px) 30vw, 100vw"}
                    />
                  </span>
                </button>

                <figcaption className="pt-gallery-meta">
                  <div className="pt-gallery-meta-top">
                    <span className="pt-gallery-index">
                      <span className="pt-num">{photo.index}</span>
                      <span className="pt-gallery-tag">{photo.tag}</span>
                    </span>
                  </div>
                  <h3>{photo.title}</h3>
                  <p>{photo.caption}</p>
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ol>

      <dialog
        ref={dialogRef}
        className="pt-lightbox"
        aria-modal="true"
        aria-label={activePhoto ? `${activePhoto.title} 实拍大图` : `${productTitle} 实拍大图`}
        onCancel={(event) => {
          event.preventDefault();
          closeLightbox();
        }}
        onKeyDown={handleDialogKeyDown}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeLightbox();
        }}
      >
        {activePhoto !== null && activeIndex !== null ? (
          <div className="pt-lightbox-panel">
            <div className="pt-lightbox-bar">
              <div className="pt-lightbox-title">
                <span className="pt-num">
                  {String(activeIndex + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
                </span>
                <h3>{activePhoto.title}</h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="pt-lightbox-btn"
                onClick={closeLightbox}
              >
                关闭
              </button>
            </div>

            <div className="pt-lightbox-stage">
              <Image src={activePhoto.image} alt={activePhoto.imageAlt} fill sizes="92vw" priority />
            </div>

            <div className="pt-lightbox-foot">
              <p>{activePhoto.caption}</p>
              {photos.length > 1 ? (
                <div className="pt-lightbox-nav">
                  <button type="button" className="pt-lightbox-btn" onClick={showPrev}>
                    上一张
                  </button>
                  <button type="button" className="pt-lightbox-btn" onClick={showNext}>
                    下一张
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
