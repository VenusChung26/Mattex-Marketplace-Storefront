import { collectAttachmentUrls, collectProductImageUrls, fitWhatsappUrls, uploadRfqPdf } from "./rfqBlob.js";
import { buildQuotePdf, canSharePdfFile, downloadBlob, sharePdfFile } from "./quotePdf.js";
import { fetchCatalogState, fetchRemoteKv, fetchRemoteRfqs, fetchRfqStamp, fetchSessionState, isSupabaseConfigured, persistCatalogTables, persistKv, persistKvNow } from "./supabasePersist.js";
import { adminOrigin, marketplaceOrigin } from "./origins.js";
import {
  accountCreatedEmailHtml,
  buyerRejectedEmailHtml,
  rfqAcceptedEmailHtml,
  rfqCancelAcceptedEmailHtml,
  rfqCancelDeclinedEmailHtml,
  rfqCancelRequestedEmailHtml,
  rfqNoOfferEmailHtml,
  rfqReverseAcceptedEmailHtml,
  rfqReverseDeclinedEmailHtml,
  rfqReverseRequestedEmailHtml,
  rfqSubmittedEmailHtml,
  salesNewRfqEmailHtml,
  wrapEmailSend,
} from "./mailTemplate.js";

const HIDDEN_CATEGORY_IDS = new Set(["service", "computer", "hardware"]);
const SYNTHETIC_CATEGORY_IDS = new Set(["service", "computer", "hardware"]);

