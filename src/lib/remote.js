function localPath(path) {
  const value = String(path || "");
  if (!value.startsWith("/") || value.startsWith("//")) {
    throw new Error("remote path must stay on this prototype");
  }
  return value;
}

async function send(path, { method = "GET", body, headers, cache } = {}) {
  const init = { method, credentials: "same-origin" };
  if (cache) init.cache = cache;
  const nextHeaders = { ...(headers || {}) };
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined) {
    if (isFormData) {
      init.body = body;
    } else {
      nextHeaders["content-type"] = nextHeaders["content-type"] || "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
  }
  if (Object.keys(nextHeaders).length) init.headers = nextHeaders;
  return fetch(localPath(path), init);
}

async function sendJson(path, options) {
  const res = await send(path, options);
  const data = await res.json().catch(() => null);
  return { res, data };
}

export async function getCatalog(ifNoneMatch) {
  const headers = {};
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
  const res = await send("/api/catalog", { headers, cache: "no-store" });
  if (res.status === 304) return { status: 304, ok: true, data: null };
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

export async function commitCatalog(body) {
  return sendJson("/api/catalog/commit", { method: "POST", body });
}

export async function getCatalogVersion() {
  return sendJson("/api/catalog-version", { cache: "no-store" });
}

export async function getCatalogLive(id) {
  const { res, data } = await sendJson(`/api/catalog-snapshot?part=status&id=${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) return true;
  return data?.live !== false;
}

export async function getHostCatalog() {
  const { res, data } = await sendJson("/catalog.json", { cache: "no-store" });
  if (!res.ok) return null;
  return data;
}

export async function getPromo() {
  const { res, data } = await sendJson("/api/promo", { cache: "no-store" });
  return res.ok ? data : null;
}

export async function savePromo(body) {
  return sendJson("/api/promo", { method: "POST", body });
}

export async function getSpecMatchStatus() {
  return sendJson("/api/spec-match");
}

export async function postSpecMatch(body) {
  return sendJson("/api/spec-match", { method: "POST", body });
}

export async function postAuth(body) {
  try {
    const { data } = await sendJson("/api/auth", { method: "POST", body });
    return data && typeof data === "object" ? data : { ok: false, error: "server" };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function postEmail(body) {
  return sendJson("/api/send-email", { method: "POST", body });
}

export async function getSharedStore() {
  return sendJson("/api/shared-store");
}

export async function postSharedStore(body) {
  return sendJson("/api/shared-store", { method: "POST", body });
}

export async function postData(op, payload = {}) {
  try {
    const { res, data } = await sendJson("/api/data", { method: "POST", body: { op, ...payload } });
    return { ok: Boolean(data?.ok), status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function getCatalogGroups() {
  const { res, data } = await sendJson("/api/catalog-groups", { cache: "no-store" });
  return res.ok ? data : null;
}

export async function saveCatalogGroups(groups) {
  return sendJson("/api/catalog-groups", { method: "POST", body: { groups } });
}

export async function uploadProductImage(dataUrl, productKey) {
  const { res, data } = await sendJson("/api/product-image", { method: "POST", body: { dataUrl, productKey } });
  if (!res.ok || !data?.image) {
    throw new Error(data?.error || "image");
  }
  return { image: data.image, imageFallback: data.imageFallback || "" };
}

export async function getTmsStatus() {
  const { data } = await sendJson("/api/tms-status");
  return Boolean(data?.configured);
}

export async function postTmsLogin(body) {
  return sendJson("/api/tms-login", { method: "POST", body });
}

export async function postTmsSubmit(body) {
  return sendJson("/api/tms-submit", { method: "POST", body });
}

export const BLOB_UPLOAD_PATH = "/api/blob-upload";
