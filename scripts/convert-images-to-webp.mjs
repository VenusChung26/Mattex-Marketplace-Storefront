import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire("/tmp/mattex-webp-tools/package.json");
const sharp = require("sharp");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_FILE = new Set(["mattex-favicon.png"]);
const SKIP_DIR = new Set(["node_modules", "dist", ".git"]);

function loadEnvFile(filePath) {
  try {
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function rewriteText(text) {
  return text
    .replace(/\/assets\/(?!mattex-favicon\b)([A-Za-z0-9._-]+)\.(?:png|jpe?g)/gi, "/assets/$1.webp")
    .replace(/(^|[^/\w.-])assets\/(?!mattex-favicon\b)([A-Za-z0-9._-]+)\.(?:png|jpe?g)/gi, "$1assets/$2.webp")
    .replace(/\/og\/([A-Za-z0-9._-]+)\.jpe?g/gi, "/og/$1.webp")
    .replace(/og-default\.(?:png|jpe?g)/gi, "og-default.webp");
}

async function convertLocal() {
  const publicDir = path.join(root, "public");
  let converted = 0;
  let bytesIn = 0;
  let bytesOut = 0;
  for (const file of walk(publicDir)) {
    if (!/\.(png|jpe?g)$/i.test(file)) continue;
    if (SKIP_FILE.has(path.basename(file))) continue;
    const out = file.replace(/\.(png|jpe?g)$/i, ".webp");
    const input = readFileSync(file);
    const webp = await sharp(input).webp({ quality: 80, effort: 4 }).toBuffer();
    writeFileSync(out, webp);
    unlinkSync(file);
    converted += 1;
    bytesIn += input.length;
    bytesOut += webp.length;
  }
  console.log(`local files ${converted}: ${(bytesIn / 1e6).toFixed(1)}MB -> ${(bytesOut / 1e6).toFixed(1)}MB`);
}

function rewriteSources() {
  const textExt = new Set([".js", ".jsx", ".mjs", ".css", ".html", ".json", ".md"]);
  let files = 0;
  for (const file of walk(root)) {
    if (file.endsWith("convert-images-to-webp.mjs")) continue;
    if (file.includes(`${path.sep}.env`)) continue;
    if (!textExt.has(path.extname(file))) continue;
    const before = readFileSync(file, "utf8");
    const after = rewriteText(before);
    if (after !== before) {
      writeFileSync(file, after);
      files += 1;
    }
  }
  console.log(`rewrote ${files} source files`);
}

function storagePathFor(url, used) {
  const parsed = new URL(url);
  const base = path.basename(parsed.pathname).replace(/\.(png|jpe?g)$/i, "");
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80) || "image";
  let rel;
  if (parsed.hostname.includes("supabase.co") && parsed.pathname.includes("/product-images/")) {
    rel = decodeURIComponent(parsed.pathname.split("/product-images/")[1] || "").replace(/\.(png|jpe?g)$/i, ".webp");
  } else {
    rel = `catalog/cms-${safe}.webp`;
  }
  if (used.has(rel)) rel = rel.replace(/\.webp$/, `-${used.size}.webp`);
  used.add(rel);
  return rel;
}

async function convertRemote(sb) {
  const [{ data: imageRows, error: imageError }, { data: products, error: productError }] = await Promise.all([
    sb.from("product_images").select("id,url,storage_path"),
    sb.from("products").select("id,image_url,payload"),
  ]);
  if (imageError) throw imageError;
  if (productError) throw productError;

  const urls = new Set();
  for (const row of imageRows || []) {
    if (/^https?:\/\//i.test(row.url || "") && /\.(png|jpe?g)(\?|$)/i.test(row.url)) urls.add(row.url);
  }
  for (const row of products || []) {
    if (/^https?:\/\//i.test(row.image_url || "") && /\.(png|jpe?g)(\?|$)/i.test(row.image_url)) urls.add(row.image_url);
  }
  console.log(`remote unique ${urls.size}`);

  const map = new Map();
  const used = new Set();
  let failed = 0;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      const input = Buffer.from(await response.arrayBuffer());
      const webp = await sharp(input).webp({ quality: 80, effort: 4 }).toBuffer();
      const storagePath = storagePathFor(url, used);
      const { error } = await sb.storage.from("product-images").upload(storagePath, webp, {
        contentType: "image/webp",
        upsert: true,
      });
      if (error) throw error;
      const { data } = sb.storage.from("product-images").getPublicUrl(storagePath);
      map.set(url, { url: data.publicUrl, storagePath });
    } catch (error) {
      failed += 1;
      console.warn("skip", url, error?.message || error);
    }
  }
  console.log(`uploaded ${map.size}, failed ${failed}`);

  function apply(value) {
    if (typeof value !== "string") return value;
    if (map.has(value)) return map.get(value).url;
    return rewriteText(value);
  }

  let imageUpdates = 0;
  for (const row of imageRows || []) {
    const nextUrl = apply(row.url);
    const mapped = map.get(row.url);
    const nextPath = mapped?.storagePath || (row.storage_path ? rewriteText(row.storage_path) : row.storage_path);
    if (nextUrl === row.url && nextPath === row.storage_path) continue;
    const { error } = await sb.from("product_images").update({ url: nextUrl, storage_path: nextPath }).eq("id", row.id);
    if (error) throw error;
    imageUpdates += 1;
  }
  console.log(`product_images updated ${imageUpdates}`);

  let productUpdates = 0;
  for (const row of products || []) {
    const imageUrl = apply(row.image_url || "");
    let nextPayload = row.payload;
    if (row.payload) {
      const original = JSON.stringify(row.payload);
      let text = original;
      const keys = [...map.keys()].sort((a, b) => b.length - a.length);
      for (const oldUrl of keys) text = text.split(oldUrl).join(map.get(oldUrl).url);
      text = rewriteText(text);
      nextPayload = text === original ? row.payload : JSON.parse(text);
    }
    const sameUrl = imageUrl === (row.image_url || "");
    const samePayload = JSON.stringify(nextPayload) === JSON.stringify(row.payload);
    if (sameUrl && samePayload) continue;
    const { error } = await sb.from("products").update({
      image_url: imageUrl || row.image_url,
      payload: nextPayload,
    }).eq("id", row.id);
    if (error) throw error;
    productUpdates += 1;
  }
  console.log(`products updated ${productUpdates}`);

  const [{ data: kvRows, error: kvError }, { data: rfqRows, error: rfqError }] = await Promise.all([
    sb.from("app_kv").select("key,value"),
    sb.from("rfqs").select("id,payload"),
  ]);
  if (kvError) throw kvError;
  if (rfqError) throw rfqError;

  function rewriteJson(value) {
    const original = JSON.stringify(value);
    let text = original;
    const keys = [...map.keys()].sort((a, b) => b.length - a.length);
    for (const oldUrl of keys) text = text.split(oldUrl).join(map.get(oldUrl).url);
    const next = rewriteText(text);
    return next === original ? null : JSON.parse(next);
  }

  let kvUpdates = 0;
  for (const row of kvRows || []) {
    const next = rewriteJson(row.value);
    if (!next) continue;
    const { error } = await sb.from("app_kv").update({ value: next }).eq("key", row.key);
    if (error) throw error;
    kvUpdates += 1;
  }
  let rfqUpdates = 0;
  for (const row of rfqRows || []) {
    const next = rewriteJson(row.payload);
    if (!next) continue;
    const { error } = await sb.from("rfqs").update({ payload: next }).eq("id", row.id);
    if (error) throw error;
    rfqUpdates += 1;
  }
  console.log(`app_kv ${kvUpdates}, rfqs ${rfqUpdates}`);
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));
const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
if (!url || !key) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

await convertLocal();
rewriteSources();
await convertRemote(createClient(url, key));
console.log("done");
