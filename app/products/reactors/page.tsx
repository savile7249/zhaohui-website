import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { findProduct } from "@/app/products/product-data";
import { ProductPhotoGallery } from "../product-gallery";
import { SiteFooter } from "../../site-footer";
import { ReactorAssemblyExplorer } from "./reactor-assembly";
import { reactorCraftNotes, reactorGalleryPhotos } from "./reactor-data";
import { ReactorPageClient } from "./reactor-page-client";
import "../../site.css";
import "../product-page.css";

export const metadata: Metadata = {
  title: "反应釜",
  description: "钢衬四氟、PO、PE、PFA 反应釜及搅拌罐结构装配示意与工况沟通条件。",
  alternates: {
    canonical: "/products/reactors/",
  },
  openGraph: {
    title: "反应釜 | 兆辉化工设备",
    description: "钢衬四氟、PO、PE、PFA 反应釜及搅拌罐结构装配示意与工况沟通条件。",
    url: "https://jszhff.cn/products/reactors/",
    images: [{ url: "/images/site/product-reactors.webp", alt: "钢衬防腐反应釜实拍" }],
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

export default function ReactorsPage() {
  const product = findProduct("reactors");
  if (!product) return null;

  return (
    <ReactorPageClient>
      {/* 反应釜产品首屏 */}
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

      {/* 01 反应釜结构随滚组装（深色墨底 #0a0f13） */}
      <section id="structure" className="pt-section is-dark pt-tower-section" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="01">反应釜结构</SectionLabel>
            <h2 className="pt-h2">
              混合、传热与防腐，
              <br />
              在同一腔体协同工作。
            </h2>
          </div>
        </div>

        <div className="pt-wrap">
          <ReactorAssemblyExplorer />
        </div>
      </section>

      {/* 02 反应釜产品实拍（浅色纸底，保持明暗交替） */}
      <section id="gallery" className="pt-section is-paper" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="02">产品实拍</SectionLabel>
            <h2 className="pt-h2">
              不同衬里与结构形式，
              <br />
              成品实拍呈现。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            以下为钢衬四氟、PO 与 PFA 反应釜成品实拍，搅拌传动、传热夹套与釜盖接口均按工艺条件配套定制。
          </p>
        </div>

        <div className="pt-wrap">
          <ProductPhotoGallery productTitle={product.title} photos={reactorGalleryPhotos} />
        </div>
      </section>

      {/* 03 工况与选型沟通条件（深色墨底，保持明暗交替） */}
      <section id="inputs" className="pt-section is-dark" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="03">沟通条件</SectionLabel>
            <h2 className="pt-h2">
              先核清反应工况，
              <br />
              再确定搅拌、传热与衬里方案。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            转速、耐温、压力、传热面积与衬里工艺均以项目技术审核为准，页面不提供自动选材或报价。
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
              {reactorCraftNotes.map((note) => (
                <div key={note.label}>
                  <dt>{note.label}</dt>
                  <dd>{note.value}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-tower-cta-row">
              <Link href="/#brief" className="pt-button">
                准备反应釜询价简报
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
    </ReactorPageClient>
  );
}
