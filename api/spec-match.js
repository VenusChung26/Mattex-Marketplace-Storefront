import { execFile } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";
import * as XLSX from "xlsx";
import { readSession } from "./auth.js";
import { parseBuyerDocument } from "../server/buyer-spec.js";

const TESS_DIR = path.join(process.cwd(), "server", "tessdata");

const execFileAsync = promisify(execFile);

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
  return pieces.filter((line) => !isPdfSyntax(line)).join("\n").slice(0, 20000);
}

function unescapePdf(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(Number.parseInt(oct, 8)));
}

function isPdfSyntax(line) {
  const text = String(line || "").trim();
  if (!text || text.startsWith("/")) return true;
  if (/\b(FlateDecode|ASCII85Decode|DCTDecode|JPXDecode|CCITTFaxDecode|endobj|endstream|startxref)\b/.test(text)) return true;
  if (/^\/?(?:Length|Filter|Type|Subtype)\b/i.test(text)) return true;
  return false;
}

function humanLine(text) {
  const clean = String(text || "").trim();
  if (/[<>\\^`~$@]/.test(clean)) return false;
  const words = clean.match(/[a-z\u4e00-\u9fff]{2,}/gi) || [];
  const letters = words.join("").length;
  return words.length >= 2 && letters / Math.max(clean.length, 1) >= 0.45;
}

function stringsFromPdfContent(content) {
  const lines = [];
  const re = /\((?:\\.|[^\\)]){2,400}\)/g;
  let match = re.exec(content);
  while (match) {
    const after = content.slice(match.index + match[0].length, match.index + match[0].length + 80);
    const close = after.indexOf("]");
    const arrayGap = close >= 0 ? after.slice(0, close) : "";
    const shown = /^\s*(?:Tj|'|")/.test(after) || (close >= 0 && /^[\s\d.+\-()\\]*$/.test(arrayGap) && /^\s*TJ/.test(after.slice(close + 1)));
    if (!shown) {
      match = re.exec(content);
      continue;
    }
    const text = unescapePdf(match[0].slice(1, -1)).replace(/[^\t\n\r\x20-\x7e\u4e00-\u9fff]/g, " ").replace(/\s+/g, " ").trim();
    if (humanLine(text) && !isPdfSyntax(text)) lines.push(text);
    match = re.exec(content);
  }
  return lines;
}

function pdfPlainText(base64) {
  const buffer = Buffer.from(base64, "base64");
  const raw = buffer.toString("latin1");
  const pieces = [];
  const marker = /stream\r?\n/g;
  let found = marker.exec(raw);
  while (found) {
    const start = found.index + found[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const dict = raw.slice(Math.max(0, found.index - 500), found.index);
    let data = Buffer.from(raw.slice(start, end), "latin1");
    if (data[0] === 0x0a || data[0] === 0x0d) data = data.subarray(1);
    if (/FlateDecode/.test(dict)) {
      try {
        data = inflateSync(data);
      } catch {
        marker.lastIndex = end + 9;
        found = marker.exec(raw);
        continue;
      }
    }
    pieces.push(...stringsFromPdfContent(data.toString("latin1")));
    marker.lastIndex = end + 9;
    found = marker.exec(raw);
  }
  if (!pieces.length) pieces.push(...stringsFromPdfContent(raw));
  return pieces.join("\n").slice(0, 20000);
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "type", "item", "items", "qty", "quantity",
  "pcs", "size", "spec", "specification", "description", "unit", "total", "page",
]);

function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function readableEnough(text) {
  const letters = (String(text || "").match(/[a-z\u4e00-\u9fff]/gi) || []).length;
  return letters >= 8 && letters / Math.max(String(text || "").length, 1) > 0.2;
}

function pushBuyerLine(items, name, spec, qty) {
  const title = String(name || "").trim().slice(0, 180);
  if (title.length < 3 || !/[a-z\u4e00-\u9fff]/i.test(title) || isPdfSyntax(title)) return;
  const parsed = Math.floor(Number(qty));
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const key = `${title.toLowerCase()}|${amount}`;
  if (items.some((row) => `${row.name.toLowerCase()}|${row.qty}` === key)) return;
  items.push({ name: title, spec: String(spec || "").trim().slice(0, 240), qty: amount });
}

function cellsOf(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  const text = String(line || "");
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && (char === "," || char === "\t" || char === "|")) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells.filter(Boolean);
}

function lineFromCells(cells) {
  const texts = cells.filter((cell) => !/^\d+(\.\d+)?$/.test(cell));
  const qtyCell = cells.find((cell) => /^\d+(\.\d+)?$/.test(cell));
  const header = texts.join(" ").toLowerCase();
  if (/description|quantity|product|specification/.test(header) && texts.length <= 3 && !qtyCell) return null;
  return { name: texts[0] || "", spec: texts.slice(1).join(" · "), qty: qtyCell };
}

function extractBuyerLines(text) {
  const items = [];
  const rawLines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of rawLines) {
    const cells = cellsOf(line);
    if (cells.length >= 2) {
      const parsed = lineFromCells(cells);
      if (parsed) pushBuyerLine(items, parsed.name, parsed.spec, parsed.qty);
      continue;
    }
    const marked = line.match(/^(.*?)(?:\s+(?:qty|quantity)\s*(\d+(?:\.\d+)?)|\s+[x×]\s*(\d+(?:\.\d+)?))\s*$/i);
    const qty = marked ? Number(marked[2] || marked[3]) : null;
    const name = (marked ? marked[1] : line).trim();
    const words = tokens(name);
    if (qty || words.length >= 2) pushBuyerLine(items, name, "", qty);
    if (items.length >= 30) break;
  }
  return items;
}

function sheetItems(base64) {
  try {
    const book = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
    const items = [];
    for (const name of book.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: false });
      for (const row of rows) {
        const cells = (Array.isArray(row) ? row : []).map((cell) => String(cell || "").trim()).filter(Boolean);
        const parsed = lineFromCells(cells);
        if (parsed) pushBuyerLine(items, parsed.name, parsed.spec, parsed.qty);
        if (items.length >= 30) return items;
      }
    }
    return items;
  } catch {
    return [];
  }
}

function matchBuyerLine(line, index) {
  const words = tokens(`${line.name} ${line.spec}`);
  if (!words.length) return [];
  const ranked = index
    .map((product) => {
      const hay = `${product.name} ${product.sku} ${product.category} ${product.spec}`.toLowerCase();
      const hits = words.filter((word) => hay.includes(word)).length;
      return { product, hits };
    })
    .filter((row) => row.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5);
  if (!ranked.length) return [];
  const top = ranked[0].hits;
  const second = ranked[1]?.hits || 0;
  const confident = top >= 2 && top > second;
  return ranked.map((row, indexNo) => ({
    productId: row.product.id,
    name: row.product.name,
    spec: row.product.spec,
    unit: row.product.unit,
    moq: Math.max(1, Number(row.product.moq) || 1),
    confident: indexNo === 0 && confident,
  }));
}

function rowsFromBuyerLines(items, index) {
  return items.map((line) => ({
    buyerName: line.name,
    buyerSpec: line.spec,
    qty: line.qty,
    matches: matchBuyerLine(line, index),
  }));
}

function buyerItems(text, pictured) {
  const structured = parseBuyerDocument(text);
  if (structured.length) return structured;
  if (pictured) return [];
  return extractBuyerLines(text);
}

function localRows(body, index, text, pictured) {
  const mime = String(body?.mime || "").toLowerCase();
  const name = String(body?.name || "").toLowerCase();
  const base64 = String(body?.base64 || "");
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("sheet") || mime.includes("excel")) {
    const items = sheetItems(base64);
    return { unreadable: items.length === 0, rows: rowsFromBuyerLines(items, index) };
  }
  if (!text) return { unreadable: true, rows: [] };
  if (!pictured && !readableEnough(text) && !parseBuyerDocument(text).length) return { unreadable: true, rows: [] };
  const items = buyerItems(text, pictured);
  return { unreadable: items.length === 0, rows: rowsFromBuyerLines(items, index) };
}

function isPicture(body) {
  const mime = String(body?.mime || "").toLowerCase();
  const name = String(body?.name || "").toLowerCase();
  return mime.startsWith("image/") || mime.includes("pdf") || name.endsWith(".pdf") || /\.(png|jpe?g|webp|gif)$/.test(name);
}

async function visionBinary() {
  const bin = path.join(tmpdir(), "mattex-vision-ocr");
  try {
    await access(bin);
    return bin;
  } catch {
    /* compile once on this machine */
  }
  if (process.platform !== "darwin") return "";
  const source = path.join(process.cwd(), "scripts", "vision-ocr.swift");
  await execFileAsync("swiftc", ["-O", "-o", bin, source], { timeout: 120000 });
  return bin;
}

async function appleVisionText(body) {
  const base64 = String(body?.base64 || "");
  if (!base64 || process.platform !== "darwin") return "";
  const name = String(body?.name || "").toLowerCase();
  const ext = name.endsWith(".pdf") ? ".pdf" : name.endsWith(".png") ? ".png" : name.endsWith(".webp") ? ".webp" : name.endsWith(".gif") ? ".gif" : ".jpg";
  let dir = "";
  try {
    const bin = await visionBinary();
    if (!bin) return "";
    dir = await mkdtemp(path.join(tmpdir(), "spec-ocr-"));
    const file = path.join(dir, `upload${ext}`);
    await writeFile(file, Buffer.from(base64, "base64"));
    const { stdout } = await execFileAsync(bin, [file], { timeout: 30000, maxBuffer: 2_000_000 });
    return String(stdout || "").slice(0, 20000);
  } catch {
    return "";
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function jpegImages(buffer) {
  const images = [];
  for (let i = 0; i < buffer.length - 1; i += 1) {
    if (buffer[i] !== 0xff || buffer[i + 1] !== 0xd8) continue;
    let end = i + 2;
    while (end < buffer.length - 1 && !(buffer[end] === 0xff && buffer[end + 1] === 0xd9)) end += 1;
    if (end >= buffer.length - 1) break;
    const slice = buffer.subarray(i, end + 2);
    if (slice.length >= 12_000) images.push(slice);
    i = end + 1;
  }
  images.sort((a, b) => b.length - a.length);
  return images.slice(0, 3);
}

let ocrWorkerPromise = null;

function resetOcrWorker() {
  const pending = ocrWorkerPromise;
  ocrWorkerPromise = null;
  if (pending) pending.then((worker) => worker.terminate()).catch(() => {});
}

async function serverOcrText(body) {
  const base64 = String(body?.base64 || "");
  if (!base64) return "";
  const name = String(body?.name || "").toLowerCase();
  const mime = String(body?.mime || "").toLowerCase();
  const buffer = Buffer.from(base64, "base64");
  const sources = name.endsWith(".pdf") || mime.includes("pdf") ? jpegImages(buffer) : [buffer];
  if (!sources.length) return "";
  try {
    const [{ createWorker }, sharpMod] = await Promise.all([import("tesseract.js"), import("sharp")]);
    const sharp = sharpMod.default;
    const pages = [];
    for (const source of sources) {
      const image = await sharp(source, { failOn: "none" })
        .rotate()
        .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      pages.push(image);
    }
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = createWorker("eng+chi_tra", 1, {
        langPath: TESS_DIR,
        cachePath: path.join(tmpdir(), "tessdata"),
        gzip: true,
      }).catch((error) => {
        ocrWorkerPromise = null;
        throw error;
      });
    }
    const worker = await ocrWorkerPromise;
    const parts = [];
    for (const page of pages) {
      const { data } = await worker.recognize(page);
      if (data?.text) parts.push(data.text);
    }
    return parts.join("\n").slice(0, 20000);
  } catch {
    resetOcrWorker();
    return "";
  }
}

async function visionText(body) {
  const base64 = String(body?.base64 || "");
  if (!base64) return "";
  if (process.env.SPEC_OCR !== "server" && process.platform === "darwin") {
    const apple = await appleVisionText(body);
    if (String(apple || "").trim()) return apple;
  }
  return serverOcrText(body);
}

async function readDocument(body) {
  const plain = sourceText(body);
  if (parseBuyerDocument(plain).length) return { text: plain, pictured: false };
  if (!isPicture(body)) return { text: plain, pictured: false };
  const ocr = await visionText(body);
  if (parseBuyerDocument(ocr).length) return { text: ocr, pictured: true };
  if (plain && extractBuyerLines(plain).length) return { text: plain, pictured: false };
  return { text: "", pictured: true };
}

function sourceText(body) {
  const mime = String(body?.mime || "").toLowerCase();
  const name = String(body?.name || "").toLowerCase();
  const base64 = String(body?.base64 || "");
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("sheet") || mime.includes("excel")) {
    return sheetText(base64) || String(body?.text || "");
  }
  if (body?.text) return String(body.text).slice(0, 20000);
  if (base64 && (name.endsWith(".pdf") || mime.includes("pdf"))) return pdfPlainText(base64);
  if (base64 && !mime.startsWith("image/")) return roughText(base64);
  return "";
}

function catalogMatch(product, confident) {
  return {
    productId: product.id,
    name: product.name,
    spec: product.spec,
    unit: product.unit,
    moq: Math.max(1, Number(product.moq) || 1),
    confident: Boolean(confident),
  };
}

function rowsFromModel(raw, index) {
  const byId = new Map(index.map((product) => [product.id, product]));
  const rows = [];
  for (const row of Array.isArray(raw) ? raw : []) {
    if (Array.isArray(row?.matches) || row?.name) {
      const name = String(row?.name || "").trim();
      if (!name) continue;
      const matches = [];
      for (const match of Array.isArray(row.matches) ? row.matches : []) {
        const product = byId.get(String(match?.productId || ""));
        if (!product || matches.some((item) => item.productId === product.id)) continue;
        matches.push(catalogMatch(product, match?.confident === true && matches.length === 0));
        if (matches.length >= 5) break;
      }
      if (!matches.length && row?.productId) {
        const product = byId.get(String(row.productId));
        if (product) matches.push(catalogMatch(product, row?.kind === "product"));
      }
      rows.push({
        buyerName: name.slice(0, 180),
        buyerSpec: String(row?.spec || "").trim().slice(0, 240),
        qty: Math.max(1, Math.floor(Number(row?.qty)) || 1),
        matches,
      });
      continue;
    }
  }
  return rows;
}

function flatLines(rows) {
  const lines = [];
  for (const row of rows) {
    for (const match of row.matches || []) {
      lines.push({
        kind: match.confident ? "product" : "suggest",
        productId: match.productId,
        name: match.name,
        spec: match.spec,
        qty: row.qty,
        unit: match.unit,
      });
    }
  }
  return lines;
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
        "One line per item in the document: {name, spec, qty, matches}.",
        "name and spec are the buyer's own item, copied from the document. qty comes from the document, or 1 when missing.",
        "matches is an array of {productId, confident}. Put the closest catalog product first. confident is true only when that product is the same item.",
        "Other close catalog products follow with confident false. Use an empty matches array when the catalog has no close product.",
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
  const member = readSession(request, "buyer") || readSession(request, "staff");
  const guest = guestState(request);
  return {
    status: 200,
    body: {
      ok: true,
      open: true,
      member: Boolean(member),
      remaining: member ? null : Math.max(0, DAILY_LIMIT - guest.count),
    },
  };
}

export async function handleSpecMatch(body, request) {
  const member = readSession(request, "buyer") || readSession(request, "staff");
  const guest = guestState(request);
  if (!member && guest.count >= DAILY_LIMIT) {
    return { status: 429, cookie: guestCookie(guest.count), body: { ok: false, error: "limit", remaining: 0 } };
  }
  const mime = String(body?.mime || "");
  const imageDataUrl = mime.startsWith("image/") && String(body?.dataUrl || "").startsWith("data:image/") ? String(body.dataUrl).slice(0, 2_000_000) : "";
  const document = await readDocument(body);
  const text = document.text;
  if (!text && !imageDataUrl && !String(body?.base64 || "")) return { status: 400, body: { ok: false, error: "file" } };
  const index = await catalogIndex();
  let parsed = localRows(body, index, text, document.pictured);
  if (matchKey()) {
    const raw = await askModel({ text, imageDataUrl, index });
    const modeled = rowsFromModel(raw, index);
    if (modeled.length) parsed = { unreadable: false, rows: modeled };
  }
  const rows = parsed.rows || [];
  const count = member ? guest.count : guest.count + 1;
  return {
    status: 200,
    cookie: member ? "" : guestCookie(count),
    body: {
      ok: true,
      unreadable: Boolean(parsed.unreadable) || rows.length === 0,
      rows,
      lines: flatLines(rows),
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
