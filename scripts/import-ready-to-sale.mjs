import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excelPath =
  process.argv[2] ||
  "/Users/venus.chung/Downloads/Ready to Sale Product upload to Website (2).xlsx";

export const CATEGORY_ZH = {
  "Reinforcement Mesh": "鋼筋網",
  "Dense Mesh Flame Retardant Safety Net": "密目防燃安全網",
  "Gypsum Block": "石膏磚",
  "XPS Foam Board": "擠塑板",
  "Tiles": "瓷磚",
  "Vinyl": "膠地板",
  "Precasted Concrete": "預製混凝土",
  "Cat Ladder": "貓梯",
  "Logistics Storage Platform & Steel Shelving": "貨台同鋼層架",
  "Handrails": "扶手",
  "Balustrades": "欄河",
  "Forge-welded Grating": "焊接鋼格板",
  "Press-Lock Grating": "壓鎖鋼格板",
  "GU Type Drainage Gratings": "GU型去水溝蓋",
  "GT Type Drainage Gratings": "GT型去水溝蓋",
  "Gypsum Board": "石膏板",
  "Oxygen Chamber": "氧氣艙",
  "Dowel Bar": "傳力桿",
  "Paint": "油漆",
  "Raised Access Floors": "架空地板",
  "Aluminum Cladding": "鋁板飾面",
  "Cable": "電線電纜",
  "Shoe Washing Machines": "洗鞋機",
};

const CATEGORY_IMAGE = {
  "Reinforcement Mesh": "/assets/prod-mesh.webp",
  "Dense Mesh Flame Retardant Safety Net": "/assets/prod-safetynet.webp",
  "Gypsum Block": "/assets/prod-gypsum-block.webp",
  "XPS Foam Board": "/assets/prod-xps.webp",
  "Tiles": "/assets/prod-tile.webp",
  "Vinyl": "/assets/prod-vinyl.webp",
  "Precasted Concrete": "/assets/prod-precast.webp",
  "Cat Ladder": "/assets/prod-ironwork.webp",
  "Logistics Storage Platform & Steel Shelving": "/assets/prod-ironwork.webp",
  "Handrails": "/assets/prod-ironwork.webp",
  "Balustrades": "/assets/prod-ironwork.webp",
  "Forge-welded Grating": "/assets/prod-grating.webp",
  "Press-Lock Grating": "/assets/prod-grating.webp",
  "GU Type Drainage Gratings": "/assets/prod-grating.webp",
  "GT Type Drainage Gratings": "/assets/prod-grating.webp",
  "Gypsum Board": "/assets/prod-gypsum-board.webp",
  "Oxygen Chamber": "/assets/sensor.webp",
  "Dowel Bar": "/assets/prod-ironwork.webp",
  "Paint": "/assets/prod-tile.webp",
  "Raised Access Floors": "/assets/prod-vinyl.webp",
  "Aluminum Cladding": "/assets/prod-ironwork.webp",
  "Cable": "/assets/gearbox.webp",
  "Shoe Washing Machines": "/assets/plc.webp",
  Software: "/assets/vfd.webp",
};

const SKU_PREFIX = {
  "Reinforcement Mesh": "MKT-MESH",
  "Dense Mesh Flame Retardant Safety Net": "MKT-DMF",
  "Gypsum Block": "MKT-GB",
  "XPS Foam Board": "MKT-XFB",
  "Tiles": "MKT-T",
  "Vinyl": "MKT-V",
  "Precasted Concrete": "MKT-PC",
  "Cat Ladder": "MKT-CL",
  "Logistics Storage Platform & Steel Shelving": "MKT-LSPS",
  "Handrails": "MKT-HR",
  "Balustrades": "MKT-BAL",
  "Forge-welded Grating": "MKT-FWG",
  "Press-Lock Grating": "MKT-PLG",
  "GU Type Drainage Gratings": "MKT-GU",
  "GT Type Drainage Gratings": "MKT-GT",
  "Gypsum Board": "MKT-GBOARD",
  "Oxygen Chamber": "MKT-OC",
  "Dowel Bar": "MKT-DB",
  "Paint": "MKT-PNT",
  "Raised Access Floors": "MKT-RAF",
  "Aluminum Cladding": "MKT-AC",
  "Cable": "MKT-CBL",
  "Shoe Washing Machines": "MKT-SWM",
};

export function categoryDisplayName(en) {
  if (en === "Software") return "Software";
  const zh = CATEGORY_ZH[en];
  return zh ? `${zh}, ${en}` : en;
}

function splitList(text) {
  return String(text || "")
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[\s\-•*]+/, "").trim())
    .filter(Boolean);
}

