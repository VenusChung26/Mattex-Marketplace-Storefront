import { createClient } from "@supabase/supabase-js";
import { readSession } from "./auth.js";
import { mergeRfqMaps } from "./shared-store.js";
import { PUBLIC_KV_KEYS } from "../src/lib/kvKeys.js";
const SEQ_KEYS = new Set(["subbie_rfq_seq", "subbie_report_seq", "subbie_tmp_sku_seq", "subbie_tms_seq"]);
const APPEND_KEYS = new Set(["subbie_admin_alerts", "subbie_product_reports", "subbie_buyer_mail_log"]);
const RFQS_KEY = "subbie_rfqs_by_user";
const ACCOUNTS_KEY = "subbie_accounts";
const QUOTES_KEY = "subbie_guest_quote_snapshots";
const GUEST_KEY = "__guest__";
const ACCOUNT_COLUMNS = "email,kind,name,phone,company_name,enabled,approval_status,bootstrap,extra";
const SECRET_FIELDS = ["password", "resetToken", "resetExpiresAt", "inviteToken", "inviteExpiresAt"];
const MAX_SEQ_JUMP = 5;
const APPEND_CAP = 200;

let client = null;
function db() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("data_not_configured");
  if (!client) client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const stripSecrets = (row) => {
  if (!isObject(row)) return row;
  const next = { ...row };
  SECRET_FIELDS.forEach((key) => delete next[key]);
  return next;
};

async function roleOf(request) {
  const staff = readSession(request, "staff");
  if (staff) {
    const { data } = await db()
      .from("user_accounts")
      .select("enabled")
      .eq("email", normalizeEmail(staff.email))
      .eq("kind", "staff")
      .maybeSingle();
    if (data?.enabled) return { kind: "staff", email: normalizeEmail(staff.email) };
  }
  const buyer = readSession(request, "buyer");
  if (buyer) return { kind: "buyer", email: normalizeEmail(buyer.email) };
  return { kind: "guest", email: "" };
}

async function readKv(keys) {
  const { data, error } = await db().from("app_kv").select("key,value").in("key", keys);
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.key, row.value]));
}

function visibleValue(key, value, role) {
  if (PUBLIC_KV_KEYS.includes(key) || role.kind === "staff") return value;
  if (role.kind !== "buyer") return undefined;
  if (key === ACCOUNTS_KEY) return isObject(value) && value[role.email] ? { [role.email]: value[role.email] } : {};
  if (key === RFQS_KEY) return isObject(value) && Array.isArray(value[role.email]) ? { [role.email]: value[role.email] } : {};
  return undefined;
}

function mergeSeq(existing, incoming, role) {
  const current = Number(existing) || 0;
  const next = Number(incoming) || 0;
  if (next <= current) return current;
  return role.kind === "staff" ? next : Math.min(next, current + MAX_SEQ_JUMP);
}

function appendKey(row) {
  if (!isObject(row)) return JSON.stringify(row);
  return String(row.id || `${row.to || ""}|${row.subject || ""}|${row.at || row.createdAt || ""}`);
}

function mergeAppend(existing, incoming) {
  const list = Array.isArray(existing) ? existing : [];
  const seen = new Set(list.map(appendKey));
  const added = (Array.isArray(incoming) ? incoming : []).filter((row) => !seen.has(appendKey(row)));
  return [...added, ...list].slice(0, APPEND_CAP);
}

function mergeAccounts(existing, incoming, role) {
  const current = isObject(existing) ? existing : {};
  const own = isObject(incoming) ? incoming[role.email] : null;
  if (role.kind !== "buyer" || !isObject(own)) return current;
  const stored = current[role.email] || {};
  return {
    ...current,
    [role.email]: stripSecrets({
      ...stored,
      ...own,
      email: role.email,
      enabled: stored.enabled ?? own.enabled ?? true,
      approvalStatus: stored.approvalStatus || own.approvalStatus || "approved",
    }),
  };
}

function rfqOwners(map) {
  const owners = new Map();
  Object.entries(isObject(map) ? map : {}).forEach(([key, list]) => {
    (Array.isArray(list) ? list : []).forEach((rfq) => rfq?.id && owners.set(rfq.id, key));
  });
  return owners;
}

function mergeRfqs(existing, incoming, role) {
  const current = isObject(existing) ? existing : {};
  if (role.kind === "staff") return mergeRfqMaps(incoming, current);
  const owners = rfqOwners(current);
  const allowedKey = role.kind === "buyer" ? role.email : GUEST_KEY;
  const accepted = {};
  Object.entries(isObject(incoming) ? incoming : {}).forEach(([key, list]) => {
    if (key !== allowedKey) return;
    const rows = (Array.isArray(list) ? list : []).filter((rfq) => {
      if (!rfq?.id) return false;
      const owner = owners.get(rfq.id);
      if (role.kind === "guest") return !owner;
      return !owner || owner === role.email;
    });
    if (rows.length) accepted[key] = rows;
  });
  return mergeRfqMaps(accepted, current);
}

function mergeValue(key, existing, incoming, role) {
  if (SEQ_KEYS.has(key)) return mergeSeq(existing, incoming, role);
  if (APPEND_KEYS.has(key)) return role.kind === "staff" ? incoming : mergeAppend(existing, incoming);
  if (key === RFQS_KEY) return mergeRfqs(existing, incoming, role);
  if (key === ACCOUNTS_KEY) return role.kind === "staff" ? incoming : mergeAccounts(existing, incoming, role);
  return role.kind === "staff" ? incoming : undefined;
}

