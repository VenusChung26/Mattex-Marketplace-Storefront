import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import CopyLinkButton from "./CopyLinkButton";
import { useLanguage } from "../i18n";
import { allProductsTo, withLocale } from "../lib/locale";
import { getCategoryDefs } from "../lib/store";

function OpenIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M10 7h7v7" />
    </svg>
  );
}

const iconBtnClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center self-center text-mute hover:text-brand-700 hover:bg-white/70";

export default function CategorySideNav({
  activeSlug = "",
  offsetTop = 88,
  filterMode = false,
  onSelectAll,
  onSelectCategory,
}) {
  const { t, lang } = useLanguage();
  const categories = getCategoryDefs();
  const listRef = useRef(null);
  const allActive = !activeSlug;
  const countKey = categories.map((category) => category.count).join(",");

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const align = () => {
      const current = list.querySelector("[aria-current='page']");
      if (!current) return;
      const listRect = list.getBoundingClientRect();
      const itemRect = current.getBoundingClientRect();
      if (itemRect.height <= 0 || listRect.height <= 0) return;
      const pad = 12;
      if (itemRect.top < listRect.top + pad) {
        list.scrollTop -= listRect.top + pad - itemRect.top;
      } else if (itemRect.bottom > listRect.bottom - pad) {
        list.scrollTop += itemRect.bottom - (listRect.bottom - pad);
      }
    };
    const frame = requestAnimationFrame(align);
    const timer = window.setTimeout(align, 60);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [activeSlug, countKey]);
  const maxHeight = `calc(100dvh - ${offsetTop}px - 12px)`;
  const allProductsPath = withLocale(lang, "/");
  const allProductsHref = allProductsTo(lang);

  const allProductsClass = `flex min-w-0 flex-1 items-center px-3 py-2.5 text-sm font-medium ${
    allActive ? "text-brand-800" : "text-ink"
  }`;

  return (
    <nav
      aria-label={t("categories")}
      className="flex max-h-60 flex-col overflow-hidden lg:sticky lg:max-h-[var(--cat-nav-max)]"
      style={{ top: offsetTop, "--cat-nav-max": maxHeight }}
    >
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-mute mb-2">{t("categories")}</p>
      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border border-line bg-white divide-y divide-line">
        <li className={`flex items-stretch ${allActive ? "bg-brand-50" : "hover:bg-paper"}`}>
          {allActive ? (
            <span aria-current="page" className={allProductsClass}>
              <span className="min-w-0 leading-snug">{t("allProductsTitle")}</span>
            </span>
          ) : filterMode && onSelectAll ? (
            <button type="button" onClick={onSelectAll} className={`${allProductsClass} text-left`}>
              <span className="min-w-0 leading-snug">{t("allProductsTitle")}</span>
            </button>
          ) : (
            <Link to={allProductsHref} className={allProductsClass}>
              <span className="min-w-0 leading-snug">{t("allProductsTitle")}</span>
            </Link>
          )}
          <Link
            to={allProductsHref}
            title={t("openAllProductsPage")}
            aria-label={t("openAllProductsPage")}
            className={iconBtnClass}
          >
            <OpenIcon />
          </Link>
          <CopyLinkButton path={allProductsPath} hash="products" variant="icon" className="self-center mr-1" />
        </li>
        {categories.map((category) => {
          const path = withLocale(lang, `/catalog/${category.id}`);
          const active = activeSlug === category.id;
          const nameClass = `min-w-0 flex-1 px-3 py-2.5 text-sm leading-snug text-left ${
            active ? "font-semibold text-brand-800" : "text-ink"
          }`;
          return (
            <li key={category.id} className={`flex items-stretch ${active ? "bg-brand-50" : "hover:bg-paper"}`}>
              {filterMode && onSelectCategory ? (
                active ? (
                  <span aria-current="page" className={nameClass}>
                    <span className="block">{category.name}</span>
                    <span className="block text-[11px] font-medium text-mute mt-0.5">{category.count}</span>
                  </span>
                ) : (
                  <button type="button" onClick={() => onSelectCategory(category)} className={nameClass}>
                    <span className="block">{category.name}</span>
                    <span className="block text-[11px] font-medium text-mute mt-0.5">{category.count}</span>
                  </button>
                )
              ) : active ? (
                <span aria-current="page" className={nameClass}>
                  <span className="block">{category.name}</span>
                  <span className="block text-[11px] font-medium text-mute mt-0.5">{category.count}</span>
                </span>
              ) : (
                <Link to={path} className={nameClass}>
                    <span className="block">{category.name}</span>
                    <span className="block text-[11px] font-medium text-mute mt-0.5">{category.count}</span>
                  </Link>
              )}
              <Link
                to={path}
                title={t("openCategoryPage")}
                aria-label={t("openCategoryPage")}
                className={iconBtnClass}
              >
                <OpenIcon />
              </Link>
              <CopyLinkButton path={path} variant="icon" className="self-center mr-1" />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
