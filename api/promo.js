import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSession } from "./auth.js";

const FILE = path.join(process.cwd(), "data", "promo.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "assets", "promo", "uploads");
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ID_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const SRC_RE = /^\/assets\/promo\/[a-zA-Z0-9._/-]+$/;
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

function publicPromo(doc) {
  return {
    visible: doc?.visible !== false,
    sentenceZh: String(doc?.sentenceZh || ""),
    sentenceEn: String(doc?.sentenceEn || ""),
    banners: (Array.isArray(doc?.banners) ? doc.banners : [])
      .filter((banner) => banner?.id && banner?.src)
      .map((banner) => ({
        id: String(banner.id),
        nameZh: String(banner.nameZh || ""),
        nameEn: String(banner.nameEn || ""),
        src: String(banner.src),
      })),
  };
}

async function readPromo() {
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
  if (!SRC_RE.test(src) || src.includes("..")) return "";
  return src;
}

async function saveNow(body) {
  const visible = body?.visible !== false;
  const sentenceZh = String(body?.sentenceZh || "").trim();
  const sentenceEn = String(body?.sentenceEn || "").trim();
  if (!sentenceZh || !sentenceEn) return { status: 400, body: { ok: false, error: "Enter the Chinese and English sentence." } };

  const incoming = Array.isArray(body?.banners) ? body.banners : [];
  const banners = [];
  const seen = new Set();
  await mkdir(UPLOAD_DIR, { recursive: true });

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
      const filename = `${id}-${Date.now()}.${decoded.ext}`;
      await writeFile(path.join(UPLOAD_DIR, filename), decoded.body);
      src = `/assets/promo/uploads/${filename}`;
    }
    if (!src) return { status: 400, body: { ok: false, error: "Each banner needs an image." } };
    banners.push({ id, nameZh, nameEn, src });
  }

  const next = { visible, sentenceZh, sentenceEn, banners };
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`);
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
