import { handleUpload } from "@vercel/blob/client";

/** SSR polyfill sets globalThis.window in the Vite process; @vercel/blob then refuses to mint a client token. */
async function withoutBrowserGlobals(fn) {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, "document");
  const windowRef = globalThis.window;
  const documentRef = globalThis.document;
  if (hadWindow) {
    try {
      delete globalThis.window;
    } catch {
      globalThis.window = undefined;
    }
  }
  if (hadDocument) {
    try {
      delete globalThis.document;
    } catch {
      globalThis.document = undefined;
    }
  }
  try {
    return await fn();
  } finally {
    if (hadWindow) globalThis.window = windowRef;
    if (hadDocument) globalThis.document = documentRef;
  }
}

export async function handleRfqBlobUpload(body, request) {
  return withoutBrowserGlobals(() =>
    handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const path = String(pathname || "");
        if (path.startsWith("products/")) {
          return {
            allowedContentTypes: ["image/webp", "image/jpeg"],
            addRandomSuffix: true,
            maximumSizeInBytes: 1024 * 1024,
            cacheControlMaxAge: 31536000,
          };
        }
        if (!path.startsWith("rfq/")) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: 20 * 1024 * 1024,
        };
      },
    })
  );
}

export async function POST(request) {
  const body = await request.json();
  try {
    const json = await handleRfqBlobUpload(body, request);
    return Response.json(json);
  } catch (error) {
    console.error("blob-upload", error);
    return Response.json({ error: error?.message || "upload failed" }, { status: 400 });
  }
}
