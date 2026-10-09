import { foldHan } from "./han";

export function productSku(product) {
  return String(product?.productNo || product?.provisionalSku || product?.id || "").trim();
}

export function searchSuggestOptions(catalog, query, { excludeIds = [], wordLimit = 8, categoryLimit = 6, productLimit = 8 } = {}) {
  const q = foldHan(String(query || "").trim()).toLowerCase();
  if (!q) return { words: [], categories: [], products: [] };
  const skip = new Set(excludeIds);
  const available = (catalog || []).filter((product) => product && !skip.has(product.id));
  const words = new Map();
  const categories = new Map();
  for (const product of available) {
    const category = String(product.category || "").trim();
    const categoryFold = foldHan(category).toLowerCase();
    if (category && categoryFold.includes(q)) {
      categories.set(category, (categories.get(category) || 0) + 1);
    }
    const seen = new Set();
    const bits = `${product.name || ""} ${category}`.split(/[^\p{L}\p{N}]+/u).filter((bit) => bit.length >= 2);
    for (const bit of bits) {
      const lower = foldHan(bit).toLowerCase();
      if (seen.has(lower) || !lower.startsWith(q) || lower === q) continue;
      seen.add(lower);
      const current = words.get(lower) || { label: bit, count: 0 };
      current.count += 1;
      words.set(lower, current);
    }
  }
  const products = available
    .filter((product) => foldHan(`${product.name || ""} ${productSku(product)} ${product.category || ""}`).toLowerCase().includes(q))
    .sort((a, b) => {
      const rank = (product) => (foldHan(product.name || "").toLowerCase().startsWith(q) ? 0 : 1);
      return rank(a) - rank(b) || String(a.name || "").localeCompare(String(b.name || ""));
    })
    .slice(0, productLimit);
  return {
    words: [...words.values()]
      .sort((a, b) => Number(/\d/.test(a.label)) - Number(/\d/.test(b.label)) || b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, wordLimit)
      .map((word) => word.label),
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, categoryLimit),
    products,
  };
}

export function flattenSuggestOptions(options) {
  const items = [];
  for (const word of options?.words || []) items.push({ type: "word", id: `word:${word}`, label: word });
  for (const [name, count] of options?.categories || []) items.push({ type: "category", id: `cat:${name}`, label: name, count });
  for (const product of options?.products || []) {
    items.push({ type: "product", id: `product:${product.id}`, label: product.name, product });
  }
  return items;
}
