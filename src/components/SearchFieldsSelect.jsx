import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n";

const SEARCH_FIELDS = ["name", "category", "sku", "spec", "supplier", "remarks"];

const FIELD_KEYS = {
  name: "searchFieldName",
  category: "searchFieldCategory",
  sku: "searchFieldSku",
  spec: "searchFieldSpec",
  supplier: "searchFieldSupplier",
  remarks: "searchFieldRemarks",
};

export default function SearchFieldsSelect({ selected, onChange, compact = false, className = "" }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedNames = Array.isArray(selected) ? selected : [];
  const allOn = selectedNames.length === 0 || selectedNames.length === SEARCH_FIELDS.length;

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function isChecked(field) {
    return allOn || selectedNames.includes(field);
  }

  function toggle(field) {
    if (allOn) {
      onChange(SEARCH_FIELDS.filter((item) => item !== field));
      return;
    }
    const next = selectedNames.includes(field)
      ? selectedNames.filter((item) => item !== field)
      : [...selectedNames, field];
    if (next.length === 0 || next.length === SEARCH_FIELDS.length) onChange([]);
    else onChange(next);
  }

  const label = allOn
    ? t("searchAllFields")
    : selectedNames.length === 1
      ? t(FIELD_KEYS[selectedNames[0]])
      : t("searchFieldsSelected", { n: selectedNames.length });

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("searchIn")}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-full min-w-0 items-center justify-between gap-2 border border-line bg-white px-3 text-left text-sm text-ink ${
          compact ? "py-2" : "py-3"
        }`}
      >
        <span className="min-w-0 truncate">
          <span className="text-mute">{t("searchIn")}</span>
          <span className="mx-1 text-mute">·</span>
          <span className="font-medium">{label}</span>
        </span>
        <span className="text-mute shrink-0 text-xs">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 z-40 mt-1 w-56 max-w-[calc(100vw-2rem)] bg-white text-ink border border-line shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">{t("searchIn")}</p>
            <button
              type="button"
              disabled={allOn}
              onClick={() => onChange([])}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-35"
            >
              {t("searchAllFields")}
            </button>
          </div>
          <div className="py-1">
            {SEARCH_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-2 px-3 py-2 hover:bg-paper cursor-pointer">
                <input type="checkbox" checked={isChecked(field)} onChange={() => toggle(field)} />
                <span className="text-sm">{t(FIELD_KEYS[field])}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
