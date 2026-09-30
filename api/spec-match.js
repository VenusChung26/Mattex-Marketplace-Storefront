import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { readSession } from "./auth.js";

const COOKIE = "mm_spec_uses";
const DAILY_LIMIT = 3;
const SNAPSHOT_FILE = path.join(process.cwd(), "data", "catalog-snapshot.json");
const SEED_FILE = path.join(process.cwd(), "public", "catalog.json");

function secret() {
  const value = process.env.SESSION_SECRET || "";
  return value.length >= 32 ? value : "mm-spec-uses-dev";
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function unsign(value) {
  const [body, sig] = String(value || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function readCookie(request, name) {
  const header = request?.headers?.get?.("cookie") || "";
  const hit = header.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function guestState(request) {
  const payload = unsign(readCookie(request, COOKIE));
  if (!payload || payload.day !== today()) return { day: today(), count: 0 };
  return { day: today(), count: Math.max(0, Number(payload.count) || 0) };
}

function guestCookie(count) {
  const value = sign({ day: today(), count });
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=172800`;
}

function matchKey() {
  return process.env.SPEC_MATCH_API_KEY || process.env.OPENAI_API_KEY || "";
}

async function catalogIndex() {
  let data = null;
  try {
    data = JSON.parse(await readFile(SNAPSHOT_FILE, "utf8"));
  } catch {
    data = null;
  }
  if (!Array.isArray(data?.products) || !data.products.length) {
    try {
      data = JSON.parse(await readFile(SEED_FILE, "utf8"));
    } catch {
      data = null;
    }
  }
  const products = Array.isArray(data?.products) ? data.products : [];
  return products
    .filter((product) => product?.id && product.deleted !== true && product.published !== false)
    .slice(0, 900)
    .map((product) => ({
      id: product.id,
      sku: String(product.productNo || product.provisionalSku || ""),
      name: String(product.name || ""),
      category: String(product.category || ""),
      moq: product.moq === "" || product.moq == null ? null : Number(product.moq) || null,
      unit: String(product.salesUnit || product.unit || ""),
      spec: String(product.primarySpec || product.sizeDesc || "").slice(0, 120),
    }));
}

function sheetText(base64) {
  try {
    const book = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
    return book.SheetNames.map((name) => XLSX.utils.sheet_to_csv(book.Sheets[name])).join("\n").slice(0, 20000);
  } catch {
    return "";
  }
}

function roughText(base64) {
  const raw = Buffer.from(base64, "base64").toString("utf8");
  const pieces = raw.match(/[ -~\u4e00-\u9fff]{4,}/g) || [];
  return pieces.join("\n").slice(0, 20000);
}

function sourceText(body) {
  const mime = String(body?.mime || "").toLowerCase();
  const name = String(body?.name || "").toLowerCase();
  const base64 = String(body?.base64 || "");
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("sheet") || mime.includes("excel")) {
    return sheetText(base64) || String(body?.text || "");
  }
  if (body?.text) return String(body.text).slice(0, 20000);
  if (base64 && !mime.startsWith("image/")) return roughText(base64);
  return "";
}

function normalizeLines(raw, index) {
  const byId = new Map(index.map((product) => [product.id, product]));
  const lines = [];
  for (const row of Array.isArray(raw) ? raw : []) {
    const product = byId.get(String(row?.productId || ""));
    const kind = row?.kind === "suggest" ? "suggest" : row?.kind === "tailor" || !product ? "tailor" : "product";
    if (kind === "tailor") {
      const name = String(row?.name || "").trim();
      if (!name) continue;
      const qty = Math.max(1, Math.floor(Number(row?.qty)) || 1);
      lines.push({
        kind: "tailor",
        productId: "",
        name,
        spec: String(row?.spec || "").trim(),
        qty,
        checked: false,
      });
      continue;
    }
    const fallbackQty = Math.max(1, Number(product.moq) || 1);
    const qty = Math.max(1, Math.floor(Number(row?.qty)) || fallbackQty);
    lines.push({
      kind,
      productId: product.id,
      name: product.name,
      spec: String(row?.spec || product.spec || "").trim(),
      qty,
      unit: product.unit,
      checked: kind === "product",
    });
  }
  return lines;
}

async function askModel({ text, imageDataUrl, index }) {
  const key = matchKey();
  const content = [
    {
      type: "text",
      text: [
        "Match the buyer specification to this catalog. Return JSON only: {\"lines\":[...]}.",
        "Each line is {kind, productId, name, spec, qty}.",
        "kind product = confident existing product. kind suggest = possible existing product. kind tailor = no catalog product; name and spec come from the document.",
        "qty comes from the document. If missing, use the catalog moq for product/suggest and 1 for tailor.",
        "One tailor line per unmatched document line.",
        `Catalog: ${JSON.stringify(index)}`,
        text ? `Document text:\n${text}` : "The document is the attached image.",
      ].join("\n"),
    },
  ];
  if (imageDataUrl) content.push({ type: "image_url", image_url: { url: imageDataUrl } });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(raw)?.lines;
  } catch {
    return null;
  }
}

export async function handleSpecMatchStatus(request) {
  const member = readSession(request, "buyer");
  const guest = guestState(request);
  return {
    status: 200,
    body: {
      ok: true,
      open: Boolean(matchKey()),
      member: Boolean(member),
      remaining: member ? null : Math.max(0, DAILY_LIMIT - guest.count),
    },
  };
}

export async function handleSpecMatch(body, request) {
  if (!matchKey()) return { status: 200, body: { ok: false, error: "closed" } };
  const member = readSession(request, "buyer");
  const guest = guestState(request);
  if (!member && guest.count >= DAILY_LIMIT) {
    return { status: 429, cookie: guestCookie(guest.count), body: { ok: false, error: "limit", remaining: 0 } };
  }
  const mime = String(body?.mime || "");
  const imageDataUrl = mime.startsWith("image/") && String(body?.dataUrl || "").startsWith("data:image/") ? String(body.dataUrl).slice(0, 2_000_000) : "";
  const text = sourceText(body);
  if (!text && !imageDataUrl) return { status: 400, body: { ok: false, error: "file" } };
  const index = await catalogIndex();
  const raw = await askModel({ text, imageDataUrl, index });
  if (!raw) return { status: 200, body: { ok: false, error: "match" } };
  const lines = normalizeLines(raw, index);
  const count = member ? guest.count : guest.count + 1;
  return {
    status: 200,
    cookie: member ? "" : guestCookie(count),
    body: {
      ok: true,
      lines,
      remaining: member ? null : Math.max(0, DAILY_LIMIT - count),
    },
  };
}

function jsonResult(result) {
  const headers = { "cache-control": "no-store" };
  if (result.cookie) headers["set-cookie"] = result.cookie;
  return Response.json(result.body, { status: result.status || 200, headers });
}

export async function GET(request) {
  return jsonResult(await handleSpecMatchStatus(request));
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  return jsonResult(await handleSpecMatch(body, request));
}
