const SITE = "Mattex Marketplace";

export function seoCopy(lang = "en") {
  const zh = lang === "zh";
  return {
    site: SITE,
    homeTitle: SITE,
    homeDesc: zh
      ? "工程產品即時報價。先看規格，再走清晰的問價流程。"
      : "Engineering products, ready to quote. Specs first, then a clear quote path for construction buyers.",
    catalogTitle: zh ? `全部產品 | ${SITE}` : `All products | ${SITE}`,
    catalogDesc: zh
      ? "瀏覽 Mattex Marketplace 全部工程產品，按規格、SKU 或分類搜尋。"
      : "Browse the full Mattex Marketplace catalog. Search by spec, SKU, size, or category.",
    greenTitle: zh ? `綠色產品 | ${SITE}` : `Green products | ${SITE}`,
    greenDesc: zh
      ? "較低碳影響的建材選擇：FSC 木材、高 R 值隔熱、再生骨料與低 VOC 板材。"
      : "Lower-impact picks for greener builds — FSC timber, high-R insulation, recycled aggregate, and low-VOC boards.",
    salesTitle: zh ? `即售產品 | ${SITE}` : `Ready-to-sale products | ${SITE}`,
    salesDesc: zh
      ? "Mattex 即售 SKU，可現貨購買或詢價。"
      : "Mattex SKUs from the ready-to-sale list — buy from stock or request a quote.",
    categoryTitle: (name) => `${name || "Catalog"} | ${SITE}`,
    categoryDesc: (name) => {
      const label = name || "this category";
      return zh
        ? `${label}。Mattex Marketplace 工程產品分類，先看規格再問價。`
        : `${label} from Mattex Marketplace. Browse specs and request a quote.`;
    },
    supplierTitle: (name) => `${name || "Mattex"} | ${SITE}`,
    supplierDesc: (name) =>
      zh
        ? `${name || "Mattex"} 供應商頁：熱門產品與可搜尋目錄。`
        : `${name || "Mattex"} supplier page — hit products and a searchable catalog.`,
    productTitle: (name) => `${name} | ${SITE}`,
    productDesc: (product) => {
      const name = product?.name || "Product";
      const detail = String(product?.description || "").trim();
      if (zh) {
        return detail ? `${name}。Mattex Marketplace 工程產品。${detail}` : `${name}。Mattex Marketplace 工程產品。`;
      }
      return detail ? `${name} from Mattex Marketplace. ${detail}` : `${name} from Mattex Marketplace.`;
    },
  };
}
