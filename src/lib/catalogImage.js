export async function uploadCatalogImage(dataUrl, productKey) {
  const res = await fetch("/api/product-image", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dataUrl, productKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.image) {
    const error = new Error(data?.error || "image");
    throw error;
  }
  return { image: data.image, imageFallback: data.imageFallback || "" };
}
