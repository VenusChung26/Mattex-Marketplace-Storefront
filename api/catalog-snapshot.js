import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readSession } from "./auth.js";

const DIR = path.join(process.cwd(), "data");
const SNAPSHOT_FILE = path.join(DIR, "catalog-snapshot.json");
const VERSION_FILE = path.join(DIR, "catalog-version.json");
const SEED = "seed";

let client = null;
let chain = Promise.resolve();

function db() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function isQuotaError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const text = `${error?.code || ""} ${error?.message || error?.error || ""}`.toLowerCase();
  return status === 402 || text.includes("exceed_egress") || text.includes("quota");
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function productsFromRows(rows) {
  return (rows || [])
    .map((row) => {
      const payload = row?.payload;
      if (!payload?.id) return null;
      const imageUrl = String(row.image_url || payload.imageUrl || payload.image || "").trim();
      return {
        ...payload,
        image: imageUrl || payload.image || "",
        imageUrl: imageUrl || payload.imageUrl || "",
      };
    })
    .filter(Boolean);
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(file, value) {
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

function etagFor(updatedAt, count) {
  return createHash("sha256").update(`${updatedAt}|${count}`).digest("hex").slice(0, 16);
}

export async function handleCatalogVersion() {
  const version = await readJson(VERSION_FILE);
  if (!version?.etag || version.etag === SEED) return { etag: SEED, updatedAt: "" };
  return { etag: version.etag, updatedAt: version.updatedAt || "" };
}

export async function handleCatalogGet() {
  const snapshot = await readJson(SNAPSHOT_FILE);
  if (!Array.isArray(snapshot?.products) || !snapshot.products.length) return null;
  return snapshot;
}

async function writeSnapshot(snapshot) {
  const updatedAt = new Date().toISOString();
  const etag = etagFor(updatedAt, snapshot.products.length);
  const next = {
    etag,
    updatedAt,
    products: snapshot.products,
    categories: Array.isArray(snapshot.categories) ? snapshot.categories : [],
  };
  await writeJson(SNAPSHOT_FILE, next);
  await writeJson(VERSION_FILE, { etag, updatedAt });
  return next;
}

function rowFromProduct(product) {
  return {
    id: product.id,
    payload: product,
    image_url: String(product.imageUrl || product.image || ""),
    updated_at: new Date().toISOString(),
  };
}

async function upsertProducts(sb, products) {
  const rows = products.filter((product) => product?.id).map(rowFromProduct);
  for (const part of chunk(rows, 40)) {
    const { error } = await sb.from("products").upsert(part);
    if (error) return { error };
  }
  return { error: null };
}

async function readAllProducts(sb) {
  const rows = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await sb.from("products").select("id,payload,image_url").range(from, from + 999);
    if (error) return { error, products: [] };
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { error: null, products: productsFromRows(rows) };
}

async function commitNow(body, request) {
  const staff = readSession(request, "staff");
  if (!staff) return { status: 401, body: { ok: false, error: "auth" } };

  const incoming = Array.isArray(body?.products) ? body.products.filter((product) => product?.id) : [];
  const removed = [...new Set((Array.isArray(body?.removed) ? body.removed : []).map(String).filter(Boolean))];
  const categories = Array.isArray(body?.categories) ? body.categories : [];
  if (!incoming.length && !removed.length) return { status: 200, body: { ok: true, etag: (await handleCatalogVersion()).etag } };

  const sb = db();
  if (!sb) {
    const existing = await readJson(SNAPSHOT_FILE);
    let products = Array.isArray(existing?.products) ? existing.products : [];
    if (!products.length) {
      const host = await readJson(path.join(process.cwd(), "public", "catalog.json"));
      products = Array.isArray(host?.products) ? host.products : [];
    }
    const byId = new Map(products.map((product) => [String(product.id), product]));
    for (const product of incoming) byId.set(String(product.id), product);
    for (const id of removed) byId.delete(id);
    const written = await writeSnapshot({
      products: [...byId.values()],
      categories: categories.length ? categories : existing?.categories || [],
    });
    return { status: 200, body: { ok: true, etag: written.etag, snapshot: true } };
  }

  if (incoming.length) {
    const saved = await upsertProducts(sb, incoming);
    if (saved.error) {
      const quota = isQuotaError(saved.error);
      return { status: quota ? 402 : 400, body: { ok: false, error: quota ? "quota" : "save" } };
    }
  }

  if (removed.length) {
    const { error } = await sb.from("products").delete().in("id", removed);
    if (error) {
      const quota = isQuotaError(error);
      return { status: quota ? 402 : 400, body: { ok: false, error: quota ? "quota" : "save" } };
    }
  }

  const existing = await readJson(SNAPSHOT_FILE);
  if (!existing?.products?.length) {
    const remote = await readAllProducts(sb);
    if (remote.error) {
      const quota = isQuotaError(remote.error);
      return { status: quota ? 402 : 400, body: { ok: false, error: quota ? "quota" : "save" } };
    }
    if (!remote.products.length) return { status: 200, body: { ok: true, etag: SEED, snapshot: false } };
    const written = await writeSnapshot({ products: remote.products, categories });
    return { status: 200, body: { ok: true, etag: written.etag, snapshot: true } };
  }

  const byId = new Map(existing.products.map((product) => [String(product.id), product]));
  for (const product of incoming) byId.set(String(product.id), product);
  for (const id of removed) byId.delete(id);
  const written = await writeSnapshot({
    products: [...byId.values()],
    categories: categories.length ? categories : existing.categories,
  });
  return { status: 200, body: { ok: true, etag: written.etag, snapshot: true } };
}

export function handleCatalogCommit(body, request) {
  const run = chain.then(() => commitNow(body, request));
  chain = run.then(() => {}).catch(() => {});
  return run;
}

function partOf(request) {
  return new URL(request.url).searchParams.get("part") || "";
}

export async function GET(request) {
  const headers = { "cache-control": "no-store" };
  if (partOf(request) === "version") {
    return Response.json(await handleCatalogVersion(), { headers });
  }
  const snapshot = await handleCatalogGet();
  if (!snapshot) return Response.json({ etag: SEED }, { status: 404, headers });
  return Response.json(snapshot, { headers });
}

export async function POST(request) {
  if (partOf(request) !== "commit") {
    return Response.json({ ok: false, error: "invalid" }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const result = await handleCatalogCommit(body, request);
  return Response.json(result.body, { status: result.status || 200, headers: { "cache-control": "no-store" } });
}
