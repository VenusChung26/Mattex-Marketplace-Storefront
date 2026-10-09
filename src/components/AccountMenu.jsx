import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logoutUser } from "../lib/store";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";

export default function AccountMenu({ user, light = false }) {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const triggerClass = light
    ? "hidden lg:inline-flex items-center gap-1.5 bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
    : "inline-flex items-center gap-1.5 bg-brand-600 px-3 sm:px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700";

  if (!user) {
    return (
      <Link to={withLocale(lang, "/login")} className={triggerClass}>
        {t("login")}
      </Link>
    );
  }

  return (
    <div className={light ? "relative hidden lg:block" : "relative"} ref={ref}>
      <button
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="max-w-[8rem] truncate">{user.name}</span>
        <span className="text-[10px] opacity-80" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 bg-white border border-line shadow-[0_12px_28px_rgba(16,21,19,0.18)] z-50 py-1"
        >
          <Link
            role="menuitem"
            to={withLocale(lang, "/login")}
            className="block w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-brand-50 hover:text-brand-700"
            onClick={() => setOpen(false)}
          >
            {t("profile")}
          </Link>
          <button
            role="menuitem"
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-brand-50 hover:text-brand-700"
            onClick={() => {
              setOpen(false);
              logoutUser();
              navigate(withLocale(lang, "/"));
            }}
          >
            {t("logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
