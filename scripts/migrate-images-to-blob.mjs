// Move every catalog / RFQ photo from Supabase Storage, /assets and inline data URLs to Vercel Blob (WebP),
// then rewrite the URLs in Supabase. Dry run by default; pass --apply to upload and write.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const envText = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
function env(key) {
  if (process.env[key]) return process.env[key];
  const match = envText.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

const SUPABASE_URL = env("VITE_SUPABASE_URL");
const SUPABASE_KEY = env("SUPABASE_SERVICE_ROLE_KEY") || env("VITE_SUPABASE_ANON_KEY");
const BLOB_TOKEN = env("BLOB_READ_WRITE_TOKEN");
if (!SUPABASE_URL || !SUPABASE_KEY || !BLOB_TOKEN) {
  console.error("Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) and BLOB_READ_WRITE_TOKEN.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const STORAGE_PREFIX = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/product-images/`;
const STORAGE_RE = new RegExp(`${STORAGE_PREFIX.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[^\\s"')]+`, "g");
const ASSET_RE = /^\/assets\/[^/]+\.(?:png|jpe?g|webp)$/i;
const BROKEN_ORIGIN_RE = /https:\/\/marketplace\.mattex\.com\.hk(?=https?:\/\/)/g;
const KV_KEYS = [
  "subbie_rfqs_by_user",
  "subbie_product_patches",
  "subbie_custom_categories",
  "subbie_admin_categories",
  "subbie_guest_quote_snapshots",
];

async function selectAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 499);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

function walkStrings(value, fn) {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((item) => walkStrings(item, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walkStrings(v, fn)]));
  }
  return value;
}

function collect(value, found) {
  walkStrings(value, (text) => {
    for (const url of text.replace(BROKEN_ORIGIN_RE, "").match(STORAGE_RE) || []) found.add(url);
    if (ASSET_RE.test(text) || text.startsWith("data:image/")) found.add(text);
    return text;
  });
}

function blobPath(source) {
  if (source.startsWith("data:image/")) {
    const hash = createHash("sha1").update(source).digest("hex").slice(0, 16);
    return `rfq/inline/${hash}.webp`;
  }
  const rel = source.startsWith("/assets/")
    ? `catalog/${source.slice("/assets/".length)}`
    : decodeURIComponent(source.slice(STORAGE_PREFIX.length).split("?")[0]);
  return rel.replace(/\.(png|jpe?g)$/i, ".webp");
}

async function loadBytes(source) {
  if (source.startsWith("data:image/")) {
    const [meta, data] = source.split(",");
    return { bytes: Buffer.from(data || "", "base64"), type: /data:([^;]+)/.exec(meta)?.[1] || "" };
  }
  if (source.startsWith("/assets/")) {
    return { bytes: readFileSync(`public${source}`), type: source.endsWith(".webp") ? "image/webp" : "" };
  }
  const res = await fetch(source);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "" };
}

async function toWebp(bytes, type) {
  if (type.includes("webp")) return bytes;
  const { default: sharp } = await import("sharp").catch(() => {
    throw new Error(`needs sharp to convert ${type || "unknown"} to WebP (pnpm add -D sharp)`);
  });
  return sharp(bytes).webp({ quality: 80, effort: 4 }).toBuffer();
}

const [products, productImages, rfqs, kvRows] = await Promise.all([
  selectAll("products", "id,payload,image_url"),
  selectAll("product_images", "id,url,storage_path"),
  selectAll("rfqs", "id,payload"),
  sb.from("app_kv").select("key,value").in("key", KV_KEYS).then(({ data, error }) => {
    if (error) throw new Error(`app_kv: ${error.message}`);
    return data || [];
  }),
]);

const sources = new Set();
products.forEach((row) => collect([row.payload, row.image_url], sources));
productImages.forEach((row) => collect(row.url, sources));
rfqs.forEach((row) => collect(row.payload, sources));
kvRows.forEach((row) => collect(row.value, sources));

const byPath = new Map();
for (const source of [...sources].sort((a, b) => Number(b.startsWith("http")) - Number(a.startsWith("http")))) {
  const path = blobPath(source);
  if (!byPath.has(path)) byPath.set(path, []);
  byPath.get(path).push(source);
}
console.log(`${sources.size} source URLs -> ${byPath.size} blob files (${APPLY ? "APPLY" : "dry run"})`);

const mapping = new Map();
let failed = 0;
for (const [path, list] of byPath) {
  if (!APPLY) {
    list.forEach((source) => mapping.set(source, `<blob>/${path}`));
    continue;
  }
  try {
    const { bytes, type } = await loadBytes(list[0]);
    const body = await toWebp(bytes, type);
    const blob = await put(path, body, {
      access: "public",
      token: BLOB_TOKEN,
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
    });
    list.forEach((source) => mapping.set(source, blob.url));
    console.log("uploaded", path, `${Math.round(body.length / 1024)} KB`);
  } catch (error) {
    failed += 1;
    console.warn("skip", path, error?.message || error);
  }
}

function rewrite(text) {
  const fixed = text.replace(BROKEN_ORIGIN_RE, "");
  if (mapping.has(fixed)) return mapping.get(fixed);
  return fixed.replace(STORAGE_RE, (url) => mapping.get(url) || url);
}

const now = new Date().toISOString();
const updates = [];
for (const row of products) {
  const payload = walkStrings(row.payload, rewrite);
  const imageUrl = rewrite(row.image_url || "");
  if (JSON.stringify(payload) !== JSON.stringify(row.payload) || imageUrl !== (row.image_url || "")) {
    updates.push(["products", row.id, { payload, image_url: imageUrl, updated_at: now }]);
  }
}
for (const row of productImages) {
  const url = rewrite(row.url || "");
  if (url !== row.url) updates.push(["product_images", row.id, { url, storage_path: null, source: "blob" }]);
}
for (const row of rfqs) {
  const payload = walkStrings(row.payload, rewrite);
  if (JSON.stringify(payload) !== JSON.stringify(row.payload)) updates.push(["rfqs", row.id, { payload, updated_at: now }]);
}
for (const row of kvRows) {
  const value = walkStrings(row.value, rewrite);
  if (JSON.stringify(value) !== JSON.stringify(row.value)) updates.push(["app_kv", row.key, { value, updated_at: now }]);
}

const counts = updates.reduce((acc, [table]) => ({ ...acc, [table]: (acc[table] || 0) + 1 }), {});
console.log("rows to update", counts);
if (!APPLY) {
  [...mapping].slice(0, 8).forEach(([from, to]) => console.log(" ", from.slice(0, 90), "->", to));
  console.log("Dry run only. Re-run with --apply to upload and write.");
  process.exit(0);
}
if (failed) {
  console.error(`${failed} uploads failed; nothing written to Supabase. Fix and re-run.`);
  process.exit(1);
}

for (let i = 0; i < updates.length; i += 10) {
  await Promise.all(
    updates.slice(i, i + 10).map(async ([table, id, patch]) => {
      const { error } = await sb.from(table).update(patch).eq(table === "app_kv" ? "key" : "id", id);
      if (error) throw new Error(`${table} ${id}: ${error.message}`);
    })
  );
}
console.log("done", counts);
