import { createClient } from "@supabase/supabase-js";

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
    readEnv("VITE_SUPABASE_ANON_KEY") ||
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const service = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { url, anon, service };
}

export function isSupabaseConfigured() {
  const { url, anon, service } = supabaseConfig();
  return Boolean(url && (anon || service));
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

export function persistKvNow(key, value) {
  if (skipPersistKey(key) || !isSupabaseConfigured()) return Promise.resolve();
  const sb = getSupabase();
  if (!sb) return Promise.resolve();
  return sb
    .from("app_kv")
    .upsert({ key, value, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.warn("supabase persist", key, error.message);
    });
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

export async function fetchRemoteKv(keys) {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    let query = sb.from("app_kv").select("key,value").not("key", "like", "subbie_drafts%");
    if (Array.isArray(keys) && keys.length === 1) query = query.eq("key", keys[0]);
    else if (Array.isArray(keys) && keys.length) query = query.in("key", keys);
    const { data, error } = await query;
    if (error) {
      console.warn("supabase kv", error.message);
      return null;
    }
    return kvFromRows(data);
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

export async function fetchRemoteRfqs() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from("rfqs").select("buyer_key,payload");
    if (error) {
      console.warn("supabase rfqs", error.message);
      return null;
    }
    return rfqsMapFromRows(data);
  } catch (error) {
    console.warn("supabase rfqs", error?.message || error);
    return null;
  }
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

export async function fetchCatalogState() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const [kvRes, productRes, metricRes] = await Promise.all([
      sb.from("app_kv").select("key,value").not("key", "like", "subbie_drafts%").neq("key", "subbie_rfqs_by_user"),
      sb.from("products").select("id,payload,image_url"),
      sb.from("supplier_metrics").select("*"),
    ]);
    if (kvRes.error && productRes.error) {
      console.warn("supabase hydrate", kvRes.error.message || productRes.error.message);
      return null;
    }
    return {
      kv: kvFromRows(kvRes.data),
      products: productsFromRows(productRes.data),
      metrics: metricsFromRows(metricRes.data),
    };
  } catch (error) {
    console.warn("supabase hydrate", error?.message || error);
    return null;
  }
}

export async function fetchSessionState() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const [kvRes, rfqRes, accountRes] = await Promise.all([
      sb.from("app_kv").select("key,value").eq("key", "subbie_rfqs_by_user"),
      sb.from("rfqs").select("buyer_key,payload"),
      sb.from("user_accounts").select("email,kind,name,phone,company_name,password,enabled,approval_status,bootstrap,extra"),
    ]);
    if (rfqRes.error) console.warn("supabase rfqs", rfqRes.error.message);
    if (accountRes.error) console.warn("supabase accounts", accountRes.error.message);
    return {
      kv: kvFromRows(kvRes.data),
      rfqs: rfqsMapFromRows(rfqRes.data),
      accounts: accountRes.data || [],
    };
  } catch (error) {
    console.warn("supabase session", error?.message || error);
    return null;
  }
}

export async function fetchRemoteState() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const [catalog, session] = await Promise.all([fetchCatalogState(), fetchSessionState()]);
    if (!catalog) return null;
    return {
      ...catalog,
      kv: { ...catalog.kv, ...(session?.kv || {}) },
      rfqs: session?.rfqs,
      accounts: session?.accounts || [],
    };
  } catch (error) {
    console.warn("supabase hydrate", error?.message || error);
    return null;
  }
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < (list || []).length; i += size) out.push(list.slice(i, i + size));
  return out;
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
  const sb = getSupabase();
  if (!sb || !Array.isArray(products)) return;
  const rows = products
    .filter((p) => p && p.id)
    .map((p) => ({
      id: p.id,
      payload: p,
      updated_at: new Date().toISOString(),
    }));
  for (const part of chunk(rows, 80)) {
    const { error } = await sb.from("products").upsert(part);
    if (error) throw error;
  }
  const ids = rows.map((row) => row.id);
  const existing = new Set();
  for (const part of chunk(ids, 80)) {
    const { data, error } = await sb.from("product_images").select("product_id").in("product_id", part);
    if (error) throw error;
    (data || []).forEach((row) => existing.add(row.product_id));
  }
  const imageRows = products
    .filter((p) => p?.id && p.image && !existing.has(p.id))
    .map((p) => ({
      product_id: p.id,
      url: p.image,
      sort_order: 0,
      is_primary: true,
      source: "catalog",
    }));
  for (const part of chunk(imageRows, 80)) {
    const { error } = await sb.from("product_images").upsert(part, { onConflict: "product_id,sort_order" });
    if (error) throw error;
  }
}
