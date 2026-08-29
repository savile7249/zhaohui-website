import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { productFamilies } from "./product-data";

export const metadata: Metadata = {
  title: "产品设备 | 兆辉化工设备",
  description: "储罐、反应釜、塔器及管道产品分类与工况资料要求。",
};

export default function ProductsPage() {
  return (
    <main id="top" className="products-page">
      <SiteHeader />

      <section className="products-hero">
        <Image
          src="/images/manufacturing-floor.png"
          alt="大型化工设备制造与装配现场"
          fill
          priority
          sizes="100vw"
          className="products-hero-image"
        />
        <div className="products-hero-scrim" aria-hidden="true" />
        <div className="site-grid relative z-[1] mx-auto h-full max-w-[1600px] items-end px-[5.75vw] pb-[clamp(4.5rem,8vw,8rem)] pt-24 text-white">
          <div className="col-start-1 col-end-8 max-w-[780px]">
            <p className="section-label text-white/72"><span>00</span> / PRODUCTS</p>
            <h1>从设备类型出发，<br />回到实际工况。</h1>
            <p className="products-hero-lead">储罐、反应釜、塔器与管道。结构、防腐路径及材料组合均需结合介质、浓度、温度和压力审核。</p>
          </div>
          <p className="products-hero-count col-start-11 col-end-13 justify-self-end">04</p>
        </div>
      </section>

      <section className="product-index-section" aria-labelledby="product-index-title">
        <div className="site-grid mx-auto max-w-[1600px] px-[5.75vw] py-[clamp(5rem,9vw,9rem)]">
          <div className="col-start-1 col-end-5">
            <p className="section-label text-[#171b1e]/72"><span>01</span> / EQUIPMENT</p>
            <h2 id="product-index-title">核心产品</h2>
          </div>
          <p className="product-index-intro col-start-8 col-end-13">以下分类用于快速定位设备方向，不替代材料适用性审核或工程设计。进入详情页可查看型号范围与前期沟通清单。</p>
        </div>

        <div className="product-family-list">
          {productFamilies.map((product, itemIndex) => (
            <article key={product.slug} className={`product-family-row ${itemIndex % 2 ? "is-reversed" : ""}`}>
              <div className="product-family-media">
                <Image
                  src={product.image}
                  alt={product.imageAlt}
                  fill
                  sizes="(max-width: 767px) 100vw, 58vw"
                  style={{ objectPosition: product.objectPosition }}
                  className="product-family-image"
                />
              </div>
              <Reveal className="product-family-copy">
                <p className="section-label"><span>{product.index}</span> / EQUIPMENT</p>
                <h3>{product.title}</h3>
                <p className="product-family-english">{product.english}</p>
                <span className="accent-line" aria-hidden="true" />
                <p>{product.summary}</p>
                <p className="product-family-variants">{product.variants.join(" / ")}</p>
                <Link href={`/products/${product.slug}`} className="text-link">查看产品详情</Link>
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      <section className="product-principle-section">
        <div className="site-grid mx-auto max-w-[1600px] gap-y-12 px-[5.75vw] py-[clamp(5rem,9vw,9rem)] text-white">
          <Reveal className="col-start-1 col-end-7">
            <p className="section-label text-white/72"><span>02</span> / ENGINEERING BASIS</p>
            <h2>先确认工况，再讨论设备。</h2>
          </Reveal>
          <ol className="product-principle-list col-start-8 col-end-13">
            <li><span>01</span><div><strong>提交条件</strong><p>介质、浓度、温度、压力、处理量及现场尺寸。</p></div></li>
            <li><span>02</span><div><strong>技术沟通</strong><p>确认结构形式、接口、内部件与制造边界。</p></div></li>
            <li><span>03</span><div><strong>方案审核</strong><p>结合实际条件评估壳体材料与防腐工艺。</p></div></li>
          </ol>
        </div>
      </section>

      <section id="consultation" className="product-consultation-section">
        <div className="site-grid mx-auto max-w-[1600px] gap-y-10 px-[5.75vw] py-[clamp(5rem,9vw,8rem)]">
          <div className="col-start-1 col-end-9">
            <p className="section-label text-[#171b1e]/72"><span>03</span> / PROJECT BRIEF</p>
            <h2>准备好工况资料，<br />让沟通从关键条件开始。</h2>
          </div>
          <div className="col-start-10 col-end-13 self-end">
            <p>当前页面不提供自动选材或在线报价。请将工况资料提交给您的兆辉业务联系人。</p>
            <a href="#contact" className="text-link">查看沟通清单</a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
