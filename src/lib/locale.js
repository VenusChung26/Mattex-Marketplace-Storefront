export const LOCALES = ["en", "zh"];
export const DEFAULT_LOCALE = "en";

export function localeFromPath(pathname) {
  const match = String(pathname || "").match(/^\/(en|zh)(?=\/|$)/);
  return match ? match[1] : null;
}

export function stripLocale(pathname) {
  const rest = String(pathname || "/").replace(/^\/(en|zh)(?=\/|$)/, "");
  return rest || "/";
}

export function withLocale(lang, to = "/") {
  const locale = lang === "zh" ? "zh" : "en";
  if (to && typeof to === "object") {
    const pathname = to.pathname == null ? "/" : String(to.pathname);
    const bare = stripLocale(pathname);
    return {
      ...to,
      pathname: `/${locale}${bare === "/" ? "/" : bare}`,
    };
  }
  const raw = String(to || "/");
  if (!raw || raw.startsWith("http") || raw.startsWith("mailto:")) return raw;
  if (raw.startsWith("#")) return raw;
  const parsed = new URL(raw, "https://mattex.invalid");
  const bare = stripLocale(parsed.pathname || "/");
  const nextPath = `/${locale}${bare === "/" ? "/" : bare}`;
  if (parsed.search || parsed.hash) {
    return { pathname: nextPath, search: parsed.search, hash: parsed.hash };
  }
  return nextPath;
}

export function allProductsTo(lang) {
  return { pathname: withLocale(lang, "/"), hash: "products" };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PUBLIC_SITE_FALLBACK = "https://subbie-storefront-omzprku33-venus926.vercel.app";

function envSiteUrl() {
  const viteUrl =
    typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SITE_URL;
  if (viteUrl) return String(viteUrl).replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env?.VITE_SITE_URL) {
    return String(process.env.VITE_SITE_URL).replace(/\/$/, "");
  }
  return "";
}

export function siteOrigin() {
  const viteUrl = envSiteUrl();
  if (viteUrl) return viteUrl;
  if (typeof process !== "undefined" && process.env?.VERCEL_URL) {
    const host = String(process.env.VERCEL_URL).replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost:5176";
}

export function publicOrigin() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    if (!LOCAL_HOSTS.has(window.location.hostname)) return window.location.origin;
  }
  return envSiteUrl() || PUBLIC_SITE_FALLBACK;
}

export function absUrl(origin, path) {
  const base = String(origin || "").replace(/\/$/, "");
  const next = String(path || "/");
  return `${base}${next.startsWith("/") ? next : `/${next}`}`;
}

export function absAsset(origin, src) {
  const value = String(src || "").trim();
  if (!value) return absUrl(origin, "/og-default.webp");
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return absUrl(origin, value.startsWith("/") ? value : `/${value}`);
}

export const LEGACY_REDIRECTS = [
  "/green",
  "/sales",
  "/catalog",
  "/login",
  "/signup",
  "/rfq",
  "/rfqs",
  "/whatsapp",
  "/whatsapp-chat",
];
