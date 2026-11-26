import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { findProduct, getProductBriefHref } from "@/app/products/product-data";
import { ProductPhotoGallery } from "../product-gallery";
import { SiteFooter } from "../../site-footer";
import { TowerAssemblyExplorer } from "./tower-assembly";
import { towerCraftNotes, towerGalleryPhotos } from "./tower-data";
import { TowerPageClient } from "./tower-page-client";
import "../../site.css";
import "../product-page.css";

export const metadata: Metadata = {
  title: "塔器",
  description: "钢衬四氟塔器、钢衬PE塔、钢衬PFA塔及衬四氟塔节结构装配示意与工况沟通条件。",
  alternates: {
    canonical: "/products/towers/",
  },
  openGraph: {
    title: "塔器 | 兆辉化工设备",
    description: "钢衬四氟塔器、钢衬PE塔、钢衬PFA塔及衬四氟塔节结构装配示意与工况沟通条件。",
    url: "https://jszhff.cn/products/towers/",
    images: [{ url: "/images/site/product-towers.webp", alt: "钢衬防腐塔器实拍" }],
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

export default function TowersPage() {
  const product = findProduct("towers");
  if (!product) return null;

  return (
    <TowerPageClient>
      {/* 塔器产品首屏 */}
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

      {/* 01 塔器产品结构随滚组装（深色墨底） */}
      <section id="structure" className="pt-section is-dark pt-tower-section" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="01">塔器结构</SectionLabel>
            <h2 className="pt-h2">
              分段制造，层层贴合，
              <br />
              再连成一整座塔。
            </h2>
          </div>
        </div>

        <div className="pt-wrap">
          <TowerAssemblyExplorer />
        </div>
      </section>

      {/* 02 塔器产品实拍（浅色纸底，保持明暗交替） */}
      <section id="gallery" className="pt-section is-paper" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="02">产品实拍</SectionLabel>
            <h2 className="pt-h2">
              整塔外观与内部构造，
              <br />
              出厂前逐一实拍呈现。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            以下为衬氟塔器成品外观及塔内喷淋、栅板等实拍记录，实际塔径、分段方式与塔内件配置均按项目工艺条件定制。
          </p>
        </div>

        <div className="pt-wrap">
          <ProductPhotoGallery productTitle={product.title} photos={towerGalleryPhotos} />
        </div>
      </section>

      {/* 03 工况与选型沟通条件（深色墨底，保持明暗交替） */}
      <section id="inputs" className="pt-section is-dark" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="03">沟通条件</SectionLabel>
            <h2 className="pt-h2">
              先核清工况边界，
              <br />
              再确定塔节与衬里方案。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            耐温、压力、壁厚与填料布置均以项目技术审核为准，页面不提供自动选材或报价。
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
              {towerCraftNotes.map((note) => (
                <div key={note.label}>
                  <dt>{note.label}</dt>
                  <dd>{note.value}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-tower-cta-row">
              <Link href={getProductBriefHref("towers")} className="pt-button">
                准备塔器询价简报
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
    </TowerPageClient>
  );
}
