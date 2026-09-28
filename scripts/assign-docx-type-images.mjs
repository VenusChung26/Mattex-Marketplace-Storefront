import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const require = createRequire("/tmp/mattex-webp-tools/package.json");
const sharp = require("sharp");

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
function envGet(key) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) throw new Error(`missing ${key}`);
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const srcDir = "/Users/venus.chung/.cursor/projects/Users-venus-chung-cursor-Subbie-Landing-Marketplace/assets";
const outDir = new URL("../public/assets/", import.meta.url);
const keys = [
  "gypsum", "xps", "ladder", "guardrail", "balustrade", "gully", "oxygen", "dowel",
  "paint", "vinyl", "floor", "aluminium", "cable", "tray", "shoe", "timber",
  "hdpe", "di", "ci", "bricks", "barrier", "manhole", "channel", "eps", "waterproof",
];

const sb = createClient(envGet("VITE_SUPABASE_URL"), envGet("VITE_SUPABASE_ANON_KEY"));
const base = `${envGet("VITE_SUPABASE_URL")}/storage/v1/object/public/product-images/catalog`;
const stamp = "v=20260928b";
const urls = {};

for (const key of keys) {
  const webp = await sharp(`${srcDir}/type-${key}.png`).resize(1200, 1200, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
  writeFileSync(new URL(`type-${key}.webp`, outDir), webp);
  const path = `catalog/type-${key}.webp`;
  const { error } = await sb.storage.from("product-images").upload(path, webp, {
    contentType: "image/webp",
    upsert: true,
  });
  if (error) throw new Error(`${key} upload ${error.message}`);
  urls[key] = `${base}/type-${key}.webp?${stamp}`;
  console.log("uploaded", key);
}

function typeKey(row) {
  const name = String(row.name || row.payload?.name || "");
  const cat = String(row.category || row.payload?.category || "");
  if (cat.includes("Gypsum Block")) return "gypsum";
  if (cat.includes("XPS") || /XPS/i.test(name)) return "xps";
  if (cat.includes("Cat Ladder")) return "ladder";
  if (cat.includes("Balustrades") || cat.includes("Handrails")) return "balustrade";
  if (/Crash Barrier/i.test(name)) return "guardrail";
  if (/Water Barrier/i.test(name)) return "barrier";
  if (cat.includes("GU Type") || cat.includes("GT Type")) return "gully";
  if (cat.includes("Press-Lock") || cat.includes("Forge-welded")) return "channel";
  if (cat.includes("Oxygen")) return "oxygen";
  if (cat.includes("Dowel")) return "dowel";
  if (cat.includes("Paint")) return "paint";
  if (cat.includes("Vinyl")) return "vinyl";
  if (cat.includes("Raised Access")) return "floor";
  if (cat.includes("Aluminum")) return "aluminium";
  if (cat.includes("Cable Containment")) return "tray";
  if (cat.includes("電線電纜")) return "cable";
  if (cat.includes("Shoe Washing")) return "shoe";
  if (cat.includes("Timber")) return "timber";
  if (cat.includes("Brick")) return "bricks";
  if (cat.includes("Manhole")) return "manhole";
  if (cat.includes("Waterproof")) return "waterproof";
  if (cat.includes("Pipe")) {
    if (/HDPE Pipe/i.test(name)) return "hdpe";
    if (/Ductile Iron/i.test(name)) return "di";
    if (/Cast Iron/i.test(name)) return "ci";
  }
  return "";
}

const rows = [];
for (let from = 0; ; from += 200) {
  const { data, error } = await sb.from("products").select("id,name,category,payload,image_url").range(from, from + 199);
  if (error) throw new Error(error.message);
  rows.push(...(data || []));
  if (!data || data.length < 200) break;
}

const counts = {};
const touched = [];
for (const row of rows) {
  const key = typeKey(row);
  if (!key) continue;
  const url = urls[key];
  const payload = { ...(row.payload || {}) };
  payload.image = url;
  payload.imageUrl = url;
  payload.images = [url];
  const { error } = await sb.from("products").update({ image_url: url, payload }).eq("id", row.id);
  if (error) throw new Error(`${row.id} ${error.message}`);
  await sb.from("product_images").update({ url, storage_path: `catalog/type-${key}.webp` }).eq("product_id", row.id).eq("is_primary", true);
  counts[key] = (counts[key] || 0) + 1;
  touched.push(row.id);
}

const categoryImage = {
  "木材、夾板, Timber / Plywood": urls.timber,
  "喉管、配件, Pipe & Fittings & Accessories": urls.hdpe,
  "線槽, Cable Containment": urls.tray,
  "磚、砌塊, Brick & Block": urls.bricks,
  "沙井、渠道, Manhole & Channel": urls.manhole,
  "防水, Waterproofing": urls.waterproof,
};
const { data: kv, error: kvError } = await sb.from("app_kv").select("value").eq("key", "subbie_custom_categories").single();
if (kvError) throw new Error(kvError.message);
const next = (kv.value || []).map((item) => (
  categoryImage[item.name] ? { ...item, image: categoryImage[item.name] } : item
));
const { error: kvWrite } = await sb.from("app_kv").update({ value: next }).eq("key", "subbie_custom_categories");
if (kvWrite) throw new Error(kvWrite.message);

console.log(JSON.stringify(counts, null, 2));
console.log("products", touched.length);
