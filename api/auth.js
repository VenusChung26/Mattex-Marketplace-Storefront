import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { passwordResetEmailHtml, staffInviteEmailHtml, wrapEmailSend } from "../src/lib/mailTemplate.js";
import { sendResendEmail } from "./send-email.js";

const COOKIES = { staff: "mm_staff", buyer: "mm_buyer" };
const SESSION_SECONDS = 14 * 24 * 60 * 60;
const TOKEN_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALES_EMAIL = "sales@mattex.com.hk";
const PUBLIC_COLUMNS =
  "email,kind,name,phone,phone_whatsapp,job_title,company_name,company_reg,company_phone,company_address,project,projects,enabled,approval_status,needs_review,bootstrap,created_at,approved_at,reviewed_at,extra";

let client = null;
function db() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("auth_not_configured");
  if (!client) client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function secret() {
  const value = process.env.SESSION_SECRET || "";
  if (value.length < 32) throw new Error("auth_not_configured");
  return value;
}

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const isKind = (kind) => kind === "staff" || kind === "buyer";
const passwordOk = (value) => {
  const text = String(value || "");
  return text.length >= 8 && /[A-Za-z]/.test(text) && /\d/.test(text);
};
const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function unsign(value) {
  const [body, sig] = String(value || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function readCookie(request, name) {
  const header = request?.headers?.get?.("cookie") || "";
  const hit = header.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
}

export function readSession(request, kind) {
  try {
    const payload = unsign(readCookie(request, COOKIES[kind]));
    return payload && payload.kind === kind && payload.email ? payload : null;
  } catch {
    return null;
  }
}

function sessionCookie(kind, email) {
  const value = sign({ kind, email, exp: Date.now() + SESSION_SECONDS * 1000 });
  return `${COOKIES[kind]}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

function clearCookie(kind) {
  return `${COOKIES[kind]}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function siteOrigin(request) {
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return new URL(request.url).origin;
}

async function findAccount(email, kind) {
  let query = db().from("user_accounts").select(PUBLIC_COLUMNS).eq("email", normalizeEmail(email));
  if (kind) query = query.eq("kind", kind);
  const { data } = await query.maybeSingle();
  return data || null;
}

async function verifyPassword(email, kind, password) {
  const { data, error } = await db().rpc("auth_verify_password", {
    p_email: normalizeEmail(email),
    p_kind: kind,
    p_password: String(password || ""),
  });
  return !error && data === true;
}

async function setPassword(email, kind, password) {
  const { data, error } = await db().rpc("auth_set_password", {
    p_email: normalizeEmail(email),
    p_kind: kind,
    p_password: String(password),
  });
  return !error && data === true;
}

async function issueToken(email, kind, purpose) {
  const token = randomBytes(32).toString("base64url");
  await db().from("auth_tokens").delete().eq("email", email).eq("purpose", purpose).is("used_at", null);
  const { error } = await db().from("auth_tokens").insert({
    token_hash: hashToken(token),
    email,
    kind,
    purpose,
    expires_at: new Date(Date.now() + TOKEN_MS).toISOString(),
  });
  if (error) throw error;
  return token;
}

async function readToken(token) {
  if (!token) return null;
  const { data } = await db().from("auth_tokens").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  if (!data || data.used_at) return null;
  return { ...data, expired: new Date(data.expires_at).getTime() < Date.now() };
}

async function patchStaffKv(email, patch) {
  const { data } = await db().from("app_kv").select("value").eq("key", "subbie_staff").maybeSingle();
  if (!Array.isArray(data?.value)) return;
  const next = data.value.map((row) => (normalizeEmail(row?.email) === email ? { ...row, ...patch } : row));
  await db().from("app_kv").update({ value: next, updated_at: new Date().toISOString() }).eq("key", "subbie_staff");
}

function mailContext(request) {
  const origin = siteOrigin(request);
  return { origin, logoUrl: `${origin}/assets/mattex-logo.webp` };
}

async function sendMail(to, subject, innerHtml, fontBase) {
  const html = wrapEmailSend({ subject, innerHtml, fontBase });
  return sendResendEmail({ to, subject, html }).catch(() => ({ ok: false }));
}

const actions = {
  async login({ kind, email, password }) {
    if (!isKind(kind)) return { status: 400, body: { ok: false, error: "invalid" } };
    const account = await findAccount(email, kind);
    if (!account) return { body: { ok: false, error: kind === "buyer" ? "missing" : "password" } };
    if (kind === "buyer" && account.approval_status === "rejected") return { body: { ok: false, error: "rejected" } };
    if (!account.enabled) return { body: { ok: false, error: kind === "buyer" ? "disabled" : "password" } };
    if (account.extra?.invitePending) return { body: { ok: false, error: "invite" } };
    if (!(await verifyPassword(account.email, kind, password))) return { body: { ok: false, error: "password" } };
    return { cookie: sessionCookie(kind, account.email), body: { ok: true, account } };
  },

  async signup({ email, password, profile = {} }) {
    const address = normalizeEmail(email);
    if (!EMAIL_RE.test(address)) return { body: { ok: false, error: "email" } };
    if (!passwordOk(password)) return { body: { ok: false, error: "password" } };
    const existing = await findAccount(address);
    if (existing?.kind === "staff") return { body: { ok: false, error: "staff" } };
    if (existing) {
      const { data: row } = await db().from("user_accounts").select("password").eq("email", address).maybeSingle();
      if (String(row?.password || "")) return { body: { ok: false, error: "exists" } };
    } else {
      const { error } = await db().from("user_accounts").insert({
        email: address,
        kind: "buyer",
        name: String(profile.name || "").trim(),
        phone: String(profile.phone || "").trim(),
        company_name: String(profile.companyName || "").trim(),
        created_at: new Date().toISOString(),
      });
      if (error) return { body: { ok: false, error: "exists" } };
    }
    if (!(await setPassword(address, "buyer", password))) return { status: 500, body: { ok: false, error: "server" } };
    return { cookie: sessionCookie("buyer", address), body: { ok: true, email: address } };
  },

  async "change-password"({ kind, currentPassword, nextPassword }, request) {
    if (!isKind(kind)) return { status: 400, body: { ok: false, error: "invalid" } };
    const session = readSession(request, kind);
    if (!session) return { status: 401, body: { ok: false, error: kind } };
    if (!(await verifyPassword(session.email, kind, currentPassword))) return { body: { ok: false, error: "current" } };
    if (!passwordOk(nextPassword)) return { body: { ok: false, error: "password" } };
    if (String(currentPassword) === String(nextPassword)) return { body: { ok: false, error: "same" } };
    await setPassword(session.email, kind, nextPassword);
    return { body: { ok: true } };
  },

  async "request-reset"({ kind, email }, request) {
    if (!isKind(kind)) return { status: 400, body: { ok: false, error: "invalid" } };
    const account = await findAccount(email, kind);
    const eligible =
      account?.enabled && !account.extra?.invitePending && (kind === "staff" || account.approval_status !== "rejected");
    if (eligible) {
      const token = await issueToken(account.email, kind, "reset");
      const { origin, logoUrl } = mailContext(request);
      const href = kind === "staff" ? `${origin}/set-password?token=${token}` : `${origin}/en/reset-password?token=${token}`;
      const subject = kind === "staff" ? "Reset your Mattex Sales portal password" : "Reset your Mattex Marketplace password";
      await sendMail(
        account.email,
        subject,
        passwordResetEmailHtml({
          logoUrl,
          salesEmail: SALES_EMAIL,
          name: account.name || "there",
          resetHref: href,
          toEmail: account.email,
          shopHref: kind === "buyer" ? `${origin}/en/login` : undefined,
          portalHref: kind === "staff" ? `${origin}/` : undefined,
          staff: kind === "staff",
        }),
        origin
      );
    }
    return { body: { ok: true } };
  },

  async "issue-invite"({ email, name }, request) {
    const session = readSession(request, "staff");
    if (!session) return { status: 401, body: { ok: false, error: "staff" } };
    const address = normalizeEmail(email);
    if (!EMAIL_RE.test(address)) return { body: { ok: false, error: "email" } };
    const existing = await findAccount(address);
    if (existing && existing.kind !== "staff") return { body: { ok: false, error: "taken" } };
    const displayName = String(name || existing?.name || "").trim();
    if (!existing) {
      const { error } = await db().from("user_accounts").insert({ email: address, kind: "staff", name: displayName, enabled: true });
      if (error) return { status: 500, body: { ok: false, error: "server" } };
    }
    await db().from("user_accounts").update({ password: "", enabled: true }).eq("email", address).eq("kind", "staff");
    await patchStaffKv(address, { invitePending: true, enabled: true });
    const token = await issueToken(address, "staff", "invite");
    const { origin, logoUrl } = mailContext(request);
    const href = `${origin}/set-password?token=${token}`;
    await sendMail(
      address,
      "Set your Mattex Sales portal password",
      staffInviteEmailHtml({
        logoUrl,
        salesEmail: SALES_EMAIL,
        name: displayName || "there",
        setPasswordHref: href,
        toEmail: address,
        portalHref: `${origin}/`,
      }),
      origin
    );
    return { body: { ok: true, href, email: address } };
  },

  async "token-info"({ token }) {
    const row = await readToken(token);
    if (!row) return { body: { ok: false } };
    const account = await findAccount(row.email, row.kind);
    return {
      body: { ok: true, email: row.email, name: account?.name || "", kind: row.kind, purpose: row.purpose, expired: row.expired },
    };
  },

  async "accept-token"({ token, password }) {
    const row = await readToken(token);
    if (!row) return { body: { ok: false, error: "token" } };
    if (row.expired) return { body: { ok: false, error: "expired" } };
    if (!passwordOk(password)) return { body: { ok: false, error: "password" } };
    if (!(await setPassword(row.email, row.kind, password))) return { body: { ok: false, error: "token" } };
    await db().from("auth_tokens").update({ used_at: new Date().toISOString() }).eq("email", row.email).is("used_at", null);
    if (row.kind === "staff") {
      await db().from("user_accounts").update({ enabled: true }).eq("email", row.email).eq("kind", "staff");
      await patchStaffKv(row.email, { invitePending: false, enabled: true });
      const account = await findAccount(row.email, "staff");
      return { cookie: sessionCookie("staff", row.email), body: { ok: true, kind: "staff", account } };
    }
    return { body: { ok: true, kind: "buyer", email: row.email } };
  },

  async session({ kind }, request) {
    if (!isKind(kind)) return { status: 400, body: { ok: false } };
    const session = readSession(request, kind);
    const account = session ? await findAccount(session.email, kind) : null;
    if (!account?.enabled) return { cookie: session ? clearCookie(kind) : undefined, body: { ok: false } };
    return { body: { ok: true, account } };
  },

  async logout({ kind }) {
    if (!isKind(kind)) return { status: 400, body: { ok: false } };
    return { cookie: clearCookie(kind), body: { ok: true } };
  },
};

export async function handleAuth(body, request) {
  const action = actions[body?.action];
  if (!action) return { status: 400, body: { ok: false, error: "invalid" } };
  try {
    return await action(body, request);
  } catch (error) {
    console.error("auth", body?.action, error?.message || error);
    return { status: 500, body: { ok: false, error: error?.message === "auth_not_configured" ? "not_configured" : "server" } };
  }
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const result = await handleAuth(body, request);
  const headers = { "cache-control": "no-store" };
  if (result.cookie) headers["set-cookie"] = result.cookie;
  return Response.json(result.body, { status: result.status || 200, headers });
}
