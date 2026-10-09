const MODEL_TYPE = "inbound_request_for_quotes";

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value);
}

function numEnv(name, fallback) {
  const n = Number(env(name, String(fallback)));
  return Number.isFinite(n) ? n : fallback;
}

export function tmsServerConfigured() {
  return Boolean(env("TMS_BOT_EMAIL") && env("TMS_BOT_PASSWORD"));
}

function config() {
  const email = env("TMS_BOT_EMAIL");
  const password = env("TMS_BOT_PASSWORD");
  if (!email || !password) {
    throw new Error("TMS credentials are not configured on the server");
  }
  return {
    apiUrl: env("TMS_API_URL", "https://api.uat-tms.mattex.com.hk").replace(/\/$/, ""),
    webUrl: env("TMS_BASE_URL", "https://uat-tms-v2.mattex.com.hk").replace(/\/$/, ""),
    email,
    password,
    sourceId: numEnv("TMS_DEFAULT_SOURCE_ID", 2),
    buyerProfileId: numEnv("TMS_DEFAULT_BUYER_PROFILE_ID", 366),
    buyerContactId: numEnv("TMS_DEFAULT_BUYER_CONTACT_ID", 845),
    projectId: numEnv("TMS_DEFAULT_PROJECT_ID", 355),
    projectAddressId: numEnv("TMS_DEFAULT_PROJECT_ADDRESS_ID", 285),
    supplierCategoryId: numEnv("TMS_DEFAULT_SUPPLIER_CATEGORY_ID", 452),
    unitId: numEnv("TMS_DEFAULT_UNIT_ID", 189),
    unit: env("TMS_DEFAULT_UNIT", "PC"),
    categoryId: numEnv("TMS_DEFAULT_CATEGORY_ID", 276),
    purpose: numEnv("TMS_DEFAULT_PURPOSE", 2),
    fileTypeId: numEnv("TMS_FILE_TYPE_ID", 170),
  };
}

