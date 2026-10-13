const LEGACY_KEY = "mm_spec_match_v1";
const CONFIRM_KEY = "mm_spec_confirm";
const QUOTE_KEY = "mm_spec_quote_draft";
const AUTH_KEY = "subbie_auth";
export const SAMPLE_SPEC_NAME = "sample-specification";

let pendingFile = null;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function ownerEmail() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    return normalizeEmail(user?.email);
  } catch {
    return "";
  }
}

function storageKey(email = ownerEmail()) {
  return email ? `${LEGACY_KEY}:user:${email}` : `${LEGACY_KEY}:guest`;
}

function parseRecord(raw) {
  try {
    const data = JSON.parse(raw || "null");
    if (!data || data.fileName === SAMPLE_SPEC_NAME || data.sample) return null;
    if (!Array.isArray(data.rows) || !data.rows.length) return null;
    return data;
  } catch {
    return null;
  }
}

function previewUrl(url) {
  const value = String(url || "");
  return /^https?:\/\//i.test(value) ? value : "";
}

function migrateLegacy() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (raw == null) return;
  localStorage.removeItem(LEGACY_KEY);
  const data = parseRecord(raw);
  const key = storageKey();
  if (data && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ ...data, specUrl: previewUrl(data.specUrl) }));
}

export function setPendingSpecFile(file) {
  pendingFile = file || null;
}

export function takePendingSpecFile() {
  const file = pendingFile;
  pendingFile = null;
  return file;
}

export function loadSpecMatch() {
  migrateLegacy();
  return parseRecord(localStorage.getItem(storageKey()));
}

export function saveSpecMatch(data) {
  if (!data || data.fileName === SAMPLE_SPEC_NAME || !Array.isArray(data.rows) || !data.rows.length) return;
  localStorage.setItem(
    storageKey(),
    JSON.stringify({
      fileName: data.fileName || "",
      specUrl: previewUrl(data.specUrl),
      sources: (Array.isArray(data.sources) ? data.sources : []).map((source) => ({
        id: source.id || "",
        name: source.name || "",
        kind: source.kind || "",
        url: previewUrl(source.url),
      })),
      rows: data.rows,
    })
  );
}

export function hasSpecMatch() {
  return Boolean(loadSpecMatch());
}

export function clearSpecMatch() {
  localStorage.removeItem(storageKey());
  sessionStorage.removeItem(CONFIRM_KEY);
}

export function adoptGuestSpecMatch(email) {
  const owner = normalizeEmail(email);
  if (!owner) return;
  const guestKey = storageKey("");
  const guest = parseRecord(localStorage.getItem(guestKey)) || parseRecord(localStorage.getItem(LEGACY_KEY));
  localStorage.removeItem(LEGACY_KEY);
  if (!guest) return;
  localStorage.setItem(storageKey(owner), JSON.stringify({ ...guest, specUrl: previewUrl(guest.specUrl) }));
  localStorage.removeItem(guestKey);
}

export function clearSpecMatchIfSubmitted(ids) {
  const data = loadSpecMatch();
  if (!data) return;
  const bound = new Set((data.rows || []).map((row) => String(row.boundId || "")).filter(Boolean));
  if ((ids || []).some((id) => bound.has(String(id)))) clearSpecMatch();
}

export function setSpecConfirm(ids) {
  sessionStorage.setItem(CONFIRM_KEY, JSON.stringify({ ids: (ids || []).map(String) }));
}

export function readSpecConfirm() {
  try {
    const data = JSON.parse(sessionStorage.getItem(CONFIRM_KEY) || "null");
    if (!data?.ids?.length) return null;
    return { ids: data.ids.map(String) };
  } catch {
    return null;
  }
}

export function clearSpecConfirm() {
  sessionStorage.removeItem(CONFIRM_KEY);
}

export function saveSpecQuoteDraft(draft) {
  sessionStorage.setItem(QUOTE_KEY, JSON.stringify(draft));
}

export function readSpecQuoteDraft() {
  try {
    const data = JSON.parse(sessionStorage.getItem(QUOTE_KEY) || "null");
    if (!data || !Array.isArray(data.lines) || !data.lines.length) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSpecQuoteDraft() {
  sessionStorage.removeItem(QUOTE_KEY);
}
