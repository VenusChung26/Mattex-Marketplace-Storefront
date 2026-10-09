const KEY = "mm_spec_match_v1";
const CONFIRM_KEY = "mm_spec_confirm";
const QUOTE_KEY = "mm_spec_quote_draft";

let pendingFile = null;

export function setPendingSpecFile(file) {
  pendingFile = file || null;
}

export function takePendingSpecFile() {
  const file = pendingFile;
  pendingFile = null;
  return file;
}

export function loadSpecMatch() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!data || !Array.isArray(data.rows) || !data.rows.length) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSpecMatch(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function hasSpecMatch() {
  return Boolean(loadSpecMatch());
}

export function clearSpecMatch() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(CONFIRM_KEY);
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