const CATEGORY_DEFS = [
  { id: "reinforcement-mesh", name: "鋼筋網, Reinforcement Mesh", nameEn: "Reinforcement Mesh", image: "/assets/prod-mesh.webp", count: 12, unit: "sheet", base: 100, supplier: "Mattex", specs: ["Type: reinforcement mesh", "Size: 2.1m × 4.8m / custom", "Standard: BS4483 / BS4449", "Use: road / slab"] },
  { id: "safety-net", name: "密目防燃安全網, Dense Mesh Flame Retardant Safety Net", nameEn: "Dense Mesh Flame Retardant Safety Net", image: "/assets/prod-safetynet.webp", count: 7, unit: "sheet", base: 100, supplier: "Mattex", specs: ["Type: dense mesh FR net", "Color: green / orange", "Use: edge protection", "Stock: HK / site lead"] },
  { id: "gypsum-block", name: "石膏磚, Gypsum Block", nameEn: "Gypsum Block", image: "/assets/type-gypsum.webp?v=20260929b", count: 3, unit: "m²", base: 100, supplier: "Mattex", specs: ["Material: gypsum block", "Size: 500 mm series", "Density: 1100–1200 kg/m³", "Use: partition"] },
  { id: "xps-foam-board", name: "擠塑板, XPS Foam Board", nameEn: "XPS Foam Board", image: "/assets/type-xps.webp?v=20260929c", count: 21, unit: "sheet", base: 100, supplier: "Mattex", specs: ["Type: XPS foam board", "Grade: JL150–JL900", "Thickness: 50–100 mm", "Fire: B1 / B2"] },
  { id: "tiles", name: "瓷磚, Tiles", nameEn: "Tiles", image: "/assets/prod-tile.webp", count: 152, unit: "m²", base: 100, supplier: "Mattex", specs: ["Material: sintered stone / porcelain", "Size: 600×600–1200×3000", "Finish: marble / texture / artistic", "Use: floor / wall"] },
  { id: "vinyl", name: "膠地板, Vinyl", nameEn: "Vinyl", image: "/assets/type-vinyl.webp?v=20260929d", count: 2, unit: "m²", base: 100, supplier: "Mattex", specs: ["Type: homogeneous / heterogeneous vinyl", "Size: 2×20 m", "Thickness: 2–3 mm", "Use: flooring"] },
  { id: "precasted-concrete", name: "預製混凝土, Precasted Concrete", nameEn: "Precasted Concrete", image: "/assets/prod-precast.webp", count: 40, unit: "m³", base: 100, supplier: "Mattex", specs: ["Type: precast block", "Size: modular / custom", "Finish: structural", "Use: civil / building"] },
  { id: "cat-ladder", name: "貓梯, Cat Ladder", nameEn: "Cat Ladder", image: "/assets/type-ladder.webp?v=20260929b", count: 1, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: cat ladder", "Finish: galvanized", "Custom: by drawing"] },
  { id: "steel-shelving", name: "貨台同鋼層架, Logistics Storage Platform & Steel Shelving", nameEn: "Logistics Storage Platform & Steel Shelving", image: "/assets/prod-ironwork.webp", count: 1, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: storage platform / shelving", "Custom: by drawing"] },
  { id: "handrails", name: "扶手, Handrails", nameEn: "Handrails", image: "/assets/type-balustrade-alt.webp?v=20260929d", count: 1, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: ball joint handrail", "Custom: by drawing"] },
  { id: "balustrades", name: "欄河, Balustrades", nameEn: "Balustrades", image: "/assets/type-balustrade.webp?v=20260929d", count: 4, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: carbon / stainless / disability", "Custom: by drawing"] },
  { id: "forge-welded-grating", name: "焊接鋼格板, Forge-welded Grating", nameEn: "Forge-welded Grating", image: "/assets/type-channel.webp?v=20260929b", count: 5, unit: "m²", base: 100, supplier: "Mattex", specs: ["Type: forge-welded", "Material: galvanized steel", "Load: by drawing"] },
  { id: "press-lock-grating", name: "壓鎖鋼格板, Press-Lock Grating", nameEn: "Press-Lock Grating", image: "/assets/type-channel.webp?v=20260929b", count: 6, unit: "m²", base: 100, supplier: "Mattex", specs: ["Type: press-lock", "Material: galvanized steel", "Load: by drawing"] },
  { id: "gu-gratings", name: "GU型去水溝蓋, GU Type Drainage Gratings", nameEn: "GU Type Drainage Gratings", image: "/assets/type-gully.webp?v=20260929b", count: 15, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: GU drainage grating", "Material: galvanized steel"] },
  { id: "gt-gratings", name: "GT型去水溝蓋, GT Type Drainage Gratings", nameEn: "GT Type Drainage Gratings", image: "/assets/type-gully.webp?v=20260929b", count: 24, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: GT drainage grating", "Material: galvanized steel"] },
  { id: "gypsum-board", name: "石膏板, Gypsum Board", nameEn: "Gypsum Board", image: "/assets/prod-gypsum-board.webp", count: 4, unit: "m²", base: 100, supplier: "Mattex", specs: ["Type: fire-resistant gypsum board", "Size: 1220×2440", "Thickness: 9.5–15 mm"] },
  { id: "oxygen-chamber", name: "氧氣艙, Oxygen Chamber", nameEn: "Oxygen Chamber", image: "/assets/type-oxygen.webp?v=20260929b", count: 9, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: oxygen chamber", "Use: medical / site"] },
  { id: "dowel-bar", name: "傳力桿, Dowel Bar", nameEn: "Dowel Bar", image: "/assets/type-dowel.webp?v=20260929b", count: 27, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: dowel bar", "Material: mild / stainless steel"] },
  { id: "paint", name: "油漆, Paint", nameEn: "Paint", image: "/assets/type-paint.webp?v=20260929b", count: 30, unit: "lot", base: 100, supplier: "Mattex", specs: ["Type: interior / exterior paint"] },
  { id: "raised-access-floors", name: "架空地板, Raised Access Floors", nameEn: "Raised Access Floors", image: "/assets/type-floor.webp?v=20260929e", count: 17, unit: "m²", base: 100, supplier: "Mattex", specs: ["Type: raised access floor"] },
  { id: "aluminum-cladding", name: "鋁板飾面, Aluminum Cladding", nameEn: "Aluminum Cladding", image: "/assets/type-aluminium.webp?v=20260929b", count: 13, unit: "m²", base: 100, supplier: "Mattex", specs: ["Type: aluminum cladding"] },
  { id: "cable", name: "電線電纜, Cable", nameEn: "Cable", image: "/assets/type-cable.webp?v=20260929b", count: 5, unit: "m", base: 100, supplier: "Mattex", specs: ["Type: power cable"] },
  { id: "shoe-washing-machines", name: "洗鞋機, Shoe Washing Machines", nameEn: "Shoe Washing Machines", image: "/assets/type-shoe.webp?v=20260929e", count: 6, unit: "set", base: 100, supplier: "Mattex", specs: ["Type: shoe washing machine"] },
  { id: "service", name: "Service", nameEn: "Service", image: "/assets/sensor.webp", count: 3, unit: "lot", base: 1800, supplier: "SiteServe Contracting", specs: ["Type: survey / install / inspect", "Scope: labour + report", "Lead: scheduled", "Use: site support"] },
  { id: "computer", name: "Computer", nameEn: "Computer", image: "/assets/plc.webp", count: 3, unit: "pc", base: 920, supplier: "BuildIT Workstations", specs: ["Type: desktop / rugged laptop", "OS: Windows", "Use: site office / BIM", "Warranty: 3 year"] },
  { id: "hardware", name: "Hardware", nameEn: "Hardware", image: "/assets/gearbox.webp", count: 4, unit: "pack", base: 48, supplier: "FixRight Hardware Co.", specs: ["Type: fixings / tools", "Grade: commercial", "Finish: zinc / stainless", "Use: install"] },
  { id: "software", name: "Software", nameEn: "Software", image: "/assets/vfd.webp", count: 14, unit: "license", base: 240, supplier: "Mattex", specs: ["Type: construction software / platform", "Term: project / annual", "Use: site management / safety / BIM"] },
];

const ALT_SUPPLIERS = {
  precast: ["Harbor Precast Co.", "Bayform Concrete Systems"],
  barriers: ["SafeRoute Barriers Ltd.", "LaneLock Civil Products"],
  brick: ["Redclay Masonry Works", "BlockHouse Materials"],
  waterproof: ["AquaShield Membranes", "SealSpan Roofing Tech"],
  manhole: ["DrainCore Industrial"],
  insulation: ["ThermoWrap Building Systems", "EcoEnvelope Insulation"],
  plaster: ["FinishLine Plasters", "WallReady Coatings"],
  safetynet: ["SiteGuard Safety Gear", "EdgePro Construction Safety"],
  steel: ["Northspan Steel Group", "MetroFab Structural"],
  tile: ["Stoneform Ceramics", "SurfaceCraft Tile Co."],
  timber: ["Pacific Timber Supply", "GreenBeam Wood Products"],
  board: ["PanelCraft Interiors", "SheetLine Building Boards"],
  aggregate: ["QuarryPeak Aggregates", "RecycleBase Materials"],
  pipe: ["Flowline Pipe & Fittings", "HydroLink Plumbing Supply"],
  cable: ["VoltTray Electrical", "ConduitMax Systems"],
  service: ["SiteServe Contracting", "FieldLine Site Services"],
  computer: ["BuildIT Workstations", "SiteDesk Computing"],
  hardware: ["FixRight Hardware Co.", "BoltHouse Fasteners"],
};
const FEATURED_NAMES = {
  "precast-01": "Hollow-core Precast Slab",
  "barriers-01": "Jersey Concrete Barrier",
  "brick-01": "Clay Facing Brick Pack",
  "waterproof-01": "Torch-on Waterproof Membrane",
  "steel-01": "UB Structural Steel Beam",
  "insulation-01": "High-R PIR Insulation Board",
  "timber-01": "FSC-Certified Structural Plywood",
  "aggregate-01": "Recycled Concrete Aggregate",
  "board-01": "Low-VOC Gypsum Board",
  "tile-01": "Low-Carbon Porcelain Tile",
  "service-01": "Site Survey & Setting-out",
  "computer-01": "Rugged Site Workstation",
  "hardware-01": "Structural Fixings Kit",
  "software-01": "BIM Coordination License",
};

const GREEN_PRODUCT_IDS = new Set();

const SAMPLE_PROJECTS = [
  "Kai Tak Tower",
  "Tsuen Wan Station Fit-out",
  "Central Harbourfront",
  "HKIA 3RS",
];

const GREEN_BLURBS = {
  "timber-01": "FSC-certified plywood for responsible structural framing.",
  "timber-02": "Responsibly sourced timber sheet for fit-out and formwork.",
  "aggregate-01": "Recycled aggregate that reduces virgin quarry demand.",
  "waterproof-02": "Long-life membrane that reduces rework and waste.",
};

const CATEGORY_BLURBS = {
  precast: "Precast concrete blocks and custom units, quote-ready from Mattex.",
  barriers: "Concrete barrier unit for temporary or permanent works.",
  brick: "Gypsum partition blocks, 500 mm series, quote-ready from Mattex.",
  waterproof: "Torch-on or self-adhesive membrane for roof and basement.",
  manhole: "Forge-welded, press-lock, GU and GT drainage gratings.",
  insulation: "JL series XPS foam board, 50–100 mm, quote-ready from Mattex.",
  plaster: "25 kg skim or base coat for indoor and outdoor finishing.",
  safetynet: "Dense mesh flame-retardant safety nets in site sizes.",
  steel: "Reinforcement mesh, cat ladders, handrails and balustrades.",
  tile: "Sintered stone, porcelain tile and homogeneous vinyl flooring.",
  timber: "Structural plywood sheet for framing, fit-out, and formwork.",
  board: "Fire-resistant gypsum board 9.5–15 mm.",
  aggregate: "Washed crushed stone or sand for concrete and fill.",
  pipe: "UPVC or steel pipe with fittings, DN15–DN200.",
  cable: "Galvanized tray or trunking for electrical containment.",
  service: "Scheduled site service lot with labour and report.",
  computer: "Rugged workstation for site office and BIM coordination.",
  hardware: "Commercial fixings pack for install and assembly.",
  software: "Named annual license for takeoff, BIM, and RFQ.",
};

const CATEGORY_STANDARDS = {
  precast: "ISO 9001:2015",
  barriers: "BS EN 1317-2:2010",
  brick: "ISO 9001:2015",
  waterproof: "BS EN 13707:2013",
  manhole: "ISO 9001:2015",
  insulation: "ISO 9001:2015",
  plaster: "BS EN 998-1:2016",
  safetynet: "GB 5725-2009",
  steel: "BS4483:2005",
  tile: "ISO 9001:2015",
  timber: "BS EN 636:2012",
  board: "ISO 9001:2015",
  aggregate: "BS EN 12620:2013",
  pipe: "BS EN 1401-1:2019",
  cable: "BS EN 61537:2007",
  service: "ISO 9001:2015",
  computer: "IEC 60950-1",
  hardware: "BS EN 10204:2004",
  software: "ISO/IEC 27001:2022",
};

const CATEGORY_PREFIX = {
  precast: "PC",
  barriers: "BR",
  brick: "BK",
  waterproof: "WP",
  manhole: "MH",
  insulation: "IN",
  plaster: "PL",
  safetynet: "SN",
  steel: "ST",
  tile: "TL",
  timber: "TB",
  board: "BD",
  aggregate: "AG",
  pipe: "PF",
  cable: "CB",
  service: "SV",
  computer: "CP",
  hardware: "HW",
  software: "SW",
};

const UNIT_MOQ = {
  panel: 4,
  unit: 2,
  pack: 10,
  roll: 5,
  set: 1,
  bag: 20,
  pc: 1,
  box: 10,
  sheet: 8,
  ton: 5,
  length: 10,
  lot: 1,
  license: 1,
  m: 1,
  m2: 1,
  m3: 1,
  "m²": 1,
  "m³": 1,
};

const STOCK_I18N = {
  in_stock: "stockInStock",
  limited: "stockLimited",
  made_to_order: "stockMadeToOrder",
  out_of_stock: "stockOutOfStock",
};

function stockStatusFor(index, price) {
  if (price == null) return index % 2 === 0 ? "made_to_order" : "limited";
  if (index % 11 === 0) return "out_of_stock";
  if (index % 7 === 0) return "made_to_order";
  if (index % 4 === 0) return "limited";
  return "in_stock";
}

function leadTimeFor(status, index) {
  if (status === "out_of_stock") return { min: 21, max: 28 };
  if (status === "made_to_order") return index % 2 === 0 ? { min: 14, max: 14 } : { min: 14, max: 21 };
  if (status === "limited") return { min: 7, max: 7 };
  return index % 3 === 0 ? { min: 3, max: 3 } : { min: 7, max: 7 };
}

function stockStatusKey(status) {
  return STOCK_I18N[status] || "stockInStock";
}

function isDiscontinued(product) {
  return Boolean(product?.discontinued);
}

function isBuyerVisible(product) {
  if (!product || product.deleted) return false;
  if (product.published === false) return false;
  if (product.held) return false;
  return true;
}

function isOrderable(product) {
  return isBuyerVisible(product) && !isDiscontinued(product);
}

function purposesFromProduct(product) {
  if (Array.isArray(product?.purposes) && product.purposes.length) {
    return product.purposes.map((term) => String(term).trim()).filter(Boolean);
  }
  return (Array.isArray(product?.specs) ? product.specs : [])
    .filter((line) => /^use:/i.test(String(line)))
    .map((line) => String(line).replace(/^use:\s*/i, "").trim())
    .filter(Boolean);
}

function normalizeProductRecord(product) {
  if (!product) return product;
  return {
    ...product,
    published: product.published !== false,
    held: Boolean(product.held),
    deleted: Boolean(product.deleted),
    discontinued: Boolean(product.discontinued),
    provisionalSku: product.provisionalSku || "",
    imageSource: product.imageSource || (product.image ? "upload" : "generated"),
    purposes: purposesFromProduct(product),
    sizeDesc: product.sizeDesc || product.description || "",
    certifications: product.certifications || product.standard || "",
    primarySpec: product.primarySpec || "",
    salesUnit: product.salesUnit || product.unit || "",
    remark: product.remark || "",
    needsChainImage: Boolean(product.needsChainImage),
    tailorMade: Boolean(product.tailorMade),
    image: String(product.imageUrl || product.image || "").startsWith("http")
      ? product.imageUrl || product.image
      : product.image || product.imageUrl || "",
    images: Array.isArray(product.images) && product.images.length
      ? product.images.filter(Boolean).slice(0, 5)
      : (product.imageUrl || product.image ? [product.imageUrl || product.image] : []),
    certFiles: Array.isArray(product.certFiles) ? product.certFiles : [],
    createdAt: Number(product.createdAt) > 0 ? Number(product.createdAt) : product.createdAt || 0,
  };
}

function activeCatalog(list) {
  return (list || []).filter((p) => !isDiscontinued(p) && isBuyerVisible(p));
}

function canDirectBuy(product) {
  if (isDiscontinued(product)) return false;
  return getEffectivePrice(product).displayPrice != null;
}

function quoteFor(i, price, isGreen) {
  if (price == null) return null;
  const listPrice = Math.round(price * 1.12 * 100) / 100;
  if (isGreen || i % 2 === 1) {
    let validUntil = "2026-11-17";
    if (i % 8 === 1) validUntil = "2026-08-24";
    else if (i % 5 === 0) validUntil = "2026-09-10";
    return { unitPrice: price, listPrice, validUntil, months: 3 };
  }
  if (i % 6 === 2) {
    return {
      unitPrice: Math.round(price * 0.9 * 100) / 100,
      listPrice: price,
      validUntil: "2026-06-30",
      months: 3,
    };
  }
  if (i % 9 === 4) {
    return { unitPrice: price, listPrice: null, validUntil: "2026-05-15", months: 3 };
  }
  return null;
}

function withMattexDemoPrice(product) {
  const seed = hashSeed(product.id);
  const stockStatus = product.stockStatus || stockStatusFor(seed % 11, null);
  return {
    ...product,
    price: null,
    quote: null,
    stockStatus,
    leadTime: product.leadTime || leadTimeFor(stockStatus, seed % 11),
  };
}

function isHitProduct(product) {
  return Boolean(product && (product.hit || product.featuredRank != null));
}

function withHitFlag(product) {
  if (product.featuredRank != null) return { ...product, hit: true };
  const seed = hashSeed(product.id);
  if (seed % 7 === 0) return { ...product, hit: true };
  return { ...product, hit: Boolean(product.hit) };
}

function applyMattexDemoPrices(list) {
  const out = list.map((p) => {
    const next = withHitFlag({ ...withMattexDemoPrice(p), sales: true });
    if (p.featuredRank != null) return next;
    const seed = hashSeed(p.id);
    if (seed % 73 !== 0) return next;
    return { ...next, discontinued: true };
  });
  return out;
}

function isQuoteActive(quote) {
  if (!quote?.validUntil) return false;
  const end = new Date(`${quote.validUntil}T23:59:59`);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() >= Date.now();
}

function getEffectivePrice(product) {
  if (!product) return { displayPrice: null, status: "none", quote: null };
  return { displayPrice: null, status: "none", quote: null };
}

function formatQuoteDate(iso, lang) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "zh" ? "zh-HK" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatQuoteDateShort(iso, lang) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "zh" ? "zh-HK" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

const CUSTOM_CATEGORIES_KEY = "subbie_custom_categories";
const CATEGORY_ADMIN_KEY = "subbie_admin_categories";

function getCategoryAdminMeta() {
  const raw = readJson(CATEGORY_ADMIN_KEY, {});
  return {
    names: raw?.names && typeof raw.names === "object" ? raw.names : {},
    hidden: Array.isArray(raw?.hidden) ? raw.hidden.map(String) : [],
  };
}

function writeCategoryAdminMeta(meta) {
  writeJson(CATEGORY_ADMIN_KEY, {
    names: meta.names && typeof meta.names === "object" ? meta.names : {},
    hidden: Array.isArray(meta.hidden) ? meta.hidden : [],
  });
}

function buildProducts() {
  return [];
}

function categoryKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function categoryAliases(def) {
  const names = [def?.name, def?.nameEn];
  if (def?.name && String(def.name).includes(",")) {
    const parts = String(def.name).split(",");
    names.push(parts[0].trim(), parts.slice(1).join(",").trim());
  }
  return [...new Set(names.map((n) => String(n || "").trim()).filter(Boolean))];
}

function findCategoryDef(name) {
  const n = categoryKey(name);
  if (!n) return null;
  const fromVisible = visibleCategoryDefs().find((c) => categoryAliases(c).some((alias) => categoryKey(alias) === n));
  if (fromVisible) return fromVisible;
  return CATEGORY_DEFS.find((c) => categoryAliases(c).some((alias) => categoryKey(alias) === n)) || null;
}

function categoryPieces(name) {
  const raw = String(name || "").trim();
  if (!raw) return [];
  const parts = raw.split(",");
  const pieces = [raw];
  if (parts.length > 1) pieces.push(parts[0].trim(), parts.slice(1).join(",").trim());
  return pieces;
}

function productInNamedCategory(product, nameOrDef) {
  const def = nameOrDef && typeof nameOrDef === "object" && nameOrDef.id ? nameOrDef : findCategoryDef(nameOrDef);
  const productPieces = new Set(categoryPieces(product?.category).map(categoryKey));
  if (!def) return productPieces.has(categoryKey(nameOrDef));
  return categoryAliases(def).some((alias) => productPieces.has(categoryKey(alias)));
}

function categoryIdFromName(name) {
  return findCategoryDef(name)?.id || "";
}

let PRODUCTS = buildProducts().map(normalizeProductRecord);

const CATEGORIES = CATEGORY_DEFS.map((c) => c.name);

function getCustomCategories() {
  const list = readJson(CUSTOM_CATEGORIES_KEY, []);
  const valid = Array.isArray(list) ? list.filter((c) => c && c.id && c.name) : [];
  const cleaned = valid.filter((c) => String(c.id) !== "234");
  if (cleaned.length !== valid.length) writeJson(CUSTOM_CATEGORIES_KEY, cleaned);
  return cleaned;
}

function visibleCategoryDefs() {
  const meta = getCategoryAdminMeta();
  const hidden = new Set([...HIDDEN_CATEGORY_IDS, ...meta.hidden]);
  const seen = new Set(CATEGORY_DEFS.map((c) => c.id));
  const extra = getCustomCategories().filter((c) => !seen.has(c.id) && !hidden.has(c.id));
  return [...CATEGORY_DEFS, ...extra]
    .filter((c) => !hidden.has(c.id))
    .map((c) => ({ ...c, name: meta.names[c.id] || c.name }));
}

function getCategoryDefs() {
  const defs = visibleCategoryDefs();
  const aliasToId = new Map();
  for (const def of defs) {
    for (const alias of categoryAliases(def)) {
      const key = categoryKey(alias);
      if (key && !aliasToId.has(key)) aliasToId.set(key, def.id);
    }
  }
  const counts = Object.create(null);
  for (const def of defs) counts[def.id] = 0;
  for (const product of activeCatalog(PRODUCTS)) {
    for (const piece of categoryPieces(product?.category)) {
      const id = aliasToId.get(categoryKey(piece));
      if (id == null) continue;
      counts[id] += 1;
      break;
    }
  }
  return defs.map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image || "/assets/prod-mesh.webp",
    count: counts[c.id] || 0,
    custom: Boolean(c.custom),
  }));
}

function getCategories() {
  return visibleCategoryDefs().map((c) => c.name);
}

function getAdminCategories() {
  return getCategories();
}

function matchAdminCategory(name) {
  const found = findCategoryDef(name);
  if (found) return found.name;
  const n = categoryKey(name);
  return getAdminCategories().find((c) => categoryKey(c) === n) || null;
}

function slugifyCategory(name) {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `cat-${Date.now()}`;
}

function addAdminCategory(name) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const nextName = String(name || "").trim();
  if (!nextName) return { ok: false, error: "name" };
  const exists = getAdminCategories().some((c) => c.toLowerCase() === nextName.toLowerCase());
  if (exists) return { ok: false, error: "exists" };
  const list = getCustomCategories();
  let id = slugifyCategory(nextName);
  const used = new Set([...CATEGORY_DEFS.map((c) => c.id), ...list.map((c) => c.id), ...getCategoryAdminMeta().hidden]);
  if (used.has(id)) id = `${id}-${Date.now().toString(36)}`;
  list.push({ id, name: nextName, image: "/assets/prod-mesh.webp", custom: true });
  writeJson(CUSTOM_CATEGORIES_KEY, list);
  emitStoreChange();
  return { ok: true, category: { id, name: nextName } };
}

function adminProductsInCategory(name) {
  return PRODUCTS.filter((p) => productInNamedCategory(p, name));
}

function listAdminCategories() {
  return visibleCategoryDefs().map((c) => {
    const products = adminProductsInCategory(c.name);
    return {
      id: c.id,
      name: c.name,
      image: c.image || "/assets/prod-mesh.webp",
      custom: Boolean(c.custom),
      count: products.length,
      deletedCount: products.filter((p) => p.deleted).length,
    };
  });
}

function renameAdminCategory(id, name) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const nextName = String(name || "").trim();
  if (!nextName) return { ok: false, error: "name" };
  const current = visibleCategoryDefs().find((c) => c.id === id);
  if (!current) return { ok: false, error: "missing" };
  const clash = getAdminCategories().some((c) => c.toLowerCase() === nextName.toLowerCase() && c.toLowerCase() !== current.name.toLowerCase());
  if (clash) return { ok: false, error: "exists" };
  if (nextName === current.name) return { ok: true, category: { id, name: nextName } };
  const custom = getCustomCategories();
  const customRow = custom.find((c) => c.id === id);
  if (customRow) {
    customRow.name = nextName;
    writeJson(CUSTOM_CATEGORIES_KEY, custom);
  } else {
    const meta = getCategoryAdminMeta();
    meta.names = { ...meta.names, [id]: nextName };
    writeCategoryAdminMeta(meta);
  }
  PRODUCTS.forEach((p) => {
    if (productInNamedCategory(p, current)) p.category = nextName;
  });
  persistProductPatches();
  emitStoreChange();
  return { ok: true, category: { id, name: nextName } };
}

function deleteAdminCategory(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const current = visibleCategoryDefs().find((c) => c.id === id);
  if (!current) return { ok: false, error: "missing" };
  if (adminProductsInCategory(current.name).length) return { ok: false, error: "in_use" };
  const custom = getCustomCategories();
  const customIdx = custom.findIndex((c) => c.id === id);
  if (customIdx >= 0) {
    custom.splice(customIdx, 1);
    writeJson(CUSTOM_CATEGORIES_KEY, custom);
  } else {
    const meta = getCategoryAdminMeta();
    if (!meta.hidden.includes(id)) meta.hidden = [...meta.hidden, id];
    if (meta.names[id]) {
      const nextNames = { ...meta.names };
      delete nextNames[id];
      meta.names = nextNames;
    }
    writeCategoryAdminMeta(meta);
  }
  emitStoreChange();
  return { ok: true };
}

function assignAdminProductsCategory(ids, categoryName) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const category = matchAdminCategory(categoryName);
  if (!category) return { ok: false, error: "category" };
  const idSet = new Set((ids || []).map(String));
  let ok = 0;
  let skipped = 0;
  PRODUCTS.forEach((p) => {
    if (!idSet.has(p.id)) return;
    if (p.deleted) {
      skipped += 1;
      return;
    }
    p.category = category;
    ok += 1;
  });
  if (ok) persistProductPatches();
  emitStoreChange();
  return { ok: true, moved: ok, skipped };
}

function getCategoryBySlug(slug) {
  const id = String(slug || "").trim();
  if (!id || HIDDEN_CATEGORY_IDS.has(id)) return null;
  return getCategoryDefs().find((c) => c.id === id) || null;
}

function getCategoryByName(name) {
  const found = findCategoryDef(name);
  if (!found) return null;
  return getCategoryDefs().find((c) => c.id === found.id) || null;
}

function catalogPathForCategory(nameOrSlug) {
  const found = getCategoryBySlug(nameOrSlug) || getCategoryByName(nameOrSlug);
  return found ? `/catalog/${found.id}` : "/";
}

function getTopProducts(limit) {
  const n = limit || 5;
  return activeCatalog(PRODUCTS)
    .filter((p) => p.featuredRank != null)
    .sort((a, b) => a.featuredRank - b.featuredRank)
    .slice(0, n);
}

function getGreenProducts(limit) {
  const list = activeCatalog(PRODUCTS).filter((p) => p.green);
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

function getSalesProducts(limit) {
  const list = activeCatalog(PRODUCTS).filter((p) => p.sales);
  const featured = list
    .filter((p) => p.featuredRank != null)
    .sort((a, b) => a.featuredRank - b.featuredRank);
  const rest = list.filter((p) => p.featuredRank == null);
  const ordered = featured.concat(rest);
  return typeof limit === "number" ? ordered.slice(0, limit) : ordered;
}

function getProductsByCategory(category) {
  const names = Array.isArray(category)
    ? category.filter(Boolean)
    : !category || category === "all"
      ? []
      : [category];
  const source = activeCatalog(PRODUCTS);
  if (!names.length) return source.slice();
  const defs = names.map((n) => findCategoryDef(n)).filter(Boolean);
  if (!defs.length) {
    const set = new Set(names.map(categoryKey));
    return source.filter((p) => set.has(categoryKey(p.category)));
  }
  return source.filter((p) => defs.some((d) => productInNamedCategory(p, d)));
}

const CATEGORY_SEARCH_TERMS = {
  "Reinforcement Mesh": ["BRC", "welded mesh", "reinforcing mesh", "square mesh", "鋼筋網", "鐵網", "鋼網"],
  "Dense Mesh Flame Retardant Safety Net": ["safety net", "FR net", "debris net", "密目網", "安全網", "阻燃網"],
  "Gypsum Block": ["gypsum block", "partition block", "石膏砌塊", "石膏磚"],
  "XPS Foam Board": ["XPS", "foam board", "insulation board", "擠塑板", "保溫板"],
  "Tiles": ["tile", "sintered stone", "porcelain", "瓷磚", "岩板"],
  "Vinyl": ["vinyl flooring", "PVC floor", "膠地板", "塑膠地板"],
  "Precasted Concrete": ["precast", "precast block", "預製混凝土", "預製件"],
  "Cat Ladder": ["cat ladder", "roof ladder", "貓梯", "爬梯"],
  "Logistics Storage Platform & Steel Shelving": ["steel shelving", "storage platform", "貨架", "鋼架"],
  "Handrails": ["handrail", "ball joint", "扶手"],
  "Balustrades": ["balustrade", "railing", "欄杆", "欄河"],
  "Forge-welded Grating": ["forge-welded grating", "steel grating", "焊接格柵", "鋼格板"],
  "Press-Lock Grating": ["press-lock grating", "pressure locked grating", "壓鎖格柵"],
  "GU Type Drainage Gratings": ["GU grating", "drainage grating", "排水溝蓋"],
  "GT Type Drainage Gratings": ["GT grating", "drainage grating", "排水溝蓋"],
  "Gypsum Board": ["plasterboard", "drywall", "石膏板"],
  "Oxygen Chamber": ["oxygen chamber", "hyperbaric", "氧氣艙"],
  "Dowel Bar": ["dowel bar", "傳力桿", "銷釘"],
  "Paint": ["paint", "coating", "油漆", "乳膠漆"],
  "Raised Access Floors": ["raised floor", "access floor", "架空地板"],
  "Aluminum Cladding": ["aluminum cladding", "aluminium cladding", "鋁板", "幕牆"],
  "Cable": ["cable", "power cable", "電線", "電纜"],
  "Shoe Washing Machines": ["shoe washing", "洗鞋機"],
  "Software": ["license", "BIM", "軟件授權"],
};

function categorySearchTerms(product) {
  const def = findCategoryDef(product?.category);
  const en = def?.nameEn || product?.category;
  return CATEGORY_SEARCH_TERMS[en] || CATEGORY_SEARCH_TERMS[product?.category] || [];
}

function getProductRemarks(product) {
  if (!product) return [];
  if (Array.isArray(product.remarks) && product.remarks.length) {
    return product.remarks.map((term) => String(term).trim()).filter(Boolean);
  }
  const fromPurposes = purposesFromProduct(product);
  const fromCat = categorySearchTerms(product);
  const extra = [product.productNo, product.provisionalSku, product.standard].filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const term of [...fromPurposes, ...fromCat, ...extra]) {
    const key = String(term).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(String(term));
  }
  return out;
}

function productSearchBlob(product) {
  const specs = Array.isArray(product.specs) ? product.specs.join(" ") : "";
  return [
    product.id,
    product.productNo,
    product.provisionalSku,
    product.name,
    product.category,
    product.supplier,
    product.description,
    product.sizeDesc,
    product.primarySpec,
    product.certifications,
    product.standard,
    product.stockStatus,
    specs,
    getProductRemarks(product).join(" "),
    (product.purposes || []).join(" "),
    "price upon request quote",
    product.green ? "green eco sustainable low-carbon fsc recycled" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const SEARCH_FIELD_KEYS = ["name", "category", "sku", "spec", "supplier", "remarks"];

function productSearchText(product, fields) {
  const selected = Array.isArray(fields) ? fields.filter((f) => SEARCH_FIELD_KEYS.includes(f)) : [];
  if (!selected.length || selected.length === SEARCH_FIELD_KEYS.length) {
    return productSearchBlob(product);
  }
  const specs = Array.isArray(product.specs) ? product.specs.join(" ") : "";
  const parts = [];
  if (selected.includes("name")) parts.push(product.name);
  if (selected.includes("category")) parts.push(product.category);
  if (selected.includes("sku")) parts.push(product.productNo, product.provisionalSku, product.id);
  if (selected.includes("spec")) {
    parts.push(specs, product.standard, product.description, product.sizeDesc, product.primarySpec, product.certifications);
  }
  if (selected.includes("supplier")) parts.push(product.supplier);
  if (selected.includes("remarks")) parts.push(getProductRemarks(product).join(" "), (product.purposes || []).join(" "));
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function searchProducts(query, category, options = {}) {
  const base = getProductsByCategory(category);
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return base;
  const tokens = q.split(/\s+/).filter(Boolean);
  return base.filter((p) => {
    const blob = productSearchText(p, options.fields);
    return tokens.every((token) => blob.includes(token));
  });
}

function searchProductsUnion(queries, category, options = {}) {
  const seen = new Set();
  const out = [];
  for (const raw of queries || []) {
    const hits = searchProducts(raw, category, options);
    for (const product of hits) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      out.push(product);
    }
  }
  return out;
}

function tokenizeMatch(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((token) => token.length >= 2);
}

function suggestCatalogMatch(item) {
  const nameTokens = tokenizeMatch(item?.name);
  const specTokens = tokenizeMatch(item?.spec);
  const category = String(item?.category || "").toLowerCase();
  if (!nameTokens.length && !specTokens.length) return null;
  let best = null;
  let bestScore = 0;
  for (const product of activeCatalog(PRODUCTS)) {
    const name = String(product.name || "").toLowerCase();
    const blob = [
      name,
      product.productNo,
      product.id,
      product.category,
      product.description,
      Array.isArray(product.specs) ? product.specs.join(" ") : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const token of nameTokens) {
      if (name.includes(token)) score += 4;
      else if (blob.includes(token)) score += 1;
    }
    for (const token of specTokens) {
      if (blob.includes(token)) score += 2;
    }
    if (category && String(product.category || "").toLowerCase() === category) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }
  if (!best || bestScore < 4) return null;
  return {
    id: best.id,
    name: best.name,
    productNo: best.productNo,
    category: best.category,
    image: best.image,
  };
}

function getProductsByIds(ids) {
  const set = new Set((ids || []).map(String));
  return activeCatalog(PRODUCTS).filter((p) => set.has(String(p.id)));
}

function supplierSlug(name) {
  const raw = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (raw === "mattex" || raw.startsWith("mattex-")) return "mattex";
  return raw;
}

function supplierPath(name) {
  return `/supplier/${supplierSlug(name)}`;
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SUPPLIER_LOGO_PALETTES = [
  { bg: "#245A41", fg: "#F3F8F5", accent: "#8FCB9B" },
  { bg: "#1B4633", fg: "#E8F0EA", accent: "#C5DCC8" },
  { bg: "#2C4A3E", fg: "#F6F7F5", accent: "#6BAF86" },
  { bg: "#101513", fg: "#DCECE2", accent: "#4F8F6C" },
  { bg: "#3D5348", fg: "#F1F7F3", accent: "#A9C9B4" },
  { bg: "#1E3A4C", fg: "#E8F2F0", accent: "#7EB8B0" },
  { bg: "#4A4033", fg: "#F7F1E8", accent: "#C4B08A" },
  { bg: "#3A2F45", fg: "#F3EEF6", accent: "#B7A2C9" },
];

function supplierInitials(name) {
  const parts = String(name || "S")
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(parts[0] || "S").slice(0, 2).toUpperCase();
}

function supplierBrand(name) {
  const seed = hashSeed(name || "supplier");
  const palette = SUPPLIER_LOGO_PALETTES[seed % SUPPLIER_LOGO_PALETTES.length];
  return {
    initials: supplierInitials(name),
    variant: seed % 5,
    ...palette,
  };
}

const SUPPLIER_BANKS = [
  { bank: "The Hongkong and Shanghai Banking Corporation", short: "HSBC", swift: "HSBCHKHHHKH", code: "004" },
  { bank: "Hang Seng Bank Limited", short: "Hang Seng", swift: "HASEHKHHXXX", code: "024" },
  { bank: "Bank of China (Hong Kong) Limited", short: "BOCHK", swift: "BKCHHKHHXXX", code: "012" },
];

function buildSupplierBankInfo(name) {
  const seed = hashSeed(name || "supplier");
  const bank = SUPPLIER_BANKS[seed % SUPPLIER_BANKS.length];
  const branch = String(100 + (seed % 800));
  const account = String(100000 + ((seed >> 2) % 900000));
  return {
    supplierName: name,
    bankName: bank.bank,
    bankShort: bank.short,
    bankCode: bank.code,
    swift: bank.swift,
    accountName: String(name || "Supplier").toUpperCase(),
    accountNumber: `${bank.code}-${branch}-${account}`,
    fpsId: String(80000000 + (seed % 19999999)),
    currency: "HKD",
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function buildSupplierMetrics(slug) {
  const seed = hashSeed(slug || "supplier");
  const subbieRating = clamp(4.2 + (seed % 8) / 10, 3.8, 5);
  const buyerRating = clamp(3.9 + ((seed >> 2) % 10) / 10, 3.6, 5);
  const subbieOrders = 90 + (seed % 240);
  const buyerReviews = 28 + ((seed >> 1) % 110);
  const subbieComplete = clamp(91 + (seed % 9), 88, 99);
  const buyerComplete = clamp(88 + ((seed >> 4) % 11), 85, 99);
  const subbieOnTime = clamp(87 + ((seed >> 3) % 12), 84, 99);
  const buyerOnTime = clamp(84 + ((seed >> 5) % 14), 80, 98);
  const weight = subbieOrders + buyerReviews;
  const searches = 640 + (seed % 2100);
  const found = Math.round(searches * (0.28 + ((seed >> 3) % 18) / 100));
  const rfqs = Math.max(8, Math.round(found * (0.08 + ((seed >> 5) % 10) / 100)));
  return {
    rating: Math.round(((subbieRating * subbieOrders + buyerRating * buyerReviews) / weight) * 10) / 10,
    completionRate: Math.round((subbieComplete + buyerComplete) / 2),
    onTimeRate: Math.round((subbieOnTime + buyerOnTime) / 2),
    searchCount: searches,
    foundCount: found,
    rfqCount: rfqs,
  };
}

function getProductRating() {
  return { rating: 0, reviews: 0, empty: true };
}

const SUPPLIER_DISPLAY_NAMES = {
  Mattex: "Mattex Asia Development Limited",
};

function supplierDisplayName(name) {
  return SUPPLIER_DISPLAY_NAMES[name] || name || "";
}

function isMattexSupplier(name) {
  const slug = supplierSlug(name);
  return slug === "mattex" || slug.startsWith("mattex-") || /\bmattex\b/i.test(String(name || ""));
}

const supplierMetricsBySlug = new Map();

function emptySupplierMetrics() {
  return {
    rating: 0,
    completionRate: 0,
    onTimeRate: 0,
    searchCount: 0,
    foundCount: 0,
    rfqCount: 0,
    empty: true,
  };
}

function metricsForSlug(slug) {
  return supplierMetricsBySlug.get(slug) || emptySupplierMetrics();
}

function mergeDraftMaps(local, remote) {
  const out = remote && typeof remote === "object" ? { ...remote } : {};
  const src = local && typeof local === "object" ? local : {};
  for (const [key, draft] of Object.entries(src)) {
    const localLines = Array.isArray(draft?.lines) ? draft.lines.length : 0;
    const remoteLines = Array.isArray(out[key]?.lines) ? out[key].lines.length : 0;
    if (localLines && localLines >= remoteLines) out[key] = draft;
  }
  return out;
}

function rfqProgress(rfq) {
  if (rfq?.cancelStatus === "accepted" || rfq?.reviewStatus === "cancelled") return 80;
  if (rfq?.reviewStatus === "revising") return 55;
  if (rfq?.reverseStatus === "requested" || rfq?.cancelStatus === "requested") return 52;
  const status = rfq?.reviewStatus || rfq?.status || "";
  return (
    {
      accepted: 50,
      quoted: 40,
      reviewing: 30,
      returned: 25,
      no_offer: 20,
      rejected: 20,
      received: 10,
      whatsapp_sent: 10,
      email_sent: 10,
      submitted: 10,
    }[status] || 0
  );
}

function rfqPickStamp(rfq) {
  let max = 0;
  const consider = (iso) => {
    const n = Date.parse(iso || "") || 0;
    if (n > max) max = n;
  };
  consider(rfq?.submittedAt);
  consider(rfq?.acceptedAt);
  consider(rfq?.resubmittedAt);
  consider(rfq?.reverseRequestedAt);
  consider(rfq?.reverseDeclinedAt);
  consider(rfq?.cancelledAt);
  consider(rfq?.cancelRequestedAt);
  consider(rfq?.quotedAt);
  consider(rfq?.noOfferAt);
  (Array.isArray(rfq?.activity) ? rfq.activity : []).forEach((row) => consider(row?.at));
  return max;
}

function pickRfq(a, b) {
  if (!a) return b;
  if (!b) return a;
  const tb = rfqPickStamp(b);
  const ta = rfqPickStamp(a);
  if (tb !== ta) return tb > ta ? b : a;
  const ra = rfqProgress(a);
  const rb = rfqProgress(b);
  if (rb !== ra) return rb > ra ? b : a;
  return JSON.stringify(b).length >= JSON.stringify(a).length ? b : a;
}

function mergeRfqMaps(local, remote) {
  const keys = new Set([
    ...Object.keys(remote && typeof remote === "object" ? remote : {}),
    ...Object.keys(local && typeof local === "object" ? local : {}),
  ]);
  const out = {};
  keys.forEach((key) => {
    const byId = new Map();
    [...(Array.isArray(remote?.[key]) ? remote[key] : []), ...(Array.isArray(local?.[key]) ? local[key] : [])].forEach(
      (rfq) => {
        if (!rfq?.id) return;
        byId.set(rfq.id, pickRfq(byId.get(rfq.id), rfq));
      }
    );
    out[key] = [...byId.values()].sort((a, b) => String(b?.submittedAt || "").localeCompare(String(a?.submittedAt || "")));
  });
  return out;
}

function writeLocalOnly(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

function isPortalSurface() {
  // Portal build sets VITE_SURFACE. Prerender and the storefront leave it unset.
  return import.meta.env?.VITE_SURFACE === "admin";
}

async function fetchHostCatalog() {
  if (typeof window === "undefined" || typeof fetch !== "function") return null;
  try {
    const res = await fetch("/catalog.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.products) || !data.products.length) return null;
    return data;
  } catch {
    return null;
  }
}

function applyHostCategoryImages(categories) {
  if (!Array.isArray(categories) || !categories.length) return;
  const builtin = new Set(CATEGORY_DEFS.flatMap((def) => categoryAliases(def).map(categoryKey)));
  const extra = [];
  for (const item of categories) {
    const name = String(item?.name || "").trim();
    if (!name || builtin.has(categoryKey(name))) continue;
    extra.push({
      id: slugifyCategory(name),
      name,
      image: item.image || "/assets/prod-mesh.webp",
      custom: true,
    });
  }
  if (extra.length) writeLocalOnly(CUSTOM_CATEGORIES_KEY, extra);
}

function restoreHostImages(hostImages) {
  for (const product of PRODUCTS) {
    const image = hostImages.get(product.id);
    if (!image || !String(image).startsWith("/assets/")) continue;
    product.image = image;
    product.imageUrl = image;
    product.images = [image];
  }
}

async function publishCatalogProducts(list) {
  const rows = Array.isArray(list) ? list : [];
  const hostImages = new Map(rows.map((row) => [row.id, row.image || row.imageUrl || ""]));
  PRODUCTS.splice(0, PRODUCTS.length);
  const CHUNK = 64;
  let releasedBoot = false;
  const releaseBoot = () => {
    if (releasedBoot) return;
    releasedBoot = true;
    applySavedProductPatches();
    restoreHostImages(hostImages);
    catalogBootReady = true;
    bumpCatalog();
    emitStoreChange();
  };
  for (let i = 0; i < rows.length; i += CHUNK) {
    for (const row of rows.slice(i, i + CHUNK)) {
      PRODUCTS.push(
        normalizeProductRecord({
          ...row,
          imageUrl: row.imageUrl || row.image || "",
        })
      );
    }
    if (i === 0) releaseBoot();
    else {
      bumpCatalog();
      emitStoreChange();
    }
    if (i + CHUNK < rows.length) await yieldToBrowser();
  }
  if (!releasedBoot) releaseBoot();
  applySavedProductPatches();
  restoreHostImages(hostImages);
  catalogLoading = false;
  catalogReady = true;
  catalogBootReady = true;
  bumpCatalog();
  emitStoreChange();
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(resolve, 0));
      return;
    }
    setTimeout(resolve, 0);
  });
}

async function hydrateStore() {
  try {
    catalogLoading = isSupabaseConfigured();
    catalogReady = !catalogLoading;
    if (catalogLoading) emitStoreChange();
    await yieldToBrowser();

    const host = await fetchHostCatalog();
    if (host) {
      applyHostCategoryImages(host.categories);
      await publishCatalogProducts(host.products);
      if (isPortalSurface()) {
        const [stamp, session] = await Promise.all([
          fetchRfqStamp(),
          fetchSessionState({ includeRfqs: false }),
        ]);
        if (session) rfqStamp = stamp;
        if (applySessionState(session)) emitStoreChange();
      }
      return true;
    }

    const remote = await fetchCatalogState(CATALOG_KV_KEYS);
    if (!remote) {
      catalogLoading = false;
      catalogReady = true;
      catalogBootReady = true;
      bumpCatalog();
      emitStoreChange();
      return false;
    }

    const overlayKeys = [
      CUSTOM_CATEGORIES_KEY,
      CATEGORY_ADMIN_KEY,
      REPORTS_KEY,
      ADMIN_ALERTS_KEY,
    ];
    overlayKeys.forEach((key) => {
      if (remote.kv[key] == null) return;
      writeLocalOnly(key, remote.kv[key]);
    });
    if (remote.kv[STAFF_KEY] != null) {
      writeLocalOnly(STAFF_KEY, mergeStaffLists(readJson(STAFF_KEY, []), remote.kv[STAFF_KEY]));
    }
    if (remote.kv[PRODUCT_PATCH_KEY] != null) {
      writeLocalOnly(PRODUCT_PATCH_KEY, mergeProductPatchMaps(readJson(PRODUCT_PATCH_KEY, {}), remote.kv[PRODUCT_PATCH_KEY]));
    }

    await yieldToBrowser();
    const list = Array.isArray(remote.products) ? remote.products : [];
    PRODUCTS.splice(0, PRODUCTS.length);
    const CHUNK = 64;
    let releasedBoot = false;
    const releaseBoot = () => {
      if (releasedBoot) return;
      releasedBoot = true;
      applySavedProductPatches();
      catalogBootReady = true;
      bumpCatalog();
      emitStoreChange();
    };
    for (let i = 0; i < list.length; i += CHUNK) {
      const slice = list.slice(i, i + CHUNK);
      for (const row of slice) {
        PRODUCTS.push(
          normalizeProductRecord({
            ...row,
            imageUrl: row.imageUrl || row.image_url || "",
          })
        );
      }
      if (i === 0) releaseBoot();
      else {
        bumpCatalog();
        emitStoreChange();
      }
      if (i + CHUNK < list.length) await yieldToBrowser();
    }
    if (!releasedBoot) releaseBoot();
    [REPORT_SEQ_KEY, TMP_SEQ_KEY, TMS_SEQ_KEY].forEach((key) => {
      const remoteN = Number(remote.kv[key] || 0);
      let localN = 0;
      try {
        localN = Number(localStorage.getItem(key) || 0);
      } catch {
        localN = 0;
      }
      if (remoteN > localN) {
        try {
          localStorage.setItem(key, String(remoteN));
        } catch {
          /* ignore */
        }
      }
    });
    supplierMetricsBySlug.clear();
    Object.entries(remote.metrics || {}).forEach(([slug, metrics]) => {
      supplierMetricsBySlug.set(slug, metrics);
    });
    if (remote.kv[DELETED_BUYERS_KEY]) mergeDeletedBuyers(remote.kv[DELETED_BUYERS_KEY]);
    if (remote.kv[ACCOUNTS_KEY]) {
      writeLocalOnly(ACCOUNTS_KEY, accountsWithoutSecrets(stripDeletedBuyers({ ...readJson(ACCOUNTS_KEY, {}), ...remote.kv[ACCOUNTS_KEY] })));
    }
    if (remote.kv[QUOTE_SNAPSHOTS_KEY]) {
      writeLocalOnly(QUOTE_SNAPSHOTS_KEY, mergeQuoteSnapshots(remote.kv[QUOTE_SNAPSHOTS_KEY], readJson(QUOTE_SNAPSHOTS_KEY, {})));
    }
    const remoteSeq = Number(remote.kv[SEQ_KEY] || 0);
    let localSeq = 0;
    try {
      localSeq = Number(localStorage.getItem(SEQ_KEY) || 0);
    } catch {
      localSeq = 0;
    }
    if (remoteSeq > localSeq) {
      try {
        localStorage.setItem(SEQ_KEY, String(remoteSeq));
      } catch {
        /* ignore */
      }
    }
    applySavedProductPatches();
    catalogLoading = false;
    catalogReady = true;
    catalogBootReady = true;
    bumpCatalog();
    emitStoreChange();

    if (isPortalSurface()) {
      const [stamp, session] = await Promise.all([
        fetchRfqStamp(),
        fetchSessionState({ includeRfqs: false }),
      ]);
      if (session) rfqStamp = stamp;
      if (applySessionState(session)) emitStoreChange();
    }
    return true;
  } catch (error) {
    console.warn("supabase hydrate", error?.message || error);
    catalogLoading = false;
    catalogReady = true;
    catalogBootReady = true;
    bumpCatalog();
    emitStoreChange();
    return false;
  }
}

function applySessionState(session) {
  if (!session) return false;
  let changed = false;
  if (session.accounts?.length) {
    const buyers = {};
    const staff = [];
    session.accounts.forEach((row) => {
      if (row.kind === "staff") {
        const extra = withoutSecrets(row?.extra && typeof row.extra === "object" ? row.extra : {});
        staff.push({
          ...extra,
          email: row.email,
          name: row.name || extra.name || "",
          enabled: row.enabled !== false,
          bootstrap: Boolean(row.bootstrap || extra.bootstrap),
        });
        return;
      }
      buyers[row.email] = accountFromRow(row);
    });
    if (Object.keys(buyers).length) {
      writeLocalOnly(ACCOUNTS_KEY, accountsWithoutSecrets(stripDeletedBuyers({ ...readJson(ACCOUNTS_KEY, {}), ...buyers })));
      changed = true;
    }
    if (staff.length) {
      writeLocalOnly(STAFF_KEY, mergeStaffLists(readJson(STAFF_KEY, []), staff));
      changed = true;
    }
  }
  const remoteRfqs = mergeRfqMaps(session.rfqs || {}, session.kv?.[RFQS_KEY] || {});
  if (Object.keys(remoteRfqs).length) {
    const merged = mergeRfqMaps(readJson(RFQS_KEY, {}), remoteRfqs);
    if (JSON.stringify(merged) !== JSON.stringify(readJson(RFQS_KEY, {}))) {
      writeLocalOnly(RFQS_KEY, merged);
      changed = true;
    }
  }
  return changed;
}

function getSuppliers() {
  const map = new Map();
  PRODUCTS.forEach((p) => {
    if (!p.supplier || !isMattexSupplier(p.supplier)) return;
    const slug = supplierSlug(p.supplier);
    if (!map.has(slug)) {
      map.set(slug, {
        slug,
        name: p.supplier,
        image: p.image,
        categories: new Set(),
        count: 0,
      });
    }
    const entry = map.get(slug);
    entry.count += 1;
    entry.categories.add(p.category);
    if (!entry.image && p.image) entry.image = p.image;
  });
  return Array.from(map.values())
    .map((s) => ({
      slug: s.slug,
      name: supplierDisplayName(s.name),
      image: s.image,
      verified: hashSeed(s.slug) % 3 !== 2,
      count: s.count,
      categories: Array.from(s.categories).sort(),
      metrics: metricsForSlug(s.slug),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSupplier(slugOrName) {
  const key = supplierSlug(slugOrName);
  return getSuppliers().find((s) => s.slug === key) || null;
}

function getProductsBySupplier(slugOrName) {
  const key = supplierSlug(slugOrName);
  return activeCatalog(PRODUCTS).filter((p) => supplierSlug(p.supplier) === key);
}

function getTopProductsForSupplier(slugOrName, limit) {
  const n = limit || 5;
  const list = getProductsBySupplier(slugOrName);
  const featured = list
    .filter((p) => p.featuredRank != null)
    .sort((a, b) => a.featuredRank - b.featuredRank);
  const rest = list
    .filter((p) => p.featuredRank == null)
    .sort((a, b) => Number(b.green) - Number(a.green) || a.name.localeCompare(b.name));
  return featured.concat(rest).slice(0, n);
}

function searchSupplierProducts(slugOrName, query) {
  const base = getProductsBySupplier(slugOrName);
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return base;
  const tokens = q.split(/\s+/).filter(Boolean);
  return base.filter((p) => {
    const blob = productSearchBlob(p);
    return tokens.every((token) => blob.includes(token));
  });
}



const listeners = new Set();
let authModalOpen = false;
let authModalMode = "invite";
let lastCartWhatsappResult = null;
let catalogEpoch = 0;
let catalogLoading = isSupabaseConfigured();
let catalogReady = !catalogLoading;
let catalogBootReady = !catalogLoading;

function bumpCatalog() {
  catalogEpoch += 1;
}

let storeSnapshot = {
  user: null,
  staff: null,
  cartCount: 0,
  catalogEpoch: 0,
  catalogLoading,
  catalogReady,
  catalogBootReady,
  draft: { lines: [], note: "" },
  rfqs: [],
  allRfqs: [],
  reports: [],
  adminAlerts: [],
  authModalOpen: false,
  authModalMode: "invite",
  lastCartWhatsappResult: null,
};

function refreshStoreSnapshot() {
  storeSnapshot = {
    user: getUser(),
    staff: getStaffSession(),
    cartCount: cartCount(),
    catalogEpoch,
    catalogLoading,
    catalogReady,
    catalogBootReady,
    draft: getDraft(),
    rfqs: getRfqs(),
    allRfqs: getAllRfqs(),
    reports: getReports(),
    adminAlerts: listAdminAlerts(),
    authModalOpen,
    authModalMode,
    lastCartWhatsappResult,
  };
}

function emitStoreChange() {
  kickDisabledBuyerIfNeeded();
  restoreSessionBuyerAccount();
  refreshStoreSnapshot();
  listeners.forEach((l) => l());
}
export function subscribeStore(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getStoreSnapshot() {
  return storeSnapshot;
}

const AUTH_KEY = "subbie_auth";
const DISABLED_KICK_KEY = "subbie_disabled_kick";
const ACCOUNTS_KEY = "subbie_accounts";
const DELETED_BUYERS_KEY = "subbie_deleted_buyers";
const DRAFTS_KEY = "subbie_drafts_by_user";
const RFQS_KEY = "subbie_rfqs_by_user";
const QUOTE_SNAPSHOTS_KEY = "subbie_guest_quote_snapshots";
const GUEST_KEY = "__guest__";
const SEQ_KEY = "subbie_rfq_seq";
const WHATSAPP_NUMBER = "85256013989";
const WHATSAPP_DISPLAY = "852-56013989";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}`;
const SALES_EMAIL = "sales@mattex.com.hk";
const RESEND_ACCOUNT_EMAIL = "resend@mattex.com.hk";
const MATTEX_CHAIN_URL = "https://uat-chain.mattex.com.hk/overview";
const TMS_INBOUND_RFQ_URL = "https://uat-tms-v2.mattex.com.hk/inbound/inbound-rfq?current=1&pageSize=20";
const MATTEX_SITE_URL = "https://www.mattex.com.hk/";

const PENDING_CART_KEY = "subbie_pending_cart";
const PENDING_WA_RFQ_KEY = "subbie_pending_whatsapp_rfq";
const PENDING_CUSTOM_KEY = "subbie_pending_custom";
const PENDING_WA_ORDER_KEY = "subbie_pending_whatsapp_order";
const PENDING_ROUTE_KEY = "subbie_pending_route";
const PENDING_CART_WA_SUBMIT_KEY = "subbie_pending_cart_wa_submit";
const AUTH_INVITE_HIDE_KEY = "subbie_hide_auth_invite_v2";
const CART_AUTH_INVITE_SHOWN_KEY = "subbie_cart_auth_invite_shown_v1";

function pendingPriceLabel() {
  try {
    return localStorage.getItem("subbie_lang") === "zh" ? "價格待定" : "Price Upon Request";
  } catch {
    return "Price Upon Request";
  }
}

function formatPrice(price) {
  if (price == null || price === "" || Number(price) === 0) return pendingPriceLabel();
  const n = Number(price);
  if (!Number.isFinite(n)) return pendingPriceLabel();
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
  if (key === RFQS_KEY) {
    persistRfqsRemote(value);
    return;
  }
  persistKv(key, value);
  persistShared(key, value);
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isLoggedIn() {
  const data = getUser();
  return Boolean(data && data.email);
}

function normalizeProfileProjects(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((row) => String(row || "").trim()).filter(Boolean))];
  }
  const one = String(value || "").trim();
  return one ? [one] : [];
}

function normalizeProfileProject(value) {
  return normalizeProfileProjects(value)[0] || "";
}

function joinProfileProjects(list) {
  return normalizeProfileProjects(list).join(" · ");
}

function getUser() {
  const user = readJson(AUTH_KEY, null);
  if (!user) return null;
  const projects = normalizeProfileProjects(user.projects || user.project);
  return {
    ...user,
    projects,
    project: joinProfileProjects(projects),
  };
}

function kickDisabledBuyerIfNeeded() {
  if (typeof window === "undefined") return false;
  const user = getUser();
  if (!user?.email) return false;
  const account = getAccount(user.email);
  if (!account || account.enabled !== false) return false;
  try {
    sessionStorage.setItem(DISABLED_KICK_KEY, "1");
  } catch {
    /* ignore */
  }
  localStorage.removeItem(AUTH_KEY);
  return true;
}

function takeDisabledKick() {
  try {
    const flagged = sessionStorage.getItem(DISABLED_KICK_KEY) === "1";
    if (flagged) sessionStorage.removeItem(DISABLED_KICK_KEY);
    return flagged;
  } catch {
    return false;
  }
}

function emptyDraft() {
  return {
    lines: [],
    note: "",
    responseDate: "",
    deliveryDate: "",
    deliveryMode: "one_time",
    deliveryLots: [],
    project: "",
    projects: [],
    address: "",
    canonicalCategory: "",
    acceptSubstitutes: false,
  };
}

function normalizeDeliveryMode(value) {
  return value === "partial" ? "partial" : "one_time";
}

function emptyDeliveryLot() {
  return { date: "", note: "", address: "" };
}

function normalizeDeliveryLots(list, { mode, deliveryDate, address } = {}) {
  const lots = (Array.isArray(list) ? list : []).map((lot) => ({
    date: String(lot?.date || "").trim(),
    note: String(lot?.note || "").trim(),
    address: String(lot?.address || "").trim(),
  }));
  if (normalizeDeliveryMode(mode) !== "partial") return lots;
  if (!lots.length) {
    lots.push({ date: String(deliveryDate || "").trim(), note: "", address: String(address || "").trim() });
  }
  while (lots.length < 2) lots.push(emptyDeliveryLot());
  return lots;
}

function normalizeDraft(draft) {
  const src = draft || {};
  return {
    lines: Array.isArray(src.lines) ? src.lines : [],
    note: src.note || "",
    responseDate: src.responseDate || src.quotationDeadline || "",
    deliveryDate: src.deliveryDate || "",
    deliveryMode: normalizeDeliveryMode(src.deliveryMode),
    deliveryLots: normalizeDeliveryLots(src.deliveryLots, {
      mode: src.deliveryMode,
      deliveryDate: src.deliveryDate,
    }),
    project: joinProfileProjects(src.projects || src.project),
    projects: normalizeProfileProjects(src.projects || src.project),
    address: src.address || "",
    canonicalCategory: src.canonicalCategory || "",
    acceptSubstitutes: Boolean(src.acceptSubstitutes),
  };
}

function getDraftsMap() {
  return readJson(DRAFTS_KEY, {});
}

function setDraftsMap(map) {
  writeJson(DRAFTS_KEY, map);
}

function getRfqsMap() {
  return readJson(RFQS_KEY, {});
}

function setRfqsMap(map) {
  writeJson(RFQS_KEY, map);
}

function currentEmail() {
  const user = getUser();
  return user ? normalizeEmail(user.email) : null;
}

function accountKey() {
  return currentEmail() || GUEST_KEY;
}

function getDraft() {
  const key = accountKey();
  const map = getDraftsMap();
  return map[key] ? normalizeDraft(map[key]) : emptyDraft();
}

function setDraft(draft) {
  const key = accountKey();
  const map = getDraftsMap();
  map[key] = normalizeDraft(draft);
  setDraftsMap(map);
  emitStoreChange();
}

function pickFilledDraftValue(memberVal, guestVal) {
  return String(memberVal || "").trim() || String(guestVal || "").trim() || "";
}

function mergeGuestCartIntoUser() {
  if (!isLoggedIn()) return;
  const email = accountKey();
  if (!email || email === GUEST_KEY) return;
  const map = getDraftsMap();
  const guest = map[GUEST_KEY] ? normalizeDraft(map[GUEST_KEY]) : emptyDraft();
  const member = map[email] ? normalizeDraft(map[email]) : emptyDraft();
  if (!guest.lines.length) {
    if (map[GUEST_KEY]) {
      delete map[GUEST_KEY];
      setDraftsMap(map);
    }
    return;
  }
  const lines = member.lines.map((line) => ({ ...line }));
  for (const guestLine of guest.lines) {
    if (guestLine.custom) {
      lines.push({ ...guestLine });
      continue;
    }
    const existing = lines.find((row) => !row.custom && String(row.productId) === String(guestLine.productId));
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + (Number(guestLine.qty) || 0);
    } else {
      lines.push({ ...guestLine });
    }
  }
  map[email] = normalizeDraft({
    ...member,
    lines,
    note: pickFilledDraftValue(member.note, guest.note),
    responseDate: pickFilledDraftValue(member.responseDate, guest.responseDate),
    deliveryDate: pickFilledDraftValue(member.deliveryDate, guest.deliveryDate),
    address: pickFilledDraftValue(member.address, guest.address),
    project: pickFilledDraftValue(member.project, guest.project),
    projects: normalizeProfileProjects(pickFilledDraftValue(member.project, guest.project)),
    canonicalCategory: pickFilledDraftValue(member.canonicalCategory, guest.canonicalCategory),
    acceptSubstitutes: Boolean(member.acceptSubstitutes || guest.acceptSubstitutes),
    deliveryMode: member.deliveryMode === "partial" || guest.deliveryMode === "partial" ? "partial" : member.deliveryMode || guest.deliveryMode,
    deliveryLots:
      (Array.isArray(member.deliveryLots) && member.deliveryLots.some((lot) => lot.date || lot.address || lot.note)
        ? member.deliveryLots
        : guest.deliveryLots) || [],
  });
  delete map[GUEST_KEY];
  setDraftsMap(map);
  emitStoreChange();
}

function getCart() {
  return getDraft().lines.map((line) => {
    if (line.custom) {
      return {
        id: line.productId,
        name: line.name || "Tailor Made Product",
        price: null,
        qty: line.qty,
        custom: true,
        intent: line.intent || "quote",
      };
    }
    const product = getProduct(line.productId);
    return {
      id: line.productId,
      name: product ? product.name : line.productId,
      price: product ? getEffectivePrice(product).displayPrice : null,
      qty: line.qty,
      custom: false,
      intent: line.intent || (product && getEffectivePrice(product).displayPrice != null ? "buy" : "quote"),
    };
  });
}

function cartCount() {
  return getDraft().lines.length;
}

function newCustomProductId() {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addToCart(productId, { intent, qty, silentInvite = false } = {}) {
  const product = getProduct(productId);
  if (!product || isDiscontinued(product) || !isOrderable(product)) return getCart();
  const guest = !isLoggedIn();
  const draft = getDraft();
  const minQty = Math.max(1, Number(product.moq) || 1);
  const addQty = Math.max(minQty, Math.floor(Number(qty)) || minQty);
  const nextIntent = intent || (getEffectivePrice(product).displayPrice != null ? "buy" : "quote");
  const existing = draft.lines.find((l) => l.productId === productId && !l.custom);
  if (existing) {
    existing.qty = (existing.qty || 0) + addQty;
    existing.intent = nextIntent;
  } else {
    draft.lines.push({ productId, qty: addQty, intent: nextIntent });
  }
  setDraft(draft);
  if (guest && !silentInvite) maybeShowCartAuthInvite();
  return getCart();
}

function isStoredAttachmentUrl(url) {
  const value = String(url || "").trim();
  return value.startsWith("data:") || /^https?:\/\//i.test(value);
}

function normalizeAttachments(list) {
  if (!list) return [];
  return (Array.isArray(list) ? list : [list])
    .map((item) => {
      const url = String(item?.url || "").trim();
      return {
        name: String(item?.name || "file").slice(0, 180),
        type: String(item?.type || ""),
        size: Number(item?.size) || 0,
        kind: item?.kind === "image" || item?.kind === "text" ? item.kind : "document",
        url: isStoredAttachmentUrl(url) ? url : "",
      };
    })
    .filter((item) => item.name)
    .slice(0, 8);
}

function addCustomLine({
  name,
  description = "",
  qty = 1,
  category = "",
  attachments,
  image = "",
  tailorMade = false,
  baseProductId = "",
  baseProductNo = "",
} = {}) {
  if (!isLoggedIn()) {
    requireBuyerAuth({
      custom: true,
      tailorFrom: tailorMade ? String(baseProductId || "").trim() : undefined,
    });
    return { ok: false, error: "not_logged_in" };
  }
  const trimmed = String(name || "").trim();
  if (!trimmed) return { ok: false, error: "name" };
  const nextQty = Math.floor(Number(qty));
  const draft = getDraft();
  const productId = newCustomProductId();
    draft.lines.push({
      productId,
      qty: Number.isFinite(nextQty) && nextQty >= 1 ? nextQty : 1,
      custom: true,
      intent: "quote",
      name: trimmed,
      description: String(description || "").trim(),
      category: String(category || "").trim(),
      attachments: normalizeAttachments(attachments),
      image: String(image || ""),
      tailorMade: Boolean(tailorMade),
      baseProductId: String(baseProductId || "").trim(),
      baseProductNo: String(baseProductNo || "").trim(),
    });
  setDraft(draft);
  return { ok: true, productId };
}

function updateCustomLine(productId, patch = {}) {
  const draft = getDraft();
  const line = draft.lines.find((l) => String(l.productId) === String(productId));
  if (!line || !line.custom) return { ok: false, error: "not_found" };
  if (patch.name != null) {
    const trimmed = String(patch.name).trim();
    if (!trimmed) return { ok: false, error: "name" };
    line.name = trimmed;
  }
  if (patch.description != null) {
    line.description = String(patch.description).trim();
  }
  if (patch.qty != null) {
    const next = Math.floor(Number(patch.qty));
    if (!Number.isFinite(next) || next < 1) return { ok: false, error: "qty" };
    line.qty = next;
  }
  if (patch.category != null) {
    line.category = String(patch.category || "").trim();
  }
  if (patch.attachments !== undefined) {
    line.attachments = normalizeAttachments(patch.attachments);
  }
  if (patch.image !== undefined) {
    line.image = String(patch.image || "");
  }
  setDraft(draft);
  return { ok: true };
}

function setLineQty(productId, qty) {
  const draft = getDraft();
  const line = draft.lines.find((l) => String(l.productId) === String(productId));
  if (!line) return draft;
  const next = Math.floor(Number(qty));
  if (!Number.isFinite(next) || next < 1) return draft;
  line.qty = next;
  setDraft(draft);
  return draft;
}

function setLineIntent(productId, intent) {
  const draft = getDraft();
  const line = draft.lines.find((l) => String(l.productId) === String(productId));
  if (!line) return { ok: false, reason: "missing" };
  const next = intent === "buy" ? "buy" : "quote";
  if (next === "buy") {
    if (line.custom) return { ok: false, reason: "unpriced" };
    const product = getProduct(line.productId);
    const price = product ? getEffectivePrice(product).displayPrice : null;
    if (price == null) return { ok: false, reason: "unpriced" };
  }
  line.intent = next;
  if (next === "buy") delete line.requestedUnitPrice;
  setDraft(draft);
  return { ok: true };
}

function setLineRequestedPrice(productId, value) {
  const draft = getDraft();
  const line = draft.lines.find((l) => String(l.productId) === String(productId));
  if (!line || line.custom) return draft;
  const product = getProduct(line.productId);
  const listPrice = product ? getEffectivePrice(product).displayPrice : null;
  if (listPrice == null) return draft;
  if (value === "" || value == null) {
    delete line.requestedUnitPrice;
    setDraft(draft);
    return draft;
  }
  const n = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return draft;
  line.requestedUnitPrice = n;
  setDraft(draft);
  return draft;
}

function removeLine(productId) {
  const draft = getDraft();
  draft.lines = draft.lines.filter((l) => String(l.productId) !== String(productId));
  setDraft(draft);
  return draft;
}

function removeLines(productIds) {
  const ids = new Set((productIds || []).map((id) => String(id)));
  if (!ids.size) return getDraft();
  const draft = getDraft();
  draft.lines = draft.lines.filter((l) => !ids.has(String(l.productId)));
  setDraft(draft);
  return draft;
}

function setDraftNote(note) {
  const draft = getDraft();
  draft.note = String(note || "");
  setDraft(draft);
  return draft;
}

function setDraftResponseDate(value) {
  const draft = getDraft();
  draft.responseDate = String(value || "");
  setDraft(draft);
  return draft;
}

function setDraftAddress(value) {
  const draft = getDraft();
  draft.address = String(value || "");
  setDraft(draft);
  return draft;
}

function setDraftProject(value) {
  const draft = getDraft();
  const projects = normalizeProfileProjects(value);
  draft.projects = projects;
  draft.project = joinProfileProjects(projects);
  setDraft(draft);
  return draft;
}

function setDraftDeliveryDate(value) {
  const draft = getDraft();
  draft.deliveryDate = String(value || "");
  setDraft(draft);
  return draft;
}

function setDraftDeliveryMode(value) {
  const draft = getDraft();
  draft.deliveryMode = normalizeDeliveryMode(value);
  if (draft.deliveryMode === "partial") {
    draft.deliveryLots = normalizeDeliveryLots(draft.deliveryLots, {
      mode: "partial",
      deliveryDate: draft.deliveryDate,
    });
  }
  setDraft(draft);
  return draft;
}

function setDraftDeliveryLots(lots) {
  const draft = getDraft();
  draft.deliveryLots = normalizeDeliveryLots(lots, {
    mode: draft.deliveryMode,
    deliveryDate: draft.deliveryDate,
  });
  if (draft.deliveryMode === "partial" && draft.deliveryLots[0]?.date) {
    draft.deliveryDate = draft.deliveryLots[0].date;
  }
  setDraft(draft);
  return draft;
}

function setDraftCanonicalCategory(value) {
  const draft = getDraft();
  draft.canonicalCategory = String(value || "");
  setDraft(draft);
  return draft;
}

function setDraftAcceptSubstitutes(value) {
  const draft = getDraft();
  draft.acceptSubstitutes = Boolean(value);
  setDraft(draft);
  return draft;
}

function inferCanonicalCategory(lines) {
  const counts = {};
  for (const line of lines || []) {
    const name = line.category || (line.custom ? "" : getProduct(line.productId)?.category) || "";
    if (!name) continue;
    counts[name] = (counts[name] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked.length ? ranked[0][0] : "";
}

function draftTotals(draft, productIds) {
  let pricedSubtotal = 0;
  let unpricedCount = 0;
  const hasFilter = arguments.length > 1;
  const idFilter = hasFilter ? new Set((productIds || []).map(String)) : null;
  const sourceLines = idFilter
    ? (draft.lines || []).filter((line) => idFilter.has(String(line.productId)))
    : draft.lines || [];
  const enriched = sourceLines.map((line) => {
    if (line.custom) {
      unpricedCount += 1;
      return {
        productId: line.productId,
        qty: line.qty,
        name: line.name || "Tailor Made Product",
        description: line.description || "",
        supplier: null,
        unitPrice: null,
        image: line.image || null,
        custom: true,
        intent: line.intent || "quote",
        moq: 1,
        unit: line.unit || "",
        productNo: line.baseProductNo || line.productNo || "",
        category: line.category || "",
        green: false,
        attachments: Array.isArray(line.attachments) ? line.attachments : [],
        tailorMade: Boolean(line.tailorMade),
        baseProductId: line.baseProductId || "",
        baseProductNo: line.baseProductNo || "",
      };
    }
    const product = getProduct(line.productId);
    const unitPrice = product ? getEffectivePrice(product).displayPrice : null;
    if (unitPrice == null) unpricedCount += 1;
    else pricedSubtotal += unitPrice * line.qty;
    return {
      productId: line.productId,
      qty: line.qty,
      name: product ? product.name : line.productId,
      description: product ? product.description : "",
      supplier: product ? product.supplier : null,
      unitPrice,
      requestedUnitPrice:
        line.requestedUnitPrice != null && Number(line.requestedUnitPrice) > 0
          ? Number(line.requestedUnitPrice)
          : null,
      image: product ? product.image : null,
      custom: false,
      intent: line.intent || (unitPrice != null ? "buy" : "quote"),
      moq: product ? product.moq : 1,
      unit: product ? product.unit : "",
      productNo: product ? product.productNo : "",
      category: product ? product.category : "",
      green: Boolean(product?.green),
    };
  });
  return {
    lines: enriched,
    pricedSubtotal,
    unpricedCount,
    note: draft.note || "",
    responseDate: draft.responseDate || "",
    deliveryDate: draft.deliveryDate || "",
    deliveryMode: normalizeDeliveryMode(draft.deliveryMode),
    deliveryLots: normalizeDeliveryLots(draft.deliveryLots, {
      mode: draft.deliveryMode,
      deliveryDate: draft.deliveryDate,
    }),
    project: String(draft.project || joinProfileProjects(draft.projects) || "").trim(),
    projects: normalizeProfileProjects(draft.projects || draft.project),
    address: draft.address || "",
    canonicalCategory: draft.canonicalCategory || "",
    acceptSubstitutes: Boolean(draft.acceptSubstitutes),
  };
}

function nextRfqId() {
  const seq = Number(localStorage.getItem(SEQ_KEY) || "1000") + 1;
  try {
    localStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    /* ignore quota */
  }
  persistKv(SEQ_KEY, seq);
  persistShared(SEQ_KEY, seq);
  return `RFQ-${seq}`;
}

function recencyMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function idNumber(value) {
  return Number(String(value || "").replace(/\D/g, "")) || 0;
}

function sortByNewest(list, stampOf) {
  return [...(list || [])].sort((a, b) => {
    const diff = recencyMs(stampOf?.(b)) - recencyMs(stampOf?.(a));
    if (diff) return diff;
    return idNumber(b?.id || b?.email) - idNumber(a?.id || a?.email);
  });
}

function sortRfqsNewestFirst(rfqs) {
  return sortByNewest(rfqs, (rfq) => rfq?.submittedAt);
}

function getRfqs() {
  const key = accountKey();
  const map = getRfqsMap();
  return sortRfqsNewestFirst(Array.isArray(map[key]) ? map[key] : []);
}

function buyerContactPhone(user, email) {
  const fromSession = String(user?.phone || "").trim();
  if (fromSession) return fromSession;
  const account = getAccount(email || user?.email);
  return String(account?.phone || "").trim();
}

function submitRfq(productIds, options = {}) {
  const user = getUser();
  const allowGuest = Boolean(options.allowGuest);
  if (!user?.email && !allowGuest) return { ok: false, error: "not_logged_in" };
  const email = accountKey();
  let draft = getDraft();
  if (!draft.lines.length) return { ok: false, error: "empty" };
  const skipLogistics = Boolean(options.skipLogistics);
  if (!skipLogistics) {
    if (!String(draft.responseDate || "").trim()) return { ok: false, error: "response_date" };
    if (!String(draft.deliveryDate || "").trim()) return { ok: false, error: "delivery_date" };
  }
  const deliveryMode = normalizeDeliveryMode(draft.deliveryMode);
  const deliveryLots = normalizeDeliveryLots(draft.deliveryLots, {
    mode: deliveryMode,
    deliveryDate: draft.deliveryDate,
    address: draft.address,
  });
  if (!skipLogistics && deliveryMode === "partial") {
    const dated = deliveryLots.filter((lot) => lot.date);
    if (dated.length < 2) return { ok: false, error: "delivery_lots" };
    if (dated.some((lot) => !lot.address)) return { ok: false, error: "address" };
  }
  const siteAddress =
    deliveryMode === "partial"
      ? deliveryLots.find((lot) => lot.address)?.address || String(draft.address || "").trim()
      : String(draft.address || "").trim();
  if (!skipLogistics && !siteAddress) return { ok: false, error: "address" };

  const selectedIds =
    Array.isArray(productIds) && productIds.length
      ? productIds.map(String)
      : draft.lines.map((l) => String(l.productId));
  const selectedSet = new Set(selectedIds);
  const selectedLines = draft.lines.filter((l) => selectedSet.has(String(l.productId)));
  if (!selectedLines.length) return { ok: false, error: "none_selected" };
  const blocked = selectedLines.filter((l) => !l.custom && !isOrderable(getProduct(l.productId)));
  if (blocked.length) return { ok: false, error: "discontinued" };

  const totals = draftTotals({ ...draft, lines: selectedLines });
  const channel =
    options.channel === "whatsapp" ? "whatsapp" : options.channel === "email" ? "email" : "rfq";
  restoreSessionBuyerAccount();
  const buyerEmail = user?.email || "guest@subbie.store";
  const buyerKind = user?.email ? "member" : "guest";
  const rfq = {
    id: nextRfqId(),
    status: channel === "whatsapp" ? "whatsapp_sent" : channel === "email" ? "email_sent" : "submitted",
    reviewStatus: "received",
    channel,
    askKind: options.kind === "buy" ? "buy" : "quote",
    submittedAt: new Date().toISOString(),
    note: totals.note,
    responseDate: totals.responseDate,
    quotationDeadline: totals.responseDate,
    deliveryDate: deliveryMode === "partial" ? deliveryLots.find((lot) => lot.date)?.date || totals.deliveryDate : totals.deliveryDate,
    deliveryMode,
    deliveryLots: deliveryMode === "partial" ? deliveryLots.filter((lot) => lot.date || lot.note || lot.address) : [],
    project: joinProfileProjects(totals.projects || totals.project),
    projects: normalizeProfileProjects(totals.projects || totals.project),
    address: siteAddress,
    canonicalCategory: totals.canonicalCategory,
    acceptSubstitutes: Boolean(totals.acceptSubstitutes),
    lines: totals.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      supplier: l.supplier,
      qty: l.qty,
      moq: l.moq,
      unit: l.unit || "",
      unitPrice: l.unitPrice,
      requestedUnitPrice: l.requestedUnitPrice != null ? l.requestedUnitPrice : null,
      custom: Boolean(l.custom),
      description: l.description || "",
      intent: l.intent || (l.unitPrice != null ? "buy" : "quote"),
      productNo: l.productNo || "",
      category: l.category || "",
      green: Boolean(l.green),
      image: l.image || null,
      attachments: Array.isArray(l.attachments) ? l.attachments : [],
      remark: String(l.remark || ""),
      tailorMade: Boolean(l.tailorMade),
      baseProductId: l.baseProductId || "",
      baseProductNo: l.baseProductNo || "",
    })),
    pricedSubtotal: totals.pricedSubtotal,
    unpricedCount: totals.unpricedCount,
    buyerEmail,
    buyerName: user?.name || "Guest",
    buyerPhone: buyerKind === "member" ? buyerContactPhone(user, user?.email) : "",
    buyerPhoneWhatsapp: Boolean(user?.phoneWhatsapp),
    buyerKind,
  };
  const v1 = snapshotRfqRequest(rfq, { version: 1, createdAt: rfq.submittedAt });
  rfq.requestVersions = [v1];
  rfq.requestEffectiveVersion = 1;
  Object.assign(
    rfq,
    pushRfqActivity(rfq, "submitted", {
      at: rfq.submittedAt,
      channel,
      detail: channel === "whatsapp" || channel === "email" ? channel : "",
    })
  );
  const map = getRfqsMap();
  const list = Array.isArray(map[email]) ? map[email] : [];
  list.unshift(rfq);
  map[email] = list;
  setRfqsMap(map);
  persistSharedRfq(email, rfq);
  notifyAdmins({
    kind: "rfq",
    title: `New RFQ ${rfq.id}`,
    body: `${rfq.buyerName || rfq.buyerEmail || "Buyer"} submitted ${(rfq.lines || []).length} line(s) from Mattex Marketplace.`,
    href: `${adminOrigin()}/?rfq=${encodeURIComponent(rfq.id)}`,
  });
  if (channel !== "whatsapp") {
    deliverRfqSubmittedEmail(rfq);
    deliverRfqToSalesEmail(rfq);
  }
  return { ok: true, rfq };
}

function takeLastCartWhatsappResult() {
  const value = lastCartWhatsappResult;
  lastCartWhatsappResult = null;
  if (value) emitStoreChange();
  return value;
}

function completeCartWhatsappSubmit(spec = {}, { announce = false } = {}) {
  const kind = spec.kind === "buy" ? "buy" : "quote";
  const ids = (Array.isArray(spec.ids) ? spec.ids : []).map(String).filter(Boolean);
  const details = draftLogisticsForWhatsapp();
  const submitted = submitRfq(ids, {
    kind,
    channel: "whatsapp",
    skipLogistics: true,
    allowGuest: !isLoggedIn(),
  });
  if (!submitted.ok) return submitted;
  const lines = getDraft().lines.filter((line) => ids.includes(String(line.productId)));
  openWhatsappDraft(lines, kind, { refNo: submitted.rfq.id, details });
  removeLines(ids);
  if (announce) {
    lastCartWhatsappResult = { rfq: submitted.rfq, kind };
    emitStoreChange();
  }
  return { ok: true, rfq: submitted.rfq, kind };
}

function sendImmediateQuote(productId, { qty, channel } = {}) {
  return whatsappNow(productId, { qty, kind: "quote", lang: "zh" });
}

function sendWhatsappQuote(productId, { qty } = {}) {
  return whatsappNow(productId, { qty, kind: "quote", lang: "zh" });
}

function getRfq(id) {
  return getRfqs().find((r) => r.id === id) || null;
}

function saveRfq(rfq) {
  if (!rfq?.id) return { ok: false };
  const key = accountKey();
  const map = getRfqsMap();
  const list = Array.isArray(map[key]) ? map[key] : [];
  const idx = list.findIndex((r) => r.id === rfq.id);
  if (idx < 0) return { ok: false };
  const lines = Array.isArray(rfq.lines) ? rfq.lines : [];
  const next = {
    ...rfq,
    lines,
    pricedSubtotal: lines.reduce((sum, l) => sum + (Number(l.unitPrice) || 0) * (Number(l.qty) || 0), 0),
    unpricedCount: lines.filter((l) => l.unitPrice == null).length,
  };
  list[idx] = next;
  map[key] = list;
  setRfqsMap(map);
  emitStoreChange();
  return { ok: true, rfq: next };
}

function reorderRfq(id) {
  const src = getRfq(id);
  if (!src) return { ok: false };
  setDraft({
    note: src.note || "",
    responseDate: src.responseDate || src.quotationDeadline || "",
    deliveryDate: src.deliveryDate || "",
    deliveryMode: normalizeDeliveryMode(src.deliveryMode),
    deliveryLots: normalizeDeliveryLots(src.deliveryLots, {
      mode: src.deliveryMode,
      deliveryDate: src.deliveryDate,
    }),
    project: joinProfileProjects(src.projects || src.project),
    projects: normalizeProfileProjects(src.projects || src.project),
    address: src.address || "",
    canonicalCategory: src.canonicalCategory || "",
    acceptSubstitutes: Boolean(src.acceptSubstitutes),
    lines: src.lines.map((l) => {
      if (l.custom || String(l.productId || "").startsWith("custom_")) {
        return {
          productId: String(l.productId || "").startsWith("custom_")
            ? l.productId
            : newCustomProductId(),
          qty: l.qty,
          custom: true,
          intent: "quote",
          name: l.name || "Tailor Made Product",
          description: l.description || "",
          category: l.category || "",
          attachments: Array.isArray(l.attachments) ? l.attachments : [],
          tailorMade: Boolean(l.tailorMade),
          baseProductId: l.baseProductId || "",
          baseProductNo: l.baseProductNo || "",
        };
      }
      return { productId: l.productId, qty: l.qty, intent: l.intent || "quote" };
    }),
  });
  return { ok: true };
}

function getDeletedBuyerSet() {
  const list = readJson(DELETED_BUYERS_KEY, []);
  return new Set((Array.isArray(list) ? list : []).map(normalizeEmail).filter(Boolean));
}

function persistDeletedBuyers(set) {
  writeJson(DELETED_BUYERS_KEY, [...set]);
}

function mergeDeletedBuyers(remoteList) {
  const next = getDeletedBuyerSet();
  const remote = new Set((Array.isArray(remoteList) ? remoteList : []).map(normalizeEmail).filter(Boolean));
  remote.forEach((key) => next.add(key));
  if (next.size === remote.size) writeLocalOnly(DELETED_BUYERS_KEY, [...next]);
  else persistDeletedBuyers(next);
  return next;
}

function rememberDeletedBuyer(email) {
  const key = normalizeEmail(email);
  if (!key) return;
  const next = getDeletedBuyerSet();
  next.add(key);
  persistDeletedBuyers(next);
}

function forgetDeletedBuyer(email) {
  const key = normalizeEmail(email);
  if (!key) return;
  const next = getDeletedBuyerSet();
  if (!next.delete(key)) return;
  persistDeletedBuyers(next);
}

function stripDeletedBuyers(map) {
  const deleted = getDeletedBuyerSet();
  if (!deleted.size) return map || {};
  const next = { ...(map || {}) };
  deleted.forEach((email) => {
    delete next[email];
  });
  return next;
}

const SECRET_ACCOUNT_FIELDS = ["password", "resetToken", "resetExpiresAt", "inviteToken", "inviteExpiresAt"];

function withoutSecrets(account) {
  if (!account || typeof account !== "object") return account;
  const next = { ...account };
  if (next.inviteToken && next.invitePending == null) next.invitePending = true;
  SECRET_ACCOUNT_FIELDS.forEach((key) => delete next[key]);
  return next;
}

function accountsWithoutSecrets(map) {
  return Object.fromEntries(Object.entries(map || {}).map(([key, account]) => [key, withoutSecrets(account)]));
}

async function authApi(action, payload = {}) {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    return data && typeof data === "object" ? data : { ok: false, error: "server" };
  } catch {
    return { ok: false, error: "network" };
  }
}

function accountFromRow(row) {
  const extra = withoutSecrets(row?.extra && typeof row.extra === "object" ? row.extra : {});
  return {
    ...extra,
    email: row.email,
    name: row.name || extra.name || "",
    phone: row.phone || extra.phone || "",
    companyName: row.company_name || extra.companyName || "",
    enabled: row.enabled !== false,
    approvalStatus: row.approval_status || extra.approvalStatus || "approved",
  };
}

function getAccountsMap() {
  return accountsWithoutSecrets(stripDeletedBuyers(readJson(ACCOUNTS_KEY, {})));
}

function setAccountsMap(map) {
  writeJson(ACCOUNTS_KEY, accountsWithoutSecrets(stripDeletedBuyers(map || {})));
}

function getAccount(email) {
  const key = normalizeEmail(email);
  const map = getAccountsMap();
  return map[key] || null;
}

function buyerApprovalStatus(account) {
  const status = String(account?.approvalStatus || "");
  if (status === "pending" || status === "rejected" || status === "approved") return status;
  return "approved";
}

function publicUserFromAccount(account) {
  if (!account) return null;
  return {
    email: account.email,
    name: account.name,
    phone: account.phone || "",
    phoneWhatsapp: Boolean(account.phoneWhatsapp),
    jobTitle: account.jobTitle || "",
    companyName: account.companyName || "",
    companyReg: account.companyReg || "",
    companyPhone: account.companyPhone || "",
    companyAddress: account.companyAddress || "",
    project: normalizeProfileProject(account.project),
    projects: normalizeProfileProjects(account.projects || account.project),
    at: Date.now(),
  };
}

function restoreSessionBuyerAccount() {
  if (typeof window === "undefined") return false;
  const user = getUser();
  const email = normalizeEmail(user?.email);
  if (!email) return false;
  if (getDeletedBuyerSet().has(email)) return false;
  if (getAccount(email)) return false;
  const now = new Date().toISOString();
  const map = getAccountsMap();
  map[email] = {
    email,
    name: String(user.name || "").trim(),
    phone: String(user.phone || "").trim(),
    phoneWhatsapp: Boolean(user.phoneWhatsapp || user.phone),
    jobTitle: String(user.jobTitle || "").trim(),
    companyName: String(user.companyName || "").trim(),
    companyReg: String(user.companyReg || "").trim(),
    companyPhone: String(user.companyPhone || "").trim(),
    companyAddress: String(user.companyAddress || "").trim(),
    project: joinProfileProjects(user.projects || user.project),
    projects: normalizeProfileProjects(user.projects || user.project),
    enabled: true,
    approvalStatus: "approved",
    needsReview: false,
    createdAt: now,
    approvedAt: now,
  };
  setAccountsMap(map);
  return true;
}

function setSessionUser(user) {
  const previous = getUser();
  const prevEmail = previous ? normalizeEmail(previous.email) : null;
  const nextEmail = normalizeEmail(user.email);

  if (prevEmail && prevEmail !== nextEmail) {
    sessionStorage.removeItem(PENDING_CART_KEY);
    sessionStorage.removeItem(PENDING_WA_RFQ_KEY);
  }

  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  emitStoreChange();
}

function isSignupPasswordOk(password) {
  const value = String(password || "");
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function persistLegacyBuyerAccess() {
  const map = getAccountsMap();
  let changed = false;
  Object.keys(map || {}).forEach((key) => {
    const account = map[key];
    if (!account || account.approvalStatus !== "pending") return;
    map[key] = {
      ...account,
      approvalStatus: "approved",
      enabled: true,
      approvedAt: account.approvedAt || account.createdAt || new Date().toISOString(),
      reviewedAt: account.reviewedAt || "",
      needsReview: true,
    };
    changed = true;
  });
  if (changed) setAccountsMap(map);
}

async function registerUser(profile) {
  const email = normalizeEmail(profile.email);
  if (!email) return { ok: false, error: "email" };
  if (getStaffAccount(email)) return { ok: false, error: "staff" };
  if (!String(profile.name || "").trim()) return { ok: false, error: "name" };
  if (!String(profile.phone || "").trim()) return { ok: false, error: "phone" };
  if (!String(profile.jobTitle || "").trim()) return { ok: false, error: "jobTitle" };
  if (!String(profile.companyName || "").trim()) return { ok: false, error: "companyName" };
  if (!String(profile.companyReg || "").trim()) return { ok: false, error: "companyReg" };
  if (!String(profile.companyAddress || "").trim()) return { ok: false, error: "companyAddress" };
  if (!isSignupPasswordOk(profile.password)) return { ok: false, error: "password" };

  persistLegacyBuyerAccess();
  if (getAccountsMap()[email]) return { ok: false, error: "exists" };
  const signup = await authApi("signup", {
    email,
    password: String(profile.password),
    profile: { name: profile.name, phone: profile.phone, companyName: profile.companyName },
  });
  if (!signup.ok) return { ok: false, error: signup.error || "server" };
  forgetDeletedBuyer(email);
  const map = getAccountsMap();

  const now = new Date().toISOString();
  const account = {
    email,
    name: String(profile.name).trim(),
    phone: String(profile.phone).trim(),
    phoneWhatsapp: Boolean(String(profile.phone || "").trim()),
    jobTitle: String(profile.jobTitle).trim(),
    companyName: String(profile.companyName).trim(),
    companyReg: String(profile.companyReg || "").trim(),
    companyPhone: String(profile.companyPhone || "").trim(),
    companyAddress: String(profile.companyAddress).trim(),
    project: joinProfileProjects(profile.projects || profile.project),
    projects: normalizeProfileProjects(profile.projects || profile.project),
    enabled: true,
    approvalStatus: "approved",
    needsReview: true,
    reviewedAt: "",
    createdAt: now,
    approvedAt: now,
  };
  map[email] = account;
  setAccountsMap(map);
  setSessionUser(publicUserFromAccount(account));
  try {
    sessionStorage.removeItem(PENDING_CART_KEY);
    sessionStorage.removeItem(PENDING_WA_RFQ_KEY);
    sessionStorage.removeItem(PENDING_CUSTOM_KEY);
    sessionStorage.removeItem(PENDING_ROUTE_KEY);
  } catch {
    /* ignore */
  }
  mergeGuestCartIntoUser();
  notifyAdmins({
    kind: "buyer",
    title: "New marketplace buyer — review",
    body: `${account.companyName || "Company"} · ${account.name || ""} · ${account.email}`.replace(/ · $/, ""),
    href: `${adminOrigin()}/?buyer=${encodeURIComponent(account.email)}`,
  });
  deliverAccountCreatedEmail(account);
  return { ok: true, pending: false, loggedIn: true, email };
}

function updateUserProfile(patch = {}) {
  const current = getUser();
  if (!current?.email) return { ok: false, error: "not_logged_in" };
  const email = normalizeEmail(current.email);

  const next = {
    name: String(current.name ?? "").trim(),
    phone: String(patch.phone ?? current.phone ?? "").trim(),
    phoneWhatsapp: Boolean(String(patch.phone ?? current.phone ?? "").trim()),
    jobTitle: String(patch.jobTitle ?? current.jobTitle ?? "").trim(),
    companyName: String(current.companyName ?? "").trim(),
    companyReg: String(current.companyReg ?? "").trim(),
    companyPhone: String(patch.companyPhone ?? current.companyPhone ?? "").trim(),
    companyAddress: String(patch.companyAddress ?? current.companyAddress ?? "").trim(),
    projects: normalizeProfileProjects(patch.projects ?? patch.project ?? current.projects ?? current.project),
    project: joinProfileProjects(patch.projects ?? patch.project ?? current.projects ?? current.project),
  };
  if (!next.name) return { ok: false, error: "name" };
  if (!next.companyName) return { ok: false, error: "companyName" };
  if (!next.companyAddress) return { ok: false, error: "companyAddress" };

  const map = getAccountsMap();
  if (map[email]) {
    map[email] = {
      ...map[email],
      ...next,
      updatedAt: new Date().toISOString(),
    };
    setAccountsMap(map);
    setSessionUser(publicUserFromAccount(map[email]));
  } else {
    setSessionUser({
      ...current,
      ...next,
      email: current.email,
      at: Date.now(),
    });
  }
  return { ok: true, user: getUser() };
}

async function requestBuyerPasswordReset(email) {
  const nextEmail = normalizeEmail(email);
  if (!nextEmail) return { ok: false, error: "email" };
  if (getStaffAccount(nextEmail)) return { ok: true };
  await authApi("request-reset", { kind: "buyer", email: nextEmail });
  return { ok: true };
}

async function getBuyerReset(token) {
  const info = await authApi("token-info", { token: String(token || "").trim() });
  if (!info.ok || info.kind !== "buyer") return null;
  return { email: info.email, name: info.name, expired: Boolean(info.expired) };
}

async function resetBuyerPassword({ token, password }) {
  if (!String(token || "").trim()) return { ok: false, error: "token" };
  if (!isSignupPasswordOk(password)) return { ok: false, error: "password" };
  const result = await authApi("accept-token", { token: String(token).trim(), password });
  if (!result.ok || result.kind !== "buyer") return { ok: false, error: result.error || "token" };
  emitStoreChange();
  return { ok: true };
}

async function loginUser({ email, password }) {
  const nextEmail = normalizeEmail(email);
  if (!nextEmail) return { ok: false, error: "email" };
  if (getStaffAccount(nextEmail)) return { ok: false, error: "staff" };

  persistLegacyBuyerAccess();
  const result = await authApi("login", { kind: "buyer", email: nextEmail, password: String(password || "") });
  if (!result.ok) return { ok: false, error: result.error || "password" };
  const map = getAccountsMap();
  const account = { ...accountFromRow(result.account), ...(map[nextEmail] || {}), enabled: true };
  map[nextEmail] = account;
  setAccountsMap(map);
  authModalOpen = false;
  setSessionUser(publicUserFromAccount(account));
  mergeGuestCartIntoUser();
  return { ok: true, user: publicUserFromAccount(account) };
}

function logoutUser() {
  authApi("logout", { kind: "buyer" });
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(PENDING_CUSTOM_KEY);
  emitStoreChange();
}

function setPendingCart(productId, intent, qty) {
  if (!productId) return;
  sessionStorage.setItem(
    PENDING_CART_KEY,
    JSON.stringify({
      productId,
      intent: intent || "quote",
      qty: qty || null,
    })
  );
}

function setPendingWhatsappRfq(productId) {
  if (productId) sessionStorage.setItem(PENDING_WA_RFQ_KEY, productId);
}

function setPendingWhatsappOrder(order) {
  if (!order) return;
  try {
    sessionStorage.setItem(PENDING_WA_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function getPendingWhatsappOrder() {
  try {
    const raw = sessionStorage.getItem(PENDING_WA_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.lines) ? parsed : null;
  } catch {
    return null;
  }
}

function setPendingCustom(payload = { custom: true }) {
  sessionStorage.setItem(PENDING_CUSTOM_KEY, JSON.stringify(payload));
}

function setPendingRoute(path) {
  const next = String(path || "").trim();
  if (!next) {
    sessionStorage.removeItem(PENDING_ROUTE_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_ROUTE_KEY, next);
}

function setPendingCartWhatsappSubmit({ kind, ids } = {}) {
  const list = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean);
  if (!list.length) return;
  try {
    sessionStorage.setItem(
      PENDING_CART_WA_SUBMIT_KEY,
      JSON.stringify({ kind: kind === "buy" ? "buy" : "quote", ids: list })
    );
  } catch {
    /* ignore */
  }
}

function readPendingCartWhatsappSubmit() {
  try {
    const raw = sessionStorage.getItem(PENDING_CART_WA_SUBMIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed?.ids) ? parsed.ids.map(String).filter(Boolean) : [];
    if (!ids.length) return null;
    return { kind: parsed?.kind === "buy" ? "buy" : "quote", ids };
  } catch {
    return null;
  }
}

function clearPendingCartWhatsappSubmit() {
  try {
    sessionStorage.removeItem(PENDING_CART_WA_SUBMIT_KEY);
  } catch {
    /* ignore */
  }
}

function isAuthInviteHidden() {
  try {
    return localStorage.getItem(AUTH_INVITE_HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function setAuthInviteHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(AUTH_INVITE_HIDE_KEY, "1");
    else localStorage.removeItem(AUTH_INVITE_HIDE_KEY);
  } catch {
    /* ignore */
  }
}

function isCartAuthInviteShown() {
  try {
    return localStorage.getItem(CART_AUTH_INVITE_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function markCartAuthInviteShown() {
  try {
    localStorage.setItem(CART_AUTH_INVITE_SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }
}

function maybeShowCartAuthInvite() {
  if (isLoggedIn() || isCartAuthInviteShown()) return;
  markCartAuthInviteShown();
  openAuthModal("cart-invite");
}

function openAuthModal(mode = "required") {
  if (mode === "invite" && isAuthInviteHidden()) return;
  authModalMode = mode === "cart-invite" || mode === "invite" ? mode : "required";
  authModalOpen = true;
  if (typeof window === "undefined") {
    emitStoreChange();
    return;
  }
  window.setTimeout(() => emitStoreChange(), 0);
}

function closeAuthModal() {
  if (!authModalOpen) return;
  authModalOpen = false;
  emitStoreChange();
}

function inviteBuyerAuth() {
  if (isLoggedIn()) return true;
  openAuthModal("invite");
  return true;
}

function requireBuyerAuth(pending = {}) {
  if (isLoggedIn()) return true;
  if (pending.productId) setPendingCart(pending.productId, pending.intent || "quote", pending.qty);
  if (pending.custom || pending.tailorFrom) {
    setPendingCustom(pending.tailorFrom ? { tailorFrom: pending.tailorFrom } : { custom: true });
  }
  openAuthModal("required");
  return false;
}

function addFromStorefront(productId, intent = "quote", qty, lang) {
  if (intent === "quote-now") {
    if (!isLoggedIn() && !isAuthInviteHidden()) {
      setPendingCart(productId, "quote-now", qty);
      openAuthModal("invite");
      return { ok: false, error: "auth_invite" };
    }
    return whatsappNow(productId, { qty, kind: "quote", lang, skipCart: true });
  }
  if (intent === "buy-now") {
    if (!requireBuyerAuth({ productId, intent, qty })) {
      return { ok: false, error: "not_logged_in" };
    }
    return whatsappNow(productId, { qty, kind: "buy", lang });
  }
  addToCart(productId, { intent, qty });
  return { ok: true };
}

function consumePendingInviteContinue() {
  const pendingWaSubmit = readPendingCartWhatsappSubmit();
  if (pendingWaSubmit) {
    clearPendingCartWhatsappSubmit();
    completeCartWhatsappSubmit(pendingWaSubmit, { announce: true });
    return;
  }
  const pendingCart = sessionStorage.getItem(PENDING_CART_KEY);
  sessionStorage.removeItem(PENDING_CART_KEY);
  if (!pendingCart) return;
  let productId = "";
  let intent = "";
  let qty;
  try {
    const parsed = JSON.parse(pendingCart);
    productId = parsed?.productId || "";
    intent = parsed?.intent || "";
    qty = parsed?.qty;
  } catch {
    return;
  }
  if (intent === "quote-now" && productId) {
    whatsappNow(productId, { qty, kind: "quote", skipCart: true });
  }
}

function consumePendingAfterAuth() {
  const pendingCart = sessionStorage.getItem(PENDING_CART_KEY);
  const pendingWa = sessionStorage.getItem(PENDING_WA_RFQ_KEY);
  const pendingCustom = sessionStorage.getItem(PENDING_CUSTOM_KEY);
  const pendingRoute = sessionStorage.getItem(PENDING_ROUTE_KEY);
  const pendingWaSubmit = readPendingCartWhatsappSubmit();
  sessionStorage.removeItem(PENDING_CART_KEY);
  sessionStorage.removeItem(PENDING_WA_RFQ_KEY);
  sessionStorage.removeItem(PENDING_CUSTOM_KEY);
  sessionStorage.removeItem(PENDING_ROUTE_KEY);
  clearPendingCartWhatsappSubmit();

  let wentToRfq = false;
  let stayPut = false;
  if (pendingWaSubmit) {
    completeCartWhatsappSubmit(pendingWaSubmit, { announce: true });
    stayPut = true;
  }
  if (pendingCart) {
    let productId = pendingCart;
    let intent = "quote";
    let qty;
    try {
      const parsed = JSON.parse(pendingCart);
      if (parsed && parsed.productId) {
        productId = parsed.productId;
        intent = parsed.intent || "quote";
        qty = parsed.qty;
      }
    } catch {
      productId = pendingCart;
    }
    if (intent === "quote-now") {
      whatsappNow(productId, { qty, kind: "quote", skipCart: true });
      stayPut = true;
    } else if (intent === "buy-now") {
      whatsappNow(productId, { qty, kind: "buy" });
      wentToRfq = true;
    } else {
      addToCart(productId, { intent, qty, silentInvite: true });
    }
  }
  if (pendingWa) {
    addToCart(pendingWa, { silentInvite: true });
    wentToRfq = true;
  }
  if (pendingCustom && !wentToRfq && !stayPut) {
    let customPayload = pendingCustom;
    try {
      customPayload = JSON.parse(pendingCustom);
    } catch {
      customPayload = pendingCustom === "1" ? { custom: true } : {};
    }
    if (customPayload?.tailorFrom) {
      return `/details/${customPayload.tailorFrom}?tailor=1`;
    }
    return "/?custom=1#products";
  }
  if (wentToRfq) return "/rfq";
  if (pendingRoute) return pendingRoute;
  return "";
}

function enrichCartLine(line) {
  if (!line) return null;
  if (line.custom) {
    return {
      name: line.name || "Tailor Made Product",
      productNo: line.baseProductNo || line.productNo || "",
      productId: line.productId,
      custom: true,
      description: line.description || "",
      qty: line.qty || 1,
      unit: line.unit || "",
      unitPrice: line.unitPrice ?? null,
      supplier: line.supplier || "",
      image: line.image || "",
      attachments: Array.isArray(line.attachments) ? line.attachments : [],
      tailorMade: Boolean(line.tailorMade),
      baseProductId: line.baseProductId || "",
      baseProductNo: line.baseProductNo || "",
    };
  }
  const product = getProduct(line.productId);
  return {
    name: line.name || product?.name || line.productId,
    productNo: line.productNo || product?.productNo || "",
    productId: line.productId,
    custom: false,
    description: line.description || "",
    qty: line.qty || 1,
    unit: product?.unit || line.unit || "",
    unitPrice: line.unitPrice ?? (product ? getEffectivePrice(product).displayPrice : null),
    supplier: line.supplier || product?.supplier || "",
    image: line.image || product?.image || "",
    attachments: Array.isArray(line.attachments) ? line.attachments : [],
  };
}

function flattenWaSpec(text) {
  return String(text || "")
    .trim()
    .replace(/\s*\n+\s*/g, "; ");
}

function waImageLabel(src, lang) {
  const value = String(src || "").trim();
  if (!value) return "";
  if (value.startsWith("data:")) return lang === "zh" ? "自訂相片" : "custom photo";
  if (/^https?:\/\//i.test(value)) return value;
  return value.split("/").pop() || value;
}

function waAttachmentNames(files) {
  return (Array.isArray(files) ? files : [])
    .map((file) => String(file?.name || "").trim())
    .filter(Boolean)
    .join(", ");
}

function hasWaMedia(rows) {
  return rows.some(
    (line) =>
      (line.attachments && line.attachments.length) ||
      (line.image && String(line.image).startsWith("data:"))
  );
}

function waField(label, value, prefixWidth) {
  const prefix = `${label}:`;
  const pad = " ".repeat(Math.max(0, prefixWidth - Array.from(prefix).length));
  return `   ${prefix}${pad} ${value}`;
}

function whatsappItemBlock(line, index) {
  const isCustom = Boolean(line.custom);
  const name = String(line.name || (isCustom ? "度身訂造產品" : line.productId) || "-").trim();
  const sku = line.productNo || (isCustom ? "度身訂造" : line.productId) || "-";
  const qty = `${line.qty}${line.unit ? ` ${line.unit}` : ""}`;
  const price = line.unitPrice != null ? formatPrice(line.unitPrice) : "待報價";
  const spec = flattenWaSpec(line.description);
  const width = 6;
  const rows = [
    `${index + 1}.`,
    waField("貨名", name, width),
    waField("貨號", sku, width),
    waField("數量", qty, width),
    waField("單價", price, width),
  ];
  if (isCustom && spec) rows.push(waField("規格／備註", spec, width));
  const attached = waAttachmentNames(line.attachments);
  if (attached) rows.push(waField("附件", attached, width));
  return rows.join("\n");
}

function waRefLabel(kind, zh = true) {
  if (kind === "buy") return zh ? "訂單編號" : "Order no.";
  return zh ? "RFQ 編號" : "RFQ no.";
}

function whatsappWrapList(list, kind, refNo) {
  const isBuy = kind === "buy";
  const intro = isBuy ? "你好，我想買以下現貨：" : "你好，我想問以下報價：";
  const outro = isBuy ? "請確認庫存及單價，謝謝。" : "請提供交貨期及單價，謝謝。";
  const head = refNo ? `${intro}\n${waRefLabel(kind)}：${refNo}` : intro;
  return `${head}\n\n${list}\n\n${outro}`;
}

function whatsappLogisticsBlock(details) {
  if (!details || typeof details !== "object") return "";
  const lines = [];
  const project = String(details.project || "").trim();
  const address = String(details.address || "").trim();
  const responseDate = String(details.responseDate || "").trim();
  const deliveryDate = String(details.deliveryDate || "").trim();
  const note = String(details.note || "").trim();
  const lots = Array.isArray(details.lots) ? details.lots : [];
  if (project) lines.push(`項目：${project}`);
  if (address) lines.push(`地址：${address}`);
  if (responseDate) lines.push(`報價限期：${responseDate}`);
  if (deliveryDate) lines.push(`交貨期：${deliveryDate}`);
  lots.forEach((lot, index) => {
    const bits = [`第${index + 1}批`];
    if (lot?.date) bits.push(String(lot.date).trim());
    if (lot?.address) bits.push(String(lot.address).trim());
    if (lot?.note) bits.push(String(lot.note).trim());
    if (bits.length > 1) lines.push(bits.join(" · "));
  });
  if (note) lines.push(`備註：${note}`);
  return lines.join("\n");
}

function draftLogisticsForWhatsapp(draft) {
  const src = draft || getDraft();
  const lots =
    src.deliveryMode === "partial"
      ? (Array.isArray(src.deliveryLots) ? src.deliveryLots : []).filter(
          (lot) => lot?.date || lot?.address || lot?.note
        )
      : [];
  return {
    project: joinProfileProjects(src.projects || src.project),
    address: String(src.address || "").trim(),
    responseDate: String(src.responseDate || "").trim(),
    deliveryDate: String(src.deliveryDate || "").trim(),
    note: String(src.note || "").trim(),
    lots,
  };
}

function whatsappPdfHintText(kind, refNo, pdfUrl, details) {
  const isBuy = kind === "buy";
  const intro = isBuy ? "你好，我想買以下現貨：" : "你好，我想問以下報價：";
  const outro = isBuy ? "請確認庫存及單價，謝謝。" : "請提供交貨期及單價，謝謝。";
  const refLine = refNo ? `${waRefLabel(kind)}：${refNo}` : "";
  const pdfLine = pdfUrl ? `產品清單 PDF：\n${pdfUrl}` : "請睇附件 PDF（產品清單）。";
  const logistics = whatsappLogisticsBlock(details);
  return [intro, refLine, pdfLine, logistics, outro].filter(Boolean).join("\n\n");
}

function whatsappPhoneId(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return "";
  if (digits.length <= 9 && !digits.startsWith("852")) return `852${digits}`;
  return digits;
}

function buyerWhatsappHref(phone, text) {
  const id = whatsappPhoneId(phone);
  if (!id) return "";
  const msg = String(text || "").trim();
  const base = `https://wa.me/${id}`;
  return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
}

function formatBuyerPhoneDisplay(phone) {
  const raw = String(phone || "").trim();
  const id = whatsappPhoneId(raw);
  if (!id) return raw;
  if (id.startsWith("852") && id.length === 11) return `+852 ${id.slice(3, 7)} ${id.slice(7)}`;
  if (id.length >= 8) return `+${id}`;
  return raw;
}

function whatsappChatHref(text = "") {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

function whatsappNativeHref(text = "") {
  const base = `whatsapp://send?phone=${WHATSAPP_NUMBER}`;
  return text ? `${base}&text=${encodeURIComponent(text)}` : base;
}

function openWhatsappChat(text = "") {
  if (typeof window === "undefined") return;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  window.open(mobile ? whatsappNativeHref(text) : whatsappChatHref(text), "_blank", "noopener,noreferrer");
}

function copyPlainText(text) {
  if (typeof document === "undefined") return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => copyPlainTextFallback(text));
    return;
  }
  copyPlainTextFallback(text);
}

function copyPlainTextFallback(text) {
  try {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  } catch {
    /* ignore */
  }
}

function closeWhatsappCopiedModal() {
  const el = document.querySelector("[data-wa-copy-modal]");
  const url = el?.dataset.waPdfUrl;
  el?.remove();
  if (url && url.startsWith("blob:") && url !== waPdfCache?.pdf?.url) URL.revokeObjectURL(url);
  document.body.style.overflow = "";
}

function modalButtonStyle(primary, disabled = false) {
  const base = primary
    ? "display:inline-flex;align-items:center;justify-content:center;border:0;background:#245a41;color:#fff;font-weight:600;font-size:0.8125rem;padding:0.65rem 1.05rem;"
    : "display:inline-flex;align-items:center;justify-content:center;border:1px solid #d6ddd8;background:#fff;color:#121816;font-weight:600;font-size:0.8125rem;padding:0.65rem 0.9rem;";
  return disabled ? `${base}cursor:not-allowed;opacity:0.5;` : `${base}cursor:pointer;`;
}

function showWhatsappPdfModal({ kind, count, text, pdf, failed, reused, refNo, blobUrl, uploading, onRetry }) {
  if (typeof document === "undefined") return;
  closeWhatsappCopiedModal();
  const zh = String(document.documentElement.lang || "").startsWith("zh");
  const refLabel = waRefLabel(kind, zh);
  const hasBlob = Boolean(blobUrl);
  const canOpenWhatsapp = hasBlob && Boolean(text);
  const waitForPdfLink = Boolean(!failed && !canOpenWhatsapp);
  const copy = zh
    ? {
        title: failed
          ? pdf
            ? "未能上載 PDF 連結"
            : "未能產生 PDF"
          : uploading
            ? "正在上傳 PDF…"
            : reused
              ? "請用同一份 PDF"
              : pdf
                ? hasBlob
                  ? "PDF 連結已準備"
                  : "報價清單 PDF 已準備"
                : "正在產生 PDF…",
        alert: reused
          ? `清單未變，重用同一份 PDF 連結。今次 WhatsApp 會用新${refLabel} ${refNo || ""}。`
          : "",
        ref: refNo ? `${refLabel}：${refNo}` : "",
        body: failed
          ? "PDF 連結未準備好。請重試，成功之後先可以開啟 WhatsApp。"
          : uploading
            ? "正在把 PDF 同產品圖片上傳到 Vercel Blob，之後會把連結寫入 WhatsApp。"
            : pdf
              ? hasBlob
                ? `共 ${count} 項。WhatsApp 訊息會帶 PDF 連結同產品圖片。`
                : `共 ${count} 項。PDF 已產生，正在準備連結。`
              : "正在把貨名、貨號、數量、單價同產品圖整成 PDF。",
        copied: "PDF 連結同產品圖片已複製。開啟 WhatsApp 後可直接傳送。",
        preview: "PDF 預覽",
        download: reused ? "再次下載同一份 PDF" : "下載 PDF",
        share: "分享 PDF",
        retry: "重新產生連結",
        open: "開啟 WhatsApp",
        close: "關閉",
      }
    : {
        title: failed
          ? pdf
            ? "Could not upload the PDF link"
            : "Could not create PDF"
          : uploading
            ? "Uploading PDF…"
            : reused
              ? "Use the same PDF"
              : pdf
                ? hasBlob
                  ? "PDF link is ready"
                  : "Quote PDF is ready"
                : "Preparing PDF…",
        alert: reused
          ? `This list has not changed — reusing the same PDF link. WhatsApp will use a new ${refLabel} ${refNo || ""}.`
          : "",
        ref: refNo ? `${refLabel}: ${refNo}` : "",
        body: failed
          ? "The PDF link is not ready. Retry, then open WhatsApp."
          : uploading
            ? "Uploading the PDF and product images to Vercel Blob, then putting the links in WhatsApp."
            : pdf
              ? hasBlob
                ? `${count} item(s). WhatsApp will include the PDF link and product images.`
                : `${count} item(s). PDF created — preparing the link.`
              : "Creating a PDF with name, SKU, qty, unit price, and product images.",
        copied: "PDF and product image links are copied. Open WhatsApp to send them.",
        preview: "PDF preview",
        download: reused ? "Download the same PDF again" : "Download PDF",
        share: "Share PDF",
        retry: "Retry PDF link",
        open: "Open WhatsApp",
        close: "Close",
      };

  const overlay = document.createElement("div");
  overlay.dataset.waCopyModal = "1";
  if (pdf?.url) overlay.dataset.waPdfUrl = pdf.url;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "wa-copy-title");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:1.25rem;background:rgba(16,21,19,0.55);";

  const card = document.createElement("div");
  card.style.cssText =
    "width:min(34rem,100%);max-height:min(40rem,calc(100vh - 2.5rem));overflow:auto;background:#fff;border:1px solid #d6ddd8;border-radius:0.75rem;box-shadow:0 18px 40px rgba(0,0,0,0.22);padding:1.25rem 1.35rem 1.15rem;";

  const title = document.createElement("h2");
  title.id = "wa-copy-title";
  title.textContent = copy.title;
  title.style.cssText = "margin:0;font-size:1.15rem;font-weight:700;color:#143528;";

  const body = document.createElement("p");
  body.textContent = copy.body;
  body.style.cssText = "margin:0.55rem 0 0;font-size:0.875rem;line-height:1.45;color:#5b6660;";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;flex-wrap:wrap;justify-content:flex-end;gap:0.5rem;margin-top:1rem;";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = copy.close;
  closeBtn.style.cssText = modalButtonStyle(false);

  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      document.removeEventListener("keydown", onKey);
      closeWhatsappCopiedModal();
    }
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeWhatsappCopiedModal();
  });
  closeBtn.addEventListener("click", () => {
    document.removeEventListener("keydown", onKey);
    closeWhatsappCopiedModal();
  });

  card.append(title);

  if (copy.ref) {
    const refEl = document.createElement("p");
    refEl.textContent = copy.ref;
    refEl.style.cssText =
      "margin:0.45rem 0 0;font-size:0.8125rem;font-weight:700;color:#143528;letter-spacing:0.02em;";
    card.append(refEl);
  }

  if (copy.alert) {
    const alertEl = document.createElement("p");
    alertEl.setAttribute("role", "alert");
    alertEl.textContent = copy.alert;
    alertEl.style.cssText =
      "margin:0.7rem 0 0;padding:0.65rem 0.75rem;border:1px solid #ead7a0;background:#fff8e8;color:#6a4f08;font-size:0.8125rem;line-height:1.45;border-radius:0.5rem;";
    card.append(alertEl);
  }

  card.append(body);

  if (hasBlob) {
    const copiedEl = document.createElement("p");
    copiedEl.setAttribute("role", "status");
    copiedEl.textContent = copy.copied;
    copiedEl.style.cssText =
      "margin:0.7rem 0 0;padding:0.65rem 0.75rem;border:1px solid #c5ddd0;background:#eef6f1;color:#143528;font-size:0.8125rem;line-height:1.45;font-weight:600;border-radius:0.5rem;";
    card.append(copiedEl);
  }

  if (blobUrl) {
    const linkWrap = document.createElement("p");
    linkWrap.style.cssText = "margin:0.7rem 0 0;font-size:0.8125rem;line-height:1.45;word-break:break-all;";
    const link = document.createElement("a");
    link.href = blobUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = blobUrl;
    link.style.cssText = "color:#245a41;font-weight:600;";
    linkWrap.append(link);
    card.append(linkWrap);
  }

  if (pdf?.url) {
    const previewLabel = document.createElement("p");
    previewLabel.textContent = copy.preview;
    previewLabel.style.cssText =
      "margin:1rem 0 0.4rem;font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b6660;";
    const frame = document.createElement("iframe");
    frame.title = copy.preview;
    frame.src = pdf.url;
    frame.style.cssText =
      "display:block;width:100%;height:16rem;border:1px solid #d6ddd8;border-radius:0.5rem;background:#f6f7f5;";
    card.append(previewLabel, frame);

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.textContent = copy.download;
    downloadBtn.style.cssText = modalButtonStyle(false);
    downloadBtn.addEventListener("click", () => downloadBlob(pdf.blob, pdf.filename));

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = copy.open;
    openBtn.disabled = !canOpenWhatsapp;
    openBtn.setAttribute("aria-busy", waitForPdfLink ? "true" : "false");
    openBtn.style.cssText = modalButtonStyle(true, !canOpenWhatsapp);
    if (!canOpenWhatsapp) {
      openBtn.title = zh ? "PDF 連結未準備好，請稍候" : "Wait until the PDF link is ready";
    }
    openBtn.addEventListener("click", () => {
      if (openBtn.disabled || !blobUrl || !text) return;
      copyPlainText(text);
      openWhatsappChat(text);
      document.removeEventListener("keydown", onKey);
      closeWhatsappCopiedModal();
    });

    const retryBtn = onRetry && (failed || (!hasBlob && !uploading))
      ? (() => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = copy.retry;
          btn.style.cssText = modalButtonStyle(false);
          btn.addEventListener("click", () => onRetry());
          return btn;
        })()
      : null;

    if (canSharePdfFile(pdf.file) && canOpenWhatsapp) {
      const shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.textContent = copy.share;
      shareBtn.style.cssText = modalButtonStyle(true);
      shareBtn.addEventListener("click", async () => {
        const shared = await sharePdfFile(pdf.file, text);
        if (shared) {
          document.removeEventListener("keydown", onKey);
          closeWhatsappCopiedModal();
        }
      });
      actions.append(closeBtn, downloadBtn, ...(retryBtn ? [retryBtn] : []), shareBtn, openBtn);
    } else {
      actions.append(closeBtn, downloadBtn, ...(retryBtn ? [retryBtn] : []), openBtn);
    }
    card.append(actions);
    overlay.append(card);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    if (canOpenWhatsapp) openBtn.focus();
    else if (retryBtn) retryBtn.focus();
    else closeBtn.focus();
    return;
  }

  if (failed) {
    if (onRetry) {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.textContent = copy.retry;
      retryBtn.style.cssText = modalButtonStyle(true);
      retryBtn.addEventListener("click", () => onRetry());
      actions.append(closeBtn, retryBtn);
    } else {
      actions.append(closeBtn);
    }
  } else {
    actions.append(closeBtn);
  }
  card.append(actions);
  overlay.append(card);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKey);
}

function firstImageAttachmentUrl(files) {
  const list = Array.isArray(files) ? files : [];
  const found = list.find((file) => {
    const type = String(file?.type || "");
    const url = String(file?.url || "");
    return file?.kind === "image" || type.startsWith("image/") || url.startsWith("data:image/");
  });
  return found?.url || "";
}

function quotePdfItems(rows) {
  return rows.map((line, i) => {
    const isCustom = Boolean(line.custom);
    const attachments = Array.isArray(line.attachments) ? line.attachments : [];
    return {
      index: i + 1,
      name: String(line.name || (isCustom ? "度身訂造產品" : line.productId) || "-").trim(),
      sku: line.productNo || (isCustom ? "度身訂造" : line.productId) || "-",
      qty: `${line.qty}${line.unit ? ` ${line.unit}` : ""}`,
      price: line.noOffer
        ? "不報價"
        : line.quotedUnitPrice != null && Number(line.quotedUnitPrice) > 0
          ? formatPrice(Number(line.quotedUnitPrice))
          : line.unitPrice != null
            ? formatPrice(line.unitPrice)
            : "待報價",
      spec: isCustom ? flattenWaSpec(line.description) : "",
      attachments: waAttachmentNames(attachments),
      image: line.image || firstImageAttachmentUrl(attachments) || "",
    };
  });
}

function whatsappDraftText(lines, kind, refNo) {
  const rows = (Array.isArray(lines) ? lines : []).map(enrichCartLine).filter(Boolean);
  return whatsappWrapList(rows.map((line, i) => whatsappItemBlock(line, i)).join("\n\n"), kind, refNo);
}

function whatsappDraftUrl() {
  return whatsappChatHref();
}

function quotePdfFingerprint(kind, items, refNo) {
  return JSON.stringify({
    kind: kind === "buy" ? "buy" : "quote",
    refNo: String(refNo || "").trim(),
    items: (Array.isArray(items) ? items : []).map((item) => [
      item.name,
      item.sku,
      item.qty,
      item.price,
      item.spec || "",
      item.attachments || "",
      item.image || "",
    ]),
  });
}

let whatsappPdfGeneration = 0;
let waPdfCache = null;
let waPdfInflight = null;
let waPublishInflight = null;

function attachWhatsappAssetsToRfq(refNo, published) {
  if (!refNo || !published?.blobUrl) return;
  const result = patchRfqById(refNo, (rfq) => ({
    ...rfq,
    pdfUrl: published.blobUrl,
    imageUrls: Array.isArray(published.imageUrls) ? published.imageUrls : [],
    attachmentUrls: Array.isArray(published.attachmentUrls) ? published.attachmentUrls : [],
  }));
  if (result.ok) {
    const buyerKey = rfqBuyerKind(result.rfq) === "guest" ? GUEST_KEY : result.rfq.buyerEmail;
    persistSharedRfq(buyerKey, result.rfq);
  }
}

function rememberWaPdf(fingerprint, pdf, extra = {}) {
  if (waPdfCache?.pdf?.url && waPdfCache.pdf.url !== pdf?.url && String(waPdfCache.pdf.url).startsWith("blob:")) {
    URL.revokeObjectURL(waPdfCache.pdf.url);
  }
  waPdfCache = pdf
    ? {
        fingerprint,
        pdf,
        blobUrl: extra.blobUrl || (waPdfCache?.fingerprint === fingerprint ? waPdfCache.blobUrl : "") || "",
        imageUrls: extra.imageUrls || (waPdfCache?.fingerprint === fingerprint ? waPdfCache.imageUrls : []) || [],
        attachmentUrls: extra.attachmentUrls || (waPdfCache?.fingerprint === fingerprint ? waPdfCache.attachmentUrls : []) || [],
      }
    : null;
}

async function publishRfqAssets(pdf, rows, refNo, fingerprint) {
  if (waPdfCache?.fingerprint === fingerprint && waPdfCache.blobUrl) {
    return { blobUrl: waPdfCache.blobUrl, imageUrls: waPdfCache.imageUrls || [], attachmentUrls: waPdfCache.attachmentUrls || [] };
  }
  if (waPublishInflight?.fingerprint === fingerprint) return waPublishInflight.promise;
  const promise = publishRfqPdf(pdf, rows, refNo).then((published) => {
    rememberWaPdf(fingerprint, pdf, published);
    return published;
  });
  waPublishInflight = { fingerprint, promise };
  try {
    return await promise;
  } finally {
    if (waPublishInflight?.fingerprint === fingerprint) waPublishInflight = null;
  }
}

function buildWhatsappShareText(kind, refNo, rows, blobUrl, imageUrls, attachmentUrls, details) {
  const withImages = fitWhatsappUrls(whatsappPdfHintText(kind, refNo, blobUrl, details), imageUrls, "產品圖片：");
  const extra = (Array.isArray(attachmentUrls) ? attachmentUrls : []).filter((url) => !(imageUrls || []).includes(url));
  const fitted = fitWhatsappUrls(withImages.text, extra, "規格附件：");
  const fallback = whatsappWrapList(rows.map((line, i) => whatsappItemBlock(line, i)).join("\n\n"), kind, refNo);
  return blobUrl ? fitted.text : fallback;
}

async function publishRfqPdf(pdf, rows, refNo) {
  const blobUrl = await uploadRfqPdf(pdf.file, refNo);
  const imageUrls = await collectProductImageUrls(rows, refNo);
  const attachmentUrls = await collectAttachmentUrls(rows, refNo);
  return { blobUrl, imageUrls, attachmentUrls };
}

function openWhatsappDraft(lines, kind, options = {}) {
  const rows = (Array.isArray(lines) ? lines : []).map(enrichCartLine).filter(Boolean);
  const items = quotePdfItems(rows);
  const refNo = String(options?.refNo || "").trim() || nextRfqId();
  const details = options.details || null;
  const fingerprint = quotePdfFingerprint(kind, items, refNo);
  const url = whatsappChatHref(whatsappPdfHintText(kind, refNo, "", details));
  if (typeof window === "undefined") return { url, truncated: false, copied: true, count: rows.length, refNo };

  const generation = ++whatsappPdfGeneration;

  function linkedText(published) {
    return buildWhatsappShareText(
      kind,
      refNo,
      rows,
      published?.blobUrl,
      published?.imageUrls,
      published?.attachmentUrls,
      details
    );
  }

  function showLinked(pdf, published, reused = false) {
    const text = linkedText(published);
    copyPlainText(text);
    attachWhatsappAssetsToRfq(refNo, published);
    showWhatsappPdfModal({
      kind,
      count: rows.length,
      text,
      pdf,
      reused,
      refNo,
      blobUrl: published.blobUrl,
    });
  }

  function runUpload(pdf) {
    showWhatsappPdfModal({
      kind,
      count: rows.length,
      text: "",
      pdf,
      refNo,
      uploading: true,
      onRetry: () => {
        if (generation !== whatsappPdfGeneration) return;
        runUpload(pdf);
      },
    });
    publishRfqAssets(pdf, rows, refNo, fingerprint)
      .then((published) => {
        if (generation !== whatsappPdfGeneration) return;
        if (!document.querySelector("[data-wa-copy-modal]")) return;
        if (!published?.blobUrl) throw new Error("missing pdf link");
        showLinked(pdf, published);
      })
      .catch(() => {
        if (generation !== whatsappPdfGeneration) return;
        if (!document.querySelector("[data-wa-copy-modal]")) return;
        showWhatsappPdfModal({
          kind,
          count: rows.length,
          text: "",
          pdf,
          refNo,
          failed: true,
          onRetry: () => {
            if (generation !== whatsappPdfGeneration) return;
            runUpload(pdf);
          },
        });
      });
  }

  const cached = waPdfCache?.fingerprint === fingerprint ? waPdfCache : null;
  if (cached?.pdf && cached.blobUrl) {
    showLinked(cached.pdf, cached, true);
    return { url: whatsappChatHref(linkedText(cached)), truncated: false, copied: true, count: rows.length, refNo, reused: true };
  }

  showWhatsappPdfModal({ kind, count: rows.length, text: "", refNo });
  const pending =
    waPdfInflight?.fingerprint === fingerprint
      ? waPdfInflight.promise
      : buildQuotePdf({ kind, items, refNo }).then((pdf) => {
          rememberWaPdf(fingerprint, pdf);
          return pdf;
        });
  waPdfInflight = { fingerprint, promise: pending };
  pending
    .then(async (pdf) => {
      if (generation !== whatsappPdfGeneration) return;
      if (!document.querySelector("[data-wa-copy-modal]")) return;
      runUpload(pdf);
    })
    .catch(() => {
      if (generation !== whatsappPdfGeneration) return;
      if (!document.querySelector("[data-wa-copy-modal]")) return;
      if (waPdfInflight?.fingerprint === fingerprint) waPdfInflight = null;
      showWhatsappPdfModal({
        kind,
        count: rows.length,
        text: "",
        failed: true,
        refNo,
        onRetry: () => openWhatsappDraft(lines, kind, options),
      });
    });
  return { url, truncated: false, copied: false, count: rows.length, refNo };
}

function whatsappNow(productId, { qty, kind, lang = "zh", skipCart = false } = {}) {
  const product = getProduct(productId);
  if (!product || isDiscontinued(product) || !isOrderable(product)) return { ok: false, error: "discontinued" };
  const intent = kind === "buy" ? "buy" : "quote";
  const minQty = Math.max(1, Number(product.moq) || 1);
  const addQty = Math.max(minQty, Math.floor(Number(qty)) || minQty);
  const line = { productId, qty: addQty, intent };
  const snapshot = skipCart ? getDraft() : null;
  if (skipCart) {
    const others = snapshot.lines.filter((row) => String(row.productId) !== String(productId) || row.custom);
    setDraft({ ...snapshot, lines: [...others, line] });
  } else {
    addToCart(productId, { intent, qty: addQty });
  }
  const submitted = submitRfq([productId], {
    kind: intent,
    skipLogistics: true,
    channel: "whatsapp",
    allowGuest: !isLoggedIn(),
  });
  if (skipCart) setDraft(snapshot);
  if (!submitted.ok && submitted.error !== "not_logged_in") return submitted;
  const rfq = submitted.ok ? submitted.rfq : null;
  return { ok: true, ...openWhatsappDraft([line], intent, { refNo: rfq?.id }), rfq };
}

function whatsappUrl() {
  return whatsappChatHref();
}

function rfqProjectName(rfq) {
  if (!rfq) return "";
  return joinProfileProjects(rfq.projects || rfq.project);
}

const STAFF_KEY = "subbie_staff";
const STAFF_AUTH_KEY = "subbie_staff_auth";
const REPORTS_KEY = "subbie_product_reports";
const PRODUCT_PATCH_KEY = "subbie_product_patches";
const REPORT_SEQ_KEY = "subbie_report_seq";
const TMS_SEQ_KEY = "subbie_tms_seq";
const TMP_SEQ_KEY = "subbie_tmp_sku_seq";

const BOOTSTRAP_STAFF_EMAIL = "sales@mattex.com.hk";
const LEGACY_BOOTSTRAP_STAFF_EMAILS = ["sales@mattex.com", "supabase@mattex.com.hk"];

function migrateStaffRow(row) {
  if (!row?.email) return row;
  const email = normalizeEmail(row.email);
  const legacy = LEGACY_BOOTSTRAP_STAFF_EMAILS.includes(email);
  if (!legacy && email !== BOOTSTRAP_STAFF_EMAIL) return withoutSecrets({ ...row, email });
  return withoutSecrets({
    ...row,
    email: BOOTSTRAP_STAFF_EMAIL,
    name: !row.name || row.name === "Supabase" ? "Sales" : row.name,
    bootstrap: true,
    enabled: row.enabled !== false,
  });
}

function mergeStaffLists(local, remote) {
  const byEmail = new Map();
  const add = (row) => {
    const migrated = migrateStaffRow(row);
    if (!migrated?.email) return;
    const email = normalizeEmail(migrated.email);
    const prev = byEmail.get(email) || {};
    byEmail.set(email, { ...prev, ...migrated, email });
  };
  (Array.isArray(remote) ? remote : []).forEach(add);
  (Array.isArray(local) ? local : []).forEach(add);
  if (!byEmail.has(BOOTSTRAP_STAFF_EMAIL)) {
    byEmail.set(BOOTSTRAP_STAFF_EMAIL, {
      email: BOOTSTRAP_STAFF_EMAIL,
      name: "Sales",
      enabled: true,
      bootstrap: true,
    });
  }
  return [...byEmail.values()];
}

function getStaffList() {
  const saved = readJson(STAFF_KEY, null);
  const seeded = [{ email: BOOTSTRAP_STAFF_EMAIL, name: "Sales", enabled: true, bootstrap: true }];
  const source = Array.isArray(saved) && saved.length ? saved : seeded;
  const next = mergeStaffLists(source, []);
  const fingerprint = (list) =>
    (list || [])
      .map((s) => `${normalizeEmail(s.email)}|${s.password ? 1 : 0}|${s.name || ""}|${Boolean(s.bootstrap)}|${s.enabled !== false}`)
      .sort()
      .join(";");
  if (!(Array.isArray(saved) && saved.length) || fingerprint(source) !== fingerprint(next)) {
    writeJson(STAFF_KEY, next);
  }
  return next;
}

function setStaffList(list) {
  writeJson(STAFF_KEY, (list || []).map(withoutSecrets));
}

function staffInvitePending(account) {
  return Boolean(account?.invitePending);
}

function getStaffAccount(email) {
  return getStaffList().find((s) => s.email === normalizeEmail(email)) || null;
}

function getStaffSession() {
  return readJson(STAFF_AUTH_KEY, null);
}

function requireStaff() {
  const session = getStaffSession();
  if (!session?.email) return { ok: false, error: "staff" };
  const account = getStaffAccount(session.email);
  if (account && !account.enabled) return { ok: false, error: "staff" };
  if (!account) {
    return {
      ok: true,
      account: {
        email: normalizeEmail(session.email),
        name: String(session.name || session.email).trim() || session.email,
        enabled: true,
      },
    };
  }
  return { ok: true, account };
}

function startStaffSession(account) {
  writeLocalOnly(STAFF_AUTH_KEY, { email: account.email, name: account.name, at: Date.now() });
  emitStoreChange();
  return getStaffSession();
}

function markStaffInvite(email, invitePending) {
  const list = getStaffList();
  const target = list.find((s) => s.email === normalizeEmail(email));
  if (!target) return;
  target.invitePending = invitePending;
  target.enabled = true;
  setStaffList(list);
}

async function loginStaff({ email, password }) {
  const result = await authApi("login", { kind: "staff", email: normalizeEmail(email), password });
  if (!result.ok) return { ok: false, error: result.error || "password" };
  const local = getStaffAccount(result.account.email);
  return { ok: true, staff: startStaffSession({ email: result.account.email, name: local?.name || result.account.name }) };
}

function logoutStaff() {
  authApi("logout", { kind: "staff" });
  localStorage.removeItem(STAFF_AUTH_KEY);
  emitStoreChange();
}

async function verifyStaffSession() {
  const local = getStaffSession();
  if (!local?.email) return;
  const result = await authApi("session", { kind: "staff" });
  if (result.error === "network") return;
  if (result.ok && normalizeEmail(result.account?.email) === normalizeEmail(local.email)) return;
  localStorage.removeItem(STAFF_AUTH_KEY);
  emitStoreChange();
}


function staffInviteMailHref({ email, name, href }) {
  const who = String(name || "there").trim() || "there";
  const subject = "Set your Mattex Sales portal password";
  const body = [
    `Hello ${who},`,
    "",
    "You've been invited to the Mattex Sales portal.",
    "Open this link to set your password:",
    "",
    href,
    "",
    "The link expires in 7 days. If you did not expect this, ignore the email.",
    "",
    "Mattex Marketplace",
  ].join("\n");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function inviteStaff(target) {
  const result = await authApi("issue-invite", { email: target.email, name: target.name });
  if (!result.ok) return { ok: false, error: result.error || "server" };
  markStaffInvite(target.email, true);
  emitStoreChange();
  return {
    ok: true,
    href: result.href,
    mailto: staffInviteMailHref({ email: target.email, name: target.name, href: result.href }),
    email: target.email,
  };
}

async function createStaff({ email, name }) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const nextEmail = normalizeEmail(email);
  const nextName = String(name || "").trim();
  if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return { ok: false, error: "email" };
  if (!nextName) return { ok: false, error: "name" };
  if (getStaffAccount(nextEmail) || getAccount(nextEmail)) return { ok: false, error: "taken" };
  const list = getStaffList();
  const account = {
    email: nextEmail,
    name: nextName,
    enabled: true,
    bootstrap: false,
    invitePending: true,
    invitedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  list.unshift(account);
  setStaffList(list);
  emitStoreChange();
  return inviteStaff(account);
}

async function resendStaffInvite(email) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const target = getStaffAccount(email);
  if (!target) return { ok: false, error: "missing" };
  return inviteStaff(target);
}

async function getStaffPasswordLink(token) {
  const info = await authApi("token-info", { token: String(token || "").trim() });
  if (!info.ok || info.kind !== "staff") return null;
  return { email: info.email, name: info.name, expired: Boolean(info.expired), kind: info.purpose };
}

async function acceptStaffPasswordLink({ token, password }) {
  if (!isSignupPasswordOk(password)) return { ok: false, error: "password" };
  const result = await authApi("accept-token", { token: String(token || "").trim(), password });
  if (!result.ok) return { ok: false, error: result.error || "token" };
  if (result.kind !== "staff") return { ok: false, error: "token" };
  markStaffInvite(result.account.email, false);
  const local = getStaffAccount(result.account.email);
  return { ok: true, staff: startStaffSession({ email: result.account.email, name: local?.name || result.account.name }) };
}

async function requestStaffPasswordReset(email) {
  const nextEmail = normalizeEmail(email);
  if (!nextEmail) return { ok: false, error: "email" };
  await authApi("request-reset", { kind: "staff", email: nextEmail });
  return { ok: true };
}

function updateStaff(email, { name } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const list = getStaffList();
  const target = list.find((s) => s.email === normalizeEmail(email));
  if (!target) return { ok: false, error: "missing" };
  if (name != null) {
    const nextName = String(name).trim();
    if (!nextName) return { ok: false, error: "name" };
    target.name = nextName;
  }
  setStaffList(list);
  emitStoreChange();
  return { ok: true };
}

async function changeOwnStaffPassword({ currentPassword, nextPassword } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  if (!isSignupPasswordOk(nextPassword)) return { ok: false, error: "password" };
  if (String(currentPassword) === String(nextPassword)) return { ok: false, error: "same" };
  const result = await authApi("change-password", { kind: "staff", currentPassword, nextPassword });
  if (result.ok) return { ok: true };
  if (result.error === "staff") logoutStaff();
  return { ok: false, error: result.error || "server" };
}

function disableStaff(email) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const list = getStaffList();
  const target = list.find((s) => s.email === normalizeEmail(email));
  if (!target) return { ok: false, error: "missing" };
  if (list.filter((s) => s.enabled).length <= 1 && target.enabled) return { ok: false, error: "last" };
  target.enabled = false;
  setStaffList(list);
  releaseStaffHeldWork(target);
  if (normalizeEmail(getStaffSession()?.email) === target.email) localStorage.removeItem(STAFF_AUTH_KEY);
  emitStoreChange();
  return { ok: true };
}

