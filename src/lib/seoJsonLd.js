import { absAsset, absUrl, withLocale } from "./locale.js";
import { ogImagePath } from "./ogImage.js";

export function orgJsonLd(origin) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Mattex Marketplace",
    url: origin,
    logo: absAsset(origin, "/assets/mattex-logo.webp"),
    parentOrganization: {
      "@type": "Organization",
      name: "Mattex Asia Development Limited",
      url: "https://uat-chain.mattex.com.hk/overview",
    },
  };
}

export function breadcrumbJsonLd(origin, crumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absUrl(origin, crumb.path),
    })),
  };
}

export function productJsonLd(origin, product, lang) {
  const url = absUrl(origin, withLocale(lang, `/details/${product.id}`));
  const priced = product.price != null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.productNo || product.id,
    description: product.description || product.name,
    image: absAsset(origin, ogImagePath(product.image)),
    brand: { "@type": "Brand", name: "Mattex" },
    inLanguage: lang === "zh" ? "zh-Hant" : "en",
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "HKD",
      ...(priced ? { price: String(product.price) } : {}),
      availability:
        product.stockStatus === "out_of_stock"
          ? "https://schema.org/OutOfStock"
          : priced
            ? "https://schema.org/InStock"
            : "https://schema.org/PreOrder",
    },
  };
}
