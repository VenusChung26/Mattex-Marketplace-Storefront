import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { canDirectBuy, catalogPathForCategory, displayLeadTime, getProduct, isBuyerVisible, isHitProduct, productSkuId, stockStatusKey, supplierDisplayName, supplierPath, addCustomLine, requireBuyerAuth } from "../lib/store";
import { groupOf, useCatalogGroups } from "../lib/catalogGroups";
import { usePromo } from "../lib/promo";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import ProductPrice from "./ProductPrice";
import ProductRating from "./ProductRating";
import CustomProductModal from "./CustomProductModal";

export function FallbackImage({ src, fallback = "", alt = "", ...rest }) {
  const [current, setCurrent] = useState(src);
  useEffect(() => {
    setCurrent(src);
  }, [src]);
  return (
    <img
      {...rest}
      src={current}
      alt={alt}
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback);
      }}
    />
  );
}

function LeavesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

function TickIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg viewBox="0 0 16 16" className={`${className} shrink-0`} fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.8 8.2 7 10.3 11.3 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function shopLeadTime(product) {
  return displayLeadTime(product) || "—";
}

const ACTION_BTN =
  "w-full min-h-[2.5rem] !px-2 !py-2 !text-xs leading-tight text-center whitespace-normal";

const TAG_PILL =
  "inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 tracking-[0.08em] uppercase";

function EmptyImage({ compact }) {
  const { t } = useLanguage();
  return (
    <span className={`flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[#f3f5f4] text-mute ${compact ? "min-h-[4.5rem]" : "min-h-[12rem]"}`}>
      <svg viewBox="0 0 24 24" className={compact ? "h-5 w-5" : "h-8 w-8"} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m8 13 2.2-2.2a1 1 0 0 1 1.4 0L15 14" strokeLinecap="round" />
        <path d="m14 13 1.2-1.2a1 1 0 0 1 1.4 0L19 14" strokeLinecap="round" />
        <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span className={compact ? "text-[9px] font-medium" : "text-xs font-medium"}>{t("noProductImage")}</span>
    </span>
  );
}

export function ProductImage({ src, alt, fallback = "", className = "", imgClassName = "", compact = false }) {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setCurrent(src);
    setFailed(false);
  }, [src]);
  const show = Boolean(String(current || "").trim()) && !failed;
  return (
    <span className={`relative block overflow-hidden bg-[#f3f5f4] ${className}`}>
      {show ? (
        <img
          src={current}
          alt={alt}
          className={imgClassName}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onError={() => {
            if (fallback && current !== fallback) {
              setCurrent(fallback);
              return;
            }
            setFailed(true);
          }}
        />
      ) : (
        <EmptyImage compact={compact} />
      )}
      {show ? (
        <span
          className={`absolute bottom-0 inset-x-0 pointer-events-none bg-charcoal/75 text-white text-center ${
            compact ? "text-[8px] leading-tight px-1 py-0.5" : "text-[10px] px-1.5 py-1"
          }`}
        >
          {t("imageForReference")}
        </span>
      ) : null}
    </span>
  );
}

export function ProductCardSkeleton({ compact = false, count = 6 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="product-tile catalog-skeleton overflow-hidden" aria-hidden>
          <div className={`bg-[#e6ebe8] ${compact ? "aspect-[5/4]" : "aspect-[4/3]"}`} />
          <div className={`space-y-2 ${compact ? "p-3" : "p-4"}`}>
            <div className="h-2.5 w-1/3 rounded bg-[#e6ebe8]" />
            <div className="h-4 w-4/5 rounded bg-[#e6ebe8]" />
            <div className="h-3 w-1/2 rounded bg-[#e6ebe8]" />
            <div className="mt-3 h-8 w-full rounded bg-[#e6ebe8]" />
          </div>
        </div>
      ))}
    </>
  );
}

function TagLink({ to, title, className, children }) {
  return (
    <Link to={to} title={title} className={className} onClick={(event) => event.stopPropagation()}>
      {children}
    </Link>
  );
}

