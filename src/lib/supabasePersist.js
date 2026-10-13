import { isPublicKvKey } from "./kvKeys.js";
import { postData } from "./remote.js";

const timers = new Map();

export function isSupabaseConfigured() {
  return typeof fetch === "function";
}

let remoteDataReady = null;

export function shouldUseLocalSharedStore() {
  return !isSupabaseConfigured() || remoteDataReady === false;
}

function markRemoteDataDown() {
  remoteDataReady = false;
}

export async function probeRemoteData() {
  if (!isSupabaseConfigured()) return false;
  if (remoteDataReady != null) return remoteDataReady;
  const result = await postData("read", { keys: ["subbie_rfq_seq"] });
  if (result.status >= 500 || result.status === 0) {
    markRemoteDataDown();
    return false;
  }
  remoteDataReady = true;
  return true;
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
  const result = await postData(op, payload);
  if (result.status >= 500 || result.status === 0) markRemoteDataDown();
  return result.ok ? result.data : null;
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

export async function fetchRemoteKv(keys, { withPrivate = true } = {}) {
  if (!Array.isArray(keys)) return null;
  const wanted = keys.filter((key) => !skipPersistKey(key));
  const readKeys = withPrivate ? wanted : wanted.filter(isPublicKvKey);
  if (!readKeys.length) return {};
  const data = await dataApi("read", { keys: readKeys });
  if (!data) return null;
  return data.kv || {};
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

export async function fetchRfqStamp() {
  const res = await dataApi("rfq-stamp");
  return res ? { table: res.table || "", kv: res.kv || "" } : null;
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
