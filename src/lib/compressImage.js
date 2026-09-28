export const PRODUCT_IMAGE_MAX = 5;
export const PRODUCT_IMAGE_MAX_SIDE = 1600;
export const PRODUCT_IMAGE_MAX_BYTES = 800 * 1024;

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.floor((base64.length * 3) / 4);
}

export function productImageList(product) {
  const extras = Array.isArray(product?.images) ? product.images : [];
  const primary = String(product?.image || "").trim();
  const list = [primary, ...extras].map((src) => String(src || "").trim()).filter(Boolean);
  return [...new Set(list)].slice(0, PRODUCT_IMAGE_MAX);
}

export function compressImageFile(file, { maxBytes = PRODUCT_IMAGE_MAX_BYTES, maxSide = PRODUCT_IMAGE_MAX_SIDE } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("bad_image"));
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("bad_image"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.86;
      let dataUrl = canvas.toDataURL("image/webp", quality);
      if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", quality);
      const mime = dataUrl.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
      while (dataUrlBytes(dataUrl) > maxBytes && quality > 0.4) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL(mime, quality);
      }
      if (dataUrlBytes(dataUrl) > maxBytes) reject(new Error("too_large"));
      else resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("bad_image"));
    };
    img.src = objectUrl;
  });
}
