function finiteNumber(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function stripTicks(value) {
  return String(value || "").replace(/^`+|`+$/g, "").trim();
}

/** Official product card price: ProductDto.unit_price only. Our catalog `price` is a different field. */
export function sellingAmount(product) {
  return finiteNumber(product?.unit_price);
}

function requestPriceLabel(lang) {
  if (lang === "zh" || lang === "en") return lang === "zh" ? "價格待定" : "Price Upon Request";
  try {
    return localStorage.getItem("subbie_lang") === "zh" ? "價格待定" : "Price Upon Request";
  } catch {
    return "Price Upon Request";
  }
}

/** Zip fmtMoney, and their product.priceUponRequest copy when there is no positive unit_price. */
export function formatUnitPrice(amount, lang) {
  const n = finiteNumber(amount);
  if (n == null || n <= 0) return requestPriceLabel(lang);
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Official min_order_qty. Our catalog stores it as moq. */
export function orderMinimum(product) {
  const official = finiteNumber(product?.min_order_qty);
  if (official != null) return official;
  return finiteNumber(product?.moq);
}

/** Official is_tailor_made. Our catalog stores it as tailorMade. */
export function isTailorMade(product) {
  if (product?.is_tailor_made != null) return Boolean(product.is_tailor_made);
  return Boolean(product?.tailorMade);
}

/** Official files[0] signed URL, then our image. Backticks around a signed URL are stripped, matching their productImage. */
export function productImageUrl(product) {
  const file = Array.isArray(product?.files) ? product.files[0] : null;
  if (file) {
    const thumb = stripTicks(file.thumbnail_file_path);
    const signed = stripTicks(file.sign_url);
    if (thumb) return thumb;
    if (signed) return signed;
    if (file.file_path) return String(file.file_path);
  }
  return String(product?.image || product?.imageUrl || "");
}

/** Official sku display: keep an existing MKT- prefix, otherwise add one. Our productNo is that sku. */
export function displaySku(product) {
  const raw = String(product?.sku || product?.productNo || product?.provisionalSku || "").trim();
  if (!raw) return "";
  return /^MKT-/i.test(raw) ? raw.toUpperCase() : `MKT-${raw.toUpperCase()}`;
}
