export const PHONE_REGIONS = [
  { id: "852", label: "香港 +852" },
  { id: "86", label: "中國 +86" },
  { id: "853", label: "澳門 +853" },
  { id: "65", label: "新加坡 +65" },
  { id: "60", label: "馬來西亞 +60" },
  { id: "other", label: "其他" },
];

const KNOWN = new Set(["852", "86", "853", "65", "60"]);

export function composePhone(region, otherCode, national) {
  const code = region === "other" ? String(otherCode || "").replace(/\D/g, "") : String(region || "");
  const digits = String(national || "").replace(/\D/g, "");
  if (!code || !digits) return "";
  return `+${code} ${digits}`;
}

export function splitPhone(phone) {
  const raw = String(phone || "").trim();
  const match = raw.match(/^\+(\d{1,4})\s*(.*)$/);
  if (!match) return { region: "852", otherCode: "", national: raw.replace(/\D/g, "") };
  const code = match[1];
  const national = String(match[2] || "").replace(/\D/g, "");
  if (KNOWN.has(code)) return { region: code, otherCode: "", national };
  return { region: "other", otherCode: code, national };
}

export function normalizeRoles(roles) {
  const list = Array.isArray(roles) ? roles : [];
  const next = [];
  if (list.includes("contractor")) next.push("contractor");
  if (list.includes("buyer")) next.push("buyer");
  return next;
}
