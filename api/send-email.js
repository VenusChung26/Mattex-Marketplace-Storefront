import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSession } from "./auth.js";
import { MARKETPLACE_LOGO_URL } from "../src/lib/mailTemplate.js";

const FROM = process.env.RESEND_FROM || "Mattex Marketplace <noreply@marketplace.mattex.com.hk>";
const INTERNAL_RECIPIENTS = new Set(["sales@mattex.com.hk", "resend@mattex.com.hk"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGO_CID = "mattex-logo";

function withInlineLogo(html) {
  if (!html.includes(MARKETPLACE_LOGO_URL)) return { html };
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), "../public/assets/mattex-logo.webp");
    const content = readFileSync(file).toString("base64");
    return {
      html: html.split(MARKETPLACE_LOGO_URL).join(`cid:${LOGO_CID}`),
      attachments: [
        {
          filename: "mattex-logo.webp",
          content,
          content_type: "image/webp",
          content_id: LOGO_CID,
        },
      ],
    };
  } catch {
    return { html };
  }
}

export async function sendResendEmail({ to, subject, html }) {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) return { ok: false, error: "not_configured" };
  const prepared = withInlineLogo(html);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html: prepared.html,
      ...(prepared.attachments ? { attachments: prepared.attachments } : {}),
    }),
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