export function ProductTagPills({ product, className = "" }) {
  const { t, lang } = useLanguage();
  const hit = isHitProduct(product);
  if (!product?.green && !hit && !product?.tailorMade) return null;
  const home = withLocale(lang, "/");
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {hit ? (
        <TagLink to={`${home}#top`} title={t("topLabelHint")} className={`${TAG_PILL} bg-charcoal text-white`}>{t("hitBadge")}</TagLink>
      ) : null}
      {product.green ? (
        <TagLink to={`${home}#green`} title={t("greenLabelHint")} className={`${TAG_PILL} bg-[#1f8a45] text-white`}>
          <LeavesIcon />
          {t("greenBadge")}
        </TagLink>
      ) : null}
      {product.tailorMade ? (
        <TagLink to={`${home}#custom`} title={t("tailorLabelHint")} className={`${TAG_PILL} bg-brand-700 text-white`}>
          <TickIcon className="h-3 w-3" />
          {t("tailorMadeBadge")}
        </TagLink>
      ) : null}
    </span>
  );
}

const META_CHIP = "inline-flex items-center whitespace-nowrap bg-paper text-[10px] px-1.5 py-0.5";

export function ProductMetaChips({ product, className = "", showTags = false }) {
  const { t } = useLanguage();
  const stockKey = stockStatusKey(product.stockStatus);
  const inStock = product.stockStatus === "in_stock";
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <span
        className={`${META_CHIP} font-semibold ${
          inStock ? "bg-brand-50 text-brand-800" : "text-ink"
        }`}
      >
        {t(stockKey)}
      </span>
      <span className={`${META_CHIP} font-medium text-mute`}>
        {t("moq")} {product.moq} {product.unit}
      </span>
      <span className={`${META_CHIP} font-medium text-mute`}>
        {shopLeadTime(product)}
      </span>
      {showTags ? <ProductTagPills product={product} /> : null}
    </div>
  );
}

export function ProductBadges({ product, rank = null }) {
  const { t, lang } = useLanguage();
  const hit = isHitProduct(product);
  const showRank = rank != null;
  if (!product?.green && !hit && !showRank && !product?.tailorMade) return null;
  const home = withLocale(lang, "/");
  return (
    <div className="absolute top-2.5 right-2.5 z-10 flex flex-wrap items-start justify-end gap-1">
      {showRank ? (
        <span className="bg-charcoal/90 text-white text-[11px] font-bold px-2 py-1">#{rank}</span>
      ) : hit ? (
        <TagLink to={`${home}#top`} title={t("topLabelHint")} className="bg-charcoal/90 text-white text-[10px] font-bold px-2 py-1 tracking-[0.08em]">
          {t("hitBadge")}
        </TagLink>
      ) : null}
      {product.green ? (
        <TagLink to={`${home}#green`} title={t("greenLabelHint")} className="inline-flex items-center gap-1 bg-[#1f8a45] text-white text-[10px] font-bold px-2 py-1 tracking-[0.08em]">
          <LeavesIcon />
          {t("greenBadge")}
        </TagLink>
      ) : null}
      {product.tailorMade ? (
        <TagLink to={`${home}#custom`} title={t("tailorLabelHint")} className="inline-flex items-center gap-1 bg-brand-700 text-white text-[10px] font-bold px-2 py-1 tracking-[0.08em]">
          <TickIcon className="h-3 w-3" />
          {t("tailorMadeBadge")}
        </TagLink>
      ) : null}
    </div>
  );
}

function cartLineFor(draft, productId) {
  return (draft?.lines || []).find((line) => String(line.productId) === String(productId) && !line.custom) || null;
}

function clampQty(value, min) {
  const n = Math.floor(Number(value));
  return Math.max(min, Number.isFinite(n) ? n : min);
}

