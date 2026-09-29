import { readSession } from "./auth.js";

const FROM = process.env.RESEND_FROM || "Mattex Marketplace <resend@mattex.com.hk>";
const INTERNAL_RECIPIENTS = new Set(["sales@mattex.com.hk", "resend@mattex.com.hk"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendResendEmail({ to, subject, html }) {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) return { ok: false, error: "not_configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.message || data?.error || "resend" };
  return { ok: true, id: data.id };
}

function mayEmail(request, to) {
  if (INTERNAL_RECIPIENTS.has(to)) return true;
  if (readSession(request, "staff")) return true;
  return readSession(request, "buyer")?.email === to;
}

export async function handleSendEmail(body, request) {
  const to = String(body?.to || "")
    .trim()
    .toLowerCase();
  const subject = String(body?.subject || "").trim();
  const html = String(body?.html || "");
  if (!to || !EMAIL_RE.test(to) || !subject || !html) {
    return { ok: false, error: "invalid" };
  }
  if (!mayEmail(request, to)) return { ok: false, error: "forbidden" };
  return sendResendEmail({ to, subject, html });
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const json = await handleSendEmail(body, request);
  return Response.json(json, { status: json.ok ? 200 : 400 });
}
