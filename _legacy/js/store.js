const CATEGORY_DEFS = [
  { id: "precast", name: "Precast Concrete", image: "assets/cat-precast.webp", count: 3, unit: "panel", base: 420, supplier: "Harbor Precast Co.", specs: ["Grade: C40/50", "Size: modular", "Finish: fair-faced", "Use: structural"] },
  { id: "barriers", name: "Barriers", image: "assets/cat-barriers.webp", count: 2, unit: "unit", base: 280, supplier: "SafeRoute Barriers Ltd.", specs: ["Type: temporary / permanent", "Material: concrete", "Length: 2–3 m", "Reflective: optional"] },
  { id: "brick", name: "Brick & Block", image: "assets/cat-brick.webp", count: 3, unit: "pack", base: 95, supplier: "Redclay Masonry Works", specs: ["Material: clay / concrete", "Size: standard", "Strength: load-bearing", "Finish: common / facing"] },
  { id: "waterproof", name: "Waterproofing", image: "assets/cat-waterproof.webp", count: 5, unit: "roll", base: 145, supplier: "AquaShield Membranes", specs: ["Type: membrane", "Thickness: 1.5–4 mm", "Application: torch / self-adhesive", "Area: roof / basement"] },
  { id: "manhole", name: "Manhole & Channel", image: "assets/cat-manhole.webp", count: 1, unit: "set", base: 560, supplier: "DrainCore Industrial", specs: ["Cover: ductile iron", "Channel: polymer concrete", "Load class: D400", "Size: DN600"] },
  { id: "insulation", name: "Insulation", image: "assets/cat-insulation.webp", count: 2, unit: "pack", base: 210, supplier: "ThermoWrap Building Systems", specs: ["Type: XPS / PIR", "Thickness: 50–100 mm", "R-value: high", "Edge: tongue & groove"] },
  { id: "plaster", name: "Plastering", image: "assets/cat-plaster.webp", count: 9, unit: "bag", base: 18, supplier: "FinishLine Plasters", specs: ["Type: gypsum / cement", "Bag size: 25 kg", "Finish: skim / base", "Indoor / outdoor"] },
  { id: "safetynet", name: "Safety Net", image: "assets/cat-safetynet.webp", count: 0, unit: "roll", base: 320, supplier: "SiteGuard Safety Gear", specs: ["Mesh: HDPE", "Color: orange", "Use: edge protection", "UV stabilized"] },
  { id: "steel", name: "Structure Steel Element, Metal Product", image: "assets/cat-steel.webp", count: 13, unit: "pc", base: 380, supplier: "Northspan Steel Group", specs: ["Grade: S275 / S355", "Section: UB / UC / angle", "Finish: primed", "Cut-to-length: yes"] },
  { id: "tile", name: "Tile", image: "assets/cat-tile.webp", count: 6, unit: "box", base: 42, supplier: "Stoneform Ceramics", specs: ["Material: ceramic / porcelain", "Size: 300×300–600×600", "Finish: matt / gloss", "Use: floor / wall"] },
  { id: "timber", name: "Timber / Plywood", image: "assets/cat-timber.webp", count: 4, unit: "sheet", base: 68, supplier: "Pacific Timber Supply", specs: ["Species: softwood / hardwood", "Grade: structural", "Thickness: 9–18 mm", "Treatment: optional"] },
  { id: "board", name: "Board", image: "assets/cat-board.webp", count: 4, unit: "sheet", base: 36, supplier: "PanelCraft Interiors", specs: ["Type: gypsum / cement board", "Size: 1200×2400", "Thickness: 9–15 mm", "Edge: tapered"] },
  { id: "aggregate", name: "Aggregate", image: "assets/cat-aggregate.webp", count: 4, unit: "ton", base: 55, supplier: "QuarryPeak Aggregates", specs: ["Type: crushed stone / sand", "Size: 10–20 mm", "Wash: washed", "Use: concrete / fill"] },
  { id: "pipe", name: "Pipe & Fittings & Accessories", image: "assets/cat-pipe.webp", count: 11, unit: "pc", base: 24, supplier: "Flowline Pipe & Fittings", specs: ["Material: UPVC / steel", "Size: DN15–DN200", "Pressure: PN10–PN16", "Includes: fittings"] },
  { id: "cable", name: "Cable Containment", image: "assets/cat-cable.webp", count: 3, unit: "length", base: 88, supplier: "VoltTray Electrical", specs: ["Type: tray / trunking", "Material: GI steel", "Width: 100–300 mm", "Finish: hot-dip galvanized"] },
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
};

const GREEN_PRODUCT_IDS = new Set([
  "insulation-01",
  "insulation-02",
  "timber-01",
  "timber-02",
  "aggregate-01",
  "board-01",
  "board-02",
  "tile-01",
  "waterproof-02",
  "precast-02",
]);

