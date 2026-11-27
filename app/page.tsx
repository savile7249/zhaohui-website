import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { productFamilies } from "@/app/products/product-data";
import { contactInfo } from "@/components/contact-data";
import { getCanonicalBase, managedSnapshot } from "@/lib/managed-content";
import { getVariantTitleLookup } from "@/lib/product-catalog";
import { BriefWorkbench } from "./brief-workbench";
import { CredentialsExplorer } from "./credentials-explorer";
import { HomeClient } from "./home-client";
import { PartnerOrbitWall } from "./partner-orbit-wall";
import { SiteFooter } from "./site-footer";
import {
  companyMilestones,
  heroContent,
  industryApplications,
  manufacturingGallery,
  manufacturingSteps,
} from "./home-data";
import "./site.css";

const canonicalBase = getCanonicalBase();

export const metadata: Metadata = {
  title: "兆辉化工设备 | 钢衬防腐储罐、反应釜、塔器与管道",
  description: "江苏兆辉防腐科技有限公司专注钢衬四氟、PO、PE、PFA、PVDF 等防腐储罐、反应釜、塔器与管道制造，配套板衬、滚塑与喷涂工艺。",
  alternates: {
    canonical: `${canonicalBase}/`,
  },
  openGraph: {
    title: "兆辉化工设备 | 钢衬防腐储罐、反应釜、塔器与管道",
    description: "专注钢衬四氟、PO、PE、PFA、PVDF 等防腐储罐、反应釜、塔器与管道制造，按介质与工况分层选材。",
    url: `${canonicalBase}/`,
    siteName: "兆辉化工设备",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "/images/site/hero-cleanroom.webp",
        width: 1920,
        height: 1080,
        alt: "洁净车间内的钢衬防腐储罐与反应设备实拍",
      },
    ],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "江苏兆辉防腐科技有限公司",
  alternateName: "兆辉化工设备",
  url: "https://jszhff.cn/",
  logo: "https://jszhff.cn/images/brand/zhaohui-logo-on-light.png",
  email: contactInfo.email.display,
  telephone: contactInfo.phones[0].display,
  address: contactInfo.addresses.map((item) => ({
    "@type": "PostalAddress",
    addressCountry: "CN",
    addressRegion: item.region,
    streetAddress: item.address.replace(/\u00A0/g, " "),
  })),
};

function SectionLabel({ index, children }: { index: string; children: string }) {
  return (
    <p className="pt-label">
      <span>{index}</span>
      {children}
    </p>
  );
}

