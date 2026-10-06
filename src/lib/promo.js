import { useEffect, useState } from "react";
import { setOfferPromo } from "./offer";

export function promoBanners(promo) {
  return (Array.isArray(promo?.banners) ? promo.banners : []).filter((banner) => banner?.id && banner?.src);
}

export function isPromoLive(promo) {
  if (!promo || promo.visible === false) return false;
  return promoBanners(promo).length > 0;
}

export function bannerName(banner, lang) {
  if (!banner) return "";
  return lang === "zh" ? banner.nameZh || banner.nameEn || "" : banner.nameEn || banner.nameZh || "";
}

export function sentenceOf(promo, lang) {
  if (!promo) return "";
  return lang === "zh" ? promo.sentenceZh || promo.sentenceEn || "" : promo.sentenceEn || promo.sentenceZh || "";
}

export function bannerSentence(banner, promo, lang) {
  const own = lang === "zh" ? banner?.sentenceZh : banner?.sentenceEn;
  const other = lang === "zh" ? banner?.sentenceEn : banner?.sentenceZh;
  return String(own || other || sentenceOf(promo, lang) || "").trim();
}

export function bannerHeroSrc(banner) {
  const hero = String(banner?.heroSrc || "");
  if (/^\/assets\/promo\/[a-zA-Z0-9._/-]+$/.test(hero) && !hero.includes("..")) return hero;
  return String(banner?.src || "");
}

export function landingBanners(promo) {
  return promoBanners(promo).filter((banner) => Array.isArray(banner.products) && banner.products.length > 0);
}

let pending = null;

export function loadPromo() {
  if (!pending) {
    pending = fetch("/api/promo", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

export function usePromo() {
  const [promo, setPromo] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancel = false;
    loadPromo().then((data) => {
      if (cancel) return;
      setOfferPromo(data);
      setPromo(data);
      setReady(true);
    });
    return () => {
      cancel = true;
    };
  }, []);
  return { promo, ready, live: isPromoLive(promo) };
}
