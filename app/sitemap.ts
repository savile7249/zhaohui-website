import type { MetadataRoute } from "next";
import { productFamilies } from "@/app/products/product-data";
import { getCanonicalBase } from "@/lib/managed-content";
import {
  getAllPublishedArticles,
  getArticleHref,
  getPublishedVariants,
  getVariantHref,
  loadManagedCatalog,
} from "@/lib/product-catalog";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const canonicalBase = getCanonicalBase();
  const catalog = loadManagedCatalog();
  const defaultLastMod = catalog.updatedAt || "2026-11-27";

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${canonicalBase}/`,
      lastModified: defaultLastMod,
      changeFrequency: "monthly",
      priority: 1.0,
    },
  ];

  for (const family of productFamilies) {
    entries.push({
      url: `${canonicalBase}/products/${family.slug}/`,
      lastModified: defaultLastMod,
      changeFrequency: "monthly",
      priority: 0.9,
    });
  }

  for (const variant of getPublishedVariants()) {
    entries.push({
      url: `${canonicalBase}${getVariantHref(variant.categorySlug, variant.variantSlug)}`,
      lastModified: variant.updatedAt || defaultLastMod,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const article of getAllPublishedArticles()) {
    entries.push({
      url: `${canonicalBase}${getArticleHref(
        article.categorySlug,
        article.variantSlug,
        article.articleSlug,
      )}`,
      lastModified: article.updatedAt || article.publishedAt || defaultLastMod,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}