function releaseStaffHeldWork(target) {
  const staffEmail = normalizeEmail(target?.email);
  if (!staffEmail) return;
  const who = String(target.name || target.email || staffEmail).trim() || staffEmail;
  const at = new Date().toISOString();
  const map = getRfqsMap();
  Object.keys(map || {}).forEach((key) => {
    const rows = Array.isArray(map[key]) ? map[key] : [];
    map[key] = rows.map((rfq) => {
      if (normalizeEmail(rfq.reviewingBy) !== staffEmail) return rfq;
      let next = { ...rfq, reviewingBy: "" };
      if (next.reviewStatus === "reviewing" || inboxStatus(next) === "reviewing") next.reviewStatus = "received";
      return pushRfqActivity(next, "released", { at, by: staffEmail, detail: who });
    });
  });
  setRfqsMap(map);
  getReports().forEach((r) => {
    if (normalizeEmail(r.lookingBy) === staffEmail) {
      r.lookingBy = "";
      if (r.status === "looking") r.status = "open";
    }
  });
  writeJson(REPORTS_KEY, getReports());
}

function canDeleteStaffForever(account) {
  if (!account || account.enabled) return false;
  const sessionEmail = normalizeEmail(getStaffSession()?.email);
  if (sessionEmail && sessionEmail === normalizeEmail(account.email)) return false;
  return getStaffList().some((row) => row.enabled && normalizeEmail(row.email) !== normalizeEmail(account.email));
}

