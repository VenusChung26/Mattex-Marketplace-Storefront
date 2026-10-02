import { createClient } from "@supabase/supabase-js";
import { isPublicKvKey } from "./kvKeys.js";

const timers = new Map();

function readEnv(name) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const meta = import.meta.env;
    if (name === "VITE_SUPABASE_URL" && meta.VITE_SUPABASE_URL) {
      return String(meta.VITE_SUPABASE_URL || "").trim();
    }
    if (name === "VITE_SUPABASE_ANON_KEY" && meta.VITE_SUPABASE_ANON_KEY) {
      return String(meta.VITE_SUPABASE_ANON_KEY || "").trim();
    }
    if (
      (name === "VITE_SUPABASE_PUBLISHABLE_KEY" || name === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") &&
      (meta.VITE_SUPABASE_PUBLISHABLE_KEY || meta.VITE_SUPABASE_ANON_KEY)
    ) {
      return String(meta.VITE_SUPABASE_PUBLISHABLE_KEY || meta.VITE_SUPABASE_ANON_KEY || "").trim();
    }
    if (meta[name] != null) return String(meta[name] || "").trim();
  }
  if (typeof process !== "undefined" && process.env && process.env[name] != null) {
    return String(process.env[name] || "").trim();
  }
  return "";
}

export function supabaseConfig() {
  const url =
    readEnv("VITE_SUPABASE_URL") ||
    readEnv("SUPABASE_URL") ||
    readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon =
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("VITE_SUPABASE_ANON_KEY") ||
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const service = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { url, anon, service };
}

export function isSupabaseConfigured() {
  const { url, anon, service } = supabaseConfig();
  return Boolean(url && (anon || service));
}

let remoteDataReady = null;

export function shouldUseLocalSharedStore() {
  return !isSupabaseConfigured() || remoteDataReady === false;
}

function markRemoteDataDown() {
  remoteDataReady = false;
}

export async function probeRemoteData() {
  if (!isSupabaseConfigured() || typeof fetch !== "function") return false;
  if (remoteDataReady != null) return remoteDataReady;
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "read", keys: ["subbie_rfq_seq"] }),
    });
    if (res.status >= 500) {
      markRemoteDataDown();
      return false;
    }
    remoteDataReady = true;
    return true;
  } catch {
    markRemoteDataDown();
    return false;
  }
}

let anonClient = null;
let serviceClient = null;

export function getSupabase(preferService = false) {
  const { url, anon, service } = supabaseConfig();
  const key = preferService && service ? service : anon || service;
  if (!url || !key) return null;
  if (preferService && service) {
    if (!serviceClient) {
      serviceClient = createClient(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return serviceClient;
  }
  if (!anonClient) {
    anonClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anonClient;
}

const SKIP_KV_KEYS = new Set([
  "subbie_auth",
  "subbie_staff_auth",
  "subbie_lang",
  "subbie_hide_auth_invite_v2",
  "subbie_cart_auth_invite_shown_v1",
  "subbie_drafts_by_user",
]);

function skipPersistKey(key) {
  const name = String(key || "");
  return !name || SKIP_KV_KEYS.has(name) || name.startsWith("subbie_drafts");
}

const inBrowser = () => typeof document !== "undefined" && typeof fetch === "function";

async function dataApi(op, payload = {}) {
  if (!inBrowser()) return null;
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, ...payload }),
    });
    const data = await res.json().catch(() => null);
    if (res.status >= 500) markRemoteDataDown();
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

export function persistKvNow(key, value) {
  if (skipPersistKey(key) || !isSupabaseConfigured()) return Promise.resolve();
  return dataApi("write", { key, value });
}

export function persistKv(key, value) {
  if (skipPersistKey(key) || !isSupabaseConfigured()) return;
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      persistKvNow(key, value);
    }, 400)
  );
}

function kvFromRows(rows) {
  const kv = {};
  for (const row of rows || []) {
    if (!row?.key || skipPersistKey(row.key)) continue;
    kv[row.key] = row.value;
  }
  return kv;
}

async function fetchPublicKv(sb, keys) {
  if (!keys.length) return {};
  const { data, error } = await sb.from("app_kv").select("key,value").in("key", keys);
  if (error) throw error;
  return kvFromRows(data);
}

export async function fetchRemoteKv(keys, { withPrivate = true } = {}) {
  const sb = getSupabase();
  if (!sb || !Array.isArray(keys)) return null;
  const wanted = keys.filter((key) => !skipPersistKey(key));
  const privateKeys = wanted.filter((key) => !isPublicKvKey(key));
  try {
    const [publicKv, privateRes] = await Promise.all([
      fetchPublicKv(sb, wanted.filter(isPublicKvKey)),
      withPrivate && privateKeys.length ? dataApi("read", { keys: privateKeys }) : null,
    ]);
    return { ...publicKv, ...(privateRes?.kv || {}) };
  } catch (error) {
    console.warn("supabase kv", error?.message || error);
    return null;
  }
}

function rfqsMapFromRows(rows) {
  const out = {};
  for (const row of rows || []) {
    const payload = row?.payload;
    if (!payload?.id) continue;
    const key = String(row.buyer_key || payload.buyerEmail || "__guest__");
    if (!out[key]) out[key] = [];
    out[key].push(payload);
  }
  return out;
}

