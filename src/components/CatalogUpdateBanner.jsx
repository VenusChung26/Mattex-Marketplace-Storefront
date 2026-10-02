import { useEffect, useState } from "react";
import { getCatalogEtag, getStoreSnapshot, subscribeStore } from "../lib/store";
import { useLanguage } from "../i18n";

export default function CatalogUpdateBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stop = false;
    async function check() {
      if (!getStoreSnapshot().catalogReady) return;
      const current = String(getCatalogEtag() || "seed");
      if (current === "seed") return;
      try {
        const res = await fetch("/api/catalog-version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const next = String(data?.etag || "seed");
        if (!stop) setVisible(next !== "seed" && next !== current);
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
  }, []);

  if (!visible) return null;
  return (
    <div className="sticky top-0 z-50 bg-charcoal text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <p>{t("catalogUpdated")}</p>
        <button type="button" className="btn-primary !px-3 !py-1.5 !text-xs" onClick={() => window.location.reload()}>
          {t("catalogReload")}
        </button>
      </div>
    </div>
  );
}