function hardDeleteStaff(email) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const list = getStaffList();
  const key = normalizeEmail(email);
  const target = list.find((s) => s.email === key);
  if (!target) return { ok: false, error: "missing" };
  if (target.enabled) return { ok: false, error: "active" };
  if (normalizeEmail(gate.account.email) === key) return { ok: false, error: "self" };
  if (!list.some((s) => s.enabled && s.email !== key)) return { ok: false, error: "last" };
  setStaffList(list.filter((s) => s.email !== key));
  emitStoreChange();
  return { ok: true };
}

function enableStaff(email) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const list = getStaffList();
  const target = list.find((s) => s.email === normalizeEmail(email));
  if (!target) return { ok: false, error: "missing" };
  target.enabled = true;
  setStaffList(list);
  emitStoreChange();
  return { ok: true };
}

function listBuyers() {
  persistLegacyBuyerAccess();
  const map = getAccountsMap();
  return sortByNewest(
    Object.values(map || {}).map((a) => ({
      email: a.email,
      name: a.name,
      phone: a.phone || "",
      phoneWhatsapp: Boolean(a.phoneWhatsapp),
      jobTitle: a.jobTitle || "",
      companyName: a.companyName,
      companyReg: a.companyReg || "",
      companyPhone: a.companyPhone || "",
      companyAddress: a.companyAddress || "",
      project: a.project || "",
      projects: normalizeProfileProjects(a.projects || a.project),
      enabled: a.enabled !== false,
      approvalStatus: buyerApprovalStatus(a),
      createdAt: a.createdAt || "",
      approvedAt: a.approvedAt || "",
      reviewedAt: a.reviewedAt || "",
      needsReview: Boolean(a.needsReview),
      rejectedAt: a.rejectedAt || "",
      rejectReason: a.rejectReason || "",
    })),
    (buyer) => buyer.createdAt
  );
}

