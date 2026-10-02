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

export function contactFormFromAccount(user) {
  const phone = splitPhone(user?.phone);
  const otherRaw = String(user?.otherPhone || "").trim();
  const other = splitPhone(otherRaw);
  const phoneText = String(user?.phone || "").trim();
  const wechat = String(user?.wechat || "").trim();
  let whatsappOn = user?.whatsappOn === "1" || user?.whatsappOn === "2" ? user.whatsappOn : "";
  if (!whatsappOn && user?.phoneWhatsapp) whatsappOn = "1";
  if (whatsappOn === "2" && !otherRaw) whatsappOn = "1";
  let wechatOn = user?.wechatOn === "1" || user?.wechatOn === "2" ? user.wechatOn : "";
  if (!wechatOn && wechat && wechat === phoneText) wechatOn = "1";
  if (!wechatOn && wechat && otherRaw && wechat === otherRaw) wechatOn = "2";
  if (wechatOn === "2" && !otherRaw) wechatOn = "";
  return {
    phoneRegion: phone.region,
    phoneOtherCode: phone.otherCode,
    phoneNational: phone.national,
    addPhone: Boolean(otherRaw),
    phone2Region: otherRaw ? other.region : "852",
    phone2OtherCode: otherRaw ? other.otherCode : "",
    phone2National: otherRaw ? other.national : "",
    whatsappOn,
    wechatOn,
    wechatPhoneRegion: wechatOn === "1" ? splitPhone(wechat).region : "852",
    wechatPhoneOtherCode: wechatOn === "1" ? splitPhone(wechat).otherCode : "",
    wechatPhoneNational: wechatOn === "1" ? splitPhone(wechat).national : "",
    wechatId: wechatOn ? "" : wechat,
  };
}

export function contactPayload(form) {
  const phone = composePhone(form.phoneRegion, form.phoneOtherCode, form.phoneNational);
  const otherPhone = form.addPhone
    ? composePhone(form.phone2Region, form.phone2OtherCode, form.phone2National)
    : "";
  let whatsappOn = form.whatsappOn === "1" || form.whatsappOn === "2" ? form.whatsappOn : "";
  let wechatOn = form.wechatOn === "1" || form.wechatOn === "2" ? form.wechatOn : "";
  if (!otherPhone) {
    if (whatsappOn === "2") whatsappOn = "";
    if (wechatOn === "2") wechatOn = "";
  }
  const wechat = wechatOn === "1" ? phone : wechatOn === "2" ? otherPhone : "";
  return {
    phone,
    otherPhone,
    phoneRegion: form.phoneRegion === "other" ? String(form.phoneOtherCode || "").trim() : form.phoneRegion,
    whatsappOn,
    wechatOn,
    wechat,
    phoneWhatsapp: Boolean(whatsappOn),
  };
}

export function phonePurposeTags(slot, whatsappOn, wechatOn) {
  const tags = [];
  if (whatsappOn === slot) tags.push("WhatsApp");
  if (wechatOn === slot) tags.push("WeChat");
  return tags;
}

export function phoneSlotLabel(base, slot, whatsappOn, wechatOn) {
  const tags = phonePurposeTags(slot, whatsappOn, wechatOn);
  return tags.length ? `${base} · ${tags.join(" · ")}` : base;
}

export function formatPhoneLine(number, slot, whatsappOn, wechatOn) {
  const base = String(number || "").trim();
  if (!base) return "";
  const tags = phonePurposeTags(slot, whatsappOn, wechatOn);
  return tags.length ? `${base} · ${tags.join(" · ")}` : base;
}

export function normalizeRoles(roles) {
  const list = Array.isArray(roles) ? roles : [];
  const next = [];
  if (list.includes("contractor")) next.push("contractor");
  if (list.includes("buyer")) next.push("buyer");
  return next;
}
