import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findProduct } from "@/app/products/product-data";
import { SiteFooter } from "@/app/site-footer";
import { getCanonicalBase } from "@/lib/managed-content";
import { renderControlledMarkdown } from "@/lib/markdown";
import {
  findPublishedArticle,
  findPublishedVariant,
  getAllPublishedArticles,
  getArticleHref,
  getPublishedArticlesForVariant,
  getVariantBriefHref,
  getVariantHref,
} from "@/lib/product-catalog";
import { isFullBleedProductImage } from "@/lib/product-media";
import { ProductSubpageShell } from "../../../product-subpage-shell";
import "../../../../site.css";
import "../../../product-page.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPublishedArticles().map((article) => ({
    category: article.categorySlug,
    variant: article.variantSlug,
    article: article.articleSlug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; variant: string; article: string }>;
}): Promise<Metadata> {
  const { category, variant: variantSlug, article: articleSlug } = await params;
  const article = findPublishedArticle(category, variantSlug, articleSlug);
  const variant = findPublishedVariant(category, variantSlug);
  if (!article || !variant) {
    return { title: "未找到技术文章" };
  }

  const canonicalBase = getCanonicalBase();
  const pageUrl = `${canonicalBase}${getArticleHref(
    article.categorySlug,
    article.variantSlug,
    article.articleSlug,
  )}`;
  const description = article.seoDescription || article.summary;
  const coverImage = article.coverImage || variant.heroImage;
  const coverAlt = article.coverImageAlt || variant.heroImageAlt;

  return {
    title: article.seoTitle || article.title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "article",
      locale: "zh_CN",
      title: `${article.title} | 兆辉化工设备`,
      description,
      url: pageUrl,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: [{ url: coverImage, alt: coverAlt }],
    },
  };
}

function toSafeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function ProductArticlePage({
  params,
}: {
  params: Promise<{ category: string; variant: string; article: string }>;
}) {
  const { category, variant: variantSlug, article: articleSlug } = await params;
  const article = findPublishedArticle(category, variantSlug, articleSlug);
  const variant = findPublishedVariant(category, variantSlug);
  const family = findProduct(category);
  if (!article || !variant || !family) {
    notFound();
  }

  const canonicalBase = getCanonicalBase();
  const categoryHref = `/products/${family.slug}/`;
  const variantHref = getVariantHref(variant.categorySlug, variant.variantSlug);
  const articleHref = getArticleHref(article.categorySlug, article.variantSlug, article.articleSlug);
  const briefHref = getVariantBriefHref(variant.categorySlug, variant.variantSlug);

  const rendered = renderControlledMarkdown(article.bodyMarkdown);
  const siblingArticles = getPublishedArticlesForVariant(variant.categorySlug, variant.variantSlug).filter(
    (item) => item.articleSlug !== article.articleSlug,
  );
  const otherCategoryArticles =
    siblingArticles.length === 0
      ? getAllPublishedArticles()
          .filter((item) => item.articleSlug !== article.articleSlug)
          .slice(0, 3)
      : [];

  const checklistPreview = (variant.confirmChecklist.length > 0 ? variant.confirmChecklist : [...family.inputs]).slice(
    0,
    5,
  );
  const coverImage = article.coverImage || variant.heroImage;
  const coverAlt = article.coverImageAlt || variant.heroImageAlt;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: `${canonicalBase}/` },
          { "@type": "ListItem", position: 2, name: family.title, item: `${canonicalBase}${categoryHref}` },
          { "@type": "ListItem", position: 3, name: variant.title, item: `${canonicalBase}${variantHref}` },
          { "@type": "ListItem", position: 4, name: article.title, item: `${canonicalBase}${articleHref}` },
        ],
      },
      {
        "@type": "TechArticle",
        headline: article.title,
        description: article.seoDescription || article.summary,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        inLanguage: "zh-CN",
        url: `${canonicalBase}${articleHref}`,
        image: coverImage.startsWith("http") ? coverImage : `${canonicalBase}${coverImage}`,
        about: {
          "@type": "Product",
          name: variant.title,
          url: `${canonicalBase}${variantHref}`,
        },
        publisher: {
          "@type": "Organization",
          name: "江苏兆辉防腐科技有限公司",
          url: `${canonicalBase}/`,
          logo: {
            "@type": "ImageObject",
            url: `${canonicalBase}/images/brand/zhaohui-logo-on-light.png`,
          },
        },
      },
    ],
  };

  return (
    <ProductSubpageShell categorySlug={variant.categorySlug} briefHref={briefHref}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toSafeJsonLd(jsonLd) }} />

      {/* 文章页头（深色 --deep / --ink） */}
      <section className="pt-article-hero">
        <div className="pt-wrap">
          <nav className="pt-breadcrumb" aria-label="面包屑导航">
            <ol>
              <li>
                <Link href="/">首页</Link>
              </li>
              <li>
                <Link href={categoryHref}>{family.title}</Link>
              </li>
              <li>
                <Link href={variantHref}>{variant.title}</Link>
              </li>
              <li aria-current="page">技术说明</li>
            </ol>
          </nav>

          <div className="pt-article-hero-body">
            <p className="pt-variant-kicker">
              <span className="pt-num">技术文章</span>
              <span>{variant.title}</span>
              <span className="pt-variant-kicker-sep" aria-hidden="true">/</span>
              <span>{variant.craftTag}</span>
            </p>
            <h1 className="pt-article-title">{article.title}</h1>
            <p className="pt-article-lead">{article.summary}</p>
            <dl className="pt-article-meta">
              <div>
                <dt>发布日期</dt>
                <dd>
                  <time dateTime={article.publishedAt}>{article.publishedAt}</time>
                </dd>
              </div>
              <div>
                <dt>更新日期</dt>
                <dd>
                  <time dateTime={article.updatedAt}>{article.updatedAt}</time>
                </dd>
              </div>
              <div>
                <dt>所属机型</dt>
                <dd>
                  <Link href={variantHref}>{variant.title}</Link>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* 正文与右侧关联设备侧栏（浅色纸底 --paper） */}
      <section className="pt-section is-paper pt-article-body-section" data-section>
        <div className="pt-wrap pt-article-grid">
          <article className="pt-article-main">
            {coverImage ? (
              <figure className="pt-article-cover">
                <div
                  className={`pt-article-cover-stage${isFullBleedProductImage(coverImage) ? " is-full-bleed" : ""}`}
                >
                  <Image
                    src={coverImage}
                    alt={coverAlt}
                    fill
                    priority
                    sizes="(min-width: 1100px) 62vw, 100vw"
                  />
                </div>
                {coverAlt ? <figcaption>{coverAlt}</figcaption> : null}
              </figure>
            ) : null}

            <div className="pt-prose" dangerouslySetInnerHTML={{ __html: rendered.html }} />
          </article>

          <aside className="pt-article-aside" aria-label="所属设备信息">
            <div className="pt-article-device-box">
              <p className="pt-label">
                <span>所属设备</span>
                {family.title}
              </p>
              <Link
                href={variantHref}
                className={`pt-article-device-media${isFullBleedProductImage(variant.heroImage) ? " is-full-bleed" : ""}`}
              >
                <Image
                  src={variant.heroImage}
                  alt={variant.heroImageAlt}
                  fill
                  sizes="(min-width: 1100px) 24vw, 100vw"
                />
              </Link>
              <h2 className="pt-article-device-title">
                <Link href={variantHref}>{variant.title}</Link>
              </h2>
              <p className="pt-article-device-tag">{variant.craftTag}</p>

              <div className="pt-article-device-checklist">
                <h3>前期沟通要点</h3>
                <ul>
                  {checklistPreview.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-article-device-actions">
                <Link href={briefHref} className="pt-button">
                  准备该设备询价简报
                </Link>
                <Link href={variantHref} className="pt-link">
                  查看规格种类与参数页
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* 文末延伸阅读与返回闭环（深色 --ink） */}
      <section className="pt-section is-dark pt-article-related" data-section>
        <div className="pt-wrap">
          <div className="pt-section-head">
            <div>
              <p className="pt-label">
                <span>延伸阅读</span>
                相关技术与选型说明
              </p>
              <h2 className="pt-h2">
                {siblingArticles.length > 0 ? `更多关于${variant.title}的说明` : "继续查阅设备规格与技术文章"}
              </h2>
            </div>
            <div className="pt-section-aside">
              <p>返回{variant.title}参数页核对全部规格项目，或直接准备项目工况简报联系技术团队。</p>
              <Link href={variantHref} className="pt-link is-inverse">
                返回{variant.title}
              </Link>
            </div>
          </div>

          {siblingArticles.length > 0 || otherCategoryArticles.length > 0 ? (
            <ol className="pt-article-list">
              {(siblingArticles.length > 0 ? siblingArticles : otherCategoryArticles).map((item, idx) => {
                const href = getArticleHref(item.categorySlug, item.variantSlug, item.articleSlug);
                return (
                  <li key={`${item.categorySlug}/${item.variantSlug}/${item.articleSlug}`} className="pt-article-row">
                    <span className="pt-num">{String(idx + 1).padStart(2, "0")}</span>
                    <div className="pt-article-row-main">
                      <h3>
                        <Link href={href}>{item.title}</Link>
                      </h3>
                      <p>{item.summary}</p>
                    </div>
                    <div className="pt-article-row-meta">
                      <time dateTime={item.publishedAt}>{item.publishedAt}</time>
                      <Link href={href} className="pt-link is-inverse">
                        阅读全文
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}
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
