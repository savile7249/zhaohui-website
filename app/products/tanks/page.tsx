import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { findProduct, getProductBriefHref } from "@/app/products/product-data";
import { getCanonicalBase } from "@/lib/managed-content";
import { getCategoryGalleryPhotos } from "@/lib/product-catalog";
import { ProductPhotoGallery } from "../product-gallery";
import { SiteFooter } from "../../site-footer";
import { TankAssemblyExplorer } from "./tank-assembly";
import { tankCraftNotes, tankGalleryPhotos } from "./tank-data";
import { TankPageClient } from "./tank-page-client";
import "../../site.css";
import "../product-page.css";

const tankProduct = findProduct("tanks");
const canonicalBase = getCanonicalBase();

export const metadata: Metadata = {
  title: tankProduct?.title ?? "储罐",
  description: tankProduct?.summary ?? "钢衬四氟、PO、PE、PFA、PVDF 防腐储罐结构装配示意与工况沟通条件。",
  alternates: {
    canonical: `${canonicalBase}/products/tanks/`,
  },
  openGraph: {
    title: `${tankProduct?.title ?? "储罐"} | 兆辉化工设备`,
    description: tankProduct?.summary ?? "钢衬四氟、PO、PE、PFA、PVDF 防腐储罐结构装配示意与工况沟通条件。",
    url: `${canonicalBase}/products/tanks/`,
    images: [{ url: tankProduct?.image ?? "/images/site/product-tanks.webp", alt: tankProduct?.imageAlt ?? "钢衬防腐储罐实拍" }],
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

export default function TanksPage() {
  const product = findProduct("tanks");
  if (!product) return null;
  const catalogPhotos = getCategoryGalleryPhotos("tanks");
  const galleryPhotos = catalogPhotos.length > 0 ? catalogPhotos : tankGalleryPhotos;

  return (
    <TankPageClient>
      {/* 储罐产品首屏 */}
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

      {/* 01 储罐结构随滚组装（深色墨底 #0a0f13） */}
      <section id="structure" className="pt-section is-dark pt-tower-section" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="01">储罐结构</SectionLabel>
            <h2 className="pt-h2">
              外有钢壳承压，
              <br />
              内有衬里连续隔离。
            </h2>
          </div>
        </div>

        <div className="pt-wrap">
          <TankAssemblyExplorer />
        </div>
      </section>

      {/* 02 储罐产品实拍（浅色纸底，保持明暗交替） */}
      <section id="gallery" className="pt-section is-paper" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="02">产品实拍</SectionLabel>
            <h2 className="pt-h2">
              多类衬里储罐，
              <br />
              外观与内腔实拍呈现。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            涵盖钢衬四氟、PO、PE、PFA 与 PVDF 储罐成品及内腔翻边实拍，具体容积、结构形式与接口布置按项目工况定制。
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
              先核清介质与容积，
              <br />
              再确定结构与衬里工艺。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            耐温、压力、壁厚与支撑形式均以项目技术审核为准，页面不提供自动选材或报价。
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
              {tankCraftNotes.map((note) => (
                <div key={note.label}>
                  <dt>{note.label}</dt>
                  <dd>{note.value}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-tower-cta-row">
              <Link href={getProductBriefHref("tanks")} className="pt-button">
                准备储罐询价简报
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
    </TankPageClient>
  );
}
