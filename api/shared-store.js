import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), ".local-shared-store.json");
const LOCK = path.join(process.cwd(), ".local-shared-store.lock");

function emptyStore() {
  return { rev: 0, kv: {} };
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!parsed || typeof parsed !== "object") return emptyStore();
    return {
      rev: Number(parsed.rev) || 0,
      kv: parsed.kv && typeof parsed.kv === "object" ? parsed.kv : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  fs.writeFileSync(FILE, JSON.stringify(store));
}

function acquireLock() {
  const started = Date.now();
  while (Date.now() - started < 1000) {
    try {
      return fs.openSync(LOCK, "wx");
    } catch {
      try {
        const age = Date.now() - fs.statSync(LOCK).mtimeMs;
        if (age > 2000) fs.unlinkSync(LOCK);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function withStore(mutator) {
  const fd = acquireLock();
  try {
    const store = readStore();
    const next = mutator(store) || store;
    next.rev = (Number(store.rev) || 0) + 1;
    next.kv = next.kv && typeof next.kv === "object" ? next.kv : {};
    writeStore(next);
    return next;
  } finally {
    if (fd != null) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(LOCK);
      } catch {
        /* ignore */
      }
    }
  }
}

export function mergeRfqMaps(incoming, existing) {
  const keys = new Set([
    ...Object.keys(existing && typeof existing === "object" ? existing : {}),
    ...Object.keys(incoming && typeof incoming === "object" ? incoming : {}),
  ]);
  const rank = (rfq) =>
    ({
      accepted: 50,
      quoted: 40,
      reviewing: 30,
      returned: 25,
      no_offer: 20,
      rejected: 20,
      received: 10,
      whatsapp_sent: 10,
      email_sent: 10,
      submitted: 10,
    }[rfq?.reviewStatus || rfq?.status || ""] || 0);
  const pick = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    if (rank(b) !== rank(a)) return rank(b) > rank(a) ? b : a;
    const tb = Date.parse(b.submittedAt || "") || 0;
    const ta = Date.parse(a.submittedAt || "") || 0;
    if (tb !== ta) return tb > ta ? b : a;
    return JSON.stringify(b).length >= JSON.stringify(a).length ? b : a;
  };
  const out = {};
  keys.forEach((key) => {
    const byId = new Map();
    [...(Array.isArray(existing?.[key]) ? existing[key] : []), ...(Array.isArray(incoming?.[key]) ? incoming[key] : [])].forEach(
      (rfq) => {
        if (!rfq?.id) return;
        byId.set(rfq.id, pick(byId.get(rfq.id), rfq));
      }
    );
    out[key] = [...byId.values()];
  });
  return out;
}

function mergeQuoteSnapshots(incoming, existing) {
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...(incoming && typeof incoming === "object" ? incoming : {}),
  };
}

function upsertRfqIntoMap(map, buyerKey, rfq) {
  const next = map && typeof map === "object" ? { ...map } : {};
  const key = String(buyerKey || rfq?.buyerEmail || "__guest__");
  const list = Array.isArray(next[key]) ? [...next[key]] : [];
  const idx = list.findIndex((row) => row?.id === rfq?.id);
  if (idx >= 0) list[idx] = rfq;
  else list.unshift(rfq);
  next[key] = list;
  return next;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function handleSharedStoreGet() {
  return readStore();
}

export async function GET() {
  if (process.env.VERCEL) return jsonResponse({ error: "use-supabase" }, 501);
  return jsonResponse(handleSharedStoreGet());
}

export async function POST(request) {
  if (process.env.VERCEL) return jsonResponse({ error: "use-supabase" }, 501);
  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }
  return jsonResponse(handleSharedStorePost(body));
}

export function handleSharedStorePost(body = {}) {
  return withStore((store) => {
    if (body.upsertRfq && body.rfq?.id) {
      store.kv.subbie_rfqs_by_user = upsertRfqIntoMap(
        store.kv.subbie_rfqs_by_user,
        body.buyerKey,
        body.rfq
      );
      return store;
    }
    if (body.bootstrap && body.kv && typeof body.kv === "object") {
      Object.entries(body.kv).forEach(([key, value]) => {
        if (store.kv[key] == null) {
          store.kv[key] = value;
          return;
        }
        if (
          key === "subbie_rfq_seq" ||
          key === "subbie_report_seq" ||
          key === "subbie_tmp_sku_seq" ||
          key === "subbie_tms_seq"
        ) {
          store.kv[key] = Math.max(Number(store.kv[key]) || 0, Number(value) || 0);
          return;
        }
        if (key === "subbie_rfqs_by_user") {
          store.kv[key] = mergeRfqMaps(value, store.kv[key]);
        } else if (key === "subbie_accounts") {
          const prev = store.kv[key] && typeof store.kv[key] === "object" ? store.kv[key] : {};
          const next = value && typeof value === "object" ? value : {};
          store.kv[key] = { ...prev, ...next };
        } else if (key === "subbie_guest_quote_snapshots") {
          store.kv[key] = mergeQuoteSnapshots(value, store.kv[key]);
        }
      });
      return store;
    }
    if (body.kv && typeof body.kv === "object") {
      store.kv = { ...store.kv, ...body.kv };
    }
    if (body.key === "subbie_rfqs_by_user") {
      store.kv[body.key] = mergeRfqMaps(body.value, store.kv[body.key] || {});
    } else if (body.key === "subbie_guest_quote_snapshots") {
      store.kv[body.key] = mergeQuoteSnapshots(body.value, store.kv[body.key] || {});
    } else if (body.key) {
      store.kv[String(body.key)] = body.value;
    }
    return store;
  });
}