export function QtyStepper({ value, min = 1, unit = "", onChange, size = "card", t }) {
  const compact = size === "card" || size === "row" || size === "bar";
  const stretch = size !== "bar";
  const [draft, setDraft] = useState(String(value));
  const [underMin, setUnderMin] = useState(() => Number(value) < min);
  const atMin = value <= min;
  const btn = compact
    ? "h-8 w-8 shrink-0 text-base leading-none text-brand-800 hover:bg-brand-50 disabled:text-mute disabled:hover:bg-transparent disabled:opacity-40"
    : "h-10 w-10 shrink-0 text-lg leading-none text-brand-800 hover:bg-brand-50 disabled:text-mute disabled:hover:bg-transparent disabled:opacity-40";
  const valueBox = compact ? "h-8 min-w-[2.5rem] text-sm" : "h-10 min-w-[2.75rem] text-base";

  useEffect(() => {
    setDraft(String(value));
    setUnderMin(Number(value) < min);
  }, [value, min]);

  function parseDraft(raw) {
    const n = Math.floor(Number(String(raw).replace(/[^\d]/g, "")));
    return Number.isFinite(n) ? n : NaN;
  }

  function commit(raw) {
    const n = parseDraft(raw);
    if (String(raw).trim() === "" || !Number.isFinite(n)) {
      setUnderMin(true);
      onChange(min);
      setDraft(String(min));
      return;
    }
    if (n < min) {
      setUnderMin(true);
      onChange(n);
      setDraft(String(n));
      return;
    }
    setUnderMin(false);
    onChange(n);
    setDraft(String(n));
  }

  function handleInput(raw) {
    const cleaned = String(raw).replace(/[^\d]/g, "");
    setDraft(cleaned);
    if (cleaned === "") {
      setUnderMin(true);
      onChange(0);
      return;
    }
    const n = parseDraft(cleaned);
    if (!Number.isFinite(n)) return;
    setUnderMin(n < min);
    onChange(n);
  }

  return (
    <div className={stretch ? "w-full min-w-0" : "w-fit max-w-full"}>
      <div
        className={`flex items-stretch overflow-hidden rounded-md border bg-white ${
          stretch ? "w-full" : "w-fit max-w-full"
        } ${underMin ? "border-amber-400" : "border-line"}`}
      >
        <span
          className={`flex shrink-0 items-center border-r px-2.5 font-medium text-mute ${
            underMin ? "border-amber-200" : "border-line"
          } ${compact ? "text-[11px]" : "text-xs"}`}
        >
          {t("qty")}
        </span>
        <button
          type="button"
          className={btn}
          aria-label="−"
          disabled={atMin}
          onClick={() => {
            setUnderMin(false);
            onChange(clampQty(value - 1, min));
          }}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("qty")}
          value={draft}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={`${valueBox} bg-transparent px-1 text-center font-semibold tabular-nums text-ink outline-none ${
            stretch ? "min-w-0 flex-1" : "w-12 shrink-0"
          }`}
        />
        <button
          type="button"
          className={btn}
          aria-label="+"
          onClick={() => {
            setUnderMin(false);
            onChange(clampQty(value + 1, min));
          }}
        >
          +
        </button>
        {unit ? (
          <span
            className={`flex shrink-0 items-center border-l px-2.5 text-mute ${
              underMin ? "border-amber-200" : "border-line"
            } ${compact ? "text-sm font-semibold text-ink" : "text-base font-semibold text-ink"}`}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {underMin ? (
        <p className={`mt-1 text-amber-800 ${compact ? "text-[10px] leading-snug" : "text-[11px]"}`} role="alert">
          {t("qtyUnderMin", { n: `${min} ${unit}`.trim() })}
        </p>
      ) : size === "detail" ? (
        <p className="mt-1 text-[11px] text-mute">{t("qtyMinMoq", { n: `${min} ${unit}`.trim() })}</p>
      ) : null}
    </div>
  );
}

function tailorInitialFromProduct(product, qty) {
  const bits = [
    product.sizeDesc || product.description || "",
    productSkuId(product) ? `Base SKU: ${productSkuId(product)}` : "",
    product.certifications || product.standard
      ? `Cert: ${product.certifications || product.standard}`
      : "",
  ].filter(Boolean);
  return {
    name: product.name || "",
    description: bits.join("\n"),
    qty: Math.max(1, Number(qty) || Number(product.moq) || 1),
    image: product.image || "",
    category: product.category || "",
    attachments: [],
  };
}

export function ProductActions({ product, onAdd, size = "card", qty: qtyProp, onQtyChange, hideQty = false, autoOpenTailor = false, disabled = false }) {
  const { t } = useLanguage();
  usePromo();
  const { draft } = useStore();
  const minQty = Math.max(1, Number(product.moq) || 1);
  const [innerQty, setInnerQty] = useState(minQty);
  const controlled = qtyProp != null && typeof onQtyChange === "function";
  const qty = controlled ? qtyProp : innerQty;
  const priced = canDirectBuy(product);
  const line = cartLineFor(draft, product.id);
  const count = line?.qty || 0;
  const [tailorOpen, setTailorOpen] = useState(false);
  const [tailorNote, setTailorNote] = useState("");
  const [tailorInitial, setTailorInitial] = useState(null);

  useEffect(() => {
    if (!controlled) setInnerQty(minQty);
  }, [product.id, minQty, controlled]);

  useEffect(() => {
    if (!autoOpenTailor || !product?.tailorMade) return;
    setTailorInitial(tailorInitialFromProduct(product, qty));
    setTailorOpen(true);
  }, [autoOpenTailor, product?.id, product?.tailorMade]);

  function setQty(next) {
    const n = Math.floor(Number(next));
    const resolved = Number.isFinite(n) ? Math.max(0, n) : minQty;
    if (controlled) onQtyChange(resolved);
    else setInnerQty(resolved);
  }

  function fire(intent) {
    if (disabled || qty < minQty) return;
    const guestCartOk = intent === "quote-now" || intent === "buy-now" || intent === "quote" || intent === "buy";
    if (!guestCartOk && !requireBuyerAuth({ productId: product.id, intent, qty })) return;
    onAdd?.(product.id, intent, qty);
  }

  function openTailor() {
    if (!requireBuyerAuth({ tailorFrom: product.id })) return;
    setTailorInitial(tailorInitialFromProduct(product, qty));
    setTailorOpen(true);
  }

  function submitTailor(payload) {
    const result = addCustomLine({
      ...payload,
      tailorMade: true,
      baseProductId: product.id,
      baseProductNo: product.productNo || "",
    });
    if (!result.ok) return;
    setTailorNote(t("addedTailorToRfq"));
    window.setTimeout(() => setTailorNote(""), 2800);
  }

  const cartIntent = priced ? "buy" : "quote";
  const inBuy = line?.intent === "buy";
  const inQuote = line?.intent === "quote";
  const addLabel = (priced ? inBuy : inQuote) && count > 0
    ? t("addedCount", { n: count })
    : t("addToCart");
  const compactBtn = size !== "detail";
  const primaryClass = compactBtn ? `btn-primary ${ACTION_BTN}` : "btn-primary !px-5 !py-3 !text-sm w-full";
  const softClass = compactBtn
    ? `btn-soft !border-brand-600/50 !text-brand-700 ${ACTION_BTN}`
    : "btn-soft !border-brand-600/50 !text-brand-700 !px-5 !py-3 !text-sm w-full";
  const addClass = `${softClass} ${count > 0 ? "btn-added" : ""}`;

  const stepper = hideQty ? null : (
    <QtyStepper value={qty} min={minQty} unit={product.unit} onChange={setQty} size={size} t={t} />
  );

  const primaryBtn = (
    <button
      type="button"
      className={`${primaryClass} disabled:opacity-40`}
      disabled={disabled}
      onClick={() => fire(priced ? "buy-now" : "quote-now")}
    >
      {priced ? t("buyNowAction") : t("requestNow")}
    </button>
  );
  const addBtn = (
    <button type="button" className={`${addClass} disabled:opacity-40`} disabled={disabled} onClick={() => fire(cartIntent)}>
      {addLabel}
    </button>
  );

  const textLinkClass = `font-semibold leading-snug text-brand-700 hover:text-brand-800 hover:underline disabled:opacity-40 ${
    compactBtn ? "text-[11px]" : "text-xs"
  }`;
  function column(control, hint, extra) {
    return (
      <div className="min-w-0 space-y-1 text-center">
        <div className="group/act">
          <p className="buy-now-hint">{hint}</p>
          {control}
        </div>
        {extra}
      </div>
    );
  }
  function textAction(label, hint, intent) {
    return (
      <div className="group/act">
        <p className="buy-now-hint">{hint}</p>
        <button type="button" className={textLinkClass} disabled={disabled} onClick={() => fire(intent)}>
          {label}
        </button>
      </div>
    );
  }

  const actionColumns = (
    <div className="grid grid-cols-2 items-start gap-2">
      {column(
        primaryBtn,
        priced ? t("buyNowWhatsappHint") : t("quoteNowWhatsappHint"),
        priced ? textAction(t("orRequestNow"), t("quoteNowWhatsappHint"), "quote-now") : null,
      )}
      {column(
        addBtn,
        priced ? t("cartBuyHint") : t("cartQuoteHint"),
        priced ? textAction(t("addToQuoteRequest"), t("cartQuoteHint"), "quote") : null,
      )}
    </div>
  );

  const showTailorCta = Boolean(product.tailorMade);
  const tailorBtn = showTailorCta ? (
    <button
      type="button"
      className={
        size === "detail"
          ? "btn-primary mt-3 w-full !py-2.5 !text-sm"
          : `${softClass} ${compactBtn ? "col-span-2" : "w-full"}`
      }
      onClick={openTailor}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        <TickIcon className="h-3.5 w-3.5" />
        {t("tailorMadeCta")}
      </span>
    </button>
  ) : null;

  const tailorPanel =
    size === "detail" && showTailorCta ? (
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-brand-800">
          <TickIcon className="h-3.5 w-3.5" />
          {t("tailorMadeBadge")}
        </p>
        <p className="mt-1 text-sm text-mute">{t("tailorMadeHint", { name: product.name })}</p>
        {tailorBtn}
      </div>
    ) : null;

  const buttons = (
    <div className={size === "detail" ? "space-y-2" : "space-y-1.5"}>
      {actionColumns}
      {size !== "detail" && size !== "bar" ? tailorBtn : null}
      {size === "bar" && tailorBtn ? <div className="grid grid-cols-1">{tailorBtn}</div> : null}
      {tailorNote ? <p className="text-[11px] font-medium text-brand-700">{tailorNote}</p> : null}
    </div>
  );

  const modal = (
    <CustomProductModal
      open={tailorOpen}
      baseProduct={product}
      initial={tailorInitial || tailorInitialFromProduct(product, qty)}
      onClose={() => setTailorOpen(false)}
      onSubmit={submitTailor}
    />
  );

  if (size === "bar") {
    return (
      <div className="space-y-2">
        {stepper}
        {actionColumns}
        {tailorBtn}
        {tailorNote ? <p className="text-[11px] font-medium text-brand-700">{tailorNote}</p> : null}
        {modal}
      </div>
    );
  }

  return (
    <div className={size === "detail" ? "space-y-3" : "space-y-2"}>
      {tailorPanel}
      {stepper}
      {buttons}
      {modal}
    </div>
  );
}

function useSelectedVariant(product, grouped) {
  useCatalogGroups();
  const group = grouped ? groupOf(product?.id) : null;
  const members = (group?.members || [])
    .map((member) => ({ ...member, product: getProduct(member.productId) }))
    .filter((member) => member.product && isBuyerVisible(member.product));
  const [selectedId, setSelectedId] = useState(product?.id || "");

  useEffect(() => {
    setSelectedId(product?.id || "");
  }, [product?.id]);

  const selected = members.find((member) => member.productId === selectedId)?.product || product;
  return { selected: selected || product, members, selectedId, setSelectedId };
}

function VariantChips({ members, selectedId, onSelect, moreHref, moreLabel }) {
  if (members.length < 2) return null;
  const overflow = members.length > 3;
  const selected = members.find((member) => member.productId === selectedId) || members[0];
  const rest = overflow ? members.filter((member) => member.productId !== selected.productId) : [];
  const visible = overflow ? [selected, rest[0]].filter(Boolean) : members;
  const chipClass = (on) =>
    `rounded-full border px-2.5 py-1 text-xs ${
      on ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-line bg-white text-ink hover:border-brand-400"
    }`;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visible.map((member) => {
        const on = member.productId === selectedId;
        return (
          <button key={member.productId} type="button" aria-pressed={on} onClick={() => onSelect(member.productId)} className={chipClass(on)}>
            {member.option}
          </button>
        );
      })}
      {overflow ? (
        <Link to={moreHref} className={chipClass(false)}>
          {moreLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ProductListRow({ product, onAdd, grouped = false }) {
  const { t, lang } = useLanguage();
  const { selected, members, selectedId, setSelectedId } = useSelectedVariant(product, grouped);
  const label = selected.name;

  return (
    <article className="relative flex min-w-0 max-w-full flex-col gap-3 border border-line bg-white p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 gap-3 sm:contents">
        <Link
          to={withLocale(lang, `/details/${selected.id}`)}
          className="h-16 w-16 shrink-0 overflow-hidden bg-brand-50 sm:w-24"
        >
          <ProductImage
            src={selected.image}
            fallback={selected.imageFallback}
            alt={label}
            compact
            className="h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">
            <Link
              to={withLocale(lang, catalogPathForCategory(selected.category))}
              className="hover:text-brand-800 hover:underline"
            >
              {selected.category}
            </Link>
          </p>
          <h3 className="mt-0.5 break-words text-sm font-semibold leading-snug text-ink sm:text-base">
            <Link to={withLocale(lang, `/details/${selected.id}`)} className="hover:text-brand-600">
              {label}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-xs text-mute">
            {t("productNo")} {productSkuId(selected) || selected.id}
            {selected.supplier ? ` · ${t("by")} ${supplierDisplayName(selected.supplier)}` : ""}
          </p>
          <div className="mt-1 sm:hidden">
            <ProductPrice product={selected} className="!mt-0" />
          </div>
          <VariantChips
            members={members}
            selectedId={selectedId}
            onSelect={setSelectedId}
            moreHref={withLocale(lang, `/details/${selected.id}`)}
            moreLabel={t("moreOptions", { n: Math.max(members.length - 2, 0) })}
          />
          <ProductMetaChips product={selected} showTags className="mt-1.5" />
        </div>
      </div>
      <div className="hidden shrink-0 sm:block sm:w-32">
        <ProductPrice product={selected} className="!mt-0" />
      </div>
      <div className="min-w-0 sm:w-72 sm:shrink-0">
        <ProductActions product={selected} onAdd={onAdd} size="row" />
      </div>
    </article>
  );
}

export default function ProductCard({ product, onAdd, rank = null, compact = false, grouped = false }) {
  const { t, lang } = useLanguage();
  const { selected, members, selectedId, setSelectedId } = useSelectedVariant(product, grouped);
  const supplierName = supplierDisplayName(selected.supplier);
  const label = selected.name;

  return (
    <article className="product-tile relative flex h-full min-w-0 max-w-full flex-col overflow-visible">
      <ProductBadges product={selected} rank={selected.id === product.id ? rank : null} />
      <Link
        to={withLocale(lang, `/details/${selected.id}`)}
        className="block h-40 overflow-hidden bg-brand-50 lg:aspect-[3/2] lg:h-auto"
      >
        <ProductImage
          src={selected.image}
          fallback={selected.imageFallback}
          alt={label}
          className="h-full w-full"
          imgClassName="w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-[1.04]"
        />
      </Link>
      <div className={`flex flex-col flex-1 ${compact ? "p-3" : "p-3.5"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">
          <Link
            to={withLocale(lang, catalogPathForCategory(selected.category))}
            className="hover:text-brand-800 hover:underline"
          >
            {selected.category}
          </Link>
        </p>
        <h3 className={`mt-1 font-semibold text-ink leading-snug line-clamp-3 ${compact ? "text-sm" : "text-base"}`}>
          <Link to={withLocale(lang, `/details/${selected.id}`)} className="hover:text-brand-600 transition-colors">
            {label}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-mute truncate">
          {t("by")}{" "}
          {selected.supplier ? (
            <Link to={withLocale(lang, supplierPath(selected.supplier))} className="hover:text-brand-600 hover:underline">
              {supplierName}
            </Link>
          ) : (
            t("subbiePartner")
          )}
        </p>
        <ProductRating product={selected} className="mt-1" />
        <VariantChips
          members={members}
          selectedId={selectedId}
          onSelect={setSelectedId}
          moreHref={withLocale(lang, `/details/${selected.id}`)}
          moreLabel={t("moreOptions", { n: Math.max(members.length - 2, 0) })}
        />
        <ProductMetaChips product={selected} className="mt-2.5" />
        <div className="mt-auto pt-4">
          <ProductPrice product={selected} className="!mt-0" />
          <div className="mt-3">
            <ProductActions product={selected} onAdd={onAdd} size="card" />
          </div>
        </div>
      </div>
    </article>
  );
}
