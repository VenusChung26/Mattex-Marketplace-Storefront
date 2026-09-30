import { useEffect, useState } from "react";
import { getCatalogEtag } from "../lib/store";
import { useLanguage } from "../i18n";

export default function CatalogUpdateBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        const res = await fetch("/api/catalog-version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const next = String(data?.etag || "seed");
        const current = getCatalogEtag() || "seed";
        if (!stop) setVisible(next !== "seed" && next !== current);
      } catch {
        /* keep the current page */
      }
    }
    check();
    const timer = window.setInterval(check, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
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