export async function fetchRemoteRfqs(since = "") {
  const res = await dataApi("rfqs", { since });
  return res ? rfqsMapFromRows(res.rows) : null;
}

function latestUpdatedAt(sb, table, filter) {
  let query = sb.from(table).select("updated_at").order("updated_at", { ascending: false }).limit(1);
  if (filter) query = filter(query);
  return query;
}

export async function fetchRfqStamp() {
  const res = await dataApi("rfq-stamp");
  return res ? { table: res.table || "", kv: res.kv || "" } : null;
}

function productsFromRows(rows) {
  return (rows || [])
    .map((row) => {
      const payload = row?.payload;
      if (!payload?.id) return null;
      const imageUrl = String(row.image_url || "").trim();
      const image = imageUrl.startsWith("http") ? imageUrl : payload.image;
      return { ...payload, image, imageUrl };
    })
    .filter(Boolean);
}

function metricsFromRows(rows) {
  const metrics = {};
  for (const row of rows || []) {
    metrics[row.slug] = {
      rating: Number(row.rating) || 0,
      completionRate: Number(row.completion_rate) || 0,
      onTimeRate: Number(row.on_time_rate) || 0,
      searchCount: Number(row.search_count) || 0,
      foundCount: Number(row.found_count) || 0,
      rfqCount: Number(row.rfq_count) || 0,
      empty: Boolean(row.empty),
    };
  }
  return metrics;
}

const CATALOG_CACHE_KEY = "subbie_catalog_cache_v1";

function readCatalogCache() {
  try {
    return JSON.parse(window.localStorage.getItem(CATALOG_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeCatalogCache(stamp, state) {
  try {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ stamp, state }));
  } catch {
    try {
      window.localStorage.removeItem(CATALOG_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

async function catalogStamp(sb, keys) {
  const [products, count, kv, metrics] = await Promise.all([
    latestUpdatedAt(sb, "products"),
    sb.from("products").select("id", { count: "exact", head: true }),
    latestUpdatedAt(sb, "app_kv", (q) => q.in("key", keys)),
    latestUpdatedAt(sb, "supplier_metrics"),
  ]);
  if (products.error || count.error || kv.error) return "";
  return [products.data?.[0]?.updated_at, count.count, kv.data?.[0]?.updated_at, metrics.data?.[0]?.updated_at].join("|");
}

async function fetchPublicCatalog(sb, publicKeys) {
  const stamp = inBrowser() && publicKeys.length ? await catalogStamp(sb, publicKeys) : "";
  const cached = stamp ? readCatalogCache() : null;
  if (cached?.stamp === stamp && cached.state) return cached.state;
  const [kvRes, productRes, metricRes] = await Promise.all([
    sb.from("app_kv").select("key,value").in("key", publicKeys),
    sb.from("products").select("id,payload,image_url"),
    sb.from("supplier_metrics").select("*"),
  ]);
  if (productRes.error) {
    console.warn("supabase hydrate", productRes.error.message);
    return null;
  }
  const state = {
    kv: kvFromRows(kvRes.data),
    products: productsFromRows(productRes.data),
    metrics: metricsFromRows(metricRes.data),
  };
  if (stamp && !kvRes.error && !metricRes.error) writeCatalogCache(stamp, state);
  return state;
}

export async function fetchCatalogState(keys = [], { withPrivate = false } = {}) {
  const sb = getSupabase();
  if (!sb) return null;
  const kvKeys = keys.filter((key) => !skipPersistKey(key));
  const privateKeys = kvKeys.filter((key) => !isPublicKvKey(key));
  try {
    const [state, privateRes] = await Promise.all([
      fetchPublicCatalog(sb, kvKeys.filter(isPublicKvKey)),
      withPrivate && privateKeys.length ? dataApi("read", { keys: privateKeys }) : null,
    ]);
    if (!state) return null;
    return { ...state, kv: { ...state.kv, ...(privateRes?.kv || {}) } };
  } catch (error) {
    console.warn("supabase hydrate", error?.message || error);
    return null;
  }
}

export async function fetchSessionState({ includeRfqs = true } = {}) {
  const res = await dataApi("session-state", { includeRfqs });
  if (!res) return null;
  return { kv: res.kv || {}, rfqs: rfqsMapFromRows(res.rows), accounts: res.accounts || [] };
}

export async function fetchQuoteSnapshot(token) {
  const res = await dataApi("quote", { token });
  return res?.kv || null;
}

let catalogTimer = null;
let catalogChain = Promise.resolve();

export function persistCatalogTables(products) {
  if (!isSupabaseConfigured() || !Array.isArray(products)) return;
  if (catalogTimer) clearTimeout(catalogTimer);
  catalogTimer = setTimeout(() => {
    catalogTimer = null;
    catalogChain = catalogChain.then(() => persistCatalogTablesNow(products)).catch((error) => {
      console.warn("supabase catalog", error?.message || error);
    });
  }, 500);
}

export async function persistCatalogTablesNow(products) {
  if (!Array.isArray(products)) return;
  const res = await dataApi("catalog", { products });
  if (!res) throw new Error("catalog save failed");
}
