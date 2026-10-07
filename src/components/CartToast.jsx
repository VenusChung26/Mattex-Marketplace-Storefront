import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";

export default function CartToast({ toast, onDone }) {
  const { t } = useLanguage();
  const [paused, setPaused] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const message = typeof toast === "string" ? toast : toast?.message || "";
  const href = typeof toast === "string" ? "" : toast?.href || "";

  useEffect(() => {
    if (!message || paused) return undefined;
    const timer = setTimeout(() => doneRef.current?.(), 3000);
    return () => clearTimeout(timer);
  }, [message, href, paused]);

  if (!message) return null;

  return (
    <div
      className="fixed bottom-44 right-6 z-50 max-w-sm border border-brand-700 bg-charcoal px-4 py-3 text-sm text-white shadow-lg"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p>{message}</p>
      {href ? (
        <Link to={href} className="mt-2 inline-flex border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white hover:text-charcoal">
          {t("goToCart")}
        </Link>
      ) : null}
    </div>
  );
}
