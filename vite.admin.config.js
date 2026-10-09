import { defineConfig } from "vite";
import marketplaceConfig from "./vite.config.js";

export default defineConfig((env) => {
  const cfg = typeof marketplaceConfig === "function" ? marketplaceConfig(env) : marketplaceConfig;
  return {
    ...cfg,
    define: {
      ...cfg.define,
      "import.meta.env.VITE_SURFACE": JSON.stringify("admin"),
    },
    server: {
      ...cfg.server,
      port: 5183,
      host: true,
    },
  };
});
