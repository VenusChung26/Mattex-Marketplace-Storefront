import { useEffect } from "react";
import { absAsset, absUrl, siteOrigin, stripLocale, withLocale } from "../lib/locale";
import { OG_HEIGHT, OG_WIDTH, isSizedOgImage, ogImagePath } from "../lib/ogImage";

export { breadcrumbJsonLd, orgJsonLd, productJsonLd } from "../lib/seoJsonLd";

function upsertMeta(selector, attrs) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null) el.removeAttribute(key);
    else el.setAttribute(key, String(value));
  });
}

function upsertLink(rel, href, extra = {}) {
  if (typeof document === "undefined") return;
  const hreflang = extra.hreflang;
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  Object.entries(extra).forEach(([key, value]) => {
    if (value == null) el.removeAttribute(key);
    else el.setAttribute(key, String(value));
  });
}

function upsertJsonLd(data) {
  if (typeof document === "undefined") return;
  const payload = Array.isArray(data) ? data.filter(Boolean) : data ? [data] : [];
  let el = document.getElementById("seo-jsonld");
  if (!payload.length) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = "seo-jsonld";
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload.length === 1 ? payload[0] : payload);
}

export default function Seo({
  title,
  description,
  path,
  image = "/og-default.webp",
  noindex = false,
  jsonLd,
  ogType = "website",
  lang = "en",
}) {
  const jsonPayload = JSON.stringify(jsonLd ?? null);

  useEffect(() => {
    const origin = siteOrigin();
    const canonicalPath = path || withLocale(lang, "/");
    const url = absUrl(origin, canonicalPath);
    const enUrl = absUrl(origin, withLocale("en", stripLocale(canonicalPath)));
    const zhUrl = absUrl(origin, withLocale("zh", stripLocale(canonicalPath)));
    const img = absAsset(origin, ogImagePath(image));
    const robots = noindex ? "noindex, nofollow" : "index, follow";
    const secure = img.startsWith("https://") ? img : "";

    document.title = title;
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";

    upsertMeta('meta[name="description"]', { name: "description", content: description || "" });
    upsertMeta('meta[name="robots"]', { name: "robots", content: robots });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description || "" });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: ogType });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: img });
    upsertMeta('meta[property="og:image:url"]', { property: "og:image:url", content: img });
    if (secure) {
      upsertMeta('meta[property="og:image:secure_url"]', { property: "og:image:secure_url", content: secure });
    }
    upsertMeta('meta[property="og:image:type"]', { property: "og:image:type", content: "image/webp" });
    const sized = isSizedOgImage(ogImagePath(image));
    upsertMeta('meta[property="og:image:width"]', { property: "og:image:width", content: sized ? String(OG_WIDTH) : "" });
    upsertMeta('meta[property="og:image:height"]', { property: "og:image:height", content: sized ? String(OG_HEIGHT) : "" });
    upsertMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: title || "Mattex Marketplace" });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "Mattex Marketplace" });
    upsertMeta('meta[property="og:locale"]', {
      property: "og:locale",
      content: lang === "zh" ? "zh_HK" : "en_HK",
    });
    upsertMeta('meta[property="og:locale:alternate"]', {
      property: "og:locale:alternate",
      content: lang === "zh" ? "en_HK" : "zh_HK",
    });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description || "" });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: img });
    upsertLink("image_src", img);

    upsertLink("canonical", url);
    upsertLink("alternate", enUrl, { hreflang: "en" });
    upsertLink("alternate", zhUrl, { hreflang: "zh-Hant" });
    upsertLink("alternate", enUrl, { hreflang: "x-default" });
    upsertJsonLd(jsonLd);
  }, [title, description, path, image, noindex, jsonPayload, ogType, lang]);

  return null;
}

