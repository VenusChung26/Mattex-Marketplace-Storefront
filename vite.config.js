import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { handleRfqBlobUpload } from "./api/blob-upload.js";
import { handleSharedStoreGet, handleSharedStorePost } from "./api/shared-store.js";
import { handleTmsLogin, handleTmsStatus, handleTmsSubmit } from "./api/tms-submit.js";
import { handleSendEmail } from "./api/send-email.js";
import { handleAuth } from "./api/auth.js";
import { handleData } from "./api/data.js";
import { GET as handleCatalogRequest, handleCatalogCommit, handleCatalogGet, handleCatalogVersion } from "./api/catalog-snapshot.js";
import { handleProductImage } from "./api/product-image.js";
import { handleSpecMatch, handleSpecMatchStatus } from "./api/spec-match.js";
import { handlePromoGet, handlePromoSave } from "./api/promo.js";
import { handleCatalogGroupsGet, handleCatalogGroupsSave } from "./api/catalog-groups.js";

const GA_MEASUREMENT_ID = "G-F89GE7J3CR";

function marketplaceGaHtmlPlugin() {
  let surface = "marketplace";
  return {
    name: "marketplace-ga4-html",
    configResolved(config) {
      const raw = config.define?.["import.meta.env.VITE_SURFACE"];
      if (typeof raw === "string") {
        try {
          surface = JSON.parse(raw);
        } catch {
          surface = raw.replace(/^"|"$/g, "");
        }
      }
    },
    transformIndexHtml(html) {
      if (surface === "admin") return html;
      if (html.includes("googletagmanager.com/gtag/js")) return html;
      const snippet = `<!-- Google tag (gtag.js) -->
    <script async id="ga-gtag-js" src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      if (!/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)) {
        gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
      }
    </script>`;
      return html.replace("</head>", `    ${snippet}\n  </head>`);
    },
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  return { raw, body: JSON.parse(raw) };
}

function localRequest(req, path) {
  return new Request(`http://${req.headers.host || "localhost:5178"}${path}`, {
    method: "POST",
    headers: { cookie: String(req.headers.cookie || "") },
  });
}

function jsonPlugin() {
  return {
    name: "subbie-local-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = String(req.url || "").split("?")[0];
        if (path === "/api/tms-status" && req.method === "GET") {
          const json = await handleTmsStatus();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(json));
          return;
        }
        if (path === "/api/shared-store" && req.method === "GET") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(handleSharedStoreGet()));
          return;
        }
        if (path === "/api/catalog-snapshot" && req.method === "GET") {
          const request = new Request(`http://${req.headers.host || "localhost"}${req.url || ""}`);
          const result = await handleCatalogRequest(request);
          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(await result.text());
          return;
        }
        if (path === "/api/catalog-version" && req.method === "GET") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(await handleCatalogVersion()));
          return;
        }
        if (path === "/api/catalog" && req.method === "GET") {
          const snapshot = await handleCatalogGet();
          res.setHeader("Content-Type", "application/json");
          if (!snapshot) {
            res.statusCode = 404;
            res.end(JSON.stringify({ etag: "seed" }));
            return;
          }
          res.statusCode = 200;
          res.end(JSON.stringify(snapshot));
          return;
        }
        if (path === "/api/spec-match" && req.method === "GET") {
          const result = await handleSpecMatchStatus(localRequest(req, path));
          res.statusCode = result.status || 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result.body));
          return;
        }
        if ((path === "/api/auth" || path === "/api/data") && req.method === "POST") {
          let authBody = {};
          try {
            ({ body: authBody } = await readJsonBody(req));
          } catch {
            authBody = {};
          }
          const handler = path === "/api/auth" ? handleAuth : handleData;
          const result = await handler(authBody, localRequest(req, path));
          res.statusCode = result.status || 200;
          res.setHeader("Content-Type", "application/json");
          if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
          res.end(JSON.stringify(result.body));
          return;
        }
        if (path === "/api/send-email" && req.method === "POST") {
          let mailBody = {};
          try {
            ({ body: mailBody } = await readJsonBody(req));
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "invalid json" }));
            return;
          }
          const json = await handleSendEmail(mailBody, localRequest(req, path));
          res.statusCode = json.ok ? 200 : 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(json));
          return;
        }
        if (path === "/api/shared-store" && req.method === "POST") {
          let body = {};
          try {
            ({ body } = await readJsonBody(req));
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "invalid json" }));
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(handleSharedStorePost(body)));
          return;
        }
        if (path === "/api/promo" && req.method === "GET") {
          const result = await handlePromoGet();
          res.statusCode = result.status || 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(result.body));
          return;
        }
        if (path === "/api/catalog-groups" && req.method === "GET") {
          const result = await handleCatalogGroupsGet();
          res.statusCode = result.status || 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(result.body));
          return;
        }
        if (path === "/api/catalog-groups" && req.method === "POST") {
          let posted = {};
          try {
            ({ body: posted } = await readJsonBody(req));
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "invalid json" }));
            return;
          }
          const result = await handleCatalogGroupsSave(posted, localRequest(req, path));
          res.statusCode = result.status || 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(result.body));
          return;
        }
        if (path === "/api/promo" && req.method === "POST") {
          let posted = {};
          try {
            ({ body: posted } = await readJsonBody(req));
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "invalid json" }));
            return;
          }
          const result = await handlePromoSave(posted, localRequest(req, path));
          res.statusCode = result.status || 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(result.body));
          return;
        }
        if ((path === "/api/catalog/commit" || path === "/api/product-image" || path === "/api/spec-match") && req.method === "POST") {
          let posted = {};
          try {
            ({ body: posted } = await readJsonBody(req));
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "invalid json" }));
            return;
          }
          const request = localRequest(req, path);
          const result = path === "/api/catalog/commit"
            ? await handleCatalogCommit(posted, request)
            : path === "/api/product-image"
              ? await handleProductImage(posted, request)
              : await handleSpecMatch(posted, request);
          res.statusCode = result.status || 200;
          res.setHeader("Content-Type", "application/json");
          if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
          res.end(JSON.stringify(result.body));
          return;
        }
        const isBlob = path === "/api/blob-upload" && req.method === "POST";
        const isTms = path === "/api/tms-submit" && req.method === "POST";
        const isTmsLogin = path === "/api/tms-login" && req.method === "POST";
        if (!isBlob && !isTms && !isTmsLogin) {
          next();
          return;
        }
        let raw = "{}";
        let body = {};
        try {
          ({ raw, body } = await readJsonBody(req));
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "invalid json" }));
          return;
        }
        try {
          if (isBlob) {
            const request = new Request(`http://${req.headers.host || "localhost:5178"}/api/blob-upload`, {
              method: "POST",
              headers: { "content-type": "application/json", ...(req.headers.host ? { host: req.headers.host } : {}) },
              body: raw,
            });
            const json = await handleRfqBlobUpload(body, request);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(json));
            return;
          }
          const json = isTmsLogin ? await handleTmsLogin(body) : await handleTmsSubmit(body);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(json));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error?.message || "request failed" }));
        }
      });
    },
  };
}

