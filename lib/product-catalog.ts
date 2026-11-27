import fs from "node:fs";
import path from "node:path";
import type { ProductSlug } from "@/app/products/product-data";
import { isProductSlug } from "@/app/products/product-data";
import type { ProductPhotoItem } from "@/app/products/product-gallery";

export interface ProductSpecRow {
  group: string;
  label: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface ProductGalleryMedia {
  src: string;
  alt: string;
}

export interface ProductVariantDetail {
  categorySlug: ProductSlug;
  variantSlug: string;
  index: string;
  craftTag: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  summary: string;
  heroImage: string;
  heroImageAlt: string;
  galleryImages: ProductGalleryMedia[];
  standardSpecs: ProductSpecRow[];
  confirmChecklist: string[];
  isPublished: boolean;
  updatedAt: string;
}

export interface ProductArticle {
  categorySlug: ProductSlug;
  variantSlug: string;
  articleSlug: string;
  title: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  coverImage?: string;
  coverImageAlt?: string;
  bodyMarkdown: string;
  publishedAt: string;
  updatedAt: string;
  status: "draft" | "published";
}

export interface ManagedCatalogDocument {
  schemaVersion: string;
  updatedAt: string;
  variants: ProductVariantDetail[];
  articles: ProductArticle[];
}

const ARTICLE_SLUG_RE = /^article_[a-z0-9][a-z0-9_-]*$/;
const VARIANT_SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

const DEFAULT_CATALOG_PATH = path.join(process.cwd(), "content", "managed-catalog.json");

function sanitizeSpecRows(raw: unknown): ProductSpecRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: ProductSpecRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = String(obj.label ?? "").trim();
    if (!label) continue;
    rows.push({
      group: String(obj.group ?? "规格项目").trim() || "规格项目",
      label,
      value: String(obj.value ?? "").trim(),
      unit: String(obj.unit ?? "").trim() || undefined,
      note: String(obj.note ?? "").trim() || undefined,
    });
  }
  return rows;
}

function sanitizeVariant(raw: unknown, fallbackIndex: number): ProductVariantDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const categorySlug = String(obj.categorySlug ?? "").trim();
  const variantSlug = String(obj.variantSlug ?? "").trim().toLowerCase();
  if (!isProductSlug(categorySlug) || !VARIANT_SLUG_RE.test(variantSlug)) {
    return null;
  }
  const title = String(obj.title ?? "").trim();
  if (!title) return null;

  const heroImage = String(obj.heroImage ?? "").trim() || "/images/site/product-tanks.webp";
  const heroImageAlt = String(obj.heroImageAlt ?? "").trim() || title;

  const galleryRaw = Array.isArray(obj.galleryImages) ? obj.galleryImages : [];
  const galleryImages: ProductGalleryMedia[] = [];
  for (const media of galleryRaw) {
    if (!media || typeof media !== "object") continue;
    const m = media as Record<string, unknown>;
    const src = String(m.src ?? "").trim();
    if (!src) continue;
    galleryImages.push({
      src,
      alt: String(m.alt ?? "").trim() || heroImageAlt,
    });
  }
  if (galleryImages.length === 0) {
    galleryImages.push({ src: heroImage, alt: heroImageAlt });
  }

  const checklistRaw = Array.isArray(obj.confirmChecklist) ? obj.confirmChecklist : [];
  const confirmChecklist = checklistRaw
    .map((x) => String(x ?? "").trim())
    .filter((x) => x.length > 0);

  return {
    categorySlug,
    variantSlug,
    index: String(obj.index ?? String(fallbackIndex).padStart(2, "0")).trim(),
    craftTag: String(obj.craftTag ?? "定制工艺").trim() || "定制工艺",
    title,
    seoTitle: String(obj.seoTitle ?? title).trim() || title,
    seoDescription: String(obj.seoDescription ?? obj.summary ?? title).trim(),
    summary: String(obj.summary ?? "").trim(),
    heroImage,
    heroImageAlt,
    galleryImages,
    standardSpecs: sanitizeSpecRows(obj.standardSpecs),
    confirmChecklist,
    isPublished: obj.isPublished !== false,
    updatedAt: String(obj.updatedAt ?? "2026-11-27").trim() || "2026-11-27",
  };
}