export default function HomePage() {
  const variantNames = getVariantTitleLookup();
  return (
    <HomeClient>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {/* 首屏 */}
      <section className="pt-hero">
        <Image
          src="/images/site/hero-cleanroom.webp"
          alt="洁净车间内的钢衬防腐储罐与反应设备实拍"
          fill
          priority
          sizes="100vw"
          className="pt-hero-image"
          data-hero-image
        />
        <div className="pt-hero-scrim" aria-hidden="true" />
        <div className="pt-wrap pt-hero-inner">
          <div className="pt-hero-copy">
            <h1 data-hero-item>
              {heroContent.headingLines[0]}
              <br />
              {heroContent.headingLines[1]}
            </h1>
            <p className="pt-hero-sub" data-hero-item>
              {heroContent.leadLines[0]}
              <br />
              {heroContent.leadLines[1]}
            </p>
          </div>

          <div className="pt-hero-dock" data-hero-item>
            <ul className="pt-hero-metrics" aria-label="交付规模与服务周期">
              {heroContent.metrics.map((metric) => (
                <li key={metric.label}>
                  <span className="pt-hero-metric-head">
                    <strong className="pt-hero-metric-value">{metric.value}</strong>
                    <span className="pt-hero-metric-unit">{metric.unit}</span>
                  </span>
                  <span className="pt-hero-metric-label">{metric.label}</span>
                </li>
              ))}
            </ul>
            <p className="pt-hero-slogan">{heroContent.slogan}</p>
          </div>
        </div>
      </section>

      {/* 01 关于 */}
      <section id="about" className="pt-section is-paper pt-about-section" data-section>
        <Image
          src="/images/site/about-facade.webp"
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="pt-about-bg"
        />
        <div className="pt-about-scrim" aria-hidden="true" />
        <div className="pt-wrap">
          <PartnerOrbitWall />

          <ol className="pt-milestones" aria-label="兆辉发展历程与产能布局">
            {companyMilestones.map((item) => (
              <li key={item.title} data-rise>
                <div className="pt-milestone-meta">
                  <strong className={`pt-milestone-value${item.unit ? "" : " is-text"}`}>{item.value}</strong>
                  {item.unit ? <span className="pt-milestone-unit">{item.unit}</span> : null}
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 02 设备 */}
      <section id="equipment" className="pt-section is-dark pt-equipment" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="02">设备</SectionLabel>
            <h2 className="pt-h2">储存、反应、分离与输送。</h2>
          </div>
        </div>

        <div className="pt-products">
          {productFamilies.map((product, index) => (
            <article key={product.slug} className={`pt-product ${index % 2 === 1 ? "is-reversed" : ""}`}>
              <div className="pt-product-media">
                <Image
                  src={product.image}
                  alt={product.imageAlt}
                  fill
                  sizes="(min-width: 900px) 58vw, 100vw"
                />
              </div>
              <div className="pt-product-body" data-rise>
                <span className="pt-num">{product.index}</span>
                <h3>{product.title}</h3>
                <p className="pt-product-summary">
                  {managedSnapshot ? product.summary : `${product.applications.join("、")}。`}
                </p>
                <Link
                  href={`/products/${product.slug}`}
                  className="pt-button"
                  aria-label={`了解${product.title}详情`}
                >
                  了解详情
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 03 应用与资质 */}
      <section id="credentials" className="pt-section is-paper" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="03">应用与资质</SectionLabel>
            <h2 className="pt-h2">
              服务多行业工艺现场，
              <br />
              资质与专利均可核验。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            面向化工、光伏储能、海水淡化、电力及食品加工等行业；生产许可、体系认证与有效专利证书均可按项目需要提供查验。
          </p>
        </div>

        <div className="pt-wrap">
          <div className="pt-industries" data-rise>
            <h3 className="pt-h3">应用行业</h3>
            <ol className="pt-industry-grid">
              {industryApplications.map((industry, index) => (
                <li key={industry.title} className={index < 2 ? "is-wide" : ""}>
                  <figure>
                    <div className="pt-industry-media">
                      <Image
                        src={industry.image}
                        alt={industry.imageAlt}
                        fill
                        sizes={index < 2 ? "(min-width: 900px) 46vw, 100vw" : "(min-width: 900px) 30vw, 100vw"}
                      />
                    </div>
                    <figcaption>
                      <span className="pt-num">{industry.index}</span>
                      <h4>{industry.title}</h4>
                      <p>{industry.summary}</p>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ol>
          </div>

          <CredentialsExplorer />
        </div>
      </section>

      {/* 04 制造 */}
      <section id="manufacturing" className="pt-section is-dark pt-manufacturing" data-section>
        <div className="pt-manufacturing-hero">
          <Image
            src="/images/site/manufacturing-roto.webp"
            alt="大型钢衬防腐设备滚塑成型制造现场实拍"
            fill
            sizes="100vw"
            className="pt-manufacturing-image"
          />
          <div className="pt-manufacturing-scrim" aria-hidden="true" />
          <div className="pt-wrap pt-manufacturing-copy" data-rise>
            <SectionLabel index="04">制造</SectionLabel>
            <h2 className="pt-h2">从制造现场，建立可靠。</h2>
            <p className="pt-lead">材料、壳体、衬里、接口与检验，按同一套流程贯穿每一台设备。</p>
          </div>
        </div>

        <div className="pt-wrap">
          <ul className="pt-site-gallery" aria-label="生产车间与基地实景">
            {manufacturingGallery.map((item) => (
              <li key={item.label} data-rise>
                <figure>
                  <div className="pt-site-media">
                    <Image
                      src={item.image}
                      alt={item.imageAlt}
                      fill
                      sizes="(min-width: 900px) 30vw, 100vw"
                    />
                  </div>
                  <figcaption>
                    <strong>{item.label}</strong>
                    <span>{item.caption}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-wrap pt-steps">
          <div className="pt-steps-head">
            <h3 className="pt-h3">从审核到出厂</h3>
            <p>五个环节依次进行。具体检验项目与判定标准，以项目技术协议为准。</p>
          </div>
          <ol className="pt-steps-list">
            {manufacturingSteps.map((step) => (
              <li key={step.step} data-rise>
                <span className="pt-num">{step.step}</span>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 05 询价准备 */}
      <section id="brief" className="pt-section is-paper" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="05">询价准备</SectionLabel>
            <h2 className="pt-h2">
              带着工况来，
              <br />
              沟通会更快。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            填写已知条件，生成一份标准简报。不确定的项目可以留空，技术人员会与您逐项确认。页面不提供自动选材或报价。
          </p>
        </div>
        <div className="pt-wrap">
          <BriefWorkbench variantNames={variantNames} />
        </div>
      </section>

      {/* 06 联系我们 */}
      <section id="contact" className="pt-section is-dark pt-contact" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="06">联系我们</SectionLabel>
            <h2 className="pt-h2">
              直接沟通工况，
              <br />
              欢迎致电或到厂考察。
            </h2>
          </div>
          <p className="pt-section-aside" data-rise>
            可通过电话、邮件或微信发送工况简报与图纸，技术与业务人员将按项目条件对接。
          </p>
        </div>

        <div className="pt-wrap pt-contact-grid">
          <dl className="pt-contact-list" data-rise>
            <div className="pt-contact-row">
              <dt>联系电话</dt>
              <dd className="pt-contact-phones">
                {contactInfo.phones.map((phone, index) => (
                  <span key={phone.href}>
                    {index > 0 && <span className="pt-contact-sep" aria-hidden="true">/</span>}
                    <a href={phone.href}>{phone.display}</a>
                  </span>
                ))}
              </dd>
            </div>
            <div className="pt-contact-row">
              <dt>联系邮箱</dt>
              <dd className="pt-contact-email">
                <a href={contactInfo.email.href}>{contactInfo.email.display}</a>
              </dd>
            </div>
            <div className="pt-contact-row">
              <dt>联系地址</dt>
              <dd className="pt-contact-addresses">
                {contactInfo.addresses.map((item) => (
                  <p key={item.address}>
                    <span className="pt-contact-region">{item.region}</span>
                    <span>{item.address}</span>
                  </p>
                ))}
              </dd>
            </div>
          </dl>

          <div className="pt-contact-social" data-rise>
            <h3 className="pt-contact-social-title">社交平台</h3>
            <ul className="pt-qr-grid" aria-label="官方社交平台二维码">
              {contactInfo.socialQrs.map((item) => (
                <li key={item.id}>
                  <figure className="pt-qr-item">
                    <div className="pt-qr-frame">
                      <Image src={item.image} alt={item.alt} width={200} height={200} />
                    </div>
                    <figcaption>
                      <strong>{item.name}</strong>
                      <span>{item.hint}</span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 结尾 */}
      <section className="pt-closing is-bordered">
        <div className="pt-wrap">
          <p className="pt-closing-line">让设备，经得住现场。</p>
        </div>
      </section>

      <SiteFooter isHome />
    </HomeClient>
  );
}
