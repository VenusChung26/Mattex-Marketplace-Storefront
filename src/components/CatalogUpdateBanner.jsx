import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { blockProductOrders, fetchProductLive, getCatalogEtag, getStoreSnapshot, subscribeStore } from "../lib/store";
import { useLanguage } from "../i18n";

function productIdFromPath(pathname) {
  const match = String(pathname || "").match(/^\/(?:en|zh)\/details\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function CatalogUpdateBanner() {
  const { t } = useLanguage();
  const location = useLocation();
  const [mode, setMode] = useState("");

  useEffect(() => {
    let stop = false;
    async function check() {
      if (!getStoreSnapshot().catalogReady) return;
      const current = String(getCatalogEtag() || "seed");
      if (current === "seed") return;
      try {
        const res = await fetch("/api/catalog-version", { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = await res.json();
        const next = String(data?.etag || "seed");
        const changed = next !== "seed" && next !== current;
        const productId = productIdFromPath(location.pathname);
        if (changed && productId) {
          const live = await fetchProductLive(productId);
          if (stop) return;
          if (!live) {
            blockProductOrders(productId);
            setMode("offline");
            return;
          }
        }
        if (!stop) setMode(changed ? "updated" : "");
      } catch {
        /* keep the current page */
      }
    }
    check();
    const unsub = subscribeStore(check);
    const timer = window.setInterval(check, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      unsub();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [location.pathname]);

  if (!mode) return null;
  const offline = mode === "offline";
  return (
    <div className={offline ? "sticky top-0 z-[60] bg-[#8a2b2b] text-white" : "sticky top-0 z-[60] bg-charcoal text-white"}>
      <div className="flex w-full items-center justify-between gap-4 px-4 py-4 text-base font-semibold">
        <p>{offline ? t("catalogOffline") : t("catalogUpdated")}</p>
        <button type="button" className="btn-primary shrink-0 !px-4 !py-2 !text-sm" onClick={() => window.location.reload()}>
          {t("catalogReload")}
        </button>
      </div>
    </div>
  );
}
