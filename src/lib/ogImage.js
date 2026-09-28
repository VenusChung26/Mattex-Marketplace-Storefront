export const OG_DEFAULT = "/og-default.webp";
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const OG_STEMS = new Set([
  "prod-grating",
  "prod-gypsum-block",
  "prod-gypsum-board",
  "prod-ironwork",
  "prod-mesh",
  "prod-precast",
  "prod-safetynet",
  "prod-tile",
  "prod-vinyl",
  "prod-xps",
  "vfd",
]);

export function categoryOgPath(slug) {
  const id = String(slug || "").trim();
  return id ? `/og/cat-${id}.webp` : OG_DEFAULT;
}

export function ogImagePath(src) {
  const value = String(src || "").trim();
  if (value.startsWith("/og/") && /\.webp$/i.test(value)) return value;
  if (!value || value.includes("og-default") || value.includes("mattex-logo") || value.includes("mattex-favicon")) {
    return OG_DEFAULT;
  }
  const file = value.split("/").pop() || "";
  const stem = file.replace(/\.[^.]+$/, "");
  if (!OG_STEMS.has(stem)) return OG_DEFAULT;
  return `/og/${stem}.webp`;
}
