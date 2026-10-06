import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readSession } from "./auth.js";
import { handleCatalogGroupsGet, handleCatalogGroupsSave } from "../server/catalog-groups.js";

const DIR = path.join(process.cwd(), "data");
const SNAPSHOT_FILE = path.join(DIR, "catalog-snapshot.json");
const VERSION_FILE = path.join(DIR, "catalog-version.json");
const SNAPSHOT_KEY = "catalog-snapshot";
const VERSION_KEY = "catalog-version";
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

function snapshotBody(value) {
  if (!Array.isArray(value?.products) || !value.products.length) return null;
  return value;
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

export async function handleCatalogVersion() {
  const sb = db();
  if (sb) {
    const remote = await readKv(sb, VERSION_KEY);
    if (!remote.error && remote.value?.etag && remote.value.etag !== SEED) {
      return { etag: remote.value.etag, updatedAt: remote.value.updatedAt || "" };
    }
  }
  const version = await readJson(VERSION_FILE);
  if (!version?.etag || version.etag === SEED) return { etag: SEED, updatedAt: "" };
  return { etag: version.etag, updatedAt: version.updatedAt || "" };
}

export async function handleCatalogGet() {
  const sb = db();
  if (sb) {
    const remote = await readKv(sb, SNAPSHOT_KEY);
    if (!remote.error) {
      const shared = snapshotBody(remote.value);
      if (shared) return shared;
    }
  }
  const snapshot = await readJson(SNAPSHOT_FILE);
  return snapshotBody(snapshot);
}

function buildSnapshot(snapshot) {
  const updatedAt = new Date().toISOString();
  const products = Array.isArray(snapshot?.products) ? snapshot.products : [];
  const etag = etagFor(updatedAt, products.length);
  return {
    etag,
    updatedAt,
    products,
    categories: Array.isArray(snapshot?.categories) ? snapshot.categories : [],
  };
}

async function writeSnapshotFile(next) {
  try {
    await writeJson(SNAPSHOT_FILE, next);
    await writeJson(VERSION_FILE, { etag: next.etag, updatedAt: next.updatedAt });
    return true;
  } catch {
    // Production disks are read-only. The shared snapshot in app_kv is what both apps read.
    return false;
  }
}

async function writeSnapshot(snapshot, sb) {
  const next = buildSnapshot(snapshot);
  if (sb) {
    const saved = await writeKv(sb, SNAPSHOT_KEY, next);
    if (saved.error) return { error: saved.error };
    const version = await writeKv(sb, VERSION_KEY, { etag: next.etag, updatedAt: next.updatedAt });
    if (version.error) return { error: version.error };
  }
  const filed = await writeSnapshotFile(next);
  if (!sb && !filed) return { error: new Error("save") };
  return { error: null, snapshot: next };
}

function commitResult(written) {
  if (written?.error) {
    const quota = isQuotaError(written.error);
    return { status: quota ? 402 : 400, body: { ok: false, error: quota ? "quota" : "save" } };
  }
  return { status: 200, body: { ok: true, etag: written.snapshot.etag, snapshot: true } };
}

async function loadBaseSnapshot(sb) {
  if (sb) {
    const remote = await readKv(sb, SNAPSHOT_KEY);
    if (remote.error) return { error: remote.error };
    const shared = snapshotBody(remote.value);
    if (shared) return { snapshot: shared };
  }
  const file = snapshotBody(await readJson(SNAPSHOT_FILE));
  if (file) return { snapshot: file };
  if (sb) {
    const remote = await readAllProducts(sb);
    if (remote.error) return { error: remote.error };
    return { snapshot: { products: remote.products, categories: [] } };
  }
  const host = await readJson(path.join(process.cwd(), "public", "catalog.json"));
  return {
    snapshot: {
      products: Array.isArray(host?.products) ? host.products : [],
      categories: Array.isArray(host?.categories) ? host.categories : [],
    },
  };
}

function rowFromProduct(product) {
  return {
    id: product.id,
    payload: product,
    image_url: String(product.imageUrl || product.image || ""),
    updated_at: new Date().toISOString(),
    name: String(product.name || ""),
    product_no: String(product.productNo || ""),
    provisional_sku: String(product.provisionalSku || ""),
    category: String(product.category || ""),
    supplier: String(product.supplier || ""),
    supplier_slug: String(product.supplierSlug || ""),
    unit: String(product.salesUnit || product.unit || ""),
    published: Boolean(product.published) && !product.deleted,
    held: Boolean(product.held),
    deleted: Boolean(product.deleted),
    discontinued: Boolean(product.discontinued),
    green: Boolean(product.green),
    hit: Boolean(product.hit),
    tailor_made: Boolean(product.tailorMade),
    moq: product.moq == null || product.moq === "" ? "" : String(product.moq),
    lead_time: product.leadTime || null,
    lead_time_label: String(product.leadTimeLabel || ""),
    size_desc: String(product.sizeDesc || ""),
    created_at_ms: Number(product.createdAt) || 0,
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
  if (sb && incoming.length) {
    const saved = await upsertProducts(sb, incoming);
    if (saved.error) {
      const quota = isQuotaError(saved.error);
      return { status: quota ? 402 : 400, body: { ok: false, error: quota ? "quota" : "save" } };
    }
  }

  if (sb && removed.length) {
    const { error } = await sb.from("products").delete().in("id", removed);
    if (error) {
      const quota = isQuotaError(error);
      return { status: quota ? 402 : 400, body: { ok: false, error: quota ? "quota" : "save" } };
    }
  }

  const base = await loadBaseSnapshot(sb);
  if (base.error) {
    const quota = isQuotaError(base.error);
    return { status: quota ? 402 : 400, body: { ok: false, error: quota ? "quota" : "save" } };
  }
  const products = Array.isArray(base.snapshot?.products) ? base.snapshot.products : [];
  if (!products.length && !incoming.length) return { status: 200, body: { ok: true, etag: SEED, snapshot: false } };
  const byId = new Map(products.map((product) => [String(product.id), product]));
  for (const product of incoming) byId.set(String(product.id), product);
  for (const id of removed) byId.delete(id);
  const written = await writeSnapshot({
    products: [...byId.values()],
    categories: categories.length ? categories : base.snapshot?.categories || [],
  }, sb);
  return commitResult(written);
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
  if (partOf(request) === "groups") {
    const result = await handleCatalogGroupsGet();
    return Response.json(result.body, { status: result.status || 200, headers });
  }
  if (partOf(request) === "version") {
    return Response.json(await handleCatalogVersion(), { headers });
  }
  if (partOf(request) === "status") {
    const id = new URL(request.url).searchParams.get("id") || "";
    const snapshot = await handleCatalogGet();
    if (!snapshot) return Response.json({ ok: true, found: true, live: true }, { headers });
    const product = (snapshot.products || []).find((row) => String(row.id) === id) || null;
    const live = Boolean(product) && product.published !== false && !product.deleted && !product.held;
    return Response.json({ ok: true, found: Boolean(product), live }, { headers });
  }
  const snapshot = await handleCatalogGet();
  if (!snapshot) return Response.json({ etag: SEED }, { status: 404, headers });
  return Response.json(snapshot, { headers });
}

export async function POST(request) {
  if (partOf(request) === "groups") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
    }
    const result = await handleCatalogGroupsSave(body, request);
    return Response.json(result.body, { status: result.status || 200, headers: { "cache-control": "no-store" } });
  }
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