function setBuyerEnabled(email, enabled) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const map = getAccountsMap();
  const key = normalizeEmail(email);
  if (!map[key]) return { ok: false, error: "missing" };
  map[key].enabled = Boolean(enabled);
  if (enabled) {
    map[key].approvalStatus = "approved";
    map[key].approvedAt = new Date().toISOString();
  }
  setAccountsMap(map);
  emitStoreChange();
  return { ok: true };
}

function approveBuyer(email) {
  return setBuyerEnabled(email, true);
}

function markBuyerReviewed(email) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const map = getAccountsMap();
  const key = normalizeEmail(email);
  if (!map[key]) return { ok: false, error: "missing" };
  map[key].reviewedAt = new Date().toISOString();
  map[key].needsReview = false;
  setAccountsMap(map);
  emitStoreChange();
  return { ok: true };
}

function isDeliverableEmail(email) {
  const value = normalizeEmail(email);
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  if (value === "guest@subbie.store" || value.startsWith("guest@")) return false;
  return true;
}

function isLocalBrowserHost() {
  if (typeof window === "undefined") return true;
  const host = String(window.location?.hostname || "");
  return host === "localhost" || host === "127.0.0.1";
}

function shouldSendViaResend() {
  return !isLocalBrowserHost();
}

function mattexLogoUrl() {
  return `${marketplaceOrigin()}/assets/mattex-logo.webp`;
}

function rfqMailContext(rfq) {
  const shop = marketplaceOrigin();
  const admin = adminOrigin();
  const id = rfq?.id || "RFQ";
  return {
    logoUrl: mattexLogoUrl(),
    salesEmail: SALES_EMAIL,
    name: String(rfq?.buyerName || "there").trim() || "there",
    rfqId: id,
    buyerName: String(rfq?.buyerName || "Buyer").trim() || "Buyer",
    buyerEmail: rfq?.buyerEmail || "",
    project: String(rfq?.project || "").trim(),
    lineCount: (rfq?.lines || []).length,
    reason: String(rfq?.reason || "").trim(),
    rfqsHref: `${shop}/zh/rfqs`,
    shopHref: `${shop}/zh`,
    portalHref: `${admin}/?rfq=${encodeURIComponent(id)}`,
    toEmail: rfq?.buyerEmail,
  };
}

function buildLifecycleEmail(rfq, kind) {
  const ctx = rfqMailContext(rfq);
  if (kind === "sales-new-rfq") {
    return {
      to: SALES_EMAIL,
      subject: `New RFQ ${ctx.rfqId} from Marketplace`,
      innerHtml: salesNewRfqEmailHtml(ctx),
    };
  }
  if (kind === "rfq-accepted") {
    return {
      to: ctx.toEmail,
      subject: `Your RFQ ${ctx.rfqId} is in review`,
      innerHtml: rfqAcceptedEmailHtml(ctx),
    };
  }
  if (kind === "rfq-no-offer") {
    return {
      to: ctx.toEmail,
      subject: `No offer on RFQ ${ctx.rfqId}`,
      innerHtml: rfqNoOfferEmailHtml(ctx),
    };
  }
  if (kind === "rfq-cancel-requested") {
    return {
      to: SALES_EMAIL,
      subject: `Cancel requested for RFQ ${ctx.rfqId}`,
      innerHtml: rfqCancelRequestedEmailHtml(ctx),
    };
  }
  if (kind === "rfq-cancel-accepted") {
    return {
      to: ctx.toEmail,
      subject: `RFQ ${ctx.rfqId} was cancelled`,
      innerHtml: rfqCancelAcceptedEmailHtml(ctx),
    };
  }
  if (kind === "rfq-cancel-declined") {
    return {
      to: ctx.toEmail,
      subject: `RFQ ${ctx.rfqId} remains open`,
      innerHtml: rfqCancelDeclinedEmailHtml(ctx),
    };
  }
  if (kind === "rfq-reverse-requested") {
    return {
      to: SALES_EMAIL,
      subject: `Reverse requested for RFQ ${ctx.rfqId}`,
      innerHtml: rfqReverseRequestedEmailHtml(ctx),
    };
  }
  if (kind === "rfq-reverse-accepted") {
    return {
      to: ctx.toEmail,
      subject: `You can revise RFQ ${ctx.rfqId}`,
      innerHtml: rfqReverseAcceptedEmailHtml(ctx),
    };
  }
  if (kind === "rfq-reverse-declined") {
    return {
      to: ctx.toEmail,
      subject: `RFQ ${ctx.rfqId} remains in review`,
      innerHtml: rfqReverseDeclinedEmailHtml(ctx),
    };
  }
  return null;
}

function inferRfqEmailPreviewKind(rfq) {
  const status = inboxStatus(rfq);
  if (rfq?.cancelStatus === "requested") return "rfq-cancel-requested";
  if (status === "cancelled") return "rfq-cancel-accepted";
  if (status === "no_offer" || status === "rejected") return "rfq-no-offer";
  if (rfq?.cancelStatus === "declined") return "rfq-cancel-declined";
  if (status === "accepted" || status === "quoted") return "rfq-accepted";
  return "";
}

function openHtmlEmail() {
  return { ok: true, skipped: true };
}

async function postResendEmail({ to, subject, innerHtml }) {
  if (!isDeliverableEmail(to)) return { ok: false, error: "email" };
  const html = wrapEmailSend({ subject, innerHtml, fontBase: marketplaceOrigin() });
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: normalizeEmail(to), subject, html }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) return { ok: false, error: data?.error || "send" };
    return { ok: true, skipped: Boolean(data?.skipped) };
  } catch {
    return { ok: false, error: "network" };
  }
}

function deliverHtmlEmail({ to, subject, innerHtml }) {
  if (!isDeliverableEmail(to)) return { ok: false, error: "email" };
  const log = readJson("subbie_buyer_mail_log", []);
  writeJson(
    "subbie_buyer_mail_log",
    [{ to: normalizeEmail(to), subject, at: new Date().toISOString(), html: true }, ...(Array.isArray(log) ? log : [])].slice(0, 40)
  );
  return postResendEmail({ to: normalizeEmail(to), subject, innerHtml });
}

async function deliverSalesToBuyerEmail({ to, subject, innerHtml }) {
  if (!isDeliverableEmail(to)) return { ok: false, error: "email" };
  const log = readJson("subbie_buyer_mail_log", []);
  writeJson(
    "subbie_buyer_mail_log",
    [{ to: normalizeEmail(to), subject, at: new Date().toISOString(), html: true }, ...(Array.isArray(log) ? log : [])].slice(0, 40)
  );
  return postResendEmail({ to, subject, innerHtml });
}

function openRfqEmailPreview() {
  return { ok: true, skipped: true };
}

function deliverRfqSubmittedEmail(rfq) {
  const name = String(rfq?.buyerName || "there").trim() || "there";
  const id = rfq?.id || "RFQ";
  const n = (rfq?.lines || []).length;
  const project = String(rfq?.project || "").trim();
  return deliverHtmlEmail({
    to: rfq?.buyerEmail,
    subject: `We received your RFQ ${id}`,
    innerHtml: rfqSubmittedEmailHtml({
      logoUrl: mattexLogoUrl(),
      salesEmail: SALES_EMAIL,
      name,
      rfqId: id,
      project,
      lineCount: n,
      rfqsHref: `${marketplaceOrigin()}/zh/rfqs`,
      shopHref: `${marketplaceOrigin()}/zh`,
      toEmail: rfq?.buyerEmail,
    }),
  });
}

function deliverRfqToSalesEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "sales-new-rfq");
  if (!mail) return { ok: false };
  return deliverHtmlEmail(mail);
}

async function deliverRfqAcceptedEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "rfq-accepted");
  if (!mail) return { ok: false, error: "email" };
  return deliverSalesToBuyerEmail({ ...mail });
}

async function deliverRfqNoOfferEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "rfq-no-offer");
  if (!mail) return { ok: false, error: "email" };
  return deliverSalesToBuyerEmail({ ...mail });
}

async function deliverRfqCancelAcceptedEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "rfq-cancel-accepted");
  if (!mail) return { ok: false, error: "email" };
  return deliverSalesToBuyerEmail({ ...mail });
}

async function deliverRfqCancelDeclinedEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "rfq-cancel-declined");
  if (!mail) return { ok: false, error: "email" };
  return deliverSalesToBuyerEmail({ ...mail });
}

function deliverRfqCancelRequestedEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "rfq-cancel-requested");
  if (!mail) return { ok: false };
  return deliverHtmlEmail(mail);
}

function deliverRfqReverseRequestedEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "rfq-reverse-requested");
  if (!mail) return { ok: false };
  return deliverHtmlEmail(mail);
}

async function deliverRfqReverseAcceptedEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "rfq-reverse-accepted");
  if (!mail) return { ok: false, error: "email" };
  return deliverSalesToBuyerEmail({ ...mail });
}

async function deliverRfqReverseDeclinedEmail(rfq) {
  const mail = buildLifecycleEmail(rfq, "rfq-reverse-declined");
  if (!mail) return { ok: false, error: "email" };
  return deliverSalesToBuyerEmail({ ...mail });
}

function deliverAccountCreatedEmail(account) {
  const name = String(account?.name || "there").trim() || "there";
  const company = String(account?.companyName || "").trim();
  const email = account?.email;
  const mail = {
    to: RESEND_ACCOUNT_EMAIL,
    subject: "Your Mattex Marketplace account is ready",
    innerHtml: accountCreatedEmailHtml({
      logoUrl: mattexLogoUrl(),
      salesEmail: SALES_EMAIL,
      name,
      email,
      company,
      shopHref: `${marketplaceOrigin()}/zh`,
    }),
  };
  const log = readJson("subbie_buyer_mail_log", []);
  writeJson(
    "subbie_buyer_mail_log",
    [{ to: RESEND_ACCOUNT_EMAIL, subject: mail.subject, at: new Date().toISOString(), html: true }, ...(Array.isArray(log) ? log : [])].slice(0, 40)
  );
  return postResendEmail({ ...mail });
}




function deliverBuyerRejectedEmail(buyer, reason) {
  const name = String(buyer?.name || "there").trim() || "there";
  const company = String(buyer?.companyName || "").trim();
  return deliverSalesToBuyerEmail({
    to: buyer?.email,
    subject: "Your Mattex Marketplace account application",
    innerHtml: buyerRejectedEmailHtml({
      logoUrl: mattexLogoUrl(),
      salesEmail: SALES_EMAIL,
      name,
      company,
      reason,
      shopHref: `${marketplaceOrigin()}/zh`,
      toEmail: buyer?.email,
    }),
  });
}