function sanitize(key, value) {
  if (key === ACCOUNTS_KEY && isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([email, row]) => [email, stripSecrets(row)]));
  }
  if (key === "subbie_staff" && Array.isArray(value)) return value.map(stripSecrets);
  return value;
}

async function writeKv(key, incoming, role) {
  if (!key || key.startsWith("subbie_drafts")) return { status: 400, body: { ok: false, error: "invalid" } };
  const stored = (await readKv([key]))[key];
  const next = mergeValue(key, stored, sanitize(key, incoming), role);
  if (next === undefined) return { status: 403, body: { ok: false, error: "forbidden" } };
  if (JSON.stringify(next) === JSON.stringify(stored)) return { body: { ok: true, unchanged: true } };
  const { error } = await db().from("app_kv").upsert({ key, value: next, updated_at: new Date().toISOString() });
  if (error) throw error;
  return { body: { ok: true } };
}

async function rfqRows(role, since) {
  let query = db().from("rfqs").select("buyer_key,payload,updated_at");
  if (role.kind === "buyer") query = query.eq("buyer_key", role.email);
  if (since) query = query.gt("updated_at", since);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function upsertCatalog(products) {
  const rows = (Array.isArray(products) ? products : [])
    .filter((p) => p && p.id)
    .map((p) => ({ id: String(p.id), payload: p, updated_at: new Date().toISOString() }));
  for (let i = 0; i < rows.length; i += 80) {
    const { error } = await db().from("products").upsert(rows.slice(i, i + 80));
    if (error) throw error;
  }
  const existing = new Set();
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await db()
      .from("product_images")
      .select("product_id")
      .in("product_id", rows.slice(i, i + 200).map((row) => row.id));
    if (error) throw error;
    (data || []).forEach((row) => existing.add(row.product_id));
  }
  const images = rows
    .filter((row) => row.payload.image && !String(row.payload.image).startsWith("data:") && !existing.has(row.id))
    .map((row) => ({ product_id: row.id, url: row.payload.image, sort_order: 0, is_primary: true, source: "catalog" }));
  for (let i = 0; i < images.length; i += 80) {
    const { error } = await db().from("product_images").upsert(images.slice(i, i + 80), { onConflict: "product_id,sort_order" });
    if (error) throw error;
  }
  return rows.length;
}

const ops = {
  async read({ keys }, role) {
    const wanted = (Array.isArray(keys) ? keys : []).map(String).filter((key) => !key.startsWith("subbie_drafts"));
    const values = wanted.length ? await readKv(wanted) : {};
    const kv = {};
    Object.entries(values).forEach(([key, value]) => {
      const visible = visibleValue(key, value, role);
      if (visible !== undefined) kv[key] = visible;
    });
    return { body: { ok: true, kv, role: role.kind } };
  },

  async write({ key, value }, role) {
    return writeKv(String(key || ""), value, role);
  },

  async quote({ token }) {
    const value = (await readKv([QUOTES_KEY]))[QUOTES_KEY];
    const id = String(token || "");
    const snapshot = isObject(value) && id ? value[id] : null;
    return { body: { ok: true, kv: snapshot ? { [QUOTES_KEY]: { [id]: snapshot } } : {} } };
  },

  async "rfq-stamp"(_body, role) {
    if (role.kind !== "staff") return { status: 403, body: { ok: false, error: "forbidden" } };
    const [table, kv] = await Promise.all([
      db().from("rfqs").select("updated_at").order("updated_at", { ascending: false }).limit(1),
      db().from("app_kv").select("updated_at").eq("key", RFQS_KEY).maybeSingle(),
    ]);
    return { body: { ok: true, table: table.data?.[0]?.updated_at || "", kv: kv.data?.updated_at || "" } };
  },

  async rfqs({ since }, role) {
    if (role.kind === "guest") return { status: 403, body: { ok: false, error: "forbidden" } };
    return { body: { ok: true, rows: await rfqRows(role, String(since || "")) } };
  },

  async "session-state"({ includeRfqs = true }, role) {
    if (role.kind === "guest") return { status: 403, body: { ok: false, error: "forbidden" } };
    let accounts = db().from("user_accounts").select(ACCOUNT_COLUMNS);
    if (role.kind === "buyer") accounts = accounts.eq("email", role.email);
    const { data: accountRows } = await accounts;
    if (!includeRfqs) return { body: { ok: true, kv: {}, rows: [], accounts: accountRows || [] } };
    const [rows, kv] = await Promise.all([rfqRows(role, ""), readKv([RFQS_KEY])]);
    return {
      body: {
        ok: true,
        kv: { [RFQS_KEY]: visibleValue(RFQS_KEY, kv[RFQS_KEY], role) || {} },
        rows,
        accounts: accountRows || [],
      },
    };
  },

  async catalog({ products }, role) {
    if (role.kind !== "staff") return { status: 403, body: { ok: false, error: "forbidden" } };
    return { body: { ok: true, count: await upsertCatalog(products) } };
  },
};

export async function handleData(body, request) {
  const op = ops[body?.op];
  if (!op) return { status: 400, body: { ok: false, error: "invalid" } };
  try {
    return await op(body, await roleOf(request));
  } catch (error) {
    console.error("data", body?.op, error?.message || error);
    return { status: 500, body: { ok: false, error: "server" } };
  }
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const result = await handleData(body, request);
  return Response.json(result.body, { status: result.status || 200, headers: { "cache-control": "no-store" } });
}
