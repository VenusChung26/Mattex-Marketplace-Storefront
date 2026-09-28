import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excelPath = process.argv[2] || "/Users/venus.chung/Desktop/mattex-prc-and-local-product-list.xlsx";

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
    /* missing file is fine */
  }
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
if (!url || !key) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const CATEGORY_ZH = {
  "Reinforcement Mesh": "鋼筋網",
  "Dense Mesh Flame Retardant Safety Net": "密目防燃安全網",
  "Gypsum Block": "石膏磚",
  "XPS Foam Board": "擠塑板",
  Tiles: "瓷磚",
  Vinyl: "膠地板",
  "Precasted Concrete": "預製混凝土",
  "Cat Ladder": "貓梯",
  "Logistics Storage Platform & Steel Shelving": "貨台同鋼層架",
  Handrails: "扶手",
  Balustrades: "欄河",
  "Forge-welded Grating": "焊接鋼格板",
  "Press-Lock Grating": "壓鎖鋼格板",
  "GU Type Drainage Gratings": "GU型去水溝蓋",
  "GT Type Drainage Gratings": "GT型去水溝蓋",
  "Gypsum Board": "石膏板",
  "Oxygen Chamber": "氧氣艙",
  "Dowel Bar": "傳力桿",
  Paint: "油漆",
  "Raised Access Floors": "架空地板",
  "Aluminum Cladding": "鋁板飾面",
  Cable: "電線電纜",
  "Shoe Washing Machines": "洗鞋機",
  "Pipe & Fittings & Accessories": "喉管、配件",
  "Manhole & Channel": "沙井、渠道",
  "Structure Steel Element, Metal Product": "結構鋼、金屬製品",
  "Brick & Block": "磚、砌塊",
  Plastering: "批盪",
  Aggregate: "石料",
  Board: "板材",
  "Cable Containment": "線槽",
  Waterproofing: "防水",
  "Timber / Plywood": "木材、夾板",
  Insulation: "保溫",
  Barriers: "圍欄",
};

const CATEGORY_IMAGE = {
  "Reinforcement Mesh": "/assets/prod-mesh.webp",
  "Dense Mesh Flame Retardant Safety Net": "/assets/prod-safetynet.webp",
  "Gypsum Block": "/assets/prod-gypsum-block.webp",
  "XPS Foam Board": "/assets/prod-xps.webp",
  Tiles: "/assets/prod-tile.webp",
  Vinyl: "/assets/prod-vinyl.webp",
  "Precasted Concrete": "/assets/prod-precast.webp",
  "Pipe & Fittings & Accessories": "/assets/prod-ironwork.webp",
  "Manhole & Channel": "/assets/prod-grating.webp",
  "Structure Steel Element, Metal Product": "/assets/prod-ironwork.webp",
  "Brick & Block": "/assets/prod-gypsum-block.webp",
  Plastering: "/assets/prod-tile.webp",
  Aggregate: "/assets/prod-precast.webp",
  Board: "/assets/prod-gypsum-board.webp",
  "Cable Containment": "/assets/gearbox.webp",
  Waterproofing: "/assets/prod-vinyl.webp",
  "Timber / Plywood": "/assets/prod-gypsum-board.webp",
  Insulation: "/assets/prod-xps.webp",
  Barriers: "/assets/prod-ironwork.webp",
};

const ALIAS = {
  tile: "Tiles",
  tiles: "Tiles",
  "precast concrete": "Precasted Concrete",
  "precasted concrete": "Precasted Concrete",
  "safety net": "Dense Mesh Flame Retardant Safety Net",
};

const KNOWN = new Set([
  "Reinforcement Mesh",
  "Dense Mesh Flame Retardant Safety Net",
  "Gypsum Block",
  "XPS Foam Board",
  "Tiles",
  "Vinyl",
  "Precasted Concrete",
  "Cat Ladder",
  "Logistics Storage Platform & Steel Shelving",
  "Handrails",
  "Balustrades",
  "Forge-welded Grating",
  "Press-Lock Grating",
  "GU Type Drainage Gratings",
  "GT Type Drainage Gratings",
  "Gypsum Board",
  "Oxygen Chamber",
  "Dowel Bar",
  "Paint",
  "Raised Access Floors",
  "Aluminum Cladding",
  "Cable",
  "Shoe Washing Machines",
]);

function categoryEnglish(raw) {
  const text = String(raw || "").trim();
  return ALIAS[text.toLowerCase()] || text;
}

function categoryDisplayName(en) {
  const zh = CATEGORY_ZH[en];
  return zh ? `${zh}, ${en}` : en;
}

