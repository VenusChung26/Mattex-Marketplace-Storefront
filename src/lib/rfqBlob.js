import { upload } from "@vercel/blob/client";
import { absUrl, publicOrigin } from "./locale.js";

const HANDLE_URL = "/api/blob-upload";
export const WA_TEXT_MAX = 1400;

function safeSegment(value) {
  return String(value || "rfq")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "rfq";
}

function dataUrlToFile(dataUrl, filename) {
  const [meta, data] = String(dataUrl).split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] || "image/jpeg";
  const binary = atob(data || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const name = filename.includes(".") ? filename : `${filename}.${ext}`;
  return new File([bytes], name, { type: mime });
}

export function catalogImageUrl(src) {
  const value = String(src || "").trim();
  if (!value || value.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return absUrl(publicOrigin(), value.startsWith("/") ? value : `/${value}`);
}

async function uploadRfqFile(pathname, file) {
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: HANDLE_URL,
    multipart: true,
  });
  return blob.url;
}

export async function uploadProductImage(dataUrl, productKey) {
  const file = dataUrlToFile(dataUrl, "photo");
  return uploadRfqFile(`products/${safeSegment(productKey || "new")}/${file.name}`, file);
}

export async function uploadRfqPdf(file, refNo) {
  const name = file?.name || "list.pdf";
  return uploadRfqFile(`rfq/${safeSegment(refNo)}/${name}`, file);
}

export async function uploadRfqDataImage(dataUrl, refNo, index) {
  const file = dataUrlToFile(dataUrl, `product-${index + 1}`);
  return uploadRfqFile(`rfq/${safeSegment(refNo)}/img-${index + 1}-${file.name}`, file);
}

export async function collectProductImageUrls(rows, refNo) {
  const urls = [];
  const list = Array.isArray(rows) ? rows : [];
  for (let i = 0; i < list.length; i += 1) {
    const src = String(list[i]?.image || "").trim();
    if (!src) continue;
    if (src.startsWith("data:")) {
      try {
        urls.push(await uploadRfqDataImage(src, refNo, i));
      } catch {
        /* skip custom photo if blob upload fails */
      }
      continue;
    }
    const publicUrl = catalogImageUrl(src);
    if (publicUrl) urls.push(publicUrl);
  }
  const seen = new Set();
  return urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export async function collectAttachmentUrls(rows, refNo) {
  const urls = [];
  const list = Array.isArray(rows) ? rows : [];
  let index = 0;
  for (const line of list) {
    for (const file of Array.isArray(line?.attachments) ? line.attachments : []) {
      const src = String(file?.url || "").trim();
      if (!src) continue;
      if (src.startsWith("data:")) {
        try {
          const name = String(file?.name || `attachment-${index + 1}`).replace(/[^\w.-]+/g, "-") || `attachment-${index + 1}`;
          urls.push(await uploadRfqFile(`rfq/${safeSegment(refNo)}/att-${index + 1}-${name}`, dataUrlToFile(src, name)));
        } catch {
          /* skip attachment if blob upload fails */
        }
        index += 1;
        continue;
      }
      if (/^https?:\/\//i.test(src)) urls.push(src);
      index += 1;
    }
  }
  const seen = new Set();
  return urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export function fitWhatsappUrls(baseText, imageUrls, heading = "產品圖片：") {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  const used = [];
  let text = baseText;
  for (const url of urls) {
    const next = used.length
      ? `${text}\n${used.length + 1}. ${url}`
      : `${text}\n\n${heading}\n1. ${url}`;
    if (next.length > WA_TEXT_MAX) break;
    text = next;
    used.push(url);
  }
  return { text, imageUrls: used };
}