function openMailto(href) {
  if (typeof document === "undefined" || !href) return;
  const link = document.createElement("a");
  link.href = href;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const ADMIN_ALERTS_KEY = "subbie_admin_alerts";

function listAdminAlerts() {
  const list = readJson(ADMIN_ALERTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

function setAdminAlerts(list) {
  writeJson(ADMIN_ALERTS_KEY, (list || []).slice(0, 40));
}

function requestAdminNotifyPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function showAdminWebNotification(title, body, href) {
  if (typeof Notification === "undefined") return;
  const fire = () => {
    try {
      const note = new Notification(title, {
        body,
        tag: title,
        icon: "/assets/mattex-logo.webp",
      });
      note.onclick = () => {
        window.focus();
        if (href) window.location.assign(href);
        note.close();
      };
    } catch {
      /* ignore blocked notifications */
    }
  };
  if (Notification.permission === "granted") fire();
  else if (Notification.permission !== "denied") {
    Notification.requestPermission()
      .then((perm) => {
        if (perm === "granted") fire();
      })
      .catch(() => {});
  }
}

function notifyAdmins({ kind, title, body, href } = {}) {
  const alert = {
    id: `AL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: kind || "rfq",
    title: String(title || "Mattex Marketplace"),
    body: String(body || ""),
    href: String(href || `${adminOrigin()}/`),
    createdAt: new Date().toISOString(),
    seen: false,
    mailed: false,
  };
  setAdminAlerts([alert, ...listAdminAlerts()]);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("subbie-admin-alert", { detail: alert }));
  }
  emitStoreChange();
  return alert;
}

function markAdminAlertsMailed(ids) {
  const want = new Set((ids || []).map(String));
  setAdminAlerts(
    listAdminAlerts().map((row) => (want.has(String(row.id)) ? { ...row, mailed: true } : row))
  );
  emitStoreChange();
}

function markAdminAlertsSeen() {
  setAdminAlerts(listAdminAlerts().map((row) => ({ ...row, seen: true })));
  emitStoreChange();
}

function adminAlertMailto(alerts) {
  const rows = alerts || [];
  if (!rows.length) return "";
  const subject = rows.length === 1 ? rows[0].title : `${rows.length} new Mattex Marketplace alerts`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const body = rows
    .map((row) => {
      const link = row.href ? `${origin}${row.href}` : "";
      return [row.title, row.body, link].filter(Boolean).join("\n");
    })
    .join("\n\n");
  return `mailto:${encodeURIComponent(SALES_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function deliverAdminAlertEmails(alerts) {
  const href = adminAlertMailto(alerts);
  if (!href) return;
  openMailto(href);
  markAdminAlertsMailed((alerts || []).map((row) => row.id));
}

function rejectBuyer(email, { reason } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const why = String(reason || "").trim();
  if (!why) return { ok: false, error: "reason" };
  const map = getAccountsMap();
  const key = normalizeEmail(email);
  if (!map[key]) return { ok: false, error: "missing" };
  map[key].approvalStatus = "rejected";
  map[key].enabled = false;
  map[key].rejectedAt = new Date().toISOString();
  map[key].rejectReason = why;
  setAccountsMap(map);
  emitStoreChange();
  deliverBuyerRejectedEmail(map[key], why);
  return { ok: true };
}

function canDeleteBuyerForever(account) {
  if (!account) return false;
  return account.enabled === false || buyerApprovalStatus(account) === "rejected";
}

function hardDeleteBuyer(email) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const map = getAccountsMap();
  const key = normalizeEmail(email);
  const account = map[key];
  if (!account) return { ok: false, error: "missing" };
  if (!canDeleteBuyerForever({ ...account, enabled: account.enabled !== false, approvalStatus: buyerApprovalStatus(account) })) {
    return { ok: false, error: "active" };
  }
  const rfqsMap = getRfqsMap();
  const held = Array.isArray(rfqsMap[key]) ? rfqsMap[key] : [];
  if (held.length) {
    const orphan = `__deleted_buyer__:${key}:${Date.now()}`;
    rfqsMap[orphan] = held.map((rfq) => ({
      ...rfq,
      buyerEmail: rfq.buyerEmail || account.email,
      buyerName: rfq.buyerName || account.name || "",
      buyerKind: rfq.buyerKind === "guest" ? "guest" : "member",
    }));
    delete rfqsMap[key];
    setRfqsMap(rfqsMap);
  }
  rememberDeletedBuyer(key);
  delete map[key];
  setAccountsMap(map);
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    if (session && normalizeEmail(session.email) === key) localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
  emitStoreChange();
  return { ok: true };
}

function listAssignableBuyers() {
  return listBuyers().filter((buyer) => buyer.enabled && buyer.approvalStatus !== "rejected");
}

function getAllRfqs() {
  const map = getRfqsMap();
  const byId = new Map();
  Object.entries(map || {}).forEach(([buyerEmail, list]) => {
    (Array.isArray(list) ? list : []).forEach((rfq) => {
      const row = { ...rfq, buyerEmail: rfq.buyerEmail || buyerEmail };
      if (!row.id) return;
      const prev = byId.get(row.id);
      if (!prev) {
        byId.set(row.id, row);
        return;
      }
      const prevDeleted = String(prev.buyerEmail || "").startsWith("__deleted_buyer__");
      const nextDeleted = String(row.buyerEmail || "").startsWith("__deleted_buyer__");
      if (prevDeleted !== nextDeleted) {
        byId.set(row.id, nextDeleted ? prev : row);
        return;
      }
      byId.set(row.id, pickRfq(prev, row));
    });
  });
  return sortRfqsNewestFirst([...byId.values()]);
}

function persistAllRfqsTouched() {
  /* getAllRfqs clones; patch via map */
}

function patchRfqById(id, fn) {
  const map = getRfqsMap();
  let found = null;
  Object.keys(map || {}).forEach((key) => {
    const list = Array.isArray(map[key]) ? map[key] : [];
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return;
    list[idx] = fn(list[idx], key) || list[idx];
    map[key] = list;
    found = list[idx];
  });
  if (!found) return { ok: false, error: "missing" };
  setRfqsMap(map);
  emitStoreChange();
  return { ok: true, rfq: found };
}

function inboxStatus(rfq) {
  if (rfq?.cancelStatus === "accepted" || rfq?.reviewStatus === "cancelled") return "cancelled";
  if (rfq?.reviewStatus === "rejected") return "no_offer";
  if (rfq?.reviewStatus === "revising") return "revising";
  if (rfq?.reviewStatus) return rfq.reviewStatus;
  if (["accepted", "returned", "rejected", "reviewing", "received", "no_offer", "revising"].includes(rfq?.status)) {
    return rfq.status === "rejected" ? "no_offer" : rfq.status;
  }
  return "received";
}

function rfqIsNoOffer(rfq) {
  if (inboxStatus(rfq) === "no_offer") return true;
  const lines = rfq?.lines || [];
  return lines.length > 0 && lines.every((line) => line.noOffer);
}

function startRfqReview(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  return patchRfqById(id, (rfq) => {
    const status = inboxStatus(rfq);
    if (status === "accepted" || status === "quoted" || status === "no_offer" || status === "cancelled" || status === "revising") return rfq;
    if (rfq.reverseStatus === "requested") return rfq;
    return { ...rfq, reviewStatus: "reviewing", reviewingBy: gate.account.email };
  });
}

function rfqBuyerKind(rfq) {
  const email = normalizeEmail(rfq?.buyerEmail);
  if (!email || email === GUEST_KEY || email === "guest@subbie.store" || email.startsWith("guest@")) return "guest";
  return "member";
}

/** Marketplace submissions that belong in the sales inbox (guest + member). */
function isDev1InboxRfq(rfq) {
  return Boolean(rfq?.id);
}

function setRfqLineQuotedPrice(id, productId, price) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const raw = price === "" || price == null ? null : Number(price);
  const nextPrice = Number.isFinite(raw) && raw >= 0 ? raw : null;
  return patchRfqById(id, (rfq) => ({
    ...rfq,
    lines: (rfq.lines || []).map((line) =>
      String(line.productId) === String(productId) ? { ...line, quotedUnitPrice: nextPrice, noOffer: false } : line
    ),
  }));
}

function setRfqLineQty(id, productId, qty) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const nextQty = Math.max(1, Math.floor(Number(qty) || 1));
  return patchRfqById(id, (rfq) => ({
    ...rfq,
    lines: (rfq.lines || []).map((line) =>
      String(line.productId) === String(productId) ? { ...line, qty: nextQty } : line
    ),
  }));
}

function setRfqLineRemark(id, productId, remark) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  return patchRfqById(id, (rfq) => ({
    ...rfq,
    lines: (rfq.lines || []).map((line) =>
      String(line.productId) === String(productId) ? { ...line, remark: String(remark || "") } : line
    ),
  }));
}

function setRfqLineNoOffer(id, productId, noOffer = true) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  return patchRfqById(id, (rfq) => {
    const status = inboxStatus(rfq);
    if (status === "cancelled") return rfq;
    const lines = (rfq.lines || []).map((line) =>
      String(line.productId) === String(productId)
        ? { ...line, noOffer: Boolean(noOffer), quotedUnitPrice: Boolean(noOffer) ? null : line.quotedUnitPrice }
        : line
    );
    const allNoOffer = lines.length > 0 && lines.every((line) => line.noOffer);
    const wasNoOffer = inboxStatus(rfq) === "no_offer";
    const reason = allNoOffer ? rfq.reason || "No offer" : rfq.reason;
    const next = {
      ...rfq,
      lines,
      reviewStatus: allNoOffer ? "no_offer" : rfq.reviewStatus === "no_offer" ? "accepted" : rfq.reviewStatus,
      reason,
    };
    if (allNoOffer && !wasNoOffer) {
      const at = new Date().toISOString();
      return pushRfqActivity({ ...next, noOfferAt: at }, "no_offer", {
        at,
        detail: reason,
        by: gate.account.email,
      });
    }
    return next;
  });
}

function assignRfqToBuyer(id, buyerEmail) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const buyer = listAssignableBuyers().find((b) => normalizeEmail(b.email) === normalizeEmail(buyerEmail));
  if (!buyer) return { ok: false, error: "missing_buyer" };
  const map = getRfqsMap();
  let found = null;
  let fromKey = "";
  Object.keys(map || {}).forEach((key) => {
    const list = Array.isArray(map[key]) ? map[key] : [];
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return;
    found = list[idx];
    fromKey = key;
  });
  if (!found) return { ok: false, error: "missing" };
  if (rfqBuyerKind(found) === "member") return { ok: false, error: "locked" };
  Object.keys(map || {}).forEach((key) => {
    const list = Array.isArray(map[key]) ? map[key] : [];
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return;
    list.splice(idx, 1);
    map[key] = list;
  });
  const dest = normalizeEmail(buyer.email);
  const assignedAt = new Date().toISOString();
  const next = pushRfqActivity(
    {
      ...found,
      buyerEmail: buyer.email,
      buyerName: buyer.name || found.buyerName || "",
      buyerKind: "member",
      buyerPhone: found.buyerPhone || buyer.phone || "",
      assignedFromGuest: Boolean(fromKey && fromKey !== dest),
      assignedAt,
    },
    "assigned",
    { at: assignedAt, detail: buyer.email, by: gate.account.email }
  );
  map[dest] = [next, ...(Array.isArray(map[dest]) ? map[dest] : [])];
  setRfqsMap(map);
  emitStoreChange();
  return { ok: true, rfq: next };
}

function setRfqBuyerPhone(id, phone) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const nextPhone = String(phone || "").trim();
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  const email = normalizeEmail(current.buyerEmail);
  const accounts = getAccountsMap();
  if (email && accounts[email]) {
    accounts[email] = { ...accounts[email], phone: nextPhone };
    setAccountsMap(accounts);
  }
  return patchRfqById(id, (rfq) => ({ ...rfq, buyerPhone: nextPhone }));
}

function getQuoteSnapshots() {
  const map = readJson(QUOTE_SNAPSHOTS_KEY, {});
  return map && typeof map === "object" ? map : {};
}

function setQuoteSnapshots(map) {
  writeJson(QUOTE_SNAPSHOTS_KEY, map && typeof map === "object" ? map : {});
}

function mergeQuoteSnapshots(incoming, existing) {
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...(incoming && typeof incoming === "object" ? incoming : {}),
  };
}

function newGuestQuoteToken() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${rand}`;
}

function snapshotLineImage(line) {
  const image = String(line?.image || "").trim();
  return image.startsWith("data:") ? "" : image;
}

function freezeQuoteLines(lines) {
  return (lines || []).map((line) => {
    const qty = Number(line.qty) || 0;
    const unitPrice = line.noOffer
      ? null
      : Number(line.quotedUnitPrice) > 0
        ? Number(line.quotedUnitPrice)
        : null;
    return {
      productId: line.productId,
      name: line.name || "",
      productNo: line.productNo || "",
      qty,
      unit: line.unit || "",
      quotedUnitPrice: unitPrice,
      noOffer: Boolean(line.noOffer),
      custom: Boolean(line.custom),
      remark: String(line.remark || ""),
      image: snapshotLineImage(line),
      lineTotal: unitPrice != null ? unitPrice * qty : 0,
    };
  });
}

function freezeGuestQuotePayload(rfq) {
  const lines = freezeQuoteLines(rfq?.lines);
  const offerLines = lines.filter((line) => !line.noOffer && line.quotedUnitPrice != null);
  const quotedSubtotal = offerLines.reduce((sum, line) => sum + line.lineTotal, 0);
  return {
    rfqId: rfq.id,
    askKind: rfq.askKind === "buy" ? "buy" : "quote",
    responseDate: rfq.responseDate || "",
    quoteNote: String(rfq?.quoteNote || "").trim(),
    lines,
    quotedSubtotal,
    createdAt: new Date().toISOString(),
  };
}

function snapshotRfqRequest(rfq, { version = 1, createdAt } = {}) {
  return {
    version,
    createdAt: createdAt || rfq?.submittedAt || new Date().toISOString(),
    note: rfq?.note || "",
    address: rfq?.address || "",
    responseDate: rfq?.responseDate || "",
    quotationDeadline: rfq?.quotationDeadline || rfq?.responseDate || "",
    deliveryDate: rfq?.deliveryDate || "",
    deliveryMode: rfq?.deliveryMode || "one_time",
    deliveryLots: Array.isArray(rfq?.deliveryLots) ? rfq.deliveryLots.map((lot) => ({ ...lot })) : [],
    project: rfq?.project || "",
    projects: normalizeProfileProjects(rfq?.projects || rfq?.project),
    canonicalCategory: rfq?.canonicalCategory || "",
    acceptSubstitutes: Boolean(rfq?.acceptSubstitutes),
    lines: (rfq?.lines || []).map((line) => ({ ...line })),
  };
}

function rfqRequestVersionList(rfq) {
  if (Array.isArray(rfq?.requestVersions) && rfq.requestVersions.length) return rfq.requestVersions;
  if (!rfq?.id) return [];
  return [snapshotRfqRequest(rfq, { version: 1, createdAt: rfq.submittedAt })];
}

function nextRfqRequestVersionNo(rfq) {
  return rfqRequestVersionList(rfq).reduce((max, row) => Math.max(max, Number(row?.version) || 0), 0) + 1;
}

function rfqRequestEffectiveVersionNo(rfq) {
  const listed = rfqRequestVersionList(rfq);
  const stored = Number(rfq?.requestEffectiveVersion);
  if (Number.isFinite(stored) && stored > 0 && listed.some((row) => Number(row.version) === stored)) return stored;
  return listed.length ? Number(listed[listed.length - 1].version) || 1 : 1;
}

function getRfqRequestVersion(rfq, versionNo) {
  const n = Number(versionNo);
  if (!Number.isFinite(n) || n <= 0) return null;
  return rfqRequestVersionList(rfq).find((row) => Number(row.version) === n) || null;
}

function getEffectiveRfqRequestVersion(rfq) {
  return getRfqRequestVersion(rfq, rfqRequestEffectiveVersionNo(rfq));
}

function formatRfqRequestVersionOption(version, { effectiveVersion, currentLabel = "Current" } = {}) {
  if (!version) return "";
  const current = Number(version.version) === Number(effectiveVersion) ? ` · ${currentLabel}` : "";
  return `v${version.version} · ${formatQuoteVersionStamp(version.createdAt)}${current}`;
}

function applyRfqRequestVersion(rfq, versionNo) {
  const snap = getRfqRequestVersion(rfq, versionNo);
  if (!rfq || !snap) return rfq;
  return {
    ...rfq,
    note: snap.note,
    address: snap.address,
    responseDate: snap.responseDate,
    quotationDeadline: snap.quotationDeadline || snap.responseDate,
    deliveryDate: snap.deliveryDate,
    deliveryMode: snap.deliveryMode,
    deliveryLots: snap.deliveryLots,
    project: snap.project,
    projects: snap.projects,
    canonicalCategory: snap.canonicalCategory,
    acceptSubstitutes: snap.acceptSubstitutes,
    lines: snap.lines,
  };
}

function quoteVersionList(rfq) {
  return Array.isArray(rfq?.quoteVersions) ? rfq.quoteVersions : [];
}

function nextQuoteVersionNo(rfq) {
  return quoteVersionList(rfq).reduce((max, row) => Math.max(max, Number(row?.version) || 0), 0) + 1;
}

function quoteEffectiveVersionNo(rfq) {
  const listed = quoteVersionList(rfq);
  const stored = Number(rfq?.quoteEffectiveVersion);
  if (Number.isFinite(stored) && stored > 0 && listed.some((row) => Number(row.version) === stored)) return stored;
  return listed.length ? Number(listed[listed.length - 1].version) || 0 : 0;
}

function getQuoteVersion(rfq, versionNo) {
  const n = Number(versionNo);
  if (!Number.isFinite(n) || n <= 0) return null;
  return quoteVersionList(rfq).find((row) => Number(row.version) === n) || null;
}

function getEffectiveQuoteVersion(rfq) {
  return getQuoteVersion(rfq, quoteEffectiveVersionNo(rfq));
}

function formatQuoteVersionStamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const BUYER_ACTIVITY_KINDS = new Set([
  "submitted",
  "accepted",
  "no_offer",
  "returned",
  "resubmitted",
  "reversed",
  "reverse_requested",
  "reverse_accepted",
  "reverse_declined",
  "cancel_requested",
  "cancel_accepted",
  "cancel_declined",
  "quoted",
  "whatsapp_quote",
  "po_created",
]);

function activityDedupeKey(entry) {
  return `${entry?.kind || ""}|${entry?.detail || ""}|${String(entry?.at || "").slice(0, 16)}`;
}

function pushRfqActivity(rfq, kind, extra = {}) {
  if (!rfq || !kind) return rfq;
  const at = extra.at || new Date().toISOString();
  const entry = {
    id: extra.id || `act-${kind}-${at}`,
    kind,
    at,
    by: extra.by || "",
    detail: extra.detail || "",
    channel: extra.channel || rfq.channel || "",
  };
  const prev = Array.isArray(rfq.activity) ? rfq.activity : [];
  const last = prev[prev.length - 1];
  if (last && activityDedupeKey(last) === activityDedupeKey(entry)) return rfq;
  return { ...rfq, activity: [...prev, entry] };
}

function mailLogStampForRfq(rfq, kind) {
  const id = String(rfq?.id || "");
  if (!id) return "";
  const rows = readJson("subbie_buyer_mail_log", []);
  if (!Array.isArray(rows)) return "";
  const hit = rows.find((row) => {
    const subject = String(row?.subject || "");
    if (!subject.includes(id)) return false;
    if (kind === "accepted") return /in review/i.test(subject);
    if (kind === "no_offer") return /no offer/i.test(subject);
    if (kind === "cancel_accepted") return /was cancelled/i.test(subject);
    if (kind === "cancel_declined") return /remains open/i.test(subject);
    return false;
  });
  return hit?.at ? String(hit.at) : "";
}

function inferRfqActivity(rfq) {
  if (!rfq) return [];
  const events = [];
  const status = inboxStatus(rfq);
  const submittedAt = rfq.submittedAt || rfq.createdAt;
  if (submittedAt) {
    const channel = rfq.channel || "rfq";
    events.push({
      kind: "submitted",
      at: submittedAt,
      channel,
      detail: channel === "whatsapp" || channel === "email" ? channel : "",
    });
  }
  const acceptedAt = rfq.acceptedAt || mailLogStampForRfq(rfq, "accepted");
  if (acceptedAt && (status === "accepted" || status === "quoted" || rfq.acceptedAt)) {
    events.push({ kind: "accepted", at: acceptedAt, by: rfq.acceptedBy || "" });
  }
  const noOfferAt = rfq.noOfferAt || mailLogStampForRfq(rfq, "no_offer");
  if (noOfferAt && (status === "no_offer" || rfq.noOfferAt)) {
    events.push({ kind: "no_offer", at: noOfferAt, detail: String(rfq.reason || "").trim() });
  }
  if (rfq.returnedAt) events.push({ kind: "returned", at: rfq.returnedAt, detail: String(rfq.reason || "").trim() });
  if (rfq.resubmittedAt) events.push({ kind: "resubmitted", at: rfq.resubmittedAt });
  if (rfq.cancelRequestedAt) events.push({ kind: "cancel_requested", at: rfq.cancelRequestedAt });
  if (rfq.cancelledAt) events.push({ kind: "cancel_accepted", at: rfq.cancelledAt, by: rfq.cancelledBy || "" });
  if (rfq.cancelDeclinedAt) events.push({ kind: "cancel_declined", at: rfq.cancelDeclinedAt });
  quoteVersionList(rfq).forEach((version) => {
    events.push({
      kind: version.channel === "whatsapp" ? "whatsapp_quote" : "quoted",
      at: version.createdAt,
      detail: `v${version.version}`,
    });
  });
  if (rfq.quoteDeliveredAt && rfq.quoteDelivery === "whatsapp" && !quoteVersionList(rfq).some((row) => row.channel === "whatsapp")) {
    events.push({ kind: "whatsapp_quote", at: rfq.quoteDeliveredAt });
  }
  if (rfq.quotedAt && !quoteVersionList(rfq).length) {
    events.push({ kind: "quoted", at: rfq.quotedAt });
  }
  if (rfq.tmsOpenedAt && rfq.tmsDocumentNo) {
    events.push({ kind: "tms", at: rfq.tmsOpenedAt, detail: rfq.tmsDocumentNo });
  }
  if (rfq.assignedAt) events.push({ kind: "assigned", at: rfq.assignedAt, detail: rfq.buyerEmail || "" });
  if (rfq.buyerPo?.createdAt) {
    events.push({ kind: "po_created", at: rfq.buyerPo.createdAt, detail: rfq.buyerPo.id || "" });
  }
  return events.filter((row) => row.at);
}

function rfqActivityLog(rfq, { audience } = {}) {
  const stored = (Array.isArray(rfq?.activity) ? rfq.activity : []).filter((row) => row?.kind && row?.at);
  const seen = new Set(stored.map(activityDedupeKey));
  const extra = inferRfqActivity(rfq).filter((row) => {
    const key = activityDedupeKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let log = [...stored, ...extra].sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
  if (audience === "buyer") log = log.filter((row) => BUYER_ACTIVITY_KINDS.has(row.kind));
  return log;
}

function rfqLastActivity(rfq, opts) {
  const log = rfqActivityLog(rfq, opts);
  return log.length ? log[log.length - 1] : null;
}

function hydrateRfqDecisionActivity(id) {
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  const status = inboxStatus(current);
  const acceptedMail = current.acceptedAt ? "" : mailLogStampForRfq(current, "accepted");
  const noOfferMail = current.noOfferAt ? "" : mailLogStampForRfq(current, "no_offer");
  const needAccepted = (status === "accepted" || status === "quoted") && !current.acceptedAt && acceptedMail;
  const needNoOffer = status === "no_offer" && !current.noOfferAt && noOfferMail;
  if (!needAccepted && !needNoOffer) return { ok: true, rfq: current };
  return patchRfqById(id, (rfq) => {
    let next = rfq;
    if (needAccepted) {
      next = pushRfqActivity({ ...next, acceptedAt: acceptedMail }, "accepted", { at: acceptedMail });
    }
    if (needNoOffer) {
      next = pushRfqActivity({ ...next, noOfferAt: noOfferMail }, "no_offer", {
        at: noOfferMail,
        detail: String(rfq.reason || "").trim(),
      });
    }
    return next;
  });
}

function rfqActivityLabel(event, lang = "en") {
  const zh = lang === "zh";
  const kind = event?.kind;
  const detail = String(event?.detail || "").trim();
  const channel = event?.channel || "";
  switch (kind) {
    case "submitted":
      if (detail === "whatsapp" || channel === "whatsapp") return zh ? "已用 WhatsApp 送出問價" : "Submitted on WhatsApp";
      if (detail === "email" || channel === "email") return zh ? "已用電郵送出問價" : "Submitted by email";
      return zh ? "已提交問價" : "RFQ submitted";
    case "accepted":
      return zh ? "銷售已接收（處理中）" : "Sales accepted — in review";
    case "no_offer":
      return detail ? (zh ? `不報價：${detail}` : `No offer: ${detail}`) : zh ? "不報價" : "No offer";
    case "returned":
      return zh ? "銷售要求補充資料" : "Sales asked for more information";
    case "resubmitted":
      return detail ? (zh ? `已重新提交 ${detail}` : `Resubmitted ${detail}`) : zh ? "已重新提交" : "Resubmitted";
    case "reversed":
      return zh ? "已撤回，正在修改" : "Reversed — revising";
    case "reverse_requested":
      return zh ? "買家申請撤回" : "Reverse requested";
    case "reverse_accepted":
      return zh ? "撤回已接受，可修改" : "Reverse accepted — you can revise";
    case "reverse_declined":
      return zh ? "撤回未獲接受，RFQ 繼續處理" : "Reverse declined — RFQ kept in review";
    case "cancel_requested":
      return zh ? "買家申請取消" : "Cancel requested";
    case "cancel_accepted":
      return zh ? "取消已接受" : "Cancellation accepted";
    case "cancel_declined":
      return zh ? "取消未獲接受，RFQ 繼續處理" : "Cancellation declined — RFQ kept open";
    case "quoted":
      return detail ? (zh ? `已提交報價 ${detail}` : `Quote sent to buyer ${detail}`) : zh ? "已提交報價" : "Quote sent to buyer";
    case "whatsapp_quote":
      return detail
        ? zh
          ? `已用 WhatsApp 送出報價 ${detail}`
          : `Quote sent on WhatsApp ${detail}`
        : zh
          ? "已用 WhatsApp 送出報價"
          : "Quote sent on WhatsApp";
    case "tms":
      return detail ? (zh ? `已建立 TMS iRFQ ${detail}` : `TMS iRFQ created ${detail}`) : zh ? "已建立 TMS iRFQ" : "TMS iRFQ created";
    case "released": {
      const who = detail || event?.by || "";
      if (who) {
        return zh ? `已從 ${who} 釋放（帳號已停用）` : `Released · ${who} (account disabled)`;
      }
      return zh ? "已釋放回共用佇列（銷售帳號已停用）" : "Released to the shared queue (sales account disabled)";
    }
    case "assigned":
      return detail ? (zh ? `已指派予會員 ${detail}` : `Assigned to member ${detail}`) : zh ? "已指派予註冊會員" : "Assigned to a registered member";
    case "po_created":
      return detail ? (zh ? `已建立採購單 ${detail}` : `Purchase order created ${detail}`) : zh ? "已建立採購單" : "Purchase order created";
    default:
      return kind || "";
  }
}

function formatQuoteVersionOption(version, { effectiveVersion, currentLabel = "Current" } = {}) {
  if (!version) return "";
  const current = Number(version.version) === Number(effectiveVersion) ? ` · ${currentLabel}` : "";
  return `v${version.version} · ${formatQuoteVersionStamp(version.createdAt)}${current}`;
}

function quoteLineKey(line) {
  return String(line?.productId ?? "");
}

function quoteLinePrice(line) {
  if (line?.noOffer) return null;
  const n = Number(line?.quotedUnitPrice);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function quoteLinesDiffer(liveLines, frozenLines) {
  const frozen = new Map((frozenLines || []).map((line) => [quoteLineKey(line), line]));
  const live = liveLines || [];
  if (live.length !== (frozenLines || []).length) {
    const liveKeys = new Set(live.map(quoteLineKey));
    for (const key of frozen.keys()) {
      if (!liveKeys.has(key)) return true;
    }
  }
  for (const line of live) {
    const other = frozen.get(quoteLineKey(line));
    if (!other) return true;
    if (Boolean(line.noOffer) !== Boolean(other.noOffer)) return true;
    if (quoteLinePrice(line) !== quoteLinePrice(other)) return true;
    if ((Number(line.qty) || 0) !== (Number(other.qty) || 0)) return true;
    if (String(line.remark || "") !== String(other.remark || "")) return true;
  }
  return false;
}

function quoteDraftIsDirty(rfq) {
  const effective = getEffectiveQuoteVersion(rfq);
  if (!effective) return false;
  return quoteLinesDiffer(rfq?.lines, effective.lines);
}

function rfqLinesForQuoteVersion(rfq, versionNo) {
  const snap = getQuoteVersion(rfq, versionNo);
  if (!snap) return rfq?.lines || [];
  const frozenById = new Map((snap.lines || []).map((line) => [quoteLineKey(line), line]));
  const seen = new Set();
  const merged = (rfq?.lines || []).map((line) => {
    const frozen = frozenById.get(quoteLineKey(line));
    seen.add(quoteLineKey(line));
    if (!frozen) return { ...line, quotedUnitPrice: null, noOffer: true };
    return { ...line, ...frozen, image: line.image || frozen.image };
  });
  (snap.lines || []).forEach((frozen) => {
    if (!seen.has(quoteLineKey(frozen))) merged.push(frozen);
  });
  return merged;
}

function persistQuoteSnapshot(rfqLike, token) {
  const id = String(token || newGuestQuoteToken());
  const snapshot = { token: id, ...freezeGuestQuotePayload(rfqLike) };
  const map = getQuoteSnapshots();
  map[id] = snapshot;
  setQuoteSnapshots(map);
  return snapshot;
}

function buildDeliveredQuoteVersion(rfq, { channel, token, lines, note, createdAt } = {}) {
  const frozenLines = freezeQuoteLines(lines || rfq?.lines);
  const quotedSubtotal = frozenLines
    .filter((line) => !line.noOffer && line.quotedUnitPrice != null)
    .reduce((sum, line) => sum + line.lineTotal, 0);
  return {
    version: nextQuoteVersionNo(rfq),
    createdAt: createdAt || new Date().toISOString(),
    channel: channel === "whatsapp" ? "whatsapp" : "marketplace",
    token: token || "",
    lines: frozenLines,
    quotedSubtotal,
    deadline: rfq?.responseDate || "",
    quoteNote: String(note || rfq?.quoteNote || "").trim(),
  };
}

function applyDeliveredQuoteVersion(rfq, version, extra = {}) {
  return {
    ...rfq,
    quoteVersions: [...quoteVersionList(rfq), version],
    quoteEffectiveVersion: version.version,
    quotedSubtotal: version.quotedSubtotal,
    ...extra,
  };
}

function loadQuoteVersionIntoDraft(id, versionNo) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  const snap = getQuoteVersion(current, versionNo);
  if (!snap) return { ok: false, error: "missing_version" };
  return patchRfqById(id, (rfq) => {
    const frozenById = new Map((snap.lines || []).map((line) => [quoteLineKey(line), line]));
    return {
      ...rfq,
      quoteNote: snap.quoteNote || rfq.quoteNote,
      lines: (rfq.lines || []).map((line) => {
        const frozen = frozenById.get(quoteLineKey(line));
        if (!frozen) return line;
        return {
          ...line,
          qty: frozen.qty != null ? frozen.qty : line.qty,
          quotedUnitPrice: frozen.quotedUnitPrice,
          noOffer: Boolean(frozen.noOffer),
          remark: frozen.remark != null ? frozen.remark : line.remark,
        };
      }),
    };
  });
}

function guestQuotePublicUrl(token, lang = "zh") {
  const id = String(token || "").trim();
  if (!id) return "";
  const locale = lang === "zh" ? "zh" : "en";
  return `${marketplaceOrigin()}/${locale}/quote/${encodeURIComponent(id)}`;
}

function guestQuoteWhatsappText(rfq, publicUrl) {
  const lines = (rfq?.lines || []).filter((line) => !line.noOffer && Number(line.quotedUnitPrice) > 0);
  const total = lines.reduce((sum, line) => sum + Number(line.quotedUnitPrice) * (Number(line.qty) || 0), 0);
  const block = lines
    .map((line, index) => {
      const qty = Number(line.qty) || 0;
      const unit = Number(line.quotedUnitPrice);
      return `${index + 1}. ${line.name} × ${qty} · 單價 ${formatPrice(unit)} · 小計 ${formatPrice(unit * qty)}`;
    })
    .join("\n");
  return [
    "你好，以下為報價：",
    `RFQ 編號：${rfq?.id || ""}`,
    block,
    `總計：${formatPrice(total)}`,
    `報價期限：${rfq?.responseDate || "—"}`,
    `查看報價：\n${publicUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getGuestQuoteSnapshot(token) {
  return getQuoteSnapshots()[String(token || "")] || null;
}

function snapshotQuotePdfItems(snapshot) {
  return (snapshot?.lines || []).map((line, index) => ({
    index: index + 1,
    name: String(line.name || line.productId || "-").trim(),
    sku: line.productNo || line.productId || "-",
    qty: `${line.qty}${line.unit ? ` ${line.unit}` : ""}`,
    price: line.noOffer ? "不報價" : line.quotedUnitPrice != null ? formatPrice(line.quotedUnitPrice) : "待報價",
    spec: "",
    attachments: "",
    image: snapshotLineImage(line),
  }));
}

function rfqQuotedOffline(rfq) {
  return String(rfq?.quoteDelivery || "") === "whatsapp";
}

function rfqOfferLinesPriced(rfq) {
  const lines = (rfq?.lines || []).filter((line) => !line.noOffer);
  return Boolean(lines.length) && lines.every((line) => Number(line.quotedUnitPrice) > 0);
}

function rfqCanSendWhatsappQuote(rfq) {
  const status = inboxStatus(rfq);
  if (status !== "accepted" && status !== "quoted" && !rfqQuotedOffline(rfq)) {
    return { ok: false, reason: "status" };
  }
  if (!rfqOfferLinesPriced(rfq)) return { ok: false, reason: "prices" };
  if (!whatsappPhoneId(rfq?.buyerPhone)) return { ok: false, reason: "phone" };
  return { ok: true };
}

function createGuestQuoteSnapshot(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  const ready = rfqCanSendWhatsappQuote(current);
  if (!ready.ok) return { ok: false, error: ready.reason };
  const token = newGuestQuoteToken();
  const snapshot = { token, ...freezeGuestQuotePayload(current) };
  const map = getQuoteSnapshots();
  map[token] = snapshot;
  setQuoteSnapshots(map);
  const patched = patchRfqById(id, (rfq) => ({
    ...rfq,
    quotePublicToken: token,
    quotePublicTokens: [...new Set([...(rfq.quotePublicTokens || []), token])],
  }));
  const url = guestQuotePublicUrl(token, "zh");
  const href = buyerWhatsappHref(current.buyerPhone, guestQuoteWhatsappText(patched.rfq || current, url));
  return { ...patched, token, snapshot, url, href };
}

function markGuestQuoteWhatsappSent(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  return patchRfqById(id, (rfq) => {
    const sentAt = new Date().toISOString();
    const token = String(rfq.quotePublicToken || "").trim();
    const already = token && quoteVersionList(rfq).some((row) => row.token && row.token === token);
    const base = {
      ...rfq,
      quoteDelivery: "whatsapp",
      quoteDeliveredAt: sentAt,
    };
    if (already) {
      return pushRfqActivity(base, "whatsapp_quote", { at: sentAt, by: gate.account.email });
    }
    const snapshot = token ? getGuestQuoteSnapshot(token) : null;
    const version = snapshot
      ? buildDeliveredQuoteVersion(rfq, {
          channel: "whatsapp",
          token,
          lines: snapshot.lines,
          note: snapshot.quoteNote,
          createdAt: sentAt,
        })
      : buildDeliveredQuoteVersion(rfq, { channel: "whatsapp", token, createdAt: sentAt });
    return pushRfqActivity(applyDeliveredQuoteVersion(base, version), "whatsapp_quote", {
      at: sentAt,
      detail: `v${version.version}`,
      by: gate.account.email,
    });
  });
}

function createBuyerPurchaseOrder(id, payload = {}) {
  const user = getUser();
  if (!user?.email) return { ok: false, error: "auth" };
  const current = getRfq(id);
  if (!current) return { ok: false, error: "missing" };
  if (normalizeEmail(current.buyerEmail) !== normalizeEmail(user.email)) return { ok: false, error: "forbidden" };
  const stamp = String(Date.now()).slice(-4);
  const poId = payload.id || `PO-${String(id).replace(/^RFQ-?/i, "")}-${stamp}`;
  const effective = getEffectiveQuoteVersion(current);
  const versionLines = (effective?.lines || []).filter((line) => !line.noOffer && Number(line.quotedUnitPrice) > 0);
  const poFromEffective = versionLines.length
    ? versionLines.map((line) => ({
        productId: line.productId,
        name: line.name,
        qty: line.qty,
        supplierName: "Mattex",
        lineTotal: line.lineTotal != null ? Number(line.lineTotal) : Number(line.quotedUnitPrice) * (Number(line.qty) || 0),
      }))
    : null;
  return patchRfqById(id, (rfq) => {
    const createdAt = rfq.buyerPo?.createdAt || new Date().toISOString();
    const next = {
      ...rfq,
      buyerPo: {
        id: poId,
        createdAt,
        confirmedAt: new Date().toISOString(),
        lines: poFromEffective || (Array.isArray(payload.lines) ? payload.lines : rfq.buyerPo?.lines || []),
        total: poFromEffective
          ? Number(effective.quotedSubtotal) || poFromEffective.reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0)
          : payload.total != null
            ? Number(payload.total)
            : rfq.buyerPo?.total || 0,
        label: String(payload.label || rfq.buyerPo?.label || (effective ? `v${effective.version}` : "")).trim(),
        status: "created",
        quoteVersion: effective?.version || null,
      },
    };
    if (rfq.buyerPo?.id) return next;
    return pushRfqActivity(next, "po_created", { at: createdAt, detail: poId });
  });
}

