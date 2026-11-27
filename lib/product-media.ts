export function isFullBleedProductImage(src: string | null | undefined): boolean {
  if (!src) return false;
  return src.startsWith("/images/site/product-");
}
