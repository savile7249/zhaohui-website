import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { findProduct, productFamilies } from "../product-data";

export function generateStaticParams() {
  return productFamilies.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = findProduct((await params).slug);
  if (!product) return {};

  return {
    title: `${product.title} | 兆辉化工设备`,
    description: `${product.title}产品范围、工况资料要求与防腐方案沟通边界。`,
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = findProduct((await params).slug);
  if (!product) notFound();

  return (
    <main id="top" className="product-detail-page">
      <SiteHeader />

      <section className="product-detail-hero">
        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          priority
          sizes="100vw"
          style={{ objectPosition: product.objectPosition }}
          className="product-detail-hero-image"
        />
        <div className="product-detail-hero-scrim" aria-hidden="true" />
        <div className="site-grid relative z-[1] mx-auto h-full max-w-[1600px] items-end px-[5.75vw] pb-[clamp(4rem,7vw,7rem)] pt-28 text-white">
          <div className="col-start-1 col-end-8 max-w-[760px]">
            <Link href="/products" className="product-breadcrumb">产品设备 / {product.title}</Link>
            <p className="section-label mt-12 text-white/72"><span>{product.index}</span> / EQUIPMENT</p>
            <h1>{product.title}</h1>
            <p className="product-detail-english">{product.english}</p>
            <p className="product-detail-lead">{product.summary}</p>
          </div>
        </div>
      </section>

      <section className="product-detail-overview">
        <div className="site-grid mx-auto max-w-[1600px] gap-y-14 px-[5.75vw] py-[clamp(5rem,9vw,9rem)]">
          <Reveal className="col-start-1 col-end-6">
            <p className="section-label text-[#171b1e]/72"><span>01</span> / PRODUCT RANGE</p>
            <h2>设备范围</h2>
            <p className="detail-section-lead">型号名称用于说明可沟通的设备形式，最终结构以工况、现场边界和技术审核为准。</p>
          </Reveal>
          <div className="product-variant-list col-start-8 col-end-13">
            {product.variants.map((variant, index) => (
              <div key={variant}><span>{String(index + 1).padStart(2, "0")}</span><strong>{variant}</strong></div>
            ))}
          </div>
        </div>
      </section>

      <section className="product-detail-applications">
        <div className="site-grid mx-auto max-w-[1600px] gap-y-14 px-[5.75vw] py-[clamp(4.5rem,8vw,8rem)]">
          <div className="col-start-1 col-end-5">
            <p className="section-label text-[#171b1e]/72"><span>02</span> / APPLICATION DIRECTION</p>
            <h2>应用方向</h2>
          </div>
          <div className="application-direction-list col-start-6 col-end-13">
            {product.applications.map((application, index) => (
              <div key={application}><span>0{index + 1}</span><p>{application}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="product-input-section">
        <div className="site-grid mx-auto max-w-[1600px] gap-y-14 px-[5.75vw] py-[clamp(5rem,9vw,9rem)] text-white">
          <Reveal className="col-start-1 col-end-6">
            <p className="section-label text-white/72"><span>03</span> / REQUIRED INPUTS</p>
            <h2>前期沟通清单</h2>
            <p>资料越完整，结构与防腐方案的讨论越接近真实使用条件。</p>
          </Reveal>
          <ol className="product-input-list col-start-7 col-end-13">
            {product.inputs.map((input, index) => (
              <li key={input}><span>{String(index + 1).padStart(2, "0")}</span>{input}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="product-material-section">
        <div className="site-grid mx-auto max-w-[1600px] gap-y-14 px-[5.75vw] py-[clamp(5rem,9vw,9rem)]">
          <div className="col-start-1 col-end-5">
            <p className="section-label text-[#171b1e]/72"><span>04</span> / MATERIAL REVIEW</p>
            <h2>材料与防腐路径</h2>
          </div>
          <div className="material-review-grid col-start-6 col-end-13">
            <article>
              <p>壳体材料评估范围</p>
              <h3>碳钢 / 不锈钢</h3>
              <span>常见牌号包括 Q235B、Q345R、304、316L。</span>
            </article>
            <article>
              <p>防腐工艺评估范围</p>
              <h3>板衬 / 滚塑 / 喷涂</h3>
              <span>可沟通 PTFE、PFA、PVDF、PE、PO；喷涂材料需按实际工况确认。</span>
            </article>
            <p className="material-review-note">以上内容是可评估范围，不构成材料兼容性结论。介质、浓度、温度、压力及设备结构变化均可能影响最终方案。</p>
          </div>
        </div>
      </section>

      <section id="consultation" className="product-detail-consultation">
        <div className="site-grid mx-auto max-w-[1600px] gap-y-10 px-[5.75vw] py-[clamp(5rem,9vw,8rem)] text-white">
          <div className="col-start-1 col-end-9">
            <p className="section-label text-white/72"><span>05</span> / START A PROJECT</p>
            <h2>带着真实工况，<br />开始一次有效沟通。</h2>
          </div>
          <div className="col-start-10 col-end-13 self-end">
            <p>页面不提供自动选材、性能承诺或在线报价。请通过您的兆辉业务联系人提交工况资料。</p>
            <Link href="/products" className="text-link">返回产品总览</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
