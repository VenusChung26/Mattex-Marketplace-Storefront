import * as XLSX from "xlsx";

const EXCEL = /\.(xlsx|xls|csv)$/i;
const WORD = /\.docx$/i;
const PDF = /\.pdf$/i;
const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

function kindFromName(name, type) {
  const label = String(name || "");
  const mime = String(type || "");
  if (mime.startsWith("image/") || IMAGE.test(label)) return "image";
  if (mime === "application/pdf" || PDF.test(label)) return "pdf";
  if (mime.includes("sheet") || mime.includes("excel") || EXCEL.test(label)) return "excel";
  if (mime.includes("wordprocessingml") || WORD.test(label)) return "word";
  return "file";
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function inflateRaw(data) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  if (typeof DecompressionStream !== "undefined") {
    const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { inflateRawSync } = await import("node:zlib");
  return inflateRawSync(copy);
}

async function zipEntryText(buffer, wanted) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (name === wanted && compSize > 0 && dataStart + compSize <= bytes.length) {
      const data = bytes.subarray(dataStart, dataStart + compSize);
      const raw = method === 0 ? data : method === 8 ? await inflateRaw(data) : null;
      return raw ? new TextDecoder().decode(raw) : "";
    }
    if (!compSize) break;
    offset = dataStart + compSize;
  }
  return "";
}

function wordParagraphs(xml) {
  return String(xml || "")
    .split(/<w:p\b/)
    .map((part) =>
      [...part.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((match) => decodeXml(match[1]))
        .join("")
        .trim()
    )
    .filter(Boolean);
}

function excelSheets(bytes) {
  const book = XLSX.read(bytes, { type: "array" });
  return book.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: false, defval: "" });
    return {
      name,
      rows: rows
        .slice(0, 200)
        .map((row) => (Array.isArray(row) ? row.slice(0, 12).map((cell) => String(cell ?? "")) : [])),
    };
  });
}

async function bytesOf(source) {
  if (source?.file) return new Uint8Array(await source.file.arrayBuffer());
  const url = String(source?.url || "");
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error("fetch");
  return new Uint8Array(await response.arrayBuffer());
}

export async function buildPreview(source) {
  const name = String(source?.name || "file");
  const url = String(source?.url || "");
  const kind = kindFromName(name, source?.type);
  const preview = { name, url, kind, sheets: [], paragraphs: [], readable: false };
  if (kind === "image" || kind === "pdf") {
    preview.readable = Boolean(url);
    return preview;
  }
  if (kind !== "excel" && kind !== "word") return preview;
  try {
    const bytes = await bytesOf(source);
    if (!bytes) return preview;
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    if (kind === "excel") {
      preview.sheets = excelSheets(new Uint8Array(copy));
      preview.readable = preview.sheets.some((sheet) => sheet.rows.some((row) => row.some(Boolean)));
      return preview;
    }
    const xml = await zipEntryText(copy, "word/document.xml");
    preview.paragraphs = wordParagraphs(xml);
    preview.readable = preview.paragraphs.length > 0;
    return preview;
  } catch {
    return preview;
  }
}

export async function downloadFile(url, filename) {
  const name = String(filename || "download");
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("fetch");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