function splitList(text) {
  return String(text || "")
    .split(/\r?\n|[;；]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseLead(text) {
  const raw = String(text || "");
  const range = raw.match(/(\d+)\s*[-–to]+\s*(\d+)/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const one = raw.match(/(\d+)/);
  if (one) return { min: Number(one[1]), max: Number(one[1]) };
  return null;
}

function parseMoq(text) {
  const raw = String(text || "").replace(/\r/g, " ").trim();
  if (!raw || raw === "/" || /no moq|without moq|no requirement/i.test(raw)) return 1;
  const simple = raw.match(/(\d+(?:\.\d+)?)/);
  return simple ? Number(simple[1]) : 1;
}

function parseUnit(text) {
  const raw = String(text || "").trim();
  if (!raw || /^per quote$/i.test(raw)) return "lot";
  if (/^m2$/i.test(raw)) return "m²";
  if (/^m3$/i.test(raw)) return "m³";
  if (/^sets?$/i.test(raw)) return "set";
  if (/^sheets?$/i.test(raw)) return "sheet";
  return raw;
}

function slugId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function norm(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueId(base, used) {
  let id = base || `mkt-${used.size + 1}`;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const wb = XLSX.read(readFileSync(excelPath), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Combined Import"], { defval: "", raw: false });

const { data: existing, error: loadError } = await sb.from("products").select("id,product_no,name,category,image_url,payload");
if (loadError) throw loadError;

const bySku = new Map();
const byCat = new Map();
const usedIds = new Set();
for (const row of existing || []) {
  usedIds.add(row.id);
  const sku = String(row.product_no || row.payload?.productNo || "").trim().toLowerCase();
  if (sku) bySku.set(sku, row);
  const cat = String(row.category || row.payload?.category || "");
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push(row);
}
const claimed = new Set();

function claimExisting(row, displayCategory, model, sku) {
  if (sku) {
    const hit = bySku.get(sku.toLowerCase());
    if (hit && !claimed.has(hit.id)) {
      claimed.add(hit.id);
      return hit;
    }
  }
  if (!model || model.length < 3 || /^\(\d+\)$/.test(model)) return null;
  const needle = norm(model);
  const pool = byCat.get(displayCategory) || [];
  const hit = pool.find((item) => {
    if (claimed.has(item.id)) return false;
    const name = norm(item.name || item.payload?.name);
    return name === needle || name.startsWith(`${needle} `) || name.startsWith(`${needle}—`) || name.startsWith(`${needle} —`);
  });
  if (hit) claimed.add(hit.id);
  return hit || null;
}

const products = [];
const customCats = new Map();
let created = 0;
let updated = 0;
let seq = 1;

for (const row of rows) {
  const en = categoryEnglish(row.category);
  const model = String(row.Product || "").trim();
  if (!en || !model) continue;
  const display = categoryDisplayName(en);
  if (!KNOWN.has(en)) {
    customCats.set(en, {
      id: slugId(en) || `cat-${customCats.size + 1}`,
      name: display,
      image: CATEGORY_IMAGE[en] || "/assets/prod-mesh.webp",
      custom: true,
    });
  }
  const excelSku = String(row.provisional_sku_id || "").trim();
  const prev = claimExisting(row, display, model, excelSku);
  const sku = excelSku || prev?.product_no || prev?.payload?.productNo || `MKT-PRC-${String(seq).padStart(4, "0")}`;
  seq += 1;
  const id = prev?.id || uniqueId(slugId(sku) || slugId(`${en}-${model}`), usedIds);
  const imageUrl = String(row.image_url || "").trim();
  const prevImage = String(prev?.image_url || prev?.payload?.image || "").trim();
  const image = /^https?:\/\//i.test(imageUrl) ? imageUrl : /^https?:\/\//i.test(prevImage) ? prevImage : CATEGORY_IMAGE[en] || "/assets/prod-mesh.webp";
  const sizeDesc = String(row["Size / Description"] || "").replace(/\r\n/g, "\n").trim();
  const certifications = String(row["Certifications / Relevant Reports"] || "").replace(/\r\n/g, "\n").trim();
  const primarySpec = String(row.Primary_Spec_Description || "").replace(/\r\n/g, "\n").trim();
  const unit = parseUnit(row.Sales_unit || prev?.payload?.unit);
  const moq = parseMoq(row.MOQ || prev?.payload?.moq);
  const leadRaw = String(row["Lead-Time"] || "").replace(/\r\n/g, " ").trim();
  const leadTime = parseLead(leadRaw) || prev?.payload?.leadTime || { min: 7, max: 14 };
  const purposes = splitList(row["Purposes (Indicator for Searching)"]);
  const remark = String(row.Remark || "").replace(/\r\n/g, "\n").trim();
  const zh = CATEGORY_ZH[en];
  const name = model.includes("—") || model.includes(en) ? model : zh ? `${model} — ${zh}, ${en}` : `${model} — ${en}`;
  const description = primarySpec || sizeDesc || purposes[0] || prev?.payload?.description || "";
  const payload = {
    ...(prev?.payload || {}),
    id,
    name,
    productNo: sku,
    provisionalSku: sku,
    category: display,
    supplier: prev?.payload?.supplier || "Mattex",
    featuredRank: prev?.payload?.featuredRank ?? null,
    green: Boolean(prev?.payload?.green),
    hit: Boolean(prev?.payload?.hit),
    tailorMade: Boolean(prev?.payload?.tailorMade),
    price: prev?.payload?.price ?? null,
    quote: prev?.payload?.quote ?? null,
    unit,
    moq,
    stockStatus: prev?.payload?.stockStatus || "limited",
    leadTime,
    leadTimeLabel: leadRaw || prev?.payload?.leadTimeLabel || "",
    standard: splitList(certifications)[0] || prev?.payload?.standard || "",
    description,
    image,
    images: /^https?:\/\//i.test(image) ? [image] : prev?.payload?.images || [],
    imageSource: /^https?:\/\//i.test(imageUrl) ? "url" : prev?.payload?.imageSource || "upload",
    sizeDesc,
    certifications,
    primarySpec,
    salesUnit: unit,
    purposes,
    remark,
    published: true,
    deleted: false,
    held: false,
    discontinued: false,
    sourceUrl: String(row.source_url || "").trim() || prev?.payload?.sourceUrl || "",
    specUrl: String(row.spec_url || "").trim() || prev?.payload?.specUrl || "",
    market: String(row.Market || "").trim(),
    parentProduct: String(row.Parent_Product || "").trim(),
    variant: String(row.Variant || "").trim(),
    specs: [
      sizeDesc ? `Size: ${sizeDesc.replace(/\n/g, " / ")}` : "",
      certifications ? `Cert: ${certifications.replace(/\s+/g, " ").trim()}` : "",
      `Sales unit: ${unit}`,
      row.MOQ ? `MOQ: ${String(row.MOQ).replace(/\s+/g, " ").trim()}` : `MOQ: ${moq}`,
      leadRaw ? `Lead: ${leadRaw}` : "",
    ].filter(Boolean),
  };
  if (prev) updated += 1;
  else created += 1;
  products.push({
    id,
    payload,
    name,
    product_no: sku,
    provisional_sku: sku,
    category: display,
    supplier: "Mattex",
    supplier_slug: "mattex",
    unit,
    image_url: /^https?:\/\//i.test(image) ? image : "",
    published: true,
    held: false,
    deleted: false,
    discontinued: false,
    green: Boolean(payload.green),
    hit: Boolean(payload.hit),
    tailor_made: Boolean(payload.tailorMade),
    moq: String(moq),
    lead_time: leadRaw,
    lead_time_label: leadRaw,
    size_desc: sizeDesc,
    updated_at: new Date().toISOString(),
  });
}

for (let i = 0; i < products.length; i += 40) {
  const chunk = products.slice(i, i + 40);
  const { error } = await sb.from("products").upsert(chunk, { onConflict: "id" });
  if (error) throw error;
}

const images = products
  .filter((row) => /^https?:\/\//i.test(row.image_url))
  .map((row) => ({
    product_id: row.id,
    url: row.image_url,
    sort_order: 0,
    is_primary: true,
    source: "url",
  }));
for (let i = 0; i < images.length; i += 80) {
  const chunk = images.slice(i, i + 80);
  const { error } = await sb.from("product_images").upsert(chunk, { onConflict: "product_id,url" });
  if (error) {
    const { error: insertError } = await sb.from("product_images").insert(chunk);
    if (insertError && !/duplicate/i.test(insertError.message)) throw insertError;
  }
}

const { data: kvRow } = await sb.from("app_kv").select("value").eq("key", "subbie_custom_categories").maybeSingle();
const current = Array.isArray(kvRow?.value) ? kvRow.value : [];
const merged = [...current];
for (const cat of customCats.values()) {
  if (!merged.some((item) => item && (item.id === cat.id || String(item.name).toLowerCase() === cat.name.toLowerCase()))) {
    merged.push(cat);
  }
}
const { error: kvError } = await sb.from("app_kv").upsert(
  { key: "subbie_custom_categories", value: merged, updated_at: new Date().toISOString() },
  { onConflict: "key" },
);
if (kvError) throw kvError;

console.log(`Excel rows ${rows.length}. Upserted ${products.length} (new ${created}, matched ${updated}). Custom categories ${customCats.size}. Images ${images.length}.`);
