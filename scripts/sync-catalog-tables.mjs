import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* missing file is fine */
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!url || !key) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const ASSET_DIR = "public/assets";
const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

function publicUrl(path) {
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path}`;
}

const { data: products, error: productErr } = await sb.from("products").select("id,image_url,payload");
if (productErr) throw productErr;

const localPaths = new Set();
for (const row of products || []) {
  const image = row.image_url || row.payload?.image || "";
  if (image.startsWith("/assets/")) localPaths.add(image);
}

const uploaded = new Map();
for (const image of [...localPaths].sort()) {
  const fileName = basename(image);
  const ext = fileName.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `catalog/${fileName}`;
  const bytes = readFileSync(`${ASSET_DIR}/${fileName}`);
  const { error } = await sb.storage.from("product-images").upload(storagePath, bytes, {
    upsert: true,
    contentType: mime[ext] || "application/octet-stream",
    cacheControl: "31536000",
  });
  if (error) throw error;
  uploaded.set(image, { storagePath, url: publicUrl(storagePath) });
  console.log(`Uploaded ${image} -> ${storagePath}`);
}

for (const [local, mapped] of uploaded) {
  const { error: imgErr } = await sb
    .from("product_images")
    .update({ url: mapped.url, storage_path: mapped.storagePath, source: "storage" })
    .eq("url", local);
  if (imgErr) throw imgErr;
  const { error: prodErr } = await sb.from("products").update({ image_url: mapped.url }).eq("image_url", local);
  if (prodErr) throw prodErr;
}

const mattexLogo = uploaded.get("/assets/prod-mesh.webp") || [...uploaded.values()][0];
if (mattexLogo) {
  const { error } = await sb.from("suppliers").update({ image_url: mattexLogo.url, updated_at: new Date().toISOString() }).eq("slug", "mattex");
  if (error) throw error;
}

console.log(`Uploaded ${uploaded.size} unique images; linked product_images to Storage.`);