const GREEN_BLURBS = {
  "insulation-01": "High thermal resistance for lower HVAC load and energy use.",
  "insulation-02": "Continuous insulation pack for envelope performance upgrades.",
  "timber-01": "FSC-certified plywood for responsible structural framing.",
  "timber-02": "Responsibly sourced timber sheet for fit-out and formwork.",
  "aggregate-01": "Recycled aggregate that reduces virgin quarry demand.",
  "board-01": "Low-VOC gypsum board for healthier indoor air.",
  "board-02": "Lightweight board option that cuts transport emissions.",
  "tile-01": "Porcelain tile with lower embodied carbon mix design.",
  "waterproof-02": "Long-life membrane that reduces rework and waste.",
  "precast-02": "Optimized precast panel for less on-site waste.",
};

function buildProducts() {
  const out = [];
  let featured = 1;
  CATEGORY_DEFS.forEach((cat) => {
    const total = cat.id === "safetynet" ? 2 : cat.count;
    for (let i = 1; i <= total; i++) {
      const id = cat.id + "-" + String(i).padStart(2, "0");
      const price =
        i % 5 === 0 ? null : Math.round((cat.base * (0.85 + (i % 7) * 0.08)) * 100) / 100;
      const name =
        FEATURED_NAMES[id] ||
        cat.name.split(",")[0].trim() + " " + cat.unit + " #" + i;
      const isGreen = GREEN_PRODUCT_IDS.has(id);
      const suppliers = ALT_SUPPLIERS[cat.id] || [cat.supplier];
      const supplier = suppliers[(i - 1) % suppliers.length];
      out.push({
        id,
        name,
        category: cat.name,
        supplier,
        featuredRank: featured <= 5 && i === 1 ? featured++ : null,
        green: isGreen,
        price,
        description: isGreen
          ? GREEN_BLURBS[id] ||
            "Green-preferred SKU for lower-impact project procurement."
          : cat.name +
            " supply item for project procurement. Spec-ready SKU for RFQ and WhatsApp price inquiry.",
        image: cat.image,
        specs: isGreen
          ? cat.specs.concat(["Tag: Green preferred", "Impact: lower-carbon option"])
          : cat.specs.slice(),
      });
    }
  });
  return out;
}

const PRODUCTS = buildProducts();

const CATEGORIES = CATEGORY_DEFS.map((c) => c.name);

function getCategoryDefs() {
  return CATEGORY_DEFS.map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image,
    count: PRODUCTS.filter((p) => p.category === c.name).length,
  }));
}

function getCategories() {
  return CATEGORIES.slice();
}

function getTopProducts(limit) {
  const n = limit || 5;
  return PRODUCTS.filter((p) => p.featuredRank != null)
    .sort((a, b) => a.featuredRank - b.featuredRank)
    .slice(0, n);
}

