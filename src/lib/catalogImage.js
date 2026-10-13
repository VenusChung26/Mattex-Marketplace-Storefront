import { uploadProductImage } from "./remote.js";

export async function uploadCatalogImage(dataUrl, productKey) {
  return uploadProductImage(dataUrl, productKey);
}
