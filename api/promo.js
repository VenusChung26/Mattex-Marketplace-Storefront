import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";
import { readSession } from "./auth.js";

const FILE = path.join(process.cwd(), "data", "promo.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "assets", "promo", "uploads");
const PROMO_KEY = "promo";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ID_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const SRC_RE = /^\/assets\/promo\/[a-zA-Z0-9._/-]+$/;
const BLOB_RE = /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\/promo\/[A-Za-z0-9._~/-]+$/;

let client = null;

function db() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

async function readKv(sb, key) {
  const { data, error } = await sb.from("app_kv").select("value").eq("key", key).maybeSingle();
  if (error) return { error, value: null };
  return { error: null, value: data?.value ?? null };
}

async function writeKv(sb, key, value) {
  const { error } = await sb.from("app_kv").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
  return { error };
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const SEED = {
  visible: true,
  sentenceZh: "憑海報即享專屬特價。買得多，折得多，額外優惠高達 5%。",
  sentenceEn: "Show this poster for the special price. Extra discount up to 5% when you buy more.",
  banners: [
    {
      id: "prices",
      nameZh: "中秋限定價目",
      nameEn: "Promotional price list",
      src: "/assets/promo/offer-prices.webp",
      products: [
        { productId: "mkt-mesh-a142", price: 88, endsOn: "2026-12-31" },
        { productId: "mkt-mesh-a193", price: 96, endsOn: "2026-12-31" },
        { productId: "mkt-mesh-a252", price: 110, endsOn: "2026-12-31" },
        { productId: "mkt-mesh-a393", price: 128, endsOn: "2026-12-31" },
        { productId: "mkt-mesh-b503", price: 140, endsOn: "2026-12-31" },
      ],
    },
    {
      id: "range",
      nameZh: "現貨及推廣建材",
      nameEn: "Products on promotion",
      src: "/assets/promo/offer-range.webp",
    },
  ],
};

let chain = Promise.resolve();

function cleanProducts(list) {
  const seen = new Set();
  const products = [];
  for (const row of Array.isArray(list) ? list : []) {
    const productId = String(row?.productId || "").trim();
    const price = Math.round(Number(row?.price) * 100) / 100;
    const endsOn = String(row?.endsOn || "").trim();
    if (!productId || seen.has(productId)) continue;
    if (!Number.isFinite(price) || price <= 0 || !DATE_RE.test(endsOn)) continue;
    seen.add(productId);
    products.push({ productId, price, endsOn });
  }
  return products;
}

function publicPromo(doc) {
  return {
    visible: doc?.visible !== false,
    titleZh: String(doc?.titleZh || ""),
    titleEn: String(doc?.titleEn || ""),
    sentenceZh: String(doc?.sentenceZh || ""),
    sentenceEn: String(doc?.sentenceEn || ""),
    banners: (Array.isArray(doc?.banners) ? doc.banners : [])
      .filter((banner) => banner?.id && banner?.src)
      .map((banner) => ({
        id: String(banner.id),
        nameZh: String(banner.nameZh || ""),
        nameEn: String(banner.nameEn || ""),
        src: String(banner.src),
        ...(safeSrc(banner.heroSrc) ? { heroSrc: safeSrc(banner.heroSrc) } : {}),
        sentenceZh: String(banner.sentenceZh || ""),
        sentenceEn: String(banner.sentenceEn || ""),
        products: cleanProducts(banner.products),
      })),
  };
}

async function readPromo() {
  const sb = db();
  if (sb) {
    const remote = await readKv(sb, PROMO_KEY);
    if (!remote.error && Array.isArray(remote.value?.banners)) return publicPromo(remote.value);
  }
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return publicPromo(parsed);
  } catch {
    return publicPromo(SEED);
  }
}

function decodeDataUrl(value) {
  const match = /^data:(image\/webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(value || ""));
  if (!match) return null;
  const body = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!body.length || body.length > MAX_IMAGE_BYTES) return null;
  return { ext: MIME_EXT[match[1]], body };
}

function safeSrc(value) {
  const src = String(value || "");
  if (BLOB_RE.test(src)) return src;
  if (!SRC_RE.test(src) || src.includes("..")) return "";
  return src;
}