function getGreenProducts(limit) {
  const list = PRODUCTS.filter((p) => p.green);
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

function getProductsByCategory(category) {
  if (!category || category === "all") return PRODUCTS.slice();
  return PRODUCTS.filter((p) => p.category === category);
}

function productSearchBlob(product) {
  const specs = Array.isArray(product.specs) ? product.specs.join(" ") : "";
  const price =
    product.price == null ? "price upon request" : String(product.price);
  return [
    product.id,
    product.name,
    product.category,
    product.supplier,
    product.description,
    specs,
    price,
    product.green ? "green eco sustainable low-carbon fsc recycled" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function searchProducts(query, category) {
  const base = getProductsByCategory(category);
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


const AUTH_KEY = "subbie_auth";
const DRAFTS_KEY = "subbie_drafts_by_user";
const RFQS_KEY = "subbie_rfqs_by_user";
const SEQ_KEY = "subbie_rfq_seq";
const WHATSAPP_NUMBER = "15550142200";

const PENDING_CART_KEY = "subbie_pending_cart";
const PENDING_WA_RFQ_KEY = "subbie_pending_whatsapp_rfq";

function formatPrice(price) {
  if (price == null) return "Price Upon Request";
  return (
    "$" +
    price.toLocaleString("en-US", {
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
  localStorage.setItem(key, JSON.stringify(value));
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

function getUser() {
  return readJson(AUTH_KEY, null);
}

function emptyDraft() {
  return { lines: [], note: "" };
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

function getDraft() {
  const email = currentEmail();
  if (!email) return emptyDraft();
  const map = getDraftsMap();
  return map[email] ? map[email] : emptyDraft();
}

function setDraft(draft) {
  const email = currentEmail();
  if (!email) return;
  const map = getDraftsMap();
  map[email] = {
    lines: Array.isArray(draft.lines) ? draft.lines : [],
    note: draft.note || "",
  };
  setDraftsMap(map);
}

function getCart() {
  return getDraft().lines.map((line) => {
    const product = getProduct(line.productId);
    return {
      id: line.productId,
      name: product ? product.name : line.productId,
      price: product ? product.price : null,
      qty: line.qty,
    };
  });
}

function cartCount() {
  return getDraft().lines.reduce((sum, line) => sum + (line.qty || 0), 0);
}

function addToCart(productId) {
  const product = getProduct(productId);
  if (!product || !currentEmail()) return getCart();
  const draft = getDraft();
  const existing = draft.lines.find((l) => l.productId === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    draft.lines.push({ productId, qty: 1 });
  }
  setDraft(draft);
  return getCart();
}

function setLineQty(productId, qty) {
  const draft = getDraft();
  const line = draft.lines.find((l) => l.productId === productId);
  if (!line) return draft;
  const next = Math.floor(Number(qty));
  if (!Number.isFinite(next) || next < 1) return draft;
  line.qty = next;
  setDraft(draft);
  return draft;
}

function removeLine(productId) {
  const draft = getDraft();
  draft.lines = draft.lines.filter((l) => l.productId !== productId);
  setDraft(draft);
  return draft;
}

function setDraftNote(note) {
  const draft = getDraft();
  draft.note = String(note || "");
  setDraft(draft);
  return draft;
}

function draftTotals(draft) {
  let pricedSubtotal = 0;
  let unpricedCount = 0;
  const enriched = (draft.lines || []).map((line) => {
    const product = getProduct(line.productId);
    const unitPrice = product ? product.price : null;
    if (unitPrice == null) unpricedCount += 1;
    else pricedSubtotal += unitPrice * line.qty;
    return {
      productId: line.productId,
      qty: line.qty,
      name: product ? product.name : line.productId,
      supplier: product ? product.supplier : null,
      unitPrice,
      image: product ? product.image : null,
    };
  });
  return { lines: enriched, pricedSubtotal, unpricedCount, note: draft.note || "" };
}

function nextRfqId() {
  const seq = Number(localStorage.getItem(SEQ_KEY) || "1000") + 1;
  localStorage.setItem(SEQ_KEY, String(seq));
  return `RFQ-${seq}`;
}

function getRfqs() {
  const email = currentEmail();
  if (!email) return [];
  const map = getRfqsMap();
  return Array.isArray(map[email]) ? map[email] : [];
}

function submitRfq() {
  const email = currentEmail();
  if (!email) return { ok: false, error: "not_logged_in" };
  const draft = getDraft();
  if (!draft.lines.length) return { ok: false, error: "empty" };
  const totals = draftTotals(draft);
  const rfq = {
    id: nextRfqId(),
    status: "submitted",
    submittedAt: new Date().toISOString(),
    note: totals.note,
    lines: totals.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      supplier: l.supplier,
      qty: l.qty,
      unitPrice: l.unitPrice,
    })),
    pricedSubtotal: totals.pricedSubtotal,
    unpricedCount: totals.unpricedCount,
  };
  const map = getRfqsMap();
  const list = Array.isArray(map[email]) ? map[email] : [];
  list.unshift(rfq);
  map[email] = list;
  setRfqsMap(map);
  setDraft(emptyDraft());
  return { ok: true, rfq };
}

function getRfq(id) {
  return getRfqs().find((r) => r.id === id) || null;
}

function reorderRfq(id) {
  const src = getRfq(id);
  if (!src || !currentEmail()) return { ok: false };
  setDraft({
    note: src.note || "",
    lines: src.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
  });
  return { ok: true };
}

function loginUser({ email, name }) {
  const nextEmail = normalizeEmail(email);
  const previous = getUser();
  const prevEmail = previous ? normalizeEmail(previous.email) : null;

  if (prevEmail && prevEmail !== nextEmail) {
    sessionStorage.removeItem(PENDING_CART_KEY);
    sessionStorage.removeItem(PENDING_WA_RFQ_KEY);
  }

  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      email: nextEmail,
      name: name || nextEmail.split("@")[0],
      at: Date.now(),
    })
  );
}

function logoutUser() {
  localStorage.removeItem(AUTH_KEY);
}

function setPendingCart(productId) {
  if (productId) sessionStorage.setItem(PENDING_CART_KEY, productId);
}

function setPendingWhatsappRfq(productId) {
  if (productId) sessionStorage.setItem(PENDING_WA_RFQ_KEY, productId);
}

function consumePendingAfterAuth() {
  const pendingCart = sessionStorage.getItem(PENDING_CART_KEY);
  const pendingWa = sessionStorage.getItem(PENDING_WA_RFQ_KEY);
  sessionStorage.removeItem(PENDING_CART_KEY);
  sessionStorage.removeItem(PENDING_WA_RFQ_KEY);

  let wentToRfq = false;
  if (pendingCart) {
    addToCart(pendingCart);
    wentToRfq = true;
  }
  if (pendingWa) {
    addToCart(pendingWa);
    wentToRfq = true;
  }
  return wentToRfq ? "rfq.html" : "index.html";
}

function whatsappUrl(product) {
  const text = product
    ? `Hi Subbie sales, I'd like to ask for the price of: ${product.name} (SKU: ${product.id.toUpperCase()}).`
    : "Hi Subbie sales, I'd like to ask about product pricing.";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
