import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const READY_PATH =
  process.argv[2] || "/Users/venus.chung/Desktop/marketplace products/Ready to Sale Product upload to Website.xlsx";
const PRC_PATH =
  process.argv[3] || "/Users/venus.chung/Desktop/marketplace products/mattex-prc-and-local-product-list.xlsx";
const SOFTWARE_PATH =
  process.argv[4] || "/Users/venus.chung/Desktop/marketplace products/Mattex-Software-List.xlsx";

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
  Window: "窗",
};

const CATEGORY_IMAGE = {
  "Reinforcement Mesh": "/assets/prod-mesh.webp",
  "Dense Mesh Flame Retardant Safety Net": "/assets/prod-safetynet.webp",
  "Gypsum Block": "/assets/prod-gypsum-block.webp",
  "XPS Foam Board": "/assets/prod-xps.webp",
  Tiles: "/assets/prod-tile.webp",
  Vinyl: "/assets/prod-vinyl.webp",
  "Precasted Concrete": "/assets/prod-precast.webp",
  "Cat Ladder": "/assets/prod-ironwork.webp",
  "Logistics Storage Platform & Steel Shelving": "/assets/prod-ironwork.webp",
  Handrails: "/assets/prod-ironwork.webp",
  Balustrades: "/assets/prod-ironwork.webp",
  "Forge-welded Grating": "/assets/prod-grating.webp",
  "Press-Lock Grating": "/assets/prod-grating.webp",
  "GU Type Drainage Gratings": "/assets/prod-grating.webp",
  "GT Type Drainage Gratings": "/assets/prod-grating.webp",
  "Gypsum Board": "/assets/prod-gypsum-board.webp",
  "Oxygen Chamber": "/assets/sensor.webp",
  "Dowel Bar": "/assets/prod-ironwork.webp",
  Paint: "/assets/prod-tile.webp",
  "Raised Access Floors": "/assets/prod-vinyl.webp",
  "Aluminum Cladding": "/assets/prod-ironwork.webp",
  Cable: "/assets/gearbox.webp",
  "Shoe Washing Machines": "/assets/plc.webp",
  Software: "/assets/vfd.webp",
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

const SKU_PREFIX = {
  "Reinforcement Mesh": "MKT-MESH",
  "Dense Mesh Flame Retardant Safety Net": "MKT-DMF",
  "Gypsum Block": "MKT-GB",
  "XPS Foam Board": "MKT-XFB",
  Tiles: "MKT-T",
  Vinyl: "MKT-V",
  "Precasted Concrete": "MKT-PC",
  "Cat Ladder": "MKT-CL",
  "Logistics Storage Platform & Steel Shelving": "MKT-LSPS",
  Handrails: "MKT-HR",
  Balustrades: "MKT-BAL",
  "Forge-welded Grating": "MKT-FWG",
  "Press-Lock Grating": "MKT-PLG",
  "GU Type Drainage Gratings": "MKT-GU",
  "GT Type Drainage Gratings": "MKT-GT",
  "Gypsum Board": "MKT-GBOARD",
  "Oxygen Chamber": "MKT-OC",
  "Dowel Bar": "MKT-DB",
  Paint: "MKT-PNT",
  "Raised Access Floors": "MKT-RAF",
  "Aluminum Cladding": "MKT-AC",
  Cable: "MKT-CBL",
  "Shoe Washing Machines": "MKT-SWM",
  "Pipe & Fittings & Accessories": "MKT-PIPE",
  "Manhole & Channel": "MKT-MH",
  "Structure Steel Element, Metal Product": "MKT-SSE",
  "Brick & Block": "MKT-BB",
  Plastering: "MKT-PLS",
  Aggregate: "MKT-AGG",
  Board: "MKT-BRD",
  "Cable Containment": "MKT-CC",
  Waterproofing: "MKT-WP",
  "Timber / Plywood": "MKT-TIM",
  Insulation: "MKT-INS",
  Barriers: "MKT-BAR",
  Window: "MKT-WIN",
  Software: "MKT-SW",
};

const ALIAS = {
  tile: "Tiles",
  tiles: "Tiles",
  "precast concrete": "Precasted Concrete",
  "precasted concrete": "Precasted Concrete",
  "safety net": "Dense Mesh Flame Retardant Safety Net",
};

function categoryEnglish(raw) {
  const text = String(raw || "").trim();
  return ALIAS[text.toLowerCase()] || text;
}

function categoryDisplayName(en) {
  const zh = CATEGORY_ZH[en];
  return zh ? `${zh}, ${en}` : en;
}

function norm(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function splitList(text) {
  return String(text || "")
    .split(/\r?\n|[;；]/)
    .map((part) => part.replace(/^[\s\-•*]+/, "").trim())
    .filter(Boolean);
}

function parseLead(text) {
  const raw = String(text || "");
  const range = raw.match(/(\d+)\s*[-–~to]+\s*(\d+)/i);
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

function sheetRows(filePath, sheetName) {
  const wb = XLSX.read(readFileSync(filePath), { type: "buffer" });
  const name = sheetName || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: false });
}

function rowKey(row) {
  return [norm(categoryEnglish(row.category)), norm(row.Product), norm(row["Size / Description"])].join("|");
}

function loadPatches() {
  try {
    const store = JSON.parse(readFileSync(path.join(root, ".local-shared-store.json"), "utf8"));
    const patches = store?.kv?.subbie_product_patches || {};
    return Object.entries(patches)
      .filter(([key, value]) => !key.startsWith("__") && value && typeof value === "object" && !Array.isArray(value))
      .map(([id, value]) => ({ ...value, id: value.id || id }));
  } catch {
    return [];
  }
}

function patchEnglish(category) {
  const raw = String(category || "");
  const en = raw.includes(",") ? raw.split(",").slice(-1)[0].trim() : raw.trim();
  return categoryEnglish(en);
}

function patchModel(name) {
  return norm(String(name || "").split("—")[0]);
}

const reservedSku = new Set();
const usedSku = new Set();
const usedId = new Set();

function takeSku(en, preferred) {
  const excelSku = String(preferred || "").trim();
  const key = excelSku.toLowerCase();
  if (excelSku && !usedSku.has(key)) {
    usedSku.add(key);
    reservedSku.delete(key);
    return excelSku;
  }
  const prefix = SKU_PREFIX[en] || "MKT-SKU";
  let n = 1;
  let sku = "";
  do {
    sku = `${prefix}-${String(n).padStart(4, "0")}`;
    n += 1;
  } while (usedSku.has(sku.toLowerCase()) || reservedSku.has(sku.toLowerCase()));
  usedSku.add(sku.toLowerCase());
  return sku;
}

function takeId(sku) {
  const base = slugId(sku) || `mkt-${usedId.size + 1}`;
  let id = base;
  let n = 2;
  while (usedId.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  usedId.add(id);
  return id;
}

function toProduct(row, source, patch) {
  const en = categoryEnglish(row.category);
  const model = String(row.Product || "").trim();
  if (!en || !model) return null;
  const display = categoryDisplayName(en);
  const excelSku = String(row.provisional_sku_id || "").trim();
  const patchSku = String(patch?.productNo || "").trim();
  if (patchSku && (!excelSku || excelSku.toLowerCase() === patchSku.toLowerCase())) reservedSku.delete(patchSku.toLowerCase());
  const sku = takeSku(en, excelSku || patchSku);
  const id = patch?.id && !usedId.has(patch.id) ? (usedId.add(patch.id), patch.id) : takeId(sku);
  const imageUrl = String(row.image_url || "").trim();
  const image = /^https?:\/\//i.test(imageUrl) ? imageUrl : CATEGORY_IMAGE[en] || "";
  const sizeDesc = String(row["Size / Description"] || "").replace(/\r\n/g, "\n").trim();
  const certifications = String(row["Certifications / Relevant Reports"] || "").replace(/\r\n/g, "\n").trim();
  const primarySpec = String(row.Primary_Spec_Description || "").replace(/\r\n/g, "\n").trim();
  const unit = parseUnit(row.Sales_unit);
  const moq = parseMoq(row.MOQ);
  const leadRaw = String(row["Lead-Time"] || "").replace(/\r\n/g, " ").trim();
  const leadTime = parseLead(leadRaw) || { min: 7, max: 14 };
  const purposes = splitList(row["Purposes (Indicator for Searching)"]);
  const remark = String(row.Remark || "").replace(/\r\n/g, "\n").trim();
  const zh = CATEGORY_ZH[en];
  const name = model.includes("—") || model.includes(en) ? model : zh ? `${model} — ${zh}, ${en}` : `${model} — ${en}`;
  const description = primarySpec || sizeDesc || purposes[0] || "";
  return {
    id,
    name,
    productNo: sku,
    provisionalSku: sku,
    category: display,
    supplier: "Mattex",
    featuredRank: null,
    green: false,
    hit: false,
    tailorMade: false,
    price: null,
    quote: null,
    unit,
    moq,
    stockStatus: "limited",
    leadTime,
    leadTimeLabel: leadRaw,
    standard: splitList(certifications)[0] || "",
    description,
    image,
    images: image ? [image] : [],
    imageSource: /^https?:\/\//i.test(imageUrl) ? "url" : image ? "upload" : "",
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
    sourceUrl: String(row.source_url || "").trim(),
    specUrl: String(row.spec_url || "").trim(),
    market: String(row.Market || "").trim(),
    parentProduct: String(row.Parent_Product || "").trim(),
    variant: String(row.Variant || "").trim(),
    refPrice: String(row["Ref. Price: HK $"] || "").trim(),
    deliveryFee: String(row["Delivery Fee: HK $"] || "").trim(),
    source,
    specs: [
      sizeDesc ? `Size: ${sizeDesc.replace(/\n/g, " / ")}` : "",
      certifications ? `Cert: ${certifications.replace(/\s+/g, " ").trim()}` : "",
      `Sales unit: ${unit}`,
      row.MOQ ? `MOQ: ${String(row.MOQ).replace(/\s+/g, " ").trim()}` : `MOQ: ${moq}`,
      leadRaw ? `Lead: ${leadRaw}` : "",
    ].filter(Boolean),
  };
}

const prcRows = sheetRows(PRC_PATH, "Combined Import");
const readyRows = sheetRows(READY_PATH);
const prcKeys = new Set();
const products = [];
const seenRow = new Set();
let duplicateRows = 0;
let reusedNumbers = 0;

const patches = loadPatches();
const patchesByKey = new Map();
for (const patch of patches) {
  const key = [norm(patchEnglish(patch.category)), patchModel(patch.name), norm(patch.sizeDesc)].join("|");
  if (!patchesByKey.has(key)) patchesByKey.set(key, []);
  patchesByKey.get(key).push(patch);
  if (patch.productNo) reservedSku.add(String(patch.productNo).trim().toLowerCase());
}

function claimPatch(row) {
  const list = patchesByKey.get(rowKey(row)) || [];
  const patch = list.find((item) => !item._used);
  if (!patch) return null;
  patch._used = true;
  reusedNumbers += 1;
  return patch;
}

for (const row of prcRows) {
  const key = rowKey(row);
  if (seenRow.has(key)) {
    duplicateRows += 1;
    continue;
  }
  seenRow.add(key);
  prcKeys.add(key);
  const product = toProduct(row, "prc-local", claimPatch(row));
  if (product) products.push(product);
}

let readyAdded = 0;
for (const row of readyRows) {
  const key = rowKey(row);
  if (prcKeys.has(key) || seenRow.has(key)) continue;
  seenRow.add(key);
  const product = toProduct(row, "ready-to-sale", claimPatch(row));
  if (!product) continue;
  readyAdded += 1;
  products.push(product);
}

function claimSoftwarePatch(shortName) {
  const needle = norm(shortName);
  const patch = patches.find((item) => {
    if (item._used || patchEnglish(item.category) !== "Software") return false;
    return patchModel(item.name) === needle;
  });
  if (!patch) return null;
  patch._used = true;
  reusedNumbers += 1;
  const patchSku = String(patch.productNo || "").trim();
  if (patchSku) reservedSku.delete(patchSku.toLowerCase());
  return patch;
}

const softwareRows = sheetRows(SOFTWARE_PATH);
let softwareAdded = 0;
for (const row of softwareRows) {
  const shortName = String(row["Short Name"] || "").trim();
  const fullName = String(row["Full Name"] || "").trim();
  if (!shortName || !fullName) continue;
  const patch = claimSoftwarePatch(shortName);
  const patchSku = String(patch?.productNo || "").trim();
  const sku = takeSku("Software", patchSku);
  const id = patch?.id && !usedId.has(patch.id) ? (usedId.add(patch.id), patch.id) : takeId(sku);
  const unit = patch?.unit || patch?.salesUnit || "license";
  products.push({
    id,
    name: `${shortName} — ${fullName}`,
    productNo: sku,
    provisionalSku: sku,
    category: "Software",
    supplier: "Mattex",
    featuredRank: null,
    green: Boolean(patch?.green),
    hit: Boolean(patch?.hit),
    tailorMade: Boolean(patch?.tailorMade),
    price: null,
    quote: null,
    unit,
    moq: Number(patch?.moq) > 0 ? Number(patch.moq) : 1,
    stockStatus: "limited",
    leadTime: patch?.leadTime || { min: 7, max: 21 },
    leadTimeLabel: patch?.leadTimeLabel || "",
    standard: patch?.standard || "",
    description: fullName,
    image: "/assets/vfd.webp",
    images: ["/assets/vfd.webp"],
    imageSource: "upload",
    sizeDesc: fullName,
    certifications: patch?.certifications || "",
    primarySpec: patch?.primarySpec || "",
    salesUnit: unit,
    purposes: [fullName],
    remark: patch?.remark || "",
    published: true,
    deleted: false,
    held: false,
    discontinued: false,
    sourceUrl: "",
    specUrl: "",
    market: "",
    parentProduct: "",
    variant: "",
    refPrice: "",
    deliveryFee: "",
    source: "software",
    specs: [`Sales unit: ${unit}`, `MOQ: ${Number(patch?.moq) > 0 ? Number(patch.moq) : 1}`],
  });
  softwareAdded += 1;
}

const categories = [];
const seenCat = new Set();
for (const product of products) {
  const en = categoryEnglish(String(product.category).split(",").slice(-1)[0]);
  if (seenCat.has(en)) continue;
  seenCat.add(en);
  categories.push({
    name: product.category,
    image: CATEGORY_IMAGE[en] || "",
  });
}

const outDir = path.join(root, "data");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "host-catalog.json");
const catalog = {
  extractedAt: new Date().toISOString(),
  sources: [
    { file: READY_PATH, rows: readyRows.length },
    { file: PRC_PATH, sheet: "Combined Import", rows: prcRows.length },
    { file: SOFTWARE_PATH, rows: softwareRows.length },
  ],
  counts: {
    products: products.length,
    fromPrc: products.filter((item) => item.source === "prc-local").length,
    fromReadyToSaleOnly: readyAdded,
    software: softwareAdded,
    duplicateRowsSkipped: duplicateRows,
    reusedProductNumbers: reusedNumbers,
    categories: categories.length,
  },
  categories,
  products,
};
writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify(catalog.counts, null, 2));
console.log(outPath);
