import Image from "next/image";
import Link from "next/link";
import { isFullBleedProductImage } from "@/lib/product-media";

export interface ProductPhotoItem {
  readonly id: string;
  readonly index: string;
  readonly tag: string;
  readonly title: string;
  readonly caption: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly detailHref?: string;
  readonly articleCount?: number;
}

interface ProductPhotoGalleryProps {
  readonly productTitle: string;
  readonly photos: readonly ProductPhotoItem[];
}

export function ProductPhotoGallery({ productTitle, photos }: ProductPhotoGalleryProps) {
  const count = photos.length;
  const gridClass =
    count === 2
      ? "is-count-2"
      : count === 3
        ? "is-count-3"
        : count === 4
          ? "is-count-4"
          : count === 5
            ? "is-count-5"
            : "is-count-default";

  return (
    <ol className={`pt-gallery-grid ${gridClass}`} aria-label={`${productTitle}产品实拍与细分机型`}>
      {photos.map((photo, idx) => {
        const isWide = count === 2 || count === 4 || (count === 5 && idx < 2);
        const isFullBleed = isFullBleedProductImage(photo.image);
        const mediaClass = isFullBleed ? "pt-gallery-media is-full-bleed" : "pt-gallery-media";
        const imageSizes = isWide ? "(min-width: 900px) 46vw, 100vw" : "(min-width: 900px) 30vw, 100vw";

        return (
          <li key={photo.id} className={isWide ? "is-wide" : ""} data-rise>
            <figure className="pt-gallery-card">
              {photo.detailHref ? (
                <Link
                  href={photo.detailHref}
                  className="pt-gallery-trigger"
                  aria-label={`查看 ${photo.title} 规格与说明`}
                >
                  <span className={mediaClass}>
                    <Image src={photo.image} alt={photo.imageAlt} fill sizes={imageSizes} />
                  </span>
                </Link>
              ) : (
                <div className={mediaClass}>
                  <Image src={photo.image} alt={photo.imageAlt} fill sizes={imageSizes} />
                </div>
              )}

              <figcaption className="pt-gallery-meta">
                <div className="pt-gallery-meta-top">
                  <span className="pt-gallery-index">
                    <span className="pt-num">{photo.index}</span>
                    <span className="pt-gallery-tag">{photo.tag}</span>
                  </span>
                  {photo.articleCount && photo.articleCount > 0 ? (
                    <span className="pt-gallery-article-count">{photo.articleCount} 篇技术说明</span>
                  ) : null}
                </div>

                <h3>
                  {photo.detailHref ? (
                    <Link href={photo.detailHref} className="pt-gallery-title-link">
                      {photo.title}
                    </Link>
                  ) : (
                    photo.title
                  )}
                </h3>

                <p>{photo.caption}</p>

                {photo.detailHref ? (
                  <div className="pt-gallery-foot">
                    <Link href={photo.detailHref} className="pt-link">
                      查看规格与技术说明
                    </Link>
                  </div>
                ) : null}
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ol>
  );
}