function quoteRfqToBuyer(id, { linePrices, note } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  if (rfqBuyerKind(current) !== "member") return { ok: false, error: "guest" };
  const status = inboxStatus(current);
  if (status === "no_offer" || status === "rejected") return { ok: false, error: "rejected" };
  if (status === "cancelled" || current.cancelStatus === "requested") return { ok: false, error: "cancel" };
  if (status !== "accepted" && status !== "quoted") return { ok: false, error: "not_accepted" };
  const prices = linePrices || {};
  const lines = (current.lines || []).map((l) => {
    if (l.noOffer) return { ...l, quotedUnitPrice: null, noOffer: true };
    const overlay = Object.prototype.hasOwnProperty.call(prices, String(l.productId))
      ? prices[String(l.productId)]
      : undefined;
    const raw = overlay === undefined ? l.quotedUnitPrice : overlay;
    const n = raw === "" || raw == null ? NaN : Number(raw);
    return {
      ...l,
      quotedUnitPrice: Number.isFinite(n) && n > 0 ? n : null,
    };
  });
  const offerLines = lines.filter((l) => !l.noOffer);
  if (!offerLines.length || offerLines.some((l) => l.quotedUnitPrice == null)) return { ok: false, error: "prices" };
  const quoteNote = String(note || "").trim();
  const snapshot = persistQuoteSnapshot({ ...current, lines, quoteNote, responseDate: current.responseDate });
  const sentAt = new Date().toISOString();
  return patchRfqById(id, (rfq) => {
    const version = buildDeliveredQuoteVersion(rfq, {
      channel: "marketplace",
      token: snapshot.token,
      lines,
      note: quoteNote,
      createdAt: sentAt,
    });
    return pushRfqActivity(
      applyDeliveredQuoteVersion(rfq, version, {
        reviewStatus: "quoted",
        quotedAt: sentAt,
        quoteNote,
        lines,
      }),
      "quoted",
      { at: sentAt, detail: `v${version.version}`, by: gate.account.email }
    );
  });
}

function decideRfq(id, { decision, reason } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const nextDecision = decision === "rejected" ? "no_offer" : decision;
  if (nextDecision === "returned" && !String(reason || "").trim()) {
    return { ok: false, error: "reason" };
  }
  return patchRfqById(id, (rfq) => {
    const status = inboxStatus(rfq);
    if (status === "cancelled" || status === "revising") return rfq;
    if (rfq.cancelStatus === "requested" && nextDecision === "accepted") return rfq;
    if (rfq.reverseStatus === "requested" && nextDecision === "accepted") return rfq;
    const at = new Date().toISOString();
    const by = gate.account.email;
    if (nextDecision === "no_offer") {
      if (status === "no_offer") return rfq;
      const why = String(reason || "No offer").trim();
      return pushRfqActivity(
        {
          ...rfq,
          reviewStatus: "no_offer",
          reviewingBy: "",
          reason: why,
          noOfferAt: at,
          lines: (rfq.lines || []).map((line) => ({ ...line, noOffer: true, quotedUnitPrice: null })),
        },
        "no_offer",
        { at, detail: why, by }
      );
    }
    if (status === "accepted" || status === "quoted" || status === "no_offer") return rfq;
    if (nextDecision === "accepted") {
      return pushRfqActivity(
        { ...rfq, reviewStatus: "accepted", reviewingBy: "", reason: "", acceptedAt: at, acceptedBy: by },
        "accepted",
        { at, by }
      );
    }
    if (nextDecision === "returned") {
      const why = String(reason || "").trim();
      return pushRfqActivity(
        { ...rfq, reviewStatus: "returned", reviewingBy: "", reason: why, returnedAt: at },
        "returned",
        { at, detail: why, by }
      );
    }
    return {
      ...rfq,
      reviewStatus: nextDecision,
      reviewingBy: "",
      reason: String(reason || "").trim(),
    };
  });
}

function rfqHasPurchaseOrder(rfq) {
  return Boolean(rfq?.buyerPo?.id || rfq?.buyerPo?.status === "created" || rfq?.buyerPo?.confirmedAt);
}

function canBuyerRequestCancel(rfq) {
  if (!rfq) return false;
  const status = inboxStatus(rfq);
  if (status === "no_offer" || status === "cancelled") return false;
  if (rfq.cancelStatus === "requested" || rfq.cancelStatus === "accepted") return false;
  if (rfq.reverseStatus === "requested") return false;
  if (rfqHasPurchaseOrder(rfq)) return false;
  return true;
}

function canBuyerReverse(rfq) {
  if (!rfq) return false;
  const status = inboxStatus(rfq);
  if (status === "no_offer" || status === "cancelled" || status === "revising") return false;
  if (rfq.cancelStatus === "requested" || rfq.reverseStatus === "requested") return false;
  if (rfqHasPurchaseOrder(rfq)) return false;
  return true;
}

function rfqNeedsSalesReverse(rfq) {
  const status = inboxStatus(rfq);
  if (status === "revising") return false;
  return status === "accepted" || status === "quoted" || Boolean(rfq?.tmsDocumentNo || rfq?.tmsId);
}

function copyRfqToDraft(rfq) {
  if (!rfq) return getDraft();
  const draft = getDraft();
  const existing = new Set((draft.lines || []).map((line) => String(line.productId)));
  (rfq.lines || []).forEach((line) => {
    const id = String(line.productId || "");
    if (!id || existing.has(id)) return;
    existing.add(id);
    draft.lines.push({ ...line });
  });
  draft.note = rfq.note || draft.note;
  draft.responseDate = rfq.responseDate || rfq.quotationDeadline || draft.responseDate;
  draft.deliveryDate = rfq.deliveryDate || draft.deliveryDate;
  draft.deliveryMode = normalizeDeliveryMode(rfq.deliveryMode || draft.deliveryMode);
  draft.deliveryLots = normalizeDeliveryLots(rfq.deliveryLots || draft.deliveryLots, {
    mode: draft.deliveryMode,
    deliveryDate: draft.deliveryDate,
    address: rfq.address,
  });
  draft.projects = normalizeProfileProjects(rfq.projects || rfq.project || draft.projects);
  draft.project = joinProfileProjects(draft.projects);
  draft.address = rfq.address || draft.address;
  draft.canonicalCategory = rfq.canonicalCategory || draft.canonicalCategory;
  draft.acceptSubstitutes = Boolean(rfq.acceptSubstitutes);
  setDraft(draft);
  return draft;
}

function notifySalesRfq(rfq, { title, body } = {}) {
  if (!rfq?.id) return;
  notifyAdmins({
    kind: "rfq",
    title: title || `RFQ ${rfq.id}`,
    body: body || `${rfq.buyerName || rfq.buyerEmail || "Buyer"} updated ${rfq.id}.`,
    href: `${adminOrigin()}/?rfq=${encodeURIComponent(rfq.id)}`,
  });
}

function patchEnterRevising(rfq, { at, by, kind = "reversed" } = {}) {
  const stamp = at || new Date().toISOString();
  const versions = rfqRequestVersionList(rfq);
  return pushRfqActivity(
    {
      ...rfq,
      reviewStatus: "revising",
      reverseStatus: "",
      reverseRequestedAt: "",
      cancelStatus: rfq.cancelStatus === "requested" ? "" : rfq.cancelStatus,
      requestVersions: versions,
      requestEffectiveVersion: rfqRequestEffectiveVersionNo({ ...rfq, requestVersions: versions }),
    },
    kind,
    { at: stamp, by: by || "" }
  );
}

function requestRfqReverse(id) {
  const user = getUser();
  if (!user?.email) return { ok: false, error: "auth" };
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  if (normalizeEmail(current.buyerEmail) !== normalizeEmail(user.email)) return { ok: false, error: "auth" };
  if (current.reverseStatus === "requested") return { ok: true, rfq: current };
  if (!canBuyerReverse(current)) return { ok: false, error: "locked" };
  if (!rfqNeedsSalesReverse(current)) {
    return patchRfqById(id, (rfq) => patchEnterRevising(rfq, { kind: "reversed" }));
  }
  const result = patchRfqById(id, (rfq) => {
    const at = new Date().toISOString();
    return pushRfqActivity(
      {
        ...rfq,
        reverseStatus: "requested",
        reverseRequestedAt: at,
      },
      "reverse_requested",
      { at }
    );
  });
  if (result.ok) {
    notifySalesRfq(current, {
      title: `Reverse requested ${id}`,
      body: `${current.buyerName || current.buyerEmail || "Buyer"} asked to reverse ${id}.`,
    });
    deliverRfqReverseRequestedEmail(result.rfq || current);
  }
  return result;
}

function requestRfqCancel(id) {
  const user = getUser();
  if (!user?.email) return { ok: false, error: "auth" };
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  if (normalizeEmail(current.buyerEmail) !== normalizeEmail(user.email)) return { ok: false, error: "auth" };
  if (current.cancelStatus === "requested") return { ok: true, rfq: current };
  if (!canBuyerRequestCancel(current)) return { ok: false, error: "locked" };
  const instant = inboxStatus(current) === "revising" || !rfqNeedsSalesReverse(current);
  if (instant) {
    const result = patchRfqById(id, (rfq) => {
      const at = new Date().toISOString();
      return pushRfqActivity(
        {
          ...rfq,
          cancelStatus: "accepted",
          cancelKind: "cancel",
          reviewStatus: "cancelled",
          reverseStatus: "",
          cancelledAt: at,
        },
        "cancel_accepted",
        { at, detail: "buyer" }
      );
    });
    if (result.ok) {
      notifySalesRfq(current, {
        title: `RFQ cancelled ${id}`,
        body: `${current.buyerName || current.buyerEmail || "Buyer"} cancelled ${id}.`,
      });
    }
    return result;
  }
  const result = patchRfqById(id, (rfq) => {
    const at = new Date().toISOString();
    return pushRfqActivity(
      {
        ...rfq,
        cancelStatus: "requested",
        cancelKind: "cancel",
        cancelRequestedAt: at,
      },
      "cancel_requested",
      { at }
    );
  });
  if (result.ok) {
    notifySalesRfq(current, {
      title: `Cancel requested ${id}`,
      body: `${current.buyerName || current.buyerEmail || "Buyer"} asked to cancel ${id}.`,
    });
    deliverRfqCancelRequestedEmail(result.rfq || current);
  }
  return result;
}

function decideRfqReverse(id, { accept } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  return patchRfqById(id, (rfq) => {
    if (rfq.reverseStatus !== "requested") return rfq;
    const at = new Date().toISOString();
    if (accept) {
      return patchEnterRevising(rfq, { at, by: gate.account.email, kind: "reverse_accepted" });
    }
    return pushRfqActivity(
      {
        ...rfq,
        reverseStatus: "declined",
        reverseDeclinedAt: at,
      },
      "reverse_declined",
      { at, by: gate.account.email }
    );
  });
}

function decideRfqCancel(id, { accept } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  return patchRfqById(id, (rfq) => {
    if (rfq.cancelStatus !== "requested") return rfq;
    if (accept) {
      const at = new Date().toISOString();
      return pushRfqActivity(
        {
          ...rfq,
          cancelStatus: "accepted",
          reviewStatus: "cancelled",
          cancelledAt: at,
          cancelledBy: gate.account.email,
        },
        "cancel_accepted",
        { at, by: gate.account.email }
      );
    }
    const at = new Date().toISOString();
    return pushRfqActivity(
      {
        ...rfq,
        cancelStatus: "declined",
        cancelDeclinedAt: at,
      },
      "cancel_declined",
      { at, by: gate.account.email }
    );
  });
}

function appOrigin() {
  return marketplaceOrigin();
}

function rfqDetailsHref(rfq, lang = "en") {
  const id = rfq?.id || "";
  if (!id) return "";
  const locale = lang === "zh" ? "zh" : "en";
  return `${marketplaceOrigin()}/${locale}/rfqs?id=${encodeURIComponent(id)}`;
}

function rfqAdminHref(rfq) {
  const id = rfq?.id || "";
  if (!id) return "";
  return `${adminOrigin()}/?rfq=${encodeURIComponent(id)}`;
}