function toIso(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/T/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00+08:00`;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function nowIso() {
  const d = new Date();
  const off = 8 * 60;
  const local = new Date(d.getTime() + off * 60 * 1000);
  return local.toISOString().replace("Z", "+08:00");
}

function normalizeUnit(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/\s+/g, "");
}

async function tmsFetch(cfg, token, method, path, { json, form } = {}) {
  const headers = {
    Accept: "application/json",
    "Accept-Language": "en-US",
    Origin: cfg.webUrl,
    Referer: `${cfg.webUrl}/inbound/inbound-rfq/`,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (form) {
    body = form;
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  const res = await fetch(`${cfg.apiUrl}${path}`, { method, headers, body });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  if (!res.ok) {
    const first = Array.isArray(data?.errors) ? data.errors[0] : null;
    const message = first?.message || data?.message || `TMS ${method} ${path} failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function login(cfg) {
  const data = await tmsFetch(cfg, "", "POST", "/login", {
    json: { email: cfg.email, password: cfg.password },
  });
  const token = data?.data?.access_token;
  const uid = data?.data?.uid;
  const email = data?.data?.email || data?.data?.user?.email || cfg.email;
  if (!token) throw new Error("TMS login did not return an access token");
  return { token, uid, email };
}

function emailKey(value) {
  return String(value || "").trim().toLowerCase();
}

async function matchHandlerByEmail(cfg, token, staffEmail) {
  const needle = emailKey(staffEmail);
  if (!needle || !needle.includes("@")) return null;
  try {
    const data = await tmsFetch(cfg, token, "GET", `/tms/api/v1/users?current=1&pageSize=20&email=${encodeURIComponent(needle)}`);
    const rows = Array.isArray(data?.data) ? data.data : [];
    const row = rows.find((item) => emailKey(item?.email) === needle);
    const id = row?.id || row?.emat_user_id || null;
    return id ? { id, email: emailKey(row.email) } : null;
  } catch {
    return null;
  }
}

function emailsOf(row) {
  const nested = Array.isArray(row?.contacts) ? row.contacts : [];
  return [row?.email, row?.contact_email, row?.user_email, ...nested.map((c) => c?.email)]
    .map((value) => emailKey(value))
    .filter(Boolean);
}

async function matchBuyer(cfg, token, buyerEmail) {
  const needle = String(buyerEmail || "").trim().toLowerCase();
  if (!needle) return { buyerProfileId: cfg.buyerProfileId, buyerContactId: cfg.buyerContactId };
  const paths = ["/tms/api/v1/buyer-profiles?current=1&pageSize=100", "/tms/api/v1/buyers?current=1&pageSize=100"];
  for (const path of paths) {
    try {
      const data = await tmsFetch(cfg, token, "GET", path);
      const rows = Array.isArray(data?.data) ? data.data : [];
      const row = rows.find((item) => emailsOf(item).includes(needle));
      if (!row?.id) continue;
      const contact =
        (Array.isArray(row.contacts) ? row.contacts : []).find((c) => String(c.email || "").trim().toLowerCase() === needle) ||
        (Array.isArray(row.contacts) ? row.contacts[0] : null);
      return {
        buyerProfileId: row.id,
        buyerContactId: contact?.id || cfg.buyerContactId,
      };
    } catch {
      /* keep default buyer */
    }
  }
  return { buyerProfileId: cfg.buyerProfileId, buyerContactId: cfg.buyerContactId };
}

async function matchProjectId(cfg, token, projectName, fallbackId) {
  const name = String(projectName || "").trim().toLowerCase();
  if (!name) return fallbackId;
  try {
    const data = await tmsFetch(cfg, token, "GET", "/tms/api/v1/projects?current=1&pageSize=100");
    const rows = Array.isArray(data?.data) ? data.data : [];
    const exact = rows.find((row) => String(row.name || "").trim().toLowerCase() === name);
    if (exact?.id) return exact.id;
    const partial = rows.find(
      (row) => String(row.name || "").toLowerCase().includes(name) || name.includes(String(row.name || "").toLowerCase())
    );
    if (partial?.id) return partial.id;
  } catch {
    /* keep default project */
  }
  return fallbackId;
}

async function unitMap(cfg, token) {
  const map = new Map();
  try {
    const data = await tmsFetch(cfg, token, "GET", "/tms/api/v1/products?current=1&pageSize=80");
    for (const row of Array.isArray(data?.data) ? data.data : []) {
      const id = Number(row.unit_id);
      const label = row.unit || row.unit_short;
      if (!id || !label) continue;
      const key = normalizeUnit(label);
      if (key && !map.has(key)) map.set(key, { id, unit: String(label) });
    }
  } catch {
    /* default unit */
  }
  return map;
}

function resolveUnit(line, units, fallback) {
  const raw = line.unit || line.qtyUnit || "";
  const key = normalizeUnit(raw);
  if (key && units.has(key)) return units.get(key);
  const aliases = {
    pc: "pc",
    pcs: "pc",
    piece: "pc",
    pieces: "pc",
    nos: "pc",
    no: "pc",
    bag: "bag",
    hour: "hour",
    hr: "hour",
    hours: "hour",
  };
  const aliased = aliases[key];
  if (aliased && units.has(aliased)) return units.get(aliased);
  return fallback;
}

function itemDescription(line) {
  const parts = [
    String(line.name || "").trim() || "Item",
    line.productNo ? `SKU ${line.productNo}` : "",
    String(line.description || line.spec || "").trim(),
    line.requestedUnitPrice != null ? `requested ${line.requestedUnitPrice}` : "",
    String(line.remark || "").trim(),
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 900);
}

function decodePdf(base64) {
  const cleaned = String(base64 || "").replace(/^data:application\/pdf;base64,/i, "");
  if (!cleaned) return null;
  return Buffer.from(cleaned, "base64");
}

async function uploadPdf(cfg, token, { modelId, filename, bytes, remark }) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), filename || "subbie-quote.pdf");
  const uploaded = await tmsFetch(cfg, token, "POST", "/tms/api/v1/files/upload", { form });
  const fileMeta = uploaded?.data;
  if (!fileMeta?.file_path) throw new Error("TMS file upload did not return a path");
  const attached = await tmsFetch(cfg, token, "POST", "/tms/api/v1/files", {
    json: {
      model_id: modelId,
      model_type: MODEL_TYPE,
      files: [
        {
          file_id: 0,
          file_name: fileMeta.original_filename || filename || "subbie-quote.pdf",
          file_path: fileMeta.file_path,
          remark: remark || "Marketplace RFQ PDF",
          file_size: bytes.length,
          attach: false,
          file_type_id: cfg.fileTypeId,
          extension: fileMeta.extension || "pdf",
        },
      ],
    },
  });
  return attached?.data?.[0] || fileMeta;
}