function parseLead(text) {
  const raw = String(text || "").replace(/\r/g, " ").replace(/\s+/g, " ").trim();
  const range = raw.match(/(\d+)\s*[-–~to]+\s*(\d+)/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const one = raw.match(/(\d+)/);
  if (one) return { min: Number(one[1]), max: Number(one[1]) };
  return null;
}

function parseMoq(text, fallback) {
  const raw = String(text || "").replace(/\r/g, " ").trim();
  if (!raw || raw === "/") return fallback ?? 1;
  if (/no moq|without moq|no requirement|have stock without moq/i.test(raw)) return 1;
  const simple = raw.match(/^(\d+(?:\.\d+)?)\s*(sheets?|pcs|sq\.?m|m[²³23]|ton)?$/i);
  if (simple) return Number(simple[1]);
  return fallback ?? 1;
}

function parseUnit(text, fallback) {
  const raw = String(text || "").trim();
  if (!raw || /^per quote$/i.test(raw)) return fallback || "lot";
  if (/^m2$/i.test(raw)) return "m²";
  if (/^m3$/i.test(raw)) return "m³";
  if (/^sets?$/i.test(raw)) return "set";
  if (/^sheets?$/i.test(raw)) return "sheet";
  return raw;
}

function slugId(sku) {
  return String(sku || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadExisting() {
  return [];
}

function nextSku(prefix, used) {
  let n = 1;
  while (used.has(`${prefix}-${String(n).padStart(4, "0")}`)) n += 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

function uniqueId(base, used) {
  let id = base || `mkt-${used.size + 1}`;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function buildFromExcel() {
  const wb = XLSX.read(readFileSync(excelPath), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
  const existing = loadExisting();
  const byEnCat = new Map();
  existing.forEach((p) => {
    if (p.category === "Software") return;
    const en = String(p.category || "").includes(",")
      ? String(p.category).split(",").slice(-1)[0].trim()
      : p.category;
    if (!byEnCat.has(en)) byEnCat.set(en, []);
    byEnCat.get(en).push(p);
  });
  const usedSku = new Set(existing.map((p) => p.productNo).filter(Boolean));
  const usedId = new Set(existing.map((p) => p.id));
  const matchedIds = new Set();
  const products = [];
  const indexByCat = new Map();

  for (const row of rows) {
    const enCat = String(row.category || "").trim();
    const model = String(row.Product || "").trim();
    if (!enCat || enCat === "Software" || !model) continue;
    const zh = CATEGORY_ZH[enCat] || enCat;
    const category = categoryDisplayName(enCat);
    const catIndex = indexByCat.get(enCat) || 0;
    indexByCat.set(enCat, catIndex + 1);
    const prev = (byEnCat.get(enCat) || [])[catIndex] || null;
    const excelSku = String(row.provisional_sku_id || "").trim();
    const sku = excelSku || prev?.productNo || nextSku(SKU_PREFIX[enCat] || "MKT-SKU", usedSku);
    usedSku.add(sku);
    if (prev?.id) matchedIds.add(prev.id);
    const purposes = splitList(row["Purposes (Indicator for Searching)"]);
    const sizeDesc = String(row["Size / Description"] || "").replace(/\r\n/g, "\n").trim();
    const certifications = String(row["Certifications / Relevant Reports"] || "").replace(/\r\n/g, "\n").trim();
    const primarySpec = String(row.Primary_Spec_Description || "").replace(/\r\n/g, "\n").trim();
    const unit = parseUnit(row.Sales_unit, prev?.salesUnit || prev?.unit);
    const moq = parseMoq(row.MOQ, prev?.moq);
    const parsedLead = parseLead(row["Lead-Time"]);
    const leadTime = parsedLead || prev?.leadTime || { min: 7, max: 14 };
    const remark = String(row.Remark || "").replace(/\r\n/g, "\n").trim();
    const standard = splitList(certifications)[0] || prev?.standard || "";
    const description = primarySpec || sizeDesc || prev?.description || "";
    const id = prev?.id || uniqueId(slugId(sku), usedId);
    usedId.add(id);
    products.push({
      id,
      name: `${model} — ${zh}, ${enCat}`,
      productNo: sku,
      provisionalSku: sku,
      category,
      supplier: prev?.supplier || "Mattex",
      featuredRank: prev?.featuredRank ?? null,
      green: Boolean(prev?.green),
      hit: Boolean(prev?.hit),
      tailorMade: Boolean(prev?.tailorMade),
      price: null,
      quote: null,
      unit,
      moq,
      stockStatus: prev?.stockStatus || "limited",
      leadTime,
      leadTimeLabel: String(row["Lead-Time"] || "").replace(/\r\n/g, " ").trim(),
      standard,
      description,
      image: prev?.image || CATEGORY_IMAGE[enCat] || "/assets/prod-mesh.webp",
      imageSource: prev?.imageSource || "upload",
      sizeDesc,
      certifications,
      primarySpec,
      salesUnit: unit,
      purposes,
      remark,
      published: true,
      specs: [
        sizeDesc ? `Size: ${sizeDesc.replace(/\n/g, " / ")}` : "",
        certifications ? `Cert: ${certifications.replace(/\s+/g, " ").trim()}` : "",
        `Sales unit: ${unit}`,
        row.MOQ ? `MOQ: ${String(row.MOQ).replace(/\s+/g, " ").trim()}` : `MOQ: ${moq}`,
        row["Lead-Time"] ? `Lead: ${String(row["Lead-Time"]).replace(/\s+/g, " ").trim()}` : "",
      ].filter(Boolean),
    });
  }

  existing.forEach((p) => {
    if (p.category === "Software") return;
    if (matchedIds.has(p.id)) return;
    products.push({
      ...p,
      provisionalSku: p.provisionalSku || p.productNo,
      published: false,
    });
  });

  const software = existing
    .filter((p) => p.category === "Software")
    .map((p) => ({
      ...p,
      provisionalSku: p.provisionalSku || p.productNo,
      published: p.published !== false,
    }));

  return products.concat(software);
}

const products = buildFromExcel();
console.log(
  `Built ${products.length} products from Excel. Catalog is stored in Supabase, not GitHub. Upsert with the storefront seed path or Table Editor.`
);
const live = products.filter((p) => p.published !== false && p.category !== "Software");
const cats = [...new Set(live.map((p) => p.category))];
const unpublished = products.filter((p) => p.published === false);
console.log(
  `${live.length} excel live, ${products.length - live.length - unpublished.length} software, ${unpublished.length} unpublished`
);
console.log(cats.join("\n"));
