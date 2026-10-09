import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n";
import { foldHan } from "../lib/han";
import { flattenSuggestOptions, productSku, searchSuggestOptions } from "../lib/searchOptions";

function highlightMatch(text, query) {
  const raw = String(text || "");
  const folded = foldHan(raw).toLowerCase();
  const tokens = foldHan(String(query || "").trim())
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!raw || !tokens.length) return raw;
  const marks = Array(raw.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    while (from < folded.length) {
      const at = folded.indexOf(token, from);
      if (at < 0) break;
      for (let i = at; i < at + token.length && i < marks.length; i += 1) marks[i] = true;
      from = at + Math.max(token.length, 1);
    }
  }
  const parts = [];
  let index = 0;
  while (index < raw.length) {
    const on = marks[index];
    let end = index + 1;
    while (end < raw.length && marks[end] === on) end += 1;
    const slice = raw.slice(index, end);
    parts.push(on ? (
      <mark key={index} className="bg-transparent font-semibold text-brand-800">
        {slice}
      </mark>
    ) : slice);
    index = end;
  }
  return parts;
}

function SuggestMenu({ anchorRef, query, options, activeIndex, onPick, labels }) {
  const menuRef = useRef(null);
  const [box, setBox] = useState(null);
  const items = useMemo(() => flattenSuggestOptions(options), [options]);

  useLayoutEffect(() => {
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const room = window.innerHeight - rect.bottom - 8;
      setBox({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, Math.min(320, room)),
      });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorRef, query, items.length]);

  useEffect(() => {
    const node = menuRef.current?.querySelector(`[data-suggest-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return undefined;
    function onDown(event) {
      const button = event.target.closest("[data-suggest-index]");
      if (!button || !menu.contains(button)) return;
      event.preventDefault();
      const index = Number(button.getAttribute("data-suggest-index"));
      const item = items[index];
      if (item) onPick(item);
    }
    menu.addEventListener("mousedown", onDown);
    return () => menu.removeEventListener("mousedown", onDown);
  }, [items, onPick, box]);

  if (!box || typeof document === "undefined") return null;

  let cursor = 0;
  function row(item, children) {
    const index = cursor;
    cursor += 1;
    const selected = index === activeIndex;
    return (
      <li key={item.id}>
        <button
          type="button"
          role="option"
          data-suggest-index={index}
          aria-selected={selected}
          className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm ${selected ? "bg-brand-50" : "hover:bg-paper"}`}
        >
          {children}
        </button>
      </li>
    );
  }

  const sections = [];
  if (options.words.length) {
    sections.push(
      <li key="words-label" className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-mute">
        {labels.words}
      </li>
    );
    for (const word of options.words) {
      const item = items[cursor];
      sections.push(row(item, <span className="min-w-0 leading-snug">{highlightMatch(word, query)}</span>));
    }
  }
  if (options.categories.length) {
    sections.push(
      <li key="cats-label" className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-mute">
        {labels.categories}
      </li>
    );
    for (const [name, count] of options.categories) {
      const item = items[cursor];
      sections.push(row(item, (
        <>
          <span className="min-w-0 leading-snug">{highlightMatch(name, query)}</span>
          <span className="shrink-0 text-[11px] font-medium text-mute">{count}</span>
        </>
      )));
    }
  }
  if (options.products.length) {
    sections.push(
      <li key="products-label" className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-mute">
        {labels.products}
      </li>
    );
    for (const product of options.products) {
      const item = items[cursor];
      sections.push(row(item, (
        <span className="min-w-0">
          <span className="block leading-snug">{highlightMatch(product.name, query)}</span>
          <span className="mt-0.5 block truncate text-[11px] text-mute">
            {highlightMatch([product.category, productSku(product)].filter(Boolean).join(" · "), query)}
          </span>
        </span>
      )));
    }
  }

  return createPortal(
    <ul
      ref={menuRef}
      role="listbox"
      className="overflow-y-auto border border-line bg-white text-ink shadow-lg"
      style={{ position: "fixed", top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight, zIndex: 80 }}
    >
      {sections.length ? sections : <li className="px-3 py-2 text-sm text-mute">{labels.empty}</li>}
    </ul>,
    document.body
  );
}

export function ProductSearchBox({
  id,
  value,
  onValue,
  onTerm,
  onProduct,
  onSubmit,
  keepOpenOnTerm = false,
  products,
  excludeIds = [],
  placeholder,
  ariaLabel,
  className = "",
  inputClassName = "",
}) {
  const { t } = useLanguage();
  const admin = import.meta.env.VITE_SURFACE === "admin";
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const excludeKey = excludeIds.join("\0");
  const options = useMemo(
    () => searchSuggestOptions(products, value, { excludeIds: excludeKey ? excludeKey.split("\0") : [] }),
    [products, value, excludeKey]
  );
  const items = useMemo(() => flattenSuggestOptions(options), [options]);
  const labels = admin
    ? { words: "Suggestions", categories: "Categories", products: "Products", empty: "No products match." }
    : { words: t("suggestWords"), categories: t("suggestCategories"), products: t("suggestProducts"), empty: t("suggestEmpty") };
  const query = String(value || "");
  const show = open && Boolean(query.trim());

  function pick(item) {
    setActiveIndex(-1);
    if (!item) return;
    if (item.type === "product") {
      setOpen(false);
      onProduct?.(item.product);
      return;
    }
    setOpen(keepOpenOnTerm);
    onTerm?.(item.label);
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        className={inputClassName}
        onChange={(event) => {
          onValue?.(event.target.value);
          setOpen(Boolean(event.target.value.trim()));
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(Boolean(query.trim()))}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && activeIndex >= 0 && items[activeIndex]) {
            event.preventDefault();
            pick(items[activeIndex]);
          } else if (event.key === "Enter" && onSubmit) {
            event.preventDefault();
            setOpen(false);
            onSubmit(query);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show ? (
        <SuggestMenu
          anchorRef={inputRef}
          query={query}
          options={options}
          activeIndex={activeIndex}
          onPick={pick}
          labels={labels}
        />
      ) : null}
    </div>
  );
}

export default function SearchSuggestions(props) {
  return <SuggestMenu {...props} />;
}