function rfqDiscussWhatsappText(rfq, lang = "en") {
  const id = rfq?.id || "";
  const admin = rfqAdminHref(rfq);
  const buyer = rfqDetailsHref(rfq, lang);
  if (lang === "zh") {
    return [
      `你好，我想查詢／討論 ${id}。請喺 Sales portal 跟進同一張 RFQ。`,
      admin ? `Sales portal：${admin}` : "",
      buyer ? `Marketplace（買家檢視）：${buyer}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Hi Mattex, I would like to discuss ${id}. Please follow up the same RFQ in the Sales portal.`,
    admin ? `Sales portal: ${admin}` : "",
    buyer ? `Marketplace (buyer view): ${buyer}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function rfqDiscussEmailHref(rfq, lang = "en") {
  const id = rfq?.id || "";
  const subject = lang === "zh" ? `查詢 ${id}` : `Discuss ${id}`;
  return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(rfqDiscussWhatsappText(rfq, lang))}`;
}

function uploadRfqToTms(id, { fail, whatsappPdfName, tms } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  return patchRfqById(id, (rfq) => {
    const status = inboxStatus(rfq);
    if (status !== "accepted" && status !== "quoted") return rfq;
    if (fail) {
      return {
        ...rfq,
        lastTmsError: fail === true ? "simulated TMS failure" : String(fail),
        whatsappPdfName: whatsappPdfName || rfq.whatsappPdfName || "",
      };
    }
    const tmsOpenedAt = new Date().toISOString();
    const documentNo = tms?.documentNo || rfq.tmsDocumentNo || "";
    return pushRfqActivity(
      {
        ...rfq,
        lastTmsError: "",
        tmsOpenedAt,
        tmsId: tms?.id || rfq.tmsId || "",
        tmsDocumentNo: documentNo,
        tmsUrl: tms?.url || rfq.tmsUrl || "",
        whatsappPdfName: tms?.fileName || whatsappPdfName || rfq.whatsappPdfName || "",
        tmsPayload: {
          model: "inbound_request_for_quotes",
          source: "mattex-marketplace",
          rfqId: rfq.id,
          tmsId: tms?.id || rfq.tmsId || "",
          documentNo,
          buyerEmail: rfq.buyerEmail,
          buyerName: rfq.buyerName,
          project: rfq.project || "",
          address: rfq.address || "",
          channel: rfq.channel || "rfq",
          askKind: rfq.askKind || "quote",
          lines: rfq.lines,
          whatsappPdfName: tms?.fileName || whatsappPdfName || rfq.whatsappPdfName || "",
        },
      },
      "tms",
      { at: tmsOpenedAt, detail: documentNo, by: gate.account.email }
    );
  });
}

function resubmitRfq(id, lines) {
  const email = currentEmail();
  if (!email) return { ok: false, error: "auth" };
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  const result = patchRfqById(id, (rfq, owner) => {
    if (normalizeEmail(owner) !== email && normalizeEmail(rfq.buyerEmail) !== email) return rfq;
    const status = inboxStatus(rfq);
    if (status !== "returned" && status !== "revising") return rfq;
    const at = new Date().toISOString();
    const nextLines = Array.isArray(lines) && lines.length ? lines : rfq.lines;
    if (status === "revising") {
      const nextNo = nextRfqRequestVersionNo(rfq);
      const snap = snapshotRfqRequest({ ...rfq, lines: nextLines }, { version: nextNo, createdAt: at });
      return pushRfqActivity(
        {
          ...rfq,
          lines: nextLines,
          reviewStatus: "received",
          reviewingBy: "",
          reverseStatus: "",
          resubmittedAt: at,
          requestVersions: [...rfqRequestVersionList(rfq), snap],
          requestEffectiveVersion: nextNo,
        },
        "resubmitted",
        { at, detail: `v${nextNo}` }
      );
    }
    return pushRfqActivity(
      {
        ...rfq,
        reviewStatus: "received",
        reviewingBy: "",
        resubmittedAt: at,
        lines: nextLines,
      },
      "resubmitted",
      { at }
    );
  });
  if (result.ok && inboxStatus(current) === "revising") {
    notifySalesRfq(result.rfq || current, {
      title: `RFQ resubmitted ${id}`,
      body: `${current.buyerName || current.buyerEmail || "Buyer"} resubmitted ${id}.`,
    });
    deliverRfqToSalesEmail(result.rfq || current);
  }
  return result;
}

function buyerRfqDetailsLocked(rfq) {
  const status = inboxStatus(rfq);
  if (status === "revising" || status === "returned") return false;
  return true;
}

function lineMoq(line) {
  if (line?.custom) return 1;
  const fromLine = Number(line?.moq);
  if (Number.isFinite(fromLine) && fromLine > 0) return Math.max(1, fromLine);
  const product = line?.productId ? getProduct(line.productId) : null;
  return Math.max(1, Number(product?.moq) || 1);
}

function updateBuyerRfqDetails(id, patch = {}) {
  const user = getUser();
  if (!user?.email) return { ok: false, error: "auth" };
  const current = getAllRfqs().find((r) => r.id === id);
  if (!current) return { ok: false, error: "missing" };
  if (normalizeEmail(current.buyerEmail) !== normalizeEmail(user.email)) return { ok: false, error: "auth" };
  if (buyerRfqDetailsLocked(current)) return { ok: false, error: "locked" };
  return patchRfqById(id, (rfq) => {
    let nextLines = Array.isArray(rfq.lines) ? rfq.lines.slice() : [];
    const removeIds = new Set((patch.removeProductIds || []).map(String));
    if (removeIds.size) {
      nextLines = nextLines.filter((line) => !removeIds.has(String(line.productId)));
      if (!nextLines.length) return rfq;
    }
    if (Array.isArray(patch.lines)) {
      nextLines = nextLines.map((line) => {
        const overlay = patch.lines.find((row) => String(row.productId) === String(line.productId));
        if (!overlay) return line;
        const qty = overlay.qty != null ? Math.max(1, Math.floor(Number(overlay.qty) || 1)) : line.qty;
        return {
          ...line,
          qty,
          remark: overlay.remark != null ? String(overlay.remark) : line.remark,
        };
      });
    }
    if (Array.isArray(patch.addLines) && patch.addLines.length) {
      patch.addLines.forEach((row) => {
        if (!row?.name && !row?.productId) return;
        nextLines.push({
          productId: row.productId || newCustomProductId(),
          qty: Math.max(1, Math.floor(Number(row.qty) || 1)),
          custom: Boolean(row.custom || !row.productId),
          intent: row.intent || "quote",
          name: String(row.name || "").trim() || "Tailor Made Product",
          description: String(row.description || "").trim(),
          category: String(row.category || "").trim(),
          attachments: Array.isArray(row.attachments) ? row.attachments : [],
          image: String(row.image || ""),
          tailorMade: Boolean(row.tailorMade),
          baseProductId: String(row.baseProductId || "").trim(),
          baseProductNo: String(row.baseProductNo || "").trim(),
          productNo: String(row.productNo || "").trim(),
          supplier: String(row.supplier || "").trim(),
        });
      });
    }
    return {
      ...rfq,
      note: patch.note != null ? String(patch.note) : rfq.note,
      address: patch.address != null ? String(patch.address).trim() : rfq.address,
      responseDate: patch.responseDate != null ? String(patch.responseDate).trim() : rfq.responseDate,
      quotationDeadline: patch.responseDate != null ? String(patch.responseDate).trim() : rfq.quotationDeadline,
      deliveryDate: patch.deliveryDate != null ? String(patch.deliveryDate).trim() : rfq.deliveryDate,
      project: patch.project != null ? String(patch.project) : rfq.project,
      projects: patch.projects != null ? normalizeProfileProjects(patch.projects) : rfq.projects,
      lines: nextLines,
    };
  });
}

function adminFollowUpWhatsapp(rfq) {
  if (typeof window === "undefined") return { ok: false, error: "window" };
  const account = getAccount(rfq?.buyerEmail);
  const phone = rfq?.buyerPhone || account?.phone || "";
  const href = buyerWhatsappHref(phone);
  if (!href) return { ok: false, error: "phone" };
  const text =
    `Follow-up on ${rfq?.id || "RFQ"} from Mattex Marketplace.` +
    (rfqAdminHref(rfq) ? `\nPortal: ${rfqAdminHref(rfq)}` : "");
  window.open(`${href}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  return { ok: true };
}

function getReports() {
  return sortByNewest(readJson(REPORTS_KEY, []), (report) => report?.createdAt || report?.id);
}

function createProductReport({ productId, type, text, evidence }) {
  const user = getUser();
  const staff = getStaffSession();
  if (!user && !staff) return { ok: false, error: "auth" };
  const product = getProduct(productId);
  if (!product || !product.published || product.deleted) return { ok: false, error: "product" };
  if (!["圖片不對", "資料不對", "其他"].includes(type)) return { ok: false, error: "type" };
  if (!String(text || "").trim()) return { ok: false, error: "text" };
  const seq = Number(localStorage.getItem(REPORT_SEQ_KEY) || "20") + 1;
  localStorage.setItem(REPORT_SEQ_KEY, String(seq));
  persistShared(REPORT_SEQ_KEY, seq);
  const report = {
    id: `RPT-${seq}`,
    productId: product.id,
    productNo: product.productNo,
    type,
    text: String(text).trim(),
    evidence: String(evidence || ""),
    status: "open",
    lookingBy: "",
    filerEmail: (user || staff).email,
    filerRole: staff && !user ? "sales" : "buyer",
    createdAt: new Date().toISOString(),
  };
  const list = getReports();
  list.unshift(report);
  writeJson(REPORTS_KEY, list);
  emitStoreChange();
  return { ok: true, report };
}

function lookProductReport(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const list = getReports();
  const r = list.find((x) => x.id === id);
  if (!r || r.status === "dismissed" || r.status === "fixed") return { ok: false, error: "missing" };
  r.status = "looking";
  r.lookingBy = gate.account.email;
  writeJson(REPORTS_KEY, list);
  emitStoreChange();
  return { ok: true };
}

function dismissProductReport(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const list = getReports();
  const r = list.find((x) => x.id === id);
  if (!r) return { ok: false, error: "missing" };
  r.status = "dismissed";
  r.lookingBy = "";
  writeJson(REPORTS_KEY, list);
  emitStoreChange();
  return { ok: true };
}

function fixProductReport(id, { hold, markChain, patch, note, unpublish } = {}) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const list = getReports();
  const r = list.find((x) => x.id === id);
  if (!r) return { ok: false, error: "missing" };
  const product = getProduct(r.productId) || PRODUCTS.find((p) => p.productNo === r.productNo);
  if (product) {
    if (hold || unpublish) {
      product.published = false;
      product.held = false;
    }
    if (markChain) product.needsChainImage = true;
    if (patch) Object.assign(product, patch);
    persistProductPatches();
  }
  r.status = "fixed";
  r.lookingBy = "";
  r.fixNote = note || "";
  writeJson(REPORTS_KEY, list);
  emitStoreChange();
  return { ok: true, product };
}

function readRemovedProductIds(patches) {
  const raw = patches && typeof patches === "object" ? patches.__removed : [];
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function mergeProductPatchMaps(local, remote) {
  const left = local && typeof local === "object" ? local : {};
  const right = remote && typeof remote === "object" ? remote : {};
  const merged = { ...right, ...left };
  const removed = [...new Set([...readRemovedProductIds(right), ...readRemovedProductIds(left)])];
  merged.__removed = removed;
  const createdById = new Map();
  [...(Array.isArray(right.__created) ? right.__created : []), ...(Array.isArray(left.__created) ? left.__created : [])].forEach((row) => {
    if (row?.id && !removed.includes(String(row.id))) createdById.set(String(row.id), row);
  });
  merged.__created = [...createdById.values()];
  removed.forEach((id) => {
    delete merged[id];
  });
  return merged;
}

function persistProductPatches() {
  const prev = readJson(PRODUCT_PATCH_KEY, {});
  const removed = readRemovedProductIds(prev);
  const created = PRODUCTS.filter((p) => String(p.id || "").startsWith("p-new-") || String(p.id || "").startsWith("p-xls-"));
  const patches = {};
  PRODUCTS.forEach((p) => {
    patches[p.id] = {
      published: p.published,
      held: p.held,
      deleted: p.deleted,
      productNo: p.productNo,
      provisionalSku: p.provisionalSku,
      name: p.name,
      category: p.category,
      sizeDesc: p.sizeDesc,
      certifications: p.certifications,
      primarySpec: p.primarySpec,
      salesUnit: p.salesUnit,
      unit: p.salesUnit || p.unit,
      moq: p.moq,
      leadTime: p.leadTime,
      leadTimeLabel: p.leadTimeLabel || "",
      purposes: p.purposes,
      remark: p.remark,
      green: p.green,
      hit: p.hit,
      tailorMade: p.tailorMade,
      image: p.image,
      images: Array.isArray(p.images) ? p.images.filter(Boolean).slice(0, 5) : [],
      imageSource: p.imageSource,
      needsChainImage: p.needsChainImage,
      discontinued: p.discontinued,
      createdAt: p.createdAt || 0,
    };
  });
  patches.__created = created;
  patches.__removed = removed;
  writeJson(PRODUCT_PATCH_KEY, patches);
  persistCatalogTables(PRODUCTS);
  bumpCatalog();
}

function applySavedProductPatches() {
  const patches = readJson(PRODUCT_PATCH_KEY, {});
  const removed = new Set(readRemovedProductIds(patches));
  if (removed.size) {
    for (let i = PRODUCTS.length - 1; i >= 0; i -= 1) {
      if (removed.has(String(PRODUCTS[i].id))) PRODUCTS.splice(i, 1);
    }
  }
  PRODUCTS.forEach((p) => {
    if (patches[p.id]) Object.assign(p, normalizeProductRecord({ ...p, ...patches[p.id] }));
  });
  (patches.__created || []).forEach((row) => {
    if (!row?.id || removed.has(String(row.id))) return;
    if (!PRODUCTS.some((p) => p.id === row.id)) PRODUCTS.push(normalizeProductRecord(row));
  });
  bumpCatalog();
}

function nextTmpSku() {
  const seq = Number(localStorage.getItem(TMP_SEQ_KEY) || "100") + 1;
  localStorage.setItem(TMP_SEQ_KEY, String(seq));
  persistShared(TMP_SEQ_KEY, seq);
  return `TMP-${String(seq).padStart(4, "0")}`;
}

function createAdminProduct(fields) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  if (!String(fields.name || "").trim()) return { ok: false, error: "name" };
  const category = matchAdminCategory(fields.category);
  if (!category) return { ok: false, error: "category" };
  const tmp = nextTmpSku();
  const product = normalizeProductRecord({
    id: `p-new-${tmp.toLowerCase()}`,
    provisionalSku: tmp,
    productNo: String(fields.productNo || "").trim(),
    category,
    name: String(fields.name).trim(),
    sizeDesc: fields.sizeDesc || "",
    certifications: fields.certifications || "",
    primarySpec: fields.primarySpec || "",
    salesUnit: fields.salesUnit || fields.unit || "",
    unit: fields.salesUnit || fields.unit || "",
    moq: fields.moq === "" || fields.moq == null ? "" : Number(fields.moq),
    leadTime: typeof fields.leadTime === "string"
      ? (String(fields.leadTime).trim() ? { min: 7, max: 7 } : null)
      : fields.leadTime || null,
    leadTimeLabel: typeof fields.leadTime === "string" ? String(fields.leadTime).trim() : "",
    purposes: Array.isArray(fields.purposes)
      ? fields.purposes
      : String(fields.purposes || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
    remark: fields.remark || "",
    green: Boolean(fields.green),
    hit: Boolean(fields.hit),
    tailorMade: Boolean(fields.tailorMade),
    image: fields.image || "",
    images: Array.isArray(fields.images) ? fields.images.filter(Boolean).slice(0, 5) : fields.image ? [fields.image] : [],
    imageSource: fields.image ? (fields.imageSource || "upload") : "generated",
    supplier: "Mattex",
    specs: [],
    published: false,
    description: fields.sizeDesc || "",
    standard: fields.certifications || "",
    createdAt: Date.now() + (Number(String(tmp).replace(/\D/g, "")) || 0),
  });
  PRODUCTS.push(product);
  persistProductPatches();
  emitStoreChange();
  return { ok: true, product };
}

function updateAdminProduct(id, fields) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product || product.deleted) return { ok: false, error: "missing" };
  if (fields.category && !matchAdminCategory(fields.category)) return { ok: false, error: "category" };
  Object.assign(product, {
    ...fields,
    category: fields.category ? matchAdminCategory(fields.category) : product.category,
    purposes: fields.purposes == null
      ? product.purposes
      : Array.isArray(fields.purposes)
        ? fields.purposes
        : String(fields.purposes).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
    unit: fields.salesUnit || fields.unit || product.unit,
    leadTimeLabel: typeof fields.leadTime === "string" ? String(fields.leadTime).trim() : product.leadTimeLabel,
    leadTime: typeof fields.leadTime === "string"
      ? (String(fields.leadTime).trim() ? product.leadTime || { min: 7, max: 7 } : null)
      : (fields.leadTime == null ? product.leadTime : fields.leadTime),
    green: Boolean(fields.green),
    hit: Boolean(fields.hit),
    tailorMade: Boolean(fields.tailorMade),
    image: fields.image == null ? product.image : fields.image,
    images: fields.images == null
      ? product.images
      : (Array.isArray(fields.images) ? fields.images.filter(Boolean).slice(0, 5) : product.images),
    imageSource: fields.image
      ? (fields.imageSource || "upload")
      : fields.image === ""
        ? "generated"
        : product.imageSource,
  });
  persistProductPatches();
  emitStoreChange();
  return { ok: true, product };
}

function productSkuId(product) {
  return String(product?.productNo || product?.provisionalSku || "").trim();
}

function productOfficialSku(product) {
  return String(product?.productNo || "").trim();
}

const PUBLISH_HARD_KEYS = ["officialSku", "name", "unit", "category", "duplicateSku"];
const PUBLISH_WARN_KEYS = ["moq", "lead"];

function publishBlockers(product) {
  const reasons = [];
  if (!productOfficialSku(product)) reasons.push("officialSku");
  if (!String(product?.category || "").trim()) reasons.push("category");
  if (!String(product?.name || "").trim()) reasons.push("name");
  if (!String(product?.salesUnit || product?.unit || "").trim()) reasons.push("unit");
  if (product?.moq == null || product?.moq === "") reasons.push("moq");
  const lead = product?.leadTime;
  if (!lead && !product?.leadTimeLabel) reasons.push("lead");
  const sku = productOfficialSku(product).toUpperCase();
  if (sku && PRODUCTS.some((o) => o.id !== product.id && !o.deleted && productOfficialSku(o).toUpperCase() === sku)) {
    reasons.push("duplicateSku");
  }
  return reasons;
}

function publishHardBlockers(product) {
  return publishBlockers(product).filter((key) => PUBLISH_HARD_KEYS.includes(key));
}

function publishWarnBlockers(product) {
  return publishBlockers(product).filter((key) => PUBLISH_WARN_KEYS.includes(key));
}

/** Published = live. Unpublish = not live. Removed is never live. */
function productCatalogStatus(product) {
  if (!product || product.deleted) return "deleted";
  if (product.published && !product.held) return "published";
  return "unpublished";
}

function publishAdminProduct(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return { ok: false, error: "missing" };
  if (product.deleted) return { ok: false, error: "deleted" };
  const blockers = publishHardBlockers(product);
  if (blockers.length) return { ok: false, error: "publish", blockers };
  product.published = true;
  product.held = false;
  product.deleted = false;
  persistProductPatches();
  emitStoreChange();
  return { ok: true, product };
}

function restoreAdminProduct(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return { ok: false, error: "missing" };
  if (!product.deleted) return { ok: false, error: "not_deleted" };
  product.deleted = false;
  product.published = false;
  product.held = false;
  persistProductPatches();
  emitStoreChange();
  return { ok: true, product };
}

function unpublishAdminProduct(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product || product.deleted) return { ok: false, error: "missing" };
  if (!product.published) return { ok: false, error: "not_live" };
  product.published = false;
  product.held = false;
  persistProductPatches();
  emitStoreChange();
  return { ok: true, product };
}

function holdAdminProduct(id, held) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product || product.deleted) return { ok: false, error: "missing" };
  product.held = false;
  if (held) product.published = false;
  persistProductPatches();
  emitStoreChange();
  return { ok: true, product };
}

function migrateHeldProductsToDraft() {
  let changed = false;
  PRODUCTS.forEach((p) => {
    if (p.held && !p.deleted) {
      p.held = false;
      p.published = false;
      changed = true;
    }
  });
  if (changed) persistProductPatches();
}

function softDeleteAdminProduct(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return { ok: false, error: "missing" };
  product.deleted = true;
  product.published = false;
  product.held = false;
  persistProductPatches();
  emitStoreChange();
  return { ok: true, product };
}

function canDeleteProductForever(product) {
  const status = productCatalogStatus(product);
  return status === "unpublished" || status === "draft" || status === "deleted";
}

function hardDeleteAdminProduct(id) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const idx = PRODUCTS.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: "missing" };
  const product = PRODUCTS[idx];
  if (!canDeleteProductForever(product)) return { ok: false, error: "published" };
  const prev = readJson(PRODUCT_PATCH_KEY, {});
  const removed = new Set(readRemovedProductIds(prev));
  removed.add(String(product.id));
  PRODUCTS.splice(idx, 1);
  const next = { ...prev, __removed: [...removed] };
  delete next[product.id];
  if (Array.isArray(next.__created)) {
    next.__created = next.__created.filter((row) => String(row?.id) !== String(product.id));
  }
  writeJson(PRODUCT_PATCH_KEY, next);
  persistProductPatches();
  emitStoreChange();
  return { ok: true };
}

function isAdminCreatedProduct(p) {
  const id = String(p.id || "");
  return id.startsWith("p-new-") || id.startsWith("p-xls-");
}

function adminProductCreatedAt(p) {
  const stamped = Number(p?.createdAt);
  if (Number.isFinite(stamped) && stamped > 0) return stamped;
  if (!isAdminCreatedProduct(p)) return 0;
  const digits = String(p.provisionalSku || p.id || "").match(/(\d+)\s*$/);
  return digits ? Number(digits[1]) : 1;
}

function listAdminProducts() {
  migrateHeldProductsToDraft();
  const index = new Map(PRODUCTS.map((p, i) => [p.id, i]));
  return PRODUCTS.slice().sort((a, b) => {
    const createdDiff = adminProductCreatedAt(b) - adminProductCreatedAt(a);
    if (createdDiff) return createdDiff;
    return (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0);
  });
}

function importAdminCsv(csv) {
  const gate = requireStaff();
  if (!gate.ok) return gate;
  const parsed = parseAdminCsv(csv);
  const results = [];
  parsed.rows.forEach((row) => {
    const name = String(row.name || "").trim();
    const cat = matchAdminCategory(row.category);
    if (!name || !cat) {
      results.push({ line: row._line, ok: false, msg: !name ? "Missing product name" : `Unknown category: ${row.category}` });
      return;
    }
    const sku = String(row.productNo || row.provisionalSku || "").trim();
    const tmp = String(row.provisionalSku || row.productNo || "").trim();
    let p = sku ? PRODUCTS.find((x) => String(x.productNo || "").toUpperCase() === sku.toUpperCase()) : null;
    if (!p && tmp) p = PRODUCTS.find((x) => x.provisionalSku === tmp || x.id === tmp);
    const tags = String(row.tags || "").toLowerCase();
    const purposes = String(row.purposes || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const imgRaw = String(row.image || "").trim();
    const imgIsGen = !imgRaw || /^gen/i.test(imgRaw);
    if (!p) {
      const created = createAdminProduct({
        name,
        category: cat,
        productNo: sku,
        sizeDesc: row.sizeDesc,
        certifications: row.certifications,
        primarySpec: row.primarySpec,
        salesUnit: row.salesUnit,
        moq: row.moq,
        leadTime: row.leadTime,
        purposes,
        remark: row.remark,
        green: /green|綠/.test(tags),
        hit: /hit|熱/.test(tags),
        tailorMade: /tailor|訂製|定制/.test(tags),
        image: imgIsGen ? "" : imgRaw,
      });
      if (created.ok) {
        if (tmp) created.product.provisionalSku = tmp;
        if (sku) created.product.productNo = sku;
      }
      results.push({ line: row._line, ok: true, msg: `Draft ${name}` });
      return;
    }
    if (p.deleted) {
      p.deleted = false;
      p.published = false;
      p.held = false;
    }
    p.category = cat;
    p.name = name;
    if (sku) p.productNo = sku;
    if (tmp) p.provisionalSku = tmp;
    if (row.sizeDesc != null) p.sizeDesc = row.sizeDesc;
    if (row.certifications != null) p.certifications = row.certifications;
    if (row.primarySpec != null) p.primarySpec = row.primarySpec;
    if (row.salesUnit) {
      p.salesUnit = row.salesUnit;
      p.unit = row.salesUnit;
    }
    if (row.moq !== "" && row.moq != null) p.moq = Number(row.moq);
    if (row.leadTime) p.leadTimeLabel = row.leadTime;
    if (purposes.length) p.purposes = purposes;
    if (row.remark != null) p.remark = row.remark;
    if (String(row.tags || "").trim()) {
      p.green = /green|綠/.test(tags);
      p.hit = /hit|熱/.test(tags);
      p.tailorMade = /tailor|訂製|定制/.test(tags);
    }
    const officialImg = p.imageSource === "upload" || p.imageSource === "chain";
    if (!imgIsGen) {
      p.image = imgRaw;
      p.imageSource = "upload";
    } else if (!officialImg) {
      p.imageSource = "generated";
    }
    results.push({ line: row._line, ok: true, msg: p.published ? `Updated live ${p.productNo}` : `Updated draft` });
  });
  persistProductPatches();
  emitStoreChange();
  return { ok: true, results };
}

function parseAdminCsv(text) {
  const map = {
    "provisional sku id": "provisionalSku",
    "official sku": "productNo",
    "category": "category",
    "img (gen)": "image",
    "product": "name",
    "product name": "name",
    "size / description": "sizeDesc",
    "certifications / relevant reports": "certifications",
    "primary spec description": "primarySpec",
    "sales unit": "salesUnit",
    "moq": "moq",
    "lead time": "leadTime",
    "purposes (indicator for searching)": "purposes",
    "remark": "remark",
    "tag (green / hit)": "tags",
    "tag (green / hit / tailor made)": "tags",
  };
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line, idx) => {
    const cells = splitCsvLine(line);
    const rec = { _line: idx + 2 };
    headers.forEach((h, i) => {
      const key = map[h.trim().toLowerCase()];
      if (key) rec[key] = cells[i] || "";
    });
    return rec;
  });
  return { rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function adminCsvTemplate() {
  return [
    "Provisional SKU ID",
    "Official SKU",
    "Category",
    "IMG (Gen)",
    "Product name",
    "Size / Description",
    "Certifications / Relevant Reports",
    "Primary Spec Description",
    "Sales Unit",
    "MOQ",
    "Lead Time",
    "Purposes (Indicator for Searching)",
    "Remark",
    "Tag (Green / Hit / Tailor Made)",
  ].join(",") + "\n";
}

const PRIVATE_STORE_KEYS = new Set([
  AUTH_KEY,
  STAFF_AUTH_KEY,
  AUTH_INVITE_HIDE_KEY,
  CART_AUTH_INVITE_SHOWN_KEY,
  "subbie_lang",
  DRAFTS_KEY,
]);
let sharedStoreRev = -1;
let sharedStoreTimer = 0;
let sharedPostChain = Promise.resolve();

function stripSharedDataUrl(value) {
  const text = String(value || "");
  return text.startsWith("data:") ? "" : value;
}

function leanSharedAttachment(item) {
  if (typeof item === "string") return item.startsWith("data:") ? { name: "attachment", omitted: true } : item;
  if (!item || typeof item !== "object") return item;
  const url = item.url || item.data || item.src || "";
  if (String(url).startsWith("data:")) {
    return { ...item, url: "", data: "", src: "", omitted: true, name: item.name || "attachment" };
  }
  return item;
}

function leanSharedRfq(rfq) {
  if (!rfq || typeof rfq !== "object") return rfq;
  const leanLine = (line) => ({
    ...line,
    image: stripSharedDataUrl(line?.image),
    attachments: Array.isArray(line?.attachments) ? line.attachments.map(leanSharedAttachment) : line?.attachments,
  });
  return {
    ...rfq,
    lines: (rfq.lines || []).map(leanLine),
    requestVersions: Array.isArray(rfq.requestVersions)
      ? rfq.requestVersions.map((version) => ({
          ...version,
          lines: (version.lines || []).map(leanLine),
        }))
      : rfq.requestVersions,
  };
}

function leanSharedRfqsMap(map) {
  const out = {};
  Object.entries(map && typeof map === "object" ? map : {}).forEach(([key, list]) => {
    out[key] = (Array.isArray(list) ? list : []).map(leanSharedRfq);
  });
  return out;
}

function enqueueSharedPost(body) {
  if (typeof fetch === "undefined" || isSupabaseConfigured()) return Promise.resolve();
  sharedPostChain = sharedPostChain
    .then(() =>
      fetch("/api/shared-store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.rev != null) sharedStoreRev = Number(data.rev) || sharedStoreRev;
        })
    )
    .catch(() => {});
  return sharedPostChain;
}

function persistShared(key, value) {
  if (typeof fetch === "undefined") return;
  if (PRIVATE_STORE_KEYS.has(key)) return;
  const payload = key === RFQS_KEY ? leanSharedRfqsMap(value) : value;
  enqueueSharedPost({ key, value: payload });
}

let rfqRemoteChain = Promise.resolve();
let rfqRemoteTimer = null;
let rfqRemotePending = null;

function flushRfqsRemote() {
  clearTimeout(rfqRemoteTimer);
  rfqRemoteTimer = null;
  const latest = rfqRemotePending;
  rfqRemotePending = null;
  if (!latest) return rfqRemoteChain;
  rfqRemoteChain = rfqRemoteChain
    .then(async () => {
      const remote = await fetchRemoteKv([RFQS_KEY]);
      const merged = mergeRfqMaps(latest, remote?.[RFQS_KEY] || {});
      writeLocalOnly(RFQS_KEY, merged);
      await persistKvNow(RFQS_KEY, leanSharedRfqsMap(merged));
      emitStoreChange();
    })
    .catch((error) => {
      console.warn("rfq persist", error?.message || error);
    });
  return rfqRemoteChain;
}

function persistRfqsRemote(map, { now = false } = {}) {
  const next = leanSharedRfqsMap(map);
  persistShared(RFQS_KEY, next);
  if (!isSupabaseConfigured()) return rfqRemoteChain;
  rfqRemotePending = next;
  if (now) return flushRfqsRemote();
  clearTimeout(rfqRemoteTimer);
  rfqRemoteTimer = setTimeout(flushRfqsRemote, 800);
  return rfqRemoteChain;
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushRfqsRemote();
  });
}

function persistSharedRfq(buyerKey, rfq) {
  if (!rfq?.id) return;
  enqueueSharedPost({
    upsertRfq: true,
    buyerKey: buyerKey || GUEST_KEY,
    rfq: leanSharedRfq(rfq),
  });
  persistRfqsRemote(getRfqsMap(), { now: true });
}

function dumpLocalSharedKv() {
  const keys = [
    ACCOUNTS_KEY,
    DELETED_BUYERS_KEY,
    RFQS_KEY,
    QUOTE_SNAPSHOTS_KEY,
    SEQ_KEY,
    REPORTS_KEY,
    REPORT_SEQ_KEY,
    ADMIN_ALERTS_KEY,
    PRODUCT_PATCH_KEY,
    CUSTOM_CATEGORIES_KEY,
    CATEGORY_ADMIN_KEY,
    TMP_SEQ_KEY,
    STAFF_KEY,
    TMS_SEQ_KEY,
  ];
  const kv = {};
  keys.forEach((key) => {
    if (key === SEQ_KEY || key === REPORT_SEQ_KEY || key === TMP_SEQ_KEY || key === TMS_SEQ_KEY) {
      const n = Number(localStorage.getItem(key) || 0);
      if (n) kv[key] = n;
      return;
    }
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      kv[key] = key === RFQS_KEY ? leanSharedRfqsMap(parsed) : parsed;
    } catch {
      /* skip */
    }
  });
  return kv;
}

function applySharedStore(kv) {
  if (!kv || typeof kv !== "object") return false;
  let changed = false;
  Object.entries(kv).forEach(([key, value]) => {
    if (PRIVATE_STORE_KEYS.has(key)) return;
    if (key === SEQ_KEY || key === REPORT_SEQ_KEY || key === TMP_SEQ_KEY || key === TMS_SEQ_KEY) {
      const remote = Number(value) || 0;
      const local = Number(localStorage.getItem(key) || 0);
      if (remote > local) {
        localStorage.setItem(key, String(remote));
        changed = true;
      }
      return;
    }
    if (key === RFQS_KEY) {
      const merged = mergeRfqMaps(readJson(RFQS_KEY, {}), value || {});
      if (JSON.stringify(merged) !== JSON.stringify(readJson(RFQS_KEY, {}))) {
        writeLocalOnly(RFQS_KEY, merged);
        changed = true;
      }
      return;
    }
    if (key === QUOTE_SNAPSHOTS_KEY) {
      const merged = mergeQuoteSnapshots(value || {}, getQuoteSnapshots());
      if (JSON.stringify(merged) !== JSON.stringify(getQuoteSnapshots())) {
        writeLocalOnly(QUOTE_SNAPSHOTS_KEY, merged);
        changed = true;
      }
      return;
    }
    if (key === DRAFTS_KEY) {
      const merged = mergeDraftMaps(readJson(DRAFTS_KEY, {}), value || {});
      if (JSON.stringify(merged) !== JSON.stringify(readJson(DRAFTS_KEY, {}))) {
        writeLocalOnly(DRAFTS_KEY, merged);
        changed = true;
      }
      return;
    }
    if (key === DELETED_BUYERS_KEY) {
      mergeDeletedBuyers(value);
      const stripped = stripDeletedBuyers(readJson(ACCOUNTS_KEY, {}));
      if (JSON.stringify(stripped) !== JSON.stringify(readJson(ACCOUNTS_KEY, {}))) {
        writeLocalOnly(ACCOUNTS_KEY, stripped);
      }
      changed = true;
      return;
    }
    if (key === ACCOUNTS_KEY) {
      const merged = accountsWithoutSecrets(stripDeletedBuyers({ ...readJson(ACCOUNTS_KEY, {}), ...(value || {}) }));
      if (JSON.stringify(merged) !== JSON.stringify(readJson(ACCOUNTS_KEY, {}))) {
        writeLocalOnly(ACCOUNTS_KEY, merged);
        changed = true;
      }
      return;
    }
    const nextRaw = JSON.stringify(value);
    if (key === STAFF_KEY) {
      const merged = mergeStaffLists(readJson(STAFF_KEY, []), value);
      if (JSON.stringify(merged) !== JSON.stringify(readJson(STAFF_KEY, []))) {
        writeLocalOnly(STAFF_KEY, merged);
        changed = true;
      }
      return;
    }
    if (key === PRODUCT_PATCH_KEY) {
      const merged = mergeProductPatchMaps(readJson(PRODUCT_PATCH_KEY, {}), value);
      if (JSON.stringify(merged) !== JSON.stringify(readJson(PRODUCT_PATCH_KEY, {}))) {
        writeLocalOnly(PRODUCT_PATCH_KEY, merged);
        applySavedProductPatches();
        changed = true;
      }
      return;
    }
    if (nextRaw !== localStorage.getItem(key)) {
      writeLocalOnly(key, value);
      if (key === PRODUCT_PATCH_KEY) applySavedProductPatches();
      changed = true;
    }
  });
  if (changed) emitStoreChange();
  return changed;
}

async function pullSupabaseSharedStore() {
  const tableRfqs = await fetchRemoteRfqs();
  if (tableRfqs && Object.keys(tableRfqs).length) {
    applySharedStore({ [RFQS_KEY]: tableRfqs });
  } else {
    const rfqs = await fetchRemoteKv([RFQS_KEY]);
    if (rfqs) applySharedStore(rfqs);
  }
  const kv = await fetchRemoteKv([
    SEQ_KEY,
    ADMIN_ALERTS_KEY,
    QUOTE_SNAPSHOTS_KEY,
    ACCOUNTS_KEY,
    DELETED_BUYERS_KEY,
    REPORTS_KEY,
    REPORT_SEQ_KEY,
    PRODUCT_PATCH_KEY,
    CUSTOM_CATEGORIES_KEY,
    CATEGORY_ADMIN_KEY,
    TMP_SEQ_KEY,
    STAFF_KEY,
    TMS_SEQ_KEY,
  ]);
  if (kv) applySharedStore(kv);
}

async function pullSharedStore({ bootstrap = false } = {}) {
  try {
    if (!isSupabaseConfigured()) {
      const res = await fetch("/api/shared-store");
      if (res.ok) {
        const data = await res.json();
        const rev = Number(data?.rev) || 0;
        if (bootstrap) {
          if (data?.kv && Object.keys(data.kv).length) applySharedStore(data.kv);
          const localKv = dumpLocalSharedKv();
          if (Object.keys(localKv).length) {
            await fetch("/api/shared-store", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ kv: localKv, bootstrap: true }),
            });
          }
          sharedStoreRev = rev;
        } else if (rev !== sharedStoreRev) {
          applySharedStore(data.kv);
          sharedStoreRev = rev;
        }
      }
    }
  } catch {
    /* ignore */
  }
  await pullSupabaseSharedStore();
}

const CATALOG_KV_KEYS = [
  CUSTOM_CATEGORIES_KEY,
  CATEGORY_ADMIN_KEY,
  REPORTS_KEY,
  ADMIN_ALERTS_KEY,
  STAFF_KEY,
  PRODUCT_PATCH_KEY,
  REPORT_SEQ_KEY,
  TMP_SEQ_KEY,
  TMS_SEQ_KEY,
  DELETED_BUYERS_KEY,
  ACCOUNTS_KEY,
  QUOTE_SNAPSHOTS_KEY,
  SEQ_KEY,
];

async function pullQuoteSnapshots() {
  if (!isSupabaseConfigured()) return pullSharedStore();
  const kv = await fetchRemoteKv([QUOTE_SNAPSHOTS_KEY]);
  if (kv) applySharedStore(kv);
}

let rfqRefreshChain = Promise.resolve();
let rfqStamp = null;

function refreshRemoteRfqs() {
  if (!isSupabaseConfigured()) return pullSharedStore();
  rfqRefreshChain = rfqRefreshChain
    .then(async () => {
      const stamp = await fetchRfqStamp();
      if (!stamp) return;
      const prev = rfqStamp;
      const tableChanged = !prev || stamp.table !== prev.table;
      const kvChanged = !prev || stamp.kv !== prev.kv;
      if (!tableChanged && !kvChanged) return;
      const [tableRfqs, kv] = await Promise.all([
        tableChanged ? fetchRemoteRfqs(prev?.table || "") : null,
        kvChanged ? fetchRemoteKv([RFQS_KEY]) : null,
      ]);
      rfqStamp = {
        table: tableChanged && !tableRfqs ? prev?.table || "" : stamp.table,
        kv: kvChanged && !kv ? prev?.kv || "" : stamp.kv,
      };
      const remoteRfqs = mergeRfqMaps(tableRfqs || {}, kv?.[RFQS_KEY] || {});
      if (!Object.keys(remoteRfqs).length) return;
      const merged = mergeRfqMaps(readJson(RFQS_KEY, {}), remoteRfqs);
      if (JSON.stringify(merged) === JSON.stringify(readJson(RFQS_KEY, {}))) return;
      writeLocalOnly(RFQS_KEY, merged);
      emitStoreChange();
    })
    .catch((error) => {
      console.warn("rfq refresh", error?.message || error);
    });
  return rfqRefreshChain;
}

function ensureBuyerSession() {
  if (!isSupabaseConfigured() || isPortalSurface() || !getUser()) return Promise.resolve(false);
  rfqRefreshChain = rfqRefreshChain
    .then(async () => {
      const session = await fetchSessionState({ buyerEmail: normalizeEmail(getUser()?.email) });
      if (applySessionState(session)) emitStoreChange();
    })
    .catch((error) => {
      console.warn("buyer session", error?.message || error);
    });
  return rfqRefreshChain;
}

function startSharedStoreSync() {
  if (typeof window === "undefined") return;
  window.clearInterval(sharedStoreTimer);
  if (!isSupabaseConfigured()) {
    pullSharedStore({ bootstrap: true });
    sharedStoreTimer = window.setInterval(() => pullSharedStore(), 1000);
  }
  if (isPortalSurface()) verifyStaffSession();
}

applySavedProductPatches();

export {
  PRODUCTS,
  CATEGORIES,
  CATEGORY_DEFS,
  getCategoryDefs,
  getCategories,
  getCategoryBySlug,
  getCategoryByName,
  catalogPathForCategory,
  getTopProducts,
  getGreenProducts,
  getSalesProducts,
  getProductsByCategory,
  searchProducts,
  searchProductsUnion,
  supplierSlug,
  supplierPath,
  supplierDisplayName,
  isMattexSupplier,
  getSuppliers,
  getSupplier,
  supplierBrand,
  buildSupplierBankInfo,
  getProductsBySupplier,
  getTopProductsForSupplier,
  searchSupplierProducts,
  buildSupplierMetrics,
  formatPrice,
  SAMPLE_PROJECTS,
  rfqProjectName,
  getProduct,
  getProductRemarks,
  getProductRating,
  hydrateStore,
  startSharedStoreSync,
  pullSharedStore,
  pullQuoteSnapshots,
  refreshRemoteRfqs,
  ensureBuyerSession,
  isSupabaseConfigured,
  canDirectBuy,
  isDiscontinued,
  suggestCatalogMatch,
  getProductsByIds,
  getEffectivePrice,
  isHitProduct,
  formatQuoteDate,
  formatQuoteDateShort,
  stockStatusKey,
  isLoggedIn,
  getUser,
  takeDisabledKick,
  getDraft,
  setDraft,
  getCart,
  cartCount,
  addToCart,
  addCustomLine,
  updateCustomLine,
  setLineQty,
  setLineIntent,
  setLineRequestedPrice,
  removeLine,
  removeLines,
  setDraftNote,
  setDraftResponseDate,
  setDraftAddress,
  setDraftProject,
  setDraftDeliveryDate,
  setDraftDeliveryMode,
  setDraftDeliveryLots,
  setDraftCanonicalCategory,
  setDraftAcceptSubstitutes,
  inferCanonicalCategory,
  draftTotals,
  getRfqs,
  submitRfq,
  sendImmediateQuote,
  sendWhatsappQuote,
  whatsappNow,
  enrichCartLine,
  whatsappDraftUrl,
  openWhatsappDraft,
  getRfq,
  saveRfq,
  reorderRfq,
  loginUser,
  requestBuyerPasswordReset,
  getBuyerReset,
  resetBuyerPassword,
  registerUser,
  updateUserProfile,
  logoutUser,
  setPendingCart,
  setPendingWhatsappRfq,
  setPendingWhatsappOrder,
  getPendingWhatsappOrder,
  setPendingCustom,
  setPendingRoute,
  openAuthModal,
  closeAuthModal,
  inviteBuyerAuth,
  requireBuyerAuth,
  addFromStorefront,
  consumePendingInviteContinue,
  setAuthInviteHidden,
  isAuthInviteHidden,
  consumePendingAfterAuth,
  setPendingCartWhatsappSubmit,
  completeCartWhatsappSubmit,
  takeLastCartWhatsappResult,
  whatsappUrl,
  buyerWhatsappHref,
  whatsappPhoneId,
  emptyDraft,
  PENDING_CART_KEY,
  PENDING_WA_RFQ_KEY,
  WHATSAPP_NUMBER,
  WHATSAPP_DISPLAY,
  WHATSAPP_HREF,
  SALES_EMAIL,
  MATTEX_CHAIN_URL,
  TMS_INBOUND_RFQ_URL,
  MATTEX_SITE_URL,
  isBuyerVisible,
  isOrderable,
  inboxStatus,
  rfqIsNoOffer,
  listAdminProducts,
  getAdminCategories,
  addAdminCategory,
  listAdminCategories,
  renameAdminCategory,
  deleteAdminCategory,
  assignAdminProductsCategory,
  restoreAdminProduct,
  publishHardBlockers,
  publishWarnBlockers,
  loginStaff,
  logoutStaff,
  getStaffSession,
  getStaffList,
  createStaff,
  resendStaffInvite,
  staffInvitePending,
  getStaffPasswordLink,
  acceptStaffPasswordLink,
  requestStaffPasswordReset,
  updateStaff,
  changeOwnStaffPassword,
  disableStaff,
  enableStaff,
  hardDeleteStaff,
  canDeleteStaffForever,
  hardDeleteBuyer,
  canDeleteBuyerForever,
  listAssignableBuyers,
  listBuyers,
  setBuyerEnabled,
  approveBuyer,
  markBuyerReviewed,
  rejectBuyer,
  getAllRfqs,
  startRfqReview,
  decideRfq,
  requestRfqCancel,
  requestRfqReverse,
  canBuyerRequestCancel,
  canBuyerReverse,
  rfqNeedsSalesReverse,
  copyRfqToDraft,
  decideRfqCancel,
  decideRfqReverse,
  openRfqEmailPreview,
  inferRfqEmailPreviewKind,
  deliverRfqAcceptedEmail,
  deliverRfqNoOfferEmail,
  deliverRfqCancelAcceptedEmail,
  deliverRfqCancelDeclinedEmail,
  deliverRfqCancelRequestedEmail,
  deliverRfqReverseRequestedEmail,
  deliverRfqReverseAcceptedEmail,
  deliverRfqReverseDeclinedEmail,
  rfqDiscussWhatsappText,
  rfqDiscussEmailHref,
  openWhatsappChat,
  quoteRfqToBuyer,
  createGuestQuoteSnapshot,
  markGuestQuoteWhatsappSent,
  getGuestQuoteSnapshot,
  quoteVersionList,
  rfqRequestVersionList,
  rfqRequestEffectiveVersionNo,
  getRfqRequestVersion,
  getEffectiveRfqRequestVersion,
  formatRfqRequestVersionOption,
  applyRfqRequestVersion,
  quoteEffectiveVersionNo,
  getQuoteVersion,
  getEffectiveQuoteVersion,
  formatQuoteVersionOption,
  formatQuoteVersionStamp,
  rfqActivityLog,
  rfqLastActivity,
  rfqActivityLabel,
  hydrateRfqDecisionActivity,
  quoteDraftIsDirty,
  rfqLinesForQuoteVersion,
  loadQuoteVersionIntoDraft,
  guestQuotePublicUrl,
  guestQuoteWhatsappText,
  snapshotQuotePdfItems,
  rfqQuotedOffline,
  rfqCanSendWhatsappQuote,
  formatBuyerPhoneDisplay,
  createBuyerPurchaseOrder,
  rfqBuyerKind,
  isDev1InboxRfq,
  setRfqLineQuotedPrice,
  setRfqLineQty,
  setRfqLineRemark,
  setRfqLineNoOffer,
  assignRfqToBuyer,
  setRfqBuyerPhone,
  uploadRfqToTms,
  quotePdfItems,
  resubmitRfq,
  updateBuyerRfqDetails,
  buyerRfqDetailsLocked,
  lineMoq,
  adminFollowUpWhatsapp,
  getReports,
  createProductReport,
  lookProductReport,
  dismissProductReport,
  fixProductReport,
  createAdminProduct,
  updateAdminProduct,
  publishAdminProduct,
  unpublishAdminProduct,
  publishBlockers,
  productCatalogStatus,
  productSkuId,
  holdAdminProduct,
  softDeleteAdminProduct,
  hardDeleteAdminProduct,
  canDeleteProductForever,
  importAdminCsv,
  adminCsvTemplate,
  listAdminAlerts,
  requestAdminNotifyPermission,
  showAdminWebNotification,
  deliverAdminAlertEmails,
  markAdminAlertsSeen,
};

refreshStoreSnapshot();

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (
      event.key === RFQS_KEY ||
      event.key === QUOTE_SNAPSHOTS_KEY ||
      event.key === REPORTS_KEY ||
      event.key === PRODUCT_PATCH_KEY ||
      event.key === ADMIN_ALERTS_KEY ||
      event.key === ACCOUNTS_KEY ||
      event.key === CUSTOM_CATEGORIES_KEY ||
      event.key === CATEGORY_ADMIN_KEY
    ) {
      emitStoreChange();
    }
  });
}