function publicSsrHtmlPlugin() {
  let surface = "marketplace";
  let catalogReady;
  return {
    name: "mattex-public-ssr-html",
    configResolved(config) {
      const raw = config.define?.["import.meta.env.VITE_SURFACE"];
      if (typeof raw === "string") {
        try {
          surface = JSON.parse(raw);
        } catch {
          surface = raw.replace(/^"|"$/g, "");
        }
      }
    },
    transformIndexHtml: {
      order: "post",
      async handler(html, ctx) {
        if (surface === "admin") return html;
        if (!ctx.server) return html;
        const url = String(ctx.originalUrl || ctx.path || "/").split("?")[0];
        await import("./src/lib/ssrNodePolyfill.js");
        const { hydrateStore } = await import("./src/lib/store.js");
        const { injectPublicDocument } = await import("./src/lib/ssrHtml.js");
        if (!catalogReady) catalogReady = hydrateStore();
        await catalogReady;
        return injectPublicDocument(html, url);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN;
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("TMS_") || key.startsWith("RESEND_") || key === "SUPABASE_SERVICE_ROLE_KEY" || key === "SESSION_SECRET" || key === "OPENAI_API_KEY" || key === "SPEC_MATCH_API_KEY" || key === "LOCAL_STAFF_EMAIL" || key === "LOCAL_STAFF_PASSWORD") {
      process.env[key] = value;
    }
  }
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const supabaseAnon =
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  if (supabaseUrl) process.env.VITE_SUPABASE_URL = supabaseUrl;
  if (supabaseAnon) process.env.VITE_SUPABASE_ANON_KEY = supabaseAnon;
  const gaMeasurementId =
    process.env.VITE_GA_MEASUREMENT_ID || env.VITE_GA_MEASUREMENT_ID || GA_MEASUREMENT_ID;
  const marketplaceOrigin =
    process.env.VITE_MARKETPLACE_ORIGIN ||
    env.VITE_MARKETPLACE_ORIGIN ||
    (mode === "production" ? "" : "http://localhost:5178");
  const adminOrigin =
    process.env.VITE_ADMIN_ORIGIN ||
    env.VITE_ADMIN_ORIGIN ||
    (mode === "production" ? "" : "http://localhost:5179");
  return {
    plugins: [react(), jsonPlugin(), marketplaceGaHtmlPlugin(), publicSsrHtmlPlugin()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnon),
      "import.meta.env.VITE_SURFACE": JSON.stringify("marketplace"),
      "import.meta.env.VITE_MARKETPLACE_ORIGIN": JSON.stringify(marketplaceOrigin),
      "import.meta.env.VITE_ADMIN_ORIGIN": JSON.stringify(adminOrigin),
      "import.meta.env.VITE_GA_MEASUREMENT_ID": JSON.stringify(gaMeasurementId),
    },
    server: {
      port: 5178,
      host: true,
      strictPort: true,
    },
  };
});
