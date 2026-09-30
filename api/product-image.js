import { put } from "@vercel/blob";
import { readSession } from "./auth.js";

function safeSegment(value) {
  return String(value || "product").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "product";
}

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/webp);base64,([a-z0-9+/=\s]+)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!bytes.length || bytes.length > 900 * 1024) return null;
  return bytes;
}

export async function handleProductImage(body, request) {
  const staff = readSession(request, "staff");
  if (!staff) return { status: 401, body: { ok: false, error: "auth" } };
  const bytes = decodeDataUrl(body?.dataUrl);
  if (!bytes) return { status: 400, body: { ok: false, error: "image" } };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { status: 503, body: { ok: false, error: "blob" } };

  const key = safeSegment(body?.productKey);
  try {
    const blob = await put(`products/${key}/${Date.now()}.webp`, bytes, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: true,
    });
    if (!blob?.url) return { status: 400, body: { ok: false, error: "blob" } };
    return { status: 200, body: { ok: true, image: blob.url } };
  } catch {
    return { status: 400, body: { ok: false, error: "blob" } };
  }
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const result = await handleProductImage(body, request);
  return Response.json(result.body, { status: result.status || 200, headers: { "cache-control": "no-store" } });
}