export async function testTmsLogin() {
  const cfg = config();
  await login(cfg);
  return { ok: true, email: cfg.email };
}

export async function submitInboundRfq(payload) {
  const cfg = config();
  const lines = Array.isArray(payload?.lines) ? payload.lines : [];
  if (!lines.length) throw new Error("No RFQ lines to submit");
  const { token } = await login(cfg);
  const handler = await matchHandlerByEmail(cfg, token, payload?.staffEmail);
  const handlerId = handler?.id || null;
  const assignHandler = Boolean(handlerId);
  const units = await unitMap(cfg, token);
  const fallbackUnit = { id: cfg.unitId, unit: cfg.unit };
  const buyer = await matchBuyer(cfg, token, payload?.rfq?.buyerEmail);
  const projectId = await matchProjectId(cfg, token, payload?.rfq?.project, cfg.projectId);
  const receivedAt = nowIso();
  const deliveryIso = toIso(payload?.rfq?.deliveryDate);
  const remarkParts = [
    payload?.rfq?.id ? `Marketplace ${payload.rfq.id}` : "",
    payload?.kind === "buy" ? "Buy / stock" : "Quote request",
    payload?.rfq?.buyerName || payload?.rfq?.buyerEmail || "",
    String(payload?.rfq?.note || "").trim(),
    payload?.rfq?.address ? `Address: ${payload.rfq.address}` : "",
  ].filter(Boolean);
  const createBody = {
    buyer_profile_id: buyer.buyerProfileId,
    buyer_contact_id: buyer.buyerContactId,
    project_id: projectId,
    project_address_id: cfg.projectAddressId,
    source_id: cfg.sourceId,
    handled_by: assignHandler ? handlerId : null,
    received_at: receivedAt,
    supplier_category_id: cfg.supplierCategoryId,
    remark: remarkParts.join(" — ").slice(0, 1900),
    status: 1,
  };
  const created = await tmsFetch(cfg, token, "POST", "/tms/api/v1/inbound-rfq", { json: createBody });
  const irfq = created?.data;
  const id = irfq?.id;
  if (!id) throw new Error("TMS did not return an inbound RFQ id");

  try {
    await tmsFetch(cfg, token, "PUT", `/tms/api/v1/inbound-rfq/${id}/info`, {
      json: {
        id,
        ...createBody,
        expected_delivery_date: deliveryIso,
      },
    });
  } catch {
    /* create already persisted the header */
  }

  for (const line of lines) {
    const unit = resolveUnit(line, units, fallbackUnit);
    const qty = Number(line.qty);
    await tmsFetch(cfg, token, "POST", `/tms/api/v1/inbound-rfq/${id}/item`, {
      json: {
        description: itemDescription(line),
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        unit_id: unit.id,
        unit: unit.unit,
        purpose: cfg.purpose,
        category_id: cfg.categoryId,
        latest_arrival_date: deliveryIso,
      },
    });
  }

  const pdfBytes = decodePdf(payload?.pdfBase64);
  let file = null;
  if (pdfBytes?.length) {
    file = await uploadPdf(cfg, token, {
      modelId: id,
      filename: payload.pdfFilename || `${payload?.rfq?.id || "marketplace"}-quote.pdf`,
      bytes: pdfBytes,
      remark: payload?.rfq?.id ? `Marketplace ${payload.rfq.id}` : "Marketplace RFQ PDF",
    });
  }

  const fresh = await tmsFetch(cfg, token, "GET", `/tms/api/v1/inbound-rfq/${id}`);
  const doc = fresh?.data || irfq;
  const documentNo = doc.document_no || irfq.document_no || String(id);
  return {
    ok: true,
    id,
    documentNo,
    url: `${cfg.webUrl}/inbound/inbound-rfq/${id}`,
    listUrl: `${cfg.webUrl}/inbound/inbound-rfq?current=1&pageSize=20`,
    fileId: file?.id || null,
    fileName: file?.file_name || null,
    handlerAssigned: assignHandler,
    handledBy: assignHandler ? handlerId : null,
    handlerEmail: assignHandler ? handler.email : "",
  };
}
