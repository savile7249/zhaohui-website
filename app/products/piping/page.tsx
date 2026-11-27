import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { findProduct, getProductBriefHref } from "@/app/products/product-data";
import { getCanonicalBase } from "@/lib/managed-content";
import { getCategoryGalleryPhotos } from "@/lib/product-catalog";
import { ProductPhotoGallery } from "../product-gallery";
import { SiteFooter } from "../../site-footer";
import { PipingAssemblyExplorer } from "./piping-assembly";
import { pipingCraftNotes, pipingGalleryPhotos } from "./piping-data";
import { PipingPageClient } from "./piping-page-client";
import "../../site.css";
import "../product-page.css";

const pipingProduct = findProduct("piping");
const canonicalBase = getCanonicalBase();

export const metadata: Metadata = {
  title: pipingProduct?.title ?? "管道与管件",
  description: pipingProduct?.summary ?? "钢衬四氟管道、钢衬 PO 管道及衬氟管件结构装配示意与工况沟通条件。",
  alternates: {
    canonical: `${canonicalBase}/products/piping/`,
  },
  openGraph: {
    title: `${pipingProduct?.title ?? "管道与管件"} | 兆辉化工设备`,
    description: pipingProduct?.summary ?? "钢衬四氟管道、钢衬 PO 管道及衬氟管件结构装配示意与工况沟通条件。",
    url: `${canonicalBase}/products/piping/`,
    images: [{ url: pipingProduct?.image ?? "/images/site/product-piping.webp", alt: pipingProduct?.imageAlt ?? "钢衬防腐管道与管件实拍" }],
  },
};

function SectionLabel({ index, children }: { index: string; children: string }) {
  return (
    <p className="pt-label">
      <span>{index}</span>
      {children}
    </p>
  );
}

export default function PipingPage() {
  const product = findProduct("piping");
  if (!product) return null;
  const catalogPhotos = getCategoryGalleryPhotos("piping");
  const galleryPhotos = catalogPhotos.length > 0 ? catalogPhotos : pipingGalleryPhotos;

  return (
    <PipingPageClient>
      {/* 管道与管件产品首屏 */}
      <section className="pt-tower-hero">
        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          priority
          sizes="100vw"
          style={{ objectPosition: product.objectPosition }}
          className="pt-tower-hero-image"
        />
        <div className="pt-tower-hero-scrim" aria-hidden="true" />
        <div className="pt-wrap pt-tower-hero-inner">
          <h1 className="pt-tower-hero-title" data-hero-item>
            {product.title}
          </h1>
        </div>
      </section>

      {/* 01 管道与管件随滚组装（深色墨底 #0a0f13） */}
      <section id="structure" className="pt-section is-dark pt-tower-section" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="01">管路结构</SectionLabel>
            <h2 className="pt-h2">
              直管、弯头与三通，
              <br />
              整条流道连续翻边隔离。
            </h2>
          </div>
        </div>

        <div className="pt-wrap">
          <PipingAssemblyExplorer />
        </div>
      </section>

      {/* 02 管道与管件实拍（浅色纸底，保持明暗交替） */}
      <section id="gallery" className="pt-section is-paper" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="02">产品实拍</SectionLabel>
            <h2 className="pt-h2">
              直管段与衬里管件，
              <br />
              翻边密封面实拍呈现。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            以下为钢衬四氟与钢衬 PO 管道及三通等管件成品实拍，公称直径、单段管长与法兰标准均按装置轴测图定长预制。
          </p>
        </div>

        <div className="pt-wrap">
          <ProductPhotoGallery productTitle={product.title} photos={galleryPhotos} />
        </div>
      </section>

      {/* 03 工况与选型沟通条件（深色墨底，保持明暗交替） */}
      <section id="inputs" className="pt-section is-dark" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="03">沟通条件</SectionLabel>
            <h2 className="pt-h2">
              先核清口径与流向，
              <br />
              再定长预制直管与非标管件。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            公称直径、法兰标准、耐温、压力与衬里壁厚均以项目技术审核为准，页面不提供自动选材或报价。
          </p>
        </div>

        <div className="pt-wrap pt-tower-specs-grid">
          <div className="pt-tower-inputs-col" data-rise>
            <h3 className="pt-tower-subhead">前期需要确认的 8 项条件</h3>
            <ol className="pt-tower-input-list">
              {product.inputs.map((item, index) => (
                <li key={item}>
                  <span className="pt-num">{String(index + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="pt-tower-notes-col" data-rise>
            <h3 className="pt-tower-subhead">工艺与审核说明</h3>
            <dl className="pt-tower-notes-list">
              {pipingCraftNotes.map((note) => (
                <div key={note.label}>
                  <dt>{note.label}</dt>
                  <dd>{note.value}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-tower-cta-row">
              <Link href={getProductBriefHref("piping")} className="pt-button">
                准备管道询价简报
              </Link>
              <Link href="/#equipment" className="pt-link is-inverse">
                返回全部设备
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 结尾与页脚 */}
      <section className="pt-closing pt-tower-closing">
        <div className="pt-wrap">
          <p className="pt-closing-line pt-tower-closing-line">让设备，经得住现场。</p>
        </div>
      </section>

      <SiteFooter showQr />
    </PipingPageClient>
  );
}
