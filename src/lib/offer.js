const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let promoCache = null;

export function setOfferPromo(promo) {
  promoCache = promo && typeof promo === "object" ? promo : null;
}

export function offerStillOn(endsOn, now = new Date()) {
  if (!DATE_RE.test(String(endsOn || ""))) return false;
  const end = new Date(`${endsOn}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() >= now.getTime();
}

export function bannerProductOffers(banner) {
  return (Array.isArray(banner?.products) ? banner.products : [])
    .map((row) => ({
      productId: String(row?.productId || "").trim(),
      price: Number(row?.price),
      endsOn: String(row?.endsOn || "").trim(),
    }))
    .filter((row) => row.productId && Number.isFinite(row.price) && row.price > 0 && DATE_RE.test(row.endsOn));
}

export function activeBannerOffers(banner, now = new Date()) {
  return bannerProductOffers(banner).filter((row) => offerStillOn(row.endsOn, now));
}

export function findProductOffer(productId, promo = promoCache, now = new Date()) {
  const id = String(productId || "");
  if (!id || !promo) return null;
  const banners = Array.isArray(promo.banners) ? promo.banners : [];
  for (const banner of banners) {
    const row = activeBannerOffers(banner, now).find((item) => item.productId === id);
    if (!row) continue;
    return {
      ...row,
      bannerId: String(banner.id || ""),
      bannerNameEn: banner.nameEn || "",
      bannerNameZh: banner.nameZh || "",
    };
  }
  return null;
}

export function activeOfferPrice(productId) {
  const offer = findProductOffer(productId);
  return offer ? offer.price : null;
}