function sanitizeArticle(raw: unknown): ProductArticle | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const categorySlug = String(obj.categorySlug ?? "").trim();
  const variantSlug = String(obj.variantSlug ?? "").trim().toLowerCase();
  const articleSlug = String(obj.articleSlug ?? "").trim().toLowerCase();
  if (!isProductSlug(categorySlug) || !VARIANT_SLUG_RE.test(variantSlug) || !ARTICLE_SLUG_RE.test(articleSlug)) {
    return null;
  }
  const title = String(obj.title ?? "").trim();
  if (!title) return null;
  const status = obj.status === "draft" ? "draft" : "published";

  return {
    categorySlug,
    variantSlug,
    articleSlug,
    title,
    summary: String(obj.summary ?? "").trim(),
    seoTitle: String(obj.seoTitle ?? title).trim() || title,
    seoDescription: String(obj.seoDescription ?? obj.summary ?? title).trim(),
    coverImage: String(obj.coverImage ?? "").trim() || undefined,
    coverImageAlt: String(obj.coverImageAlt ?? "").trim() || undefined,
    bodyMarkdown: String(obj.bodyMarkdown ?? "").trim(),
    publishedAt: String(obj.publishedAt ?? "2026-11-27").trim() || "2026-11-27",
    updatedAt: String(obj.updatedAt ?? obj.publishedAt ?? "2026-11-27").trim() || "2026-11-27",
    status,
  };
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function loadManagedCatalog(): ManagedCatalogDocument {
  // 1. 基准读取仓库内 content/managed-catalog.json（本地开发模式点击 Dev Sync 即热更新）
  const baseDoc = readJsonFile(DEFAULT_CATALOG_PATH);

  // 2. 若通过 ZHAOHUI_SNAPSHOT_PATH 注入生产/预览快照，且其中包含 variants/articles，则优先生效
  const snapshotPath = (process.env.ZHAOHUI_SNAPSHOT_PATH || "").trim();
  const snapshotDoc = snapshotPath ? readJsonFile(snapshotPath) : null;

  const sourceVariantsRaw =
    snapshotDoc && Array.isArray(snapshotDoc.variants) && snapshotDoc.variants.length > 0
      ? snapshotDoc.variants
      : Array.isArray(baseDoc?.variants)
        ? baseDoc.variants
        : [];

  const sourceArticlesRaw =
    snapshotDoc && Array.isArray(snapshotDoc.articles)
      ? snapshotDoc.articles
      : Array.isArray(baseDoc?.articles)
        ? baseDoc.articles
        : [];

  const variants: ProductVariantDetail[] = [];
  const seenVariantKeys = new Set<string>();
  sourceVariantsRaw.forEach((item, idx) => {
    const parsed = sanitizeVariant(item, idx + 1);
    if (!parsed) return;
    const key = `${parsed.categorySlug}/${parsed.variantSlug}`;
    if (seenVariantKeys.has(key)) return;
    seenVariantKeys.add(key);
    variants.push(parsed);
  });

  const articles: ProductArticle[] = [];
  const seenArticleKeys = new Set<string>();
  sourceArticlesRaw.forEach((item) => {
    const parsed = sanitizeArticle(item);
    if (!parsed) return;
    const variantKey = `${parsed.categorySlug}/${parsed.variantSlug}`;
    if (!seenVariantKeys.has(variantKey)) return;
    const artKey = `${variantKey}/${parsed.articleSlug}`;
    if (seenArticleKeys.has(artKey)) return;
    seenArticleKeys.add(artKey);
    articles.push(parsed);
  });

  return {
    schemaVersion: String(snapshotDoc?.schemaVersion ?? baseDoc?.schemaVersion ?? "1.1"),
    updatedAt: String(snapshotDoc?.updatedAt ?? baseDoc?.updatedAt ?? "2026-11-27"),
    variants,
    articles,
  };
}

export function getPublishedVariants(categorySlug?: ProductSlug): ProductVariantDetail[] {
  const catalog = loadManagedCatalog();
  return catalog.variants.filter((v) => v.isPublished && (!categorySlug || v.categorySlug === categorySlug));
}

export function findPublishedVariant(categorySlug: string, variantSlug: string): ProductVariantDetail | null {
  if (!isProductSlug(categorySlug)) return null;
  const target = variantSlug.trim().toLowerCase();
  return (
    getPublishedVariants(categorySlug).find((v) => v.variantSlug === target) ?? null
  );
}

export function getPublishedArticlesForVariant(categorySlug: ProductSlug, variantSlug: string): ProductArticle[] {
  const catalog = loadManagedCatalog();
  const target = variantSlug.trim().toLowerCase();
  return catalog.articles
    .filter(
      (a) =>
        a.status === "published" &&
        a.categorySlug === categorySlug &&
        a.variantSlug === target,
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.articleSlug.localeCompare(b.articleSlug));
}

export function getAllPublishedArticles(): ProductArticle[] {
  const catalog = loadManagedCatalog();
  const publishedVariantKeys = new Set(
    catalog.variants.filter((v) => v.isPublished).map((v) => `${v.categorySlug}/${v.variantSlug}`),
  );
  return catalog.articles
    .filter(
      (a) =>
        a.status === "published" &&
        publishedVariantKeys.has(`${a.categorySlug}/${a.variantSlug}`),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.articleSlug.localeCompare(b.articleSlug));
}

export function findPublishedArticle(
  categorySlug: string,
  variantSlug: string,
  articleSlug: string,
): ProductArticle | null {
  if (!isProductSlug(categorySlug)) return null;
  const vTarget = variantSlug.trim().toLowerCase();
  const aTarget = articleSlug.trim().toLowerCase();
  return (
    getAllPublishedArticles().find(
      (a) => a.categorySlug === categorySlug && a.variantSlug === vTarget && a.articleSlug === aTarget,
    ) ?? null
  );
}

export function getVariantHref(categorySlug: ProductSlug, variantSlug: string): string {
  return `/products/${categorySlug}/${variantSlug}/`;
}

export function getArticleHref(categorySlug: ProductSlug, variantSlug: string, articleSlug: string): string {
  return `/products/${categorySlug}/${variantSlug}/${articleSlug}/`;
}

export function getVariantBriefHref(categorySlug: ProductSlug, variantSlug: string): string {
  return `/?product=${categorySlug}&variant=${variantSlug}#brief`;
}

export function getCategoryGalleryPhotos(categorySlug: ProductSlug): ProductPhotoItem[] {
  const variants = getPublishedVariants(categorySlug);
  return variants.map((v, idx) => {
    const articles = getPublishedArticlesForVariant(categorySlug, v.variantSlug);
    return {
      id: `${categorySlug}-${v.variantSlug}`,
      index: String(idx + 1).padStart(2, "0"),
      tag: v.craftTag,
      title: v.title,
      caption: v.summary,
      image: v.heroImage,
      imageAlt: v.heroImageAlt,
      detailHref: getVariantHref(categorySlug, v.variantSlug),
      articleCount: articles.length,
    };
  });
}

export function getVariantTitleLookup(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of getPublishedVariants()) {
    map[`${v.categorySlug}/${v.variantSlug}`] = v.title;
  }
  return map;
}