async function storeImage(id, decoded) {
  const filename = `${id}-${Date.now()}.${decoded.ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`promo/${filename}`, decoded.body, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: decoded.ext === "jpg" ? "image/jpeg" : `image/${decoded.ext}`,
    });
    return blob.url;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), decoded.body);
  return `/assets/promo/uploads/${filename}`;
}

async function persistPromo(next) {
  const sb = db();
  if (sb) {
    const written = await writeKv(sb, PROMO_KEY, next);
    if (!written.error) {
      try {
        await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`);
      } catch {
        // Production disks are read-only. Supabase is the copy both apps read.
      }
      return null;
    }
  }
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`);
    return null;
  } catch (error) {
    return error;
  }
}

async function saveNow(body) {
  const visible = body?.visible !== false;
  const titleZh = String(body?.titleZh || "").trim();
  const titleEn = String(body?.titleEn || "").trim();
  const sentenceZh = String(body?.sentenceZh || "").trim();
  const sentenceEn = String(body?.sentenceEn || "").trim();

  const incoming = Array.isArray(body?.banners) ? body.banners : [];
  const banners = [];
  const seen = new Set();

  for (const item of incoming) {
    const id = String(item?.id || "").trim();
    const nameZh = String(item?.nameZh || "").trim();
    const nameEn = String(item?.nameEn || "").trim();
    if (!ID_RE.test(id) || seen.has(id)) return { status: 400, body: { ok: false, error: "Each banner needs its own id." } };
    if (!nameZh || !nameEn) return { status: 400, body: { ok: false, error: "Each banner needs a Chinese name and an English name." } };
    seen.add(id);

    let src = safeSrc(item?.src);
    if (item?.image) {
      const decoded = decodeDataUrl(item.image);
      if (!decoded) return { status: 400, body: { ok: false, error: "Banner image must be WebP under 8 MB." } };
      try {
        src = await storeImage(id, decoded);
      } catch {
        return { status: 400, body: { ok: false, error: "Could not store the banner image." } };
      }
    }
    if (!src) return { status: 400, body: { ok: false, error: "Each banner needs an image." } };
    const incomingProducts = Array.isArray(item?.products) ? item.products : [];
    const products = [];
    const productIds = new Set();
    for (const row of incomingProducts) {
      const productId = String(row?.productId || "").trim();
      const price = Math.round(Number(row?.price) * 100) / 100;
      const endsOn = String(row?.endsOn || "").trim();
      if (!productId) continue;
      if (!Number.isFinite(price) || price <= 0 || !DATE_RE.test(endsOn)) {
        return { status: 400, body: { ok: false, error: "Each offer product needs a price and an end date." } };
      }
      if (productIds.has(productId)) return { status: 400, body: { ok: false, error: "A product can only be added once on a banner." } };
      productIds.add(productId);
      products.push({ productId, price, endsOn });
    }
    const bannerSentenceZh = String(item?.sentenceZh || "").trim();
    const bannerSentenceEn = String(item?.sentenceEn || "").trim();
    const heroSrc = safeSrc(item?.heroSrc);
    const saved = { id, nameZh, nameEn, src, sentenceZh: bannerSentenceZh, sentenceEn: bannerSentenceEn, products };
    if (heroSrc) saved.heroSrc = heroSrc;
    banners.push(saved);
  }
  const owner = new Map();
  for (const banner of banners) {
    for (const row of banner.products) {
      if (owner.has(row.productId)) {
        const other = owner.get(row.productId);
        return { status: 400, body: { ok: false, error: `Already on ${other}.` } };
      }
      owner.set(row.productId, banner.nameEn || banner.nameZh || banner.id);
    }
  }

  const next = { visible, titleZh, titleEn, sentenceZh, sentenceEn, banners };
  const failed = await persistPromo(next);
  if (failed) return { status: 500, body: { ok: false, error: "Could not save banners." } };
  return { status: 200, body: { ok: true, promo: publicPromo(next) } };
}

export function handlePromoGet() {
  return readPromo().then((promo) => ({ status: 200, body: promo }));
}

export function handlePromoSave(body, request) {
  const staff = readSession(request, "staff");
  if (!staff) return Promise.resolve({ status: 401, body: { ok: false, error: "auth" } });
  const run = chain.then(() => saveNow(body));
  chain = run.then(() => {}).catch(() => {});
  return run;
}

export async function GET() {
  const result = await handlePromoGet();
  return Response.json(result.body, { status: result.status || 200, headers: { "cache-control": "no-store" } });
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const result = await handlePromoSave(body, request);
  return Response.json(result.body, { status: result.status || 200, headers: { "cache-control": "no-store" } });
}
