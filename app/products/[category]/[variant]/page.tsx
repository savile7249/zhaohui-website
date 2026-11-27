import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findProduct } from "@/app/products/product-data";
import { SiteFooter } from "@/app/site-footer";
import { getCanonicalBase } from "@/lib/managed-content";
import {
  findPublishedVariant,
  getArticleHref,
  getPublishedArticlesForVariant,
  getPublishedVariants,
  getVariantBriefHref,
  getVariantHref,
} from "@/lib/product-catalog";
import { isFullBleedProductImage } from "@/lib/product-media";
import { ProductSubpageShell } from "../../product-subpage-shell";
import { VariantMediaShowcase } from "../../variant-media-showcase";
import "../../../site.css";
import "../../product-page.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedVariants().map((variant) => ({
    category: variant.categorySlug,
    variant: variant.variantSlug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; variant: string }>;
}): Promise<Metadata> {
  const { category, variant: variantSlug } = await params;
  const variant = findPublishedVariant(category, variantSlug);
  const family = findProduct(category);
  if (!variant || !family) {
    return { title: "未找到设备型号" };
  }

  const canonicalBase = getCanonicalBase();
  const pageUrl = `${canonicalBase}${getVariantHref(variant.categorySlug, variant.variantSlug)}`;
  const description = variant.seoDescription || variant.summary || family.summary;

  return {
    title: variant.seoTitle || variant.title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      title: `${variant.title} | 兆辉化工设备`,
      description,
      url: pageUrl,
      images: [
        {
          url: variant.heroImage,
          alt: variant.heroImageAlt,
        },
      ],
    },
  };
}

function SectionLabel({ index, children }: { index: string; children: string }) {
  return (
    <p className="pt-label">
      <span>{index}</span>
      {children}
    </p>
  );
}

function toSafeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function ProductVariantDetailPage({
  params,
}: {
  params: Promise<{ category: string; variant: string }>;
}) {
  const { category, variant: variantSlug } = await params;
  const variant = findPublishedVariant(category, variantSlug);
  const family = findProduct(category);
  if (!variant || !family) {
    notFound();
  }

  const canonicalBase = getCanonicalBase();
  const categoryUrl = `${canonicalBase}/products/${family.slug}/`;
  const variantUrl = `${canonicalBase}${getVariantHref(variant.categorySlug, variant.variantSlug)}`;
  const briefHref = getVariantBriefHref(variant.categorySlug, variant.variantSlug);

  const articles = getPublishedArticlesForVariant(variant.categorySlug, variant.variantSlug);
  const siblings = getPublishedVariants(variant.categorySlug);

  // 仅向 JSON-LD 输出已填写具体值的规格项，绝不虚构价格或评分
  const filledAdditionalProperties = variant.standardSpecs
    .filter((row) => row.value.trim().length > 0)
    .map((row) => ({
      "@type": "PropertyValue",
      name: row.label,
      value: row.unit ? `${row.value} ${row.unit}` : row.value,
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: `${canonicalBase}/` },
          { "@type": "ListItem", position: 2, name: family.title, item: categoryUrl },
          { "@type": "ListItem", position: 3, name: variant.title, item: variantUrl },
        ],
      },
      {
        "@type": "Product",
        name: variant.title,
        category: family.title,
        description: variant.seoDescription || variant.summary,
        image: variant.galleryImages.map((img) =>
          img.src.startsWith("http") ? img.src : `${canonicalBase}${img.src}`,
        ),
        url: variantUrl,
        brand: {
          "@type": "Brand",
          name: "兆辉化工设备",
        },
        manufacturer: {
          "@type": "Organization",
          name: "江苏兆辉防腐科技有限公司",
          url: `${canonicalBase}/`,
        },
        ...(filledAdditionalProperties.length > 0
          ? { additionalProperty: filledAdditionalProperties }
          : {}),
      },
    ],
  };

  const hasArticles = articles.length > 0;

  return (
    <ProductSubpageShell categorySlug={variant.categorySlug} briefHref={briefHref}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toSafeJsonLd(jsonLd) }} />

      {/* 首屏信息区（深色 --deep） */}
      <section className="pt-variant-hero">
        <div className="pt-wrap">
          <nav className="pt-breadcrumb" aria-label="面包屑导航">
            <ol>
              <li>
                <Link href="/">首页</Link>
              </li>
              <li>
                <Link href={`/products/${family.slug}/`}>{family.title}</Link>
              </li>
              <li aria-current="page">{variant.title}</li>
            </ol>
          </nav>

          <div className="pt-variant-hero-grid">
            <div className="pt-variant-copy">
              <p className="pt-variant-kicker">
                <span className="pt-num">{variant.index}</span>
                <span>{family.title}</span>
                <span className="pt-variant-kicker-sep" aria-hidden="true">/</span>
                <span>{variant.craftTag}</span>
              </p>
              <h1 className="pt-variant-title">{variant.title}</h1>
              <p className="pt-variant-summary">{variant.summary}</p>
            </div>

            <div className="pt-variant-media-col">
              <VariantMediaShowcase title={variant.title} images={variant.galleryImages} />
            </div>
          </div>
        </div>
      </section>

      {/* 01 规格与结构参数 + 关联工艺文章（浅色纸底 --paper，同板块收紧呈现） */}
      <section id="specs" className="pt-section is-paper pt-variant-unified-section" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="01">规格与结构参数</SectionLabel>
            <h2 className="pt-h2">
              先按规格种类核对，
              <br />
              具体参数以技术审核为准。
            </h2>
          </div>
        </div>

        <div className={`pt-wrap pt-variant-unified-grid ${hasArticles ? "has-articles" : "is-single"}`}>
          <div className="pt-variant-spec-col" data-rise>
            {variant.standardSpecs.length > 0 ? (
              <div className="pt-spec-table-wrap">
                <table className="pt-spec-table">
                  <thead>
                    <tr>
                      <th scope="col">规格种类</th>
                      <th scope="col">规格参数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variant.standardSpecs.map((row, idx) => {
                      const hasValue = row.value.trim().length > 0;
                      return (
                        <tr key={`${row.group}-${row.label}-${idx}`}>
                          <th scope="row" className="pt-spec-label">
                            {row.label}
                            {row.unit ? <span className="pt-spec-unit">（{row.unit}）</span> : null}
                          </th>
                          <td className={hasValue ? "pt-spec-val-filled" : "pt-spec-val-pending"}>
                            {hasValue
                              ? row.unit && !row.value.includes(row.unit)
                                ? `${row.value} ${row.unit}`
                                : row.value
                              : "按项目工况核定"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            <p className="pt-risk-note is-special pt-variant-risk-note">
              <strong>专项审核边界</strong>
              涉及氢氟酸、高氯酸、氯磺酸、液溴、过氧化氢、混酸等高危或强氧化介质，以及存在负压抽吸、温度骤变的工况，统一交由技术负责人专项审核。未经审核的耐温、压力、壁厚与寿命参数不作对外承诺。
            </p>
          </div>

          {hasArticles ? (
            <aside id="articles" className="pt-variant-articles-col" aria-label="选型与工艺文章" data-rise>
              <div className="pt-variant-articles-head">
                <h3>选型与工艺文章</h3>
                <span>{articles.length} 篇说明</span>
              </div>
              <ol className="pt-variant-article-list">
                {articles.map((article, idx) => {
                  const href = getArticleHref(article.categorySlug, article.variantSlug, article.articleSlug);
                  return (
                    <li key={article.articleSlug} className="pt-variant-article-item">
                      <div className="pt-variant-article-meta">
                        <span className="pt-num">{String(idx + 1).padStart(2, "0")}</span>
                        <time dateTime={article.publishedAt}>{article.publishedAt}</time>
                      </div>
                      <h4>
                        <Link href={href}>{article.title}</Link>
                      </h4>
                      <p>{article.summary}</p>
                      <Link href={href} className="pt-link">
                        阅读全文
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </aside>
          ) : null}
        </div>
      </section>

      {/* 02 同系设备选型切换（深色墨底 --ink，保持深浅交替） */}
      <section id="siblings" className="pt-section is-dark" data-section>
        <div className="pt-wrap pt-section-head">
          <div data-rise>
            <SectionLabel index="02">同系设备</SectionLabel>
            <h2 className="pt-h2">浏览{family.title}其余细分机型。</h2>
          </div>
        </div>

        <div className="pt-wrap">
          <ul
            className={`pt-sibling-grid is-count-${siblings.length}`}
            aria-label={`${family.title}同系产品列表`}
          >
            {siblings.map((item) => {
              const isCurrent = item.variantSlug === variant.variantSlug;
              const itemHref = getVariantHref(item.categorySlug, item.variantSlug);
              const mediaClass = isFullBleedProductImage(item.heroImage)
                ? "pt-sibling-media is-full-bleed"
                : "pt-sibling-media";
              const cardContent = (
                <>
                  <span className={mediaClass}>
                    <Image
                      src={item.heroImage}
                      alt={item.heroImageAlt}
                      fill
                      sizes="(min-width: 900px) 22vw, 46vw"
                    />
                  </span>
                  <span className="pt-sibling-meta">
                    <span className="pt-num">{item.index}</span>
                    <span>{item.craftTag}</span>
                  </span>
                  <strong>{item.title}</strong>
                  <span className="pt-sibling-action">
                    {isCurrent ? "当前查看 · 返回顶部 ↑" : "查看规格 →"}
                  </span>
                </>
              );

              return (
                <li key={item.variantSlug} data-rise>
                  {isCurrent ? (
                    <a
                      href="#top"
                      className="pt-sibling-card is-current"
                      aria-current="page"
                      aria-label={`返回 ${item.title} 页面顶部`}
                    >
                      {cardContent}
                    </a>
                  ) : (
                    <Link href={itemHref} className="pt-sibling-card">
                      {cardContent}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 结尾与页脚 */}
      <section className="pt-closing pt-tower-closing">
        <div className="pt-wrap">
          <p className="pt-closing-line pt-tower-closing-line">让设备，经得住现场。</p>
        </div>
      </section>

      <SiteFooter showQr />
    </ProductSubpageShell>
  );
}
