/**
 * PROTOTYPE — Variant A: mix-and-match supplier offers per RFQ line.
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { formatPrice, buildSupplierMetrics, getSupplier, supplierSlug, getProduct } from "../../lib/store";
import { scrollLeftSoon, scrollNodeIntoView } from "../../lib/scrollInto";
import { useLanguage } from "../../i18n";

function metricsForSupplier(name) {
  return getSupplier(name)?.metrics || buildSupplierMetrics(supplierSlug(name));
}

function MiniStars({ value }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex shrink-0 items-center gap-px text-[9px] leading-none" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? "text-mute" : "text-line"}>
          ★
        </span>
      ))}
    </span>
  );
}

function SupplierQuoteStats({ name, paymentTerms, leadDays }) {
  const { t } = useLanguage();
  const metrics = metricsForSupplier(name);
  return (
    <div className="mt-2 font-normal border-t border-line/80 pt-2 space-y-1.5">
      <dl className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-[11px] text-mute">{t("quoteLeadShort")}</dt>
          <dd className="text-xs font-semibold tabular-nums text-ink">
            {t("quoteLeadValue", { days: leadDays })}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-[11px] text-mute shrink-0">{t("paymentTerms")}</dt>
          <dd className="text-xs font-semibold text-ink text-right truncate" title={paymentTerms}>
            {paymentTerms}
          </dd>
        </div>
      </dl>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums text-mute">
        <span className="inline-flex items-center gap-0.5">
          {metrics.rating.toFixed(1)}
          <MiniStars value={metrics.rating} />
          <span>{t("metricRatingShort")}</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          {metrics.completionRate}% {t("metricCompletionShort")}
        </span>
        <span aria-hidden>·</span>
        <span>
          {metrics.onTimeRate}% {t("metricOnTimeShort")}
        </span>
      </p>
    </div>
  );
}

function AcceptedBanner({ acceptance, onReset, onGoToPo, historicalPreview = false }) {
  if (!acceptance) return null;
  const mixed = acceptance.mode === "mixed";
  return (
    <div className="mb-5 border border-brand-600 bg-brand-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Submitted selection</p>
        <p className="text-sm font-semibold text-brand-800">
          {acceptance.label} · {formatPrice(acceptance.total)}
        </p>
        <p className="text-xs text-mute mt-0.5">
          {mixed
            ? `${acceptance.lines?.length || 0} lines from ${acceptance.supplierNames?.length || 0} suppliers`
            : "Full quote from one supplier"}
          {" · "}
          Continue to Purchase Order to confirm and create a PO. Payment and delivery are not required in this phase.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onGoToPo ? (
          <button
            type="button"
            className="btn-primary !px-3 !py-2 text-sm disabled:opacity-40"
            disabled={historicalPreview}
            onClick={onGoToPo}
          >
            Purchase Order
          </button>
        ) : null}
        <button type="button" className="btn-soft !px-3 !py-2 text-sm" onClick={onReset}>
          Undo submit
        </button>
      </div>
    </div>
  );
}

function lineQuoteFlags(req, quotes, picks) {
  const picked = Boolean(picks[req.productId]);
  const quotedBy = [];
  let quoted = false;
  let hasAlt = false;
  quotes.forEach((quote) => {
    const line = quote.lines.find((l) => l.productId === req.productId);
    if (!line) return;
    quoted = true;
    quotedBy.push(quote.supplierName || quote.supplier);
    if (line.isAlternate || line.isSet) hasAlt = true;
  });
  return { picked, quoted, hasAlt, quotedBy };
}

function lineMatchesBase(req, quotes, picks, filters) {
  const q = String(filters.query || "").trim().toLowerCase();
  if (q) {
    const hay = [
      req.requestName,
      `l${req.lineNo}`,
      req.productId,
      req.productNo,
      req.category,
      req.supplier,
      req.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.category && req.category !== filters.category) return false;
  if (filters.green && !req.green) return false;
  if (filters.custom && !req.custom) return false;
  if (filters.listed === "yes" && req.unitPrice == null) return false;
  if (filters.listed === "no" && req.unitPrice != null) return false;
  if (filters.supplier) {
    const { quotedBy } = lineQuoteFlags(req, quotes, picks);
    if (!quotedBy.includes(filters.supplier)) return false;
  }
  return true;
}

function lineMatchesStatus(req, quotes, picks, status) {
  if (!status || status === "all") return true;
  const { picked, quoted, hasAlt } = lineQuoteFlags(req, quotes, picks);
  if (status === "unpicked") return !picked;
  if (status === "picked") return picked;
  if (status === "noquote") return !quoted;
  if (status === "alternate") return hasAlt;
  return true;
}

function lineMatchesFilter(req, quotes, picks, filters) {
  return lineMatchesBase(req, quotes, picks, filters) && lineMatchesStatus(req, quotes, picks, filters.status);
}

function money(n) {
  return Math.round(Number(n) * 100) / 100;
}

function qtyKey(quoteId, productId) {
  return `${quoteId}::${productId}`;
}

function selectedIndexesForSet(line, quoteId, setPartPicks) {
  const parts = line?.setParts || [];
  if (!parts.length) return [];
  const stored = setPartPicks?.[qtyKey(quoteId, line.productId)];
  if (!Array.isArray(stored)) return [];
  return stored.filter((i) => i >= 0 && i < parts.length);
}

function catalogCopy(line) {
  const product = line?.custom ? null : getProduct(line?.productId);
  return {
    name: line?.name || product?.name || line?.requestName || "",
    description: String(line?.description || product?.description || "").trim(),
    productNo: line?.productNo || product?.productNo || "",
    green: Boolean(line?.green || product?.green),
  };
}

function GreenOfferTag({ t }) {
  return (
    <span className="inline-flex items-center gap-0.5 bg-[#1f8a45] text-white text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 shrink-0">
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3 shrink-0"
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
      {t("greenBadge")}
    </span>
  );
}

function resolveOffer(line, quoteId, qtyEdits, setPartPicks = {}) {
  if (!line) return null;
  const copy = catalogCopy(line);
  const quotedQty = line.qty;
  const moq = Math.max(1, Number(line.moq) || 1);
  const raw = qtyEdits?.[qtyKey(quoteId, line.productId)];
  const parsed = Math.floor(Number(raw));
  const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : quotedQty;
  if (line.isSet && line.setParts?.length) {
    const selectedPartIndexes = selectedIndexesForSet(line, quoteId, setPartPicks);
    const lineTotal = money(
      line.setParts.reduce(
        (sum, part, i) => (selectedPartIndexes.includes(i) ? sum + Number(part.lineTotal || 0) : sum),
        0
      )
    );
    return {
      ...line,
      ...copy,
      qty: quotedQty,
      lineTotal,
      qtyChanged: false,
      quotedQty,
      moq,
      selectedPartIndexes,
    };
  }
  let lineTotal = line.lineTotal;
  if (line.unitPrice != null) lineTotal = money(line.unitPrice * qty);
  else if (quotedQty) lineTotal = money(line.lineTotal * (qty / quotedQty));
  return {
    ...line,
    ...copy,
    qty,
    lineTotal,
    qtyChanged: qty !== quotedQty,
    qtyBelowMoq: qty < moq,
    quotedQty,
    moq,
  };
}

export function buildAcceptanceFromPicks(rfq, quotes, picks, qtyEdits = {}, setPartPicks = {}) {
  const lines = [];
  let total = 0;
  const supplierNames = [];
  rfq.lines.forEach((req) => {
    const quoteId = picks[req.productId];
    if (!quoteId) return;
    const quote = quotes.find((q) => q.id === quoteId);
    const offer = resolveOffer(
      quote?.lines.find((l) => l.productId === req.productId),
      quoteId,
      qtyEdits,
      setPartPicks
    );
    if (!quote || !offer) return;
    lines.push({
      productId: req.productId,
      requestName: req.name,
      quoteId,
      supplierName: quote.supplierName,
      offer,
      lineTotal: offer.lineTotal,
    });
    total += offer.lineTotal;
    if (!supplierNames.includes(quote.supplierName)) supplierNames.push(quote.supplierName);
  });
  const uniqueQuotes = new Set(lines.map((l) => l.quoteId));
  const mode = uniqueQuotes.size <= 1 ? "full" : "mixed";
  const onlyQuoteId = uniqueQuotes.size === 1 ? [...uniqueQuotes][0] : null;
  return {
    mode,
    quoteId: onlyQuoteId,
    picks: { ...picks },
    lines,
    total: Math.round(total * 100) / 100,
    supplierNames,
    label:
      mode === "full" ? supplierNames[0] || "Quote" : `Mixed · ${supplierNames.length} suppliers`,
  };
}

function ProductImageLightbox({ src, alt, onClose, t }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-charcoal/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("zoomImage")}
        className="relative max-w-3xl w-full"
      >
        <button
          type="button"
          className="absolute -top-2 -right-2 z-10 h-8 w-8 rounded-full bg-white border border-line text-ink hover:bg-paper"
          onClick={onClose}
          aria-label={t("closeZoom")}
        >
          ×
        </button>
        <img
          src={src}
          alt={alt || ""}
          className="w-full max-h-[80vh] object-contain bg-white border border-line"
        />
      </div>
    </div>
  );
}

function OfferCard({
  offered,
  isPicked,
  isLineLowest,
  locked,
  selectMode = "radio",
  onPick,
  onQtyChange,
  onRestoreQty,
  onZoomImage,
  t,
  showQtyEditor = true,
}) {
  const isCheckbox = selectMode === "checkbox";
  const isDifferent = Boolean(offered.isAlternate || offered.optional || offered.name !== offered.requestName);

  return (
    <div
      className={`w-full text-left rounded-lg px-2 py-2 transition-colors border ${
        isPicked
          ? "border-brand-600 bg-brand-50"
          : "border-line bg-white hover:border-brand-600/40"
      } ${locked ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          disabled={locked}
          onClick={onPick}
          className={`mt-1 inline-flex h-3.5 w-3.5 border shrink-0 ${
            isCheckbox ? "rounded-sm" : "rounded-full"
          } ${isPicked ? "border-brand-600 bg-brand-600" : "border-line bg-white"}`}
          aria-label={isCheckbox ? t("setPartInclude") : "Select this offer"}
        />
        <button
          type="button"
          className={`w-12 h-12 shrink-0 border border-line bg-brand-50 overflow-hidden flex items-center justify-center ${
            offered.image ? "cursor-zoom-in hover:border-brand-600" : "cursor-pointer"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (offered.image) {
              onZoomImage?.({ src: offered.image, alt: offered.name });
              return;
            }
            if (!locked) onPick();
          }}
          aria-label={offered.image ? t("zoomImage") : "Select this offer"}
        >
          {offered.image ? (
            <img src={offered.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[8px] font-bold uppercase text-brand-700 px-0.5 text-center">SKU</span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" disabled={locked} onClick={onPick} className="w-full text-left disabled:cursor-default">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className="text-sm font-semibold text-brand-800 leading-snug line-clamp-2 break-words"
                title={offered.name}
              >
                {offered.name}
              </span>
              {offered.green ? <GreenOfferTag t={t} /> : null}
            </span>
            {isDifferent ? (
              <span className="mt-1 inline-flex items-center bg-amber-100 text-amber-900 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5">
                {offered.optional ? t("setPartOptional") : t("alternateProduct")}
              </span>
            ) : null}
            <span
              className={`mt-1.5 block text-sm font-bold tabular-nums ${
                isPicked || isLineLowest ? "text-brand-700" : "text-brand-800"
              }`}
            >
              {formatPrice(offered.lineTotal)}
              {isLineLowest ? (
                <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-brand-600">
                  Low
                </span>
              ) : null}
            </span>
            {offered.description ? (
              <span
                className="mt-0.5 block text-[11px] font-normal text-mute leading-snug line-clamp-3 break-words"
                title={offered.description}
              >
                {offered.description}
              </span>
            ) : null}
            {offered.productNo ? (
              <span className="mt-0.5 block text-[10px] font-normal text-mute tabular-nums">
                {t("productNo")} {offered.productNo}
              </span>
            ) : null}
          </button>
          {isDifferent && !offered.optional ? (
            <p className="mt-1 text-[10px] leading-snug text-amber-800">{t("differentProductNotice")}</p>
          ) : null}
          {showQtyEditor ? (
            <>
              <p className="mt-1 text-[10px] text-mute tabular-nums">
                {t("moq")} {offered.moq}
                {offered.unitPrice != null ? ` · ${formatPrice(offered.unitPrice)}` : ""}
              </p>
              <label className="mt-1.5 flex items-center gap-1 text-[10px] text-mute" onClick={(e) => e.stopPropagation()}>
                {t("qty")}
                <input
                  type="number"
                  min={1}
                  disabled={locked}
                  value={offered.qty}
                  onChange={(e) => onQtyChange?.(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className={`w-14 border px-1.5 py-1 text-xs text-ink bg-white ${
                    offered.qtyBelowMoq ? "border-amber-600" : "border-line"
                  }`}
                />
              </label>
              {offered.qtyBelowMoq ? (
                <div className="mt-1.5 text-[10px] leading-snug text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-1.5">
                  <p>{t("qtyBelowMoq", { n: offered.moq })}</p>
                  <button
                    type="button"
                    className="mt-1 font-semibold text-brand-700 hover:text-brand-800"
                    disabled={locked}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestoreQty?.();
                    }}
                  >
                    {t("restoreOriginalQty", { n: offered.quotedQty })}
                  </button>
                </div>
              ) : offered.qtyChanged ? (
                <div className="mt-1">
                  <p className="text-[10px] leading-snug text-brand-700">{t("qtyPendingSupplier")}</p>
                  <button
                    type="button"
                    className="mt-0.5 text-[10px] font-semibold text-brand-700 hover:text-brand-800"
                    disabled={locked}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestoreQty?.();
                    }}
                  >
                    {t("restoreOriginalQty", { n: offered.quotedQty })}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-[10px] text-mute tabular-nums">
              {t("qty")} {offered.qty}
              {offered.unitPrice != null ? ` · ${t("setPartUnit")} ${formatPrice(offered.unitPrice)}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactCell({
  offered,
  isPicked,
  isLineLowest,
  locked,
  onPick,
  onQtyChange,
  onRestoreQty,
  onZoomImage,
  onTogglePart,
  onSelectAllParts,
  onSelectNoneParts,
  highlighted,
  t,
}) {
  const focusCls = highlighted ? " ring-2 ring-inset ring-brand-600" : "";
  if (!offered) {
    return (
      <td className={`px-3 py-3 text-center text-mute text-sm border-b border-line bg-paper/40${focusCls}`}>—</td>
    );
  }

  if (offered.isSet && offered.setParts?.length) {
    const partCount = offered.setParts.length;
    const selectedCount = offered.selectedPartIndexes?.length ?? partCount;
    return (
      <td
        className={`relative px-2 py-2.5 border-b border-line align-top ${
          isPicked ? "bg-brand-50/60" : "bg-white"
        }${focusCls}`}
      >
        <div
          className={`rounded-lg border px-2 py-2 ${
            isPicked ? "border-brand-600 bg-brand-50/80" : "border-line bg-paper/50"
          }`}
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={onPick}
              className={`mt-1 inline-flex h-3.5 w-3.5 rounded-full border shrink-0 ${
                isPicked ? "border-brand-600 bg-brand-600" : "border-line bg-white"
              }`}
              aria-label="Select this offer"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold tabular-nums ${isPicked || isLineLowest ? "text-brand-700" : "text-brand-800"}`}>
                {formatPrice(offered.lineTotal)}
                {isLineLowest ? (
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-brand-600">Low</span>
                ) : null}
              </p>
              <p className="mt-1 inline-flex items-center bg-amber-100 text-amber-900 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5">
                {t("setGroupTitle")} · {selectedCount}/{partCount}
              </p>
              <p className="mt-1 text-[10px] text-mute leading-snug">{t("setOptionalHint")}</p>
              {locked ? null : (
                <div className="mt-1 flex flex-wrap gap-2">
                  <button type="button" className="text-[10px] font-semibold text-brand-700" onClick={onSelectAllParts}>
                    {t("setSelectAll")}
                  </button>
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-mute hover:text-brand-700"
                    onClick={onSelectNoneParts}
                  >
                    {t("setSelectNone")}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {offered.setParts.map((part, index) => {
              const partOffer = {
                ...part,
                requestName: part.name,
                isAlternate: Boolean(part.optional),
                optional: Boolean(part.optional),
                moq: part.moq || 1,
                quotedQty: part.quotedQty ?? part.qty,
              };
              const partOn = offered.selectedPartIndexes?.includes(index);
              return (
                <OfferCard
                  key={part.id || `${offered.productId}-${index}`}
                  offered={partOffer}
                  isPicked={Boolean(partOn)}
                  isLineLowest={false}
                  locked={locked}
                  selectMode="checkbox"
                  showQtyEditor={false}
                  t={t}
                  onPick={() => onTogglePart?.(index)}
                  onZoomImage={onZoomImage}
                />
              );
            })}
          </div>
        </div>
      </td>
    );
  }

  return (
    <td
      className={`relative px-2 py-2.5 border-b border-line align-top ${
        isPicked ? "bg-brand-50" : "bg-white"
      }${focusCls}`}
    >
      <OfferCard
        offered={offered}
        isPicked={isPicked}
        isLineLowest={isLineLowest}
        locked={locked}
        selectMode="radio"
        showQtyEditor
        t={t}
        onPick={onPick}
        onQtyChange={onQtyChange}
        onRestoreQty={onRestoreQty}
        onZoomImage={onZoomImage}
      />
    </td>
  );
}

function InlineDetailRow({ req, offered, supplierName, colSpan }) {
  if (!req || !offered || offered.isSet) return null;

  return (
    <tr className="bg-paper/70">
      <td
        colSpan={colSpan}
        className="px-4 py-3 border-b border-line border-t border-t-brand-600/30"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 max-w-4xl">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-600">
              L{req.lineNo} · {supplierName}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-brand-800">{req.requestName}</p>
            <p className="mt-1 text-xs text-mute">
              Product: {offered.name}
              {" · "}
              Qty {offered.qty} · Unit price {formatPrice(offered.unitPrice)}
            </p>
          </div>
          <p className="text-lg font-bold text-brand-700 tabular-nums shrink-0">
            {formatPrice(offered.lineTotal)}
          </p>
        </div>
      </td>
    </tr>
  );
}

function ProductOfferBlock({ line, requestName, quote, isLowest, locked, t, onTogglePart, onSelectAllParts, onSelectNoneParts }) {
  if (!line) {
    return <p className="mt-1 text-xs font-semibold text-mute">Not quoted for this item</p>;
  }

  if (line.isSet && line.setParts?.length) {
    return (
      <>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center bg-brand-600 text-white text-[10px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5">
            Set · {line.setParts.length} SKUs
          </span>
          {isLowest ? (
            <span className="text-[10px] font-semibold text-brand-700 uppercase tracking-wide">
              Lowest for this item
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-mute">
          Buyer asked 1 item · supplier returned a set · Lead {quote.leadDays}d · Full quote{" "}
          {formatPrice(quote.total)} ({quote.coveredCount}/{quote.requestCount} lines)
        </p>
        <div className="mt-2 space-y-2">
          {line.setParts.map((part, index) => {
            const partOffer = {
              ...part,
              requestName: part.name,
              isAlternate: Boolean(part.optional),
              optional: Boolean(part.optional),
              moq: part.moq || 1,
            };
            return (
              <OfferCard
                key={part.id || index}
                offered={partOffer}
                isPicked={Boolean(line.selectedPartIndexes?.includes(index))}
                isLineLowest={false}
                locked={locked}
                selectMode="checkbox"
                showQtyEditor={false}
                t={t}
                onPick={() => onTogglePart?.(index)}
              />
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      {line.name !== requestName ? (
        <p className="mt-1 text-xs text-mute line-clamp-2 break-words" title={line.name}>
          Their SKU: {line.name}
        </p>
      ) : (
        <p className="mt-1 text-xs text-mute">Same name as RFQ</p>
      )}
      <p className="mt-1 text-xs text-mute">
        Qty {line.qty} · Unit price {formatPrice(line.unitPrice)} · Lead {quote.leadDays}d · Full quote{" "}
        {formatPrice(quote.total)} ({quote.coveredCount}/{quote.requestCount} lines)
      </p>
    </>
  );
}

export default function VariantA({ rfq, quotes, acceptance, onAccept, onSupplierAcceptSelection, onGoToPo, onReset, focusQuoteId, focusTick = 0, historicalPreview = false }) {
  const { t } = useLanguage();
  const locked = Boolean(acceptance) || historicalPreview;
  const [matchMode, setMatchMode] = useState("supplier");
  const [reviewQuoteId, setReviewQuoteId] = useState(null);
  const [qtyEdits, setQtyEdits] = useState({});
  const [setPartPicks, setSetPartPicks] = useState({});
  const [zoomImage, setZoomImage] = useState(null);
  const [productQuery, setProductQuery] = useState("");
  const [productStatus, setProductStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterGreen, setFilterGreen] = useState(false);
  const [filterCustom, setFilterCustom] = useState(false);
  const [filterListed, setFilterListed] = useState("");
  const requestLines = useMemo(
    () =>
      (rfq.lines || []).map((l, i) => {
        const product = l.custom ? null : getProduct(l.productId);
        return {
          productId: l.productId,
          requestName: l.name,
          qty: l.qty,
          lineNo: i + 1,
          unitPrice: l.unitPrice,
          requestedUnitPrice: l.requestedUnitPrice,
          productNo: l.productNo || product?.productNo || "",
          category: l.category || product?.category || "",
          supplier: l.supplier || product?.supplier || "",
          description: l.description || product?.description || "",
          green: Boolean(l.green || product?.green),
          custom: Boolean(l.custom),
        };
      }),
    [rfq.lines]
  );
  const filterState = {
    query: productQuery,
    status: productStatus,
    category: filterCategory,
    supplier: filterSupplier,
    green: filterGreen,
    custom: filterCustom,
    listed: filterListed,
  };
  const [focusProductId, setFocusProductId] = useState(requestLines[0]?.productId || null);
  const focusLine = requestLines.find((l) => l.productId === focusProductId) || requestLines[0];
  const [picks, setPicks] = useState(() => acceptance?.picks || {});
  const [detailProductId, setDetailProductId] = useState(requestLines[0]?.productId || null);

  const categories = useMemo(
    () => [...new Set(requestLines.map((l) => l.category).filter(Boolean))].sort(),
    [requestLines]
  );
  const quotingSuppliers = useMemo(
    () => [...new Set(quotes.map((q) => q.supplierName || q.supplier).filter(Boolean))],
    [quotes]
  );
  const hasGreen = requestLines.some((l) => l.green);
  const hasCustom = requestLines.some((l) => l.custom);
  const hasListedMix = requestLines.some((l) => l.unitPrice != null) && requestLines.some((l) => l.unitPrice == null);

  const visibleLines = useMemo(
    () => requestLines.filter((req) => lineMatchesFilter(req, quotes, picks, filterState)),
    [requestLines, quotes, picks, productQuery, productStatus, filterCategory, filterSupplier, filterGreen, filterCustom, filterListed]
  );

  const statusCounts = useMemo(() => {
    const base = requestLines.filter((req) =>
      lineMatchesBase(req, quotes, picks, { ...filterState, status: "all" })
    );
    const count = (status) => base.filter((req) => lineMatchesStatus(req, quotes, picks, status)).length;
    return {
      all: base.length,
      unpicked: count("unpicked"),
      picked: count("picked"),
      noquote: count("noquote"),
      alternate: count("alternate"),
    };
  }, [requestLines, quotes, picks, productQuery, filterCategory, filterSupplier, filterGreen, filterCustom, filterListed]);

  const filtersActive =
    Boolean(productQuery) ||
    productStatus !== "all" ||
    Boolean(filterCategory) ||
    Boolean(filterSupplier) ||
    filterGreen ||
    filterCustom ||
    Boolean(filterListed);

  function clearProductFilters() {
    setProductQuery("");
    setProductStatus("all");
    setFilterCategory("");
    setFilterSupplier("");
    setFilterGreen(false);
    setFilterCustom(false);
    setFilterListed("");
  }

  useEffect(() => {
    if (!visibleLines.length) return;
    if (!visibleLines.some((l) => l.productId === focusProductId)) {
      setFocusProductId(visibleLines[0].productId);
    }
  }, [visibleLines, focusProductId]);

  useEffect(() => {
    if (acceptance?.picks) setPicks(acceptance.picks);
  }, [acceptance]);

  useEffect(() => {
    if (focusQuoteId) {
      setMatchMode("supplier");
      setReviewQuoteId(focusQuoteId);
      return;
    }
    setReviewQuoteId(null);
  }, [focusQuoteId]);

  useEffect(() => {
    if (matchMode !== "supplier" || !reviewQuoteId) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const table = document.getElementById("quote-compare-table");
        const col = document.getElementById(`quote-col-${reviewQuoteId}`);
        scrollNodeIntoView(table, { block: "start" });
        if (table && col) {
          const left = col.offsetLeft - table.clientWidth / 2 + col.offsetWidth / 2;
          scrollLeftSoon(table, Math.max(0, left));
        }
      });
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [matchMode, reviewQuoteId, focusTick]);

  function clearSetPartsForProduct(productId, keepQuoteId = null) {
    setSetPartPicks((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((key) => {
        if (!key.endsWith(`::${productId}`)) return;
        if (keepQuoteId && key === qtyKey(keepQuoteId, productId)) return;
        delete next[key];
        changed = true;
      });
      return changed ? next : prev;
    });
  }

  function pickLine(productId, quoteId) {
    if (locked) return;
    setPicks((prev) => ({ ...prev, [productId]: quoteId }));
    setDetailProductId(productId);
    const quote = quotes.find((q) => q.id === quoteId);
    const line = quote?.lines.find((l) => String(l.productId) === String(productId));
    clearSetPartsForProduct(productId, line?.isSet ? quoteId : null);
  }

  function unpickLine(productId, quoteId) {
    if (locked) return;
    setPicks((prev) => {
      if (prev[productId] !== quoteId) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function applySetPartIndexes(quoteId, productId, nextIndexes) {
    if (locked) return;
    const key = qtyKey(quoteId, productId);
    setSetPartPicks((prev) => ({ ...prev, [key]: nextIndexes }));
    if (nextIndexes.length > 0) pickLine(productId, quoteId);
    else unpickLine(productId, quoteId);
  }

  function pickAllFromSupplier(quoteId) {
    if (locked) return;
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return;
    setPicks((prev) => {
      const next = { ...prev };
      quote.lines.forEach((l) => {
        next[l.productId] = quoteId;
      });
      return next;
    });
    setSetPartPicks((prev) => {
      const next = { ...prev };
      quote.lines.forEach((l) => {
        Object.keys(next).forEach((key) => {
          if (key.endsWith(`::${l.productId}`) && key !== qtyKey(quoteId, l.productId)) {
            delete next[key];
          }
        });
        if (l.isSet && l.setParts?.length) {
          next[qtyKey(quoteId, l.productId)] = l.setParts.map((_, i) => i);
        }
      });
      return next;
    });
  }

  function toggleSetPart(quoteId, productId, index, partCount) {
    const key = qtyKey(quoteId, productId);
    const current = Array.isArray(setPartPicks[key]) ? setPartPicks[key] : [];
    const next = current.includes(index)
      ? current.filter((i) => i !== index)
      : [...current, index].sort((a, b) => a - b);
    applySetPartIndexes(quoteId, productId, next.filter((i) => i >= 0 && i < partCount));
  }

  function setAllSetParts(quoteId, productId, partCount, on) {
    applySetPartIndexes(quoteId, productId, on ? [...Array(partCount).keys()] : []);
  }

  const pickedCount = requestLines.filter((r) => picks[r.productId]).length;
  const allPicked = pickedCount === requestLines.length && requestLines.length > 0;
  const draftAcceptance = buildAcceptanceFromPicks(rfq, quotes, picks, qtyEdits, setPartPicks);
  const missing = requestLines.filter((r) => !picks[r.productId]);

  const offersForFocus = focusLine
    ? quotes
        .map((q) => {
          const line = resolveOffer(
            q.lines.find((l) => l.productId === focusLine.productId),
            q.id,
            qtyEdits,
            setPartPicks
          );
          return { quote: q, line };
        })
        .sort((a, b) => {
          if (!a.line && !b.line) return 0;
          if (!a.line) return 1;
          if (!b.line) return -1;
          return a.line.lineTotal - b.line.lineTotal;
        })
    : [];
  const lowestOfferQuoteId = offersForFocus.find((o) => o.line && o.line.lineTotal > 0)?.quote.id;

  const lowestByProductId = Object.fromEntries(
    requestLines.map((req) => {
      let bestId = null;
      let bestTotal = Infinity;
      quotes.forEach((q) => {
        const line = resolveOffer(
          q.lines.find((l) => l.productId === req.productId),
          q.id,
          qtyEdits,
          setPartPicks
        );
        if (line && line.lineTotal > 0 && line.lineTotal < bestTotal) {
          bestTotal = line.lineTotal;
          bestId = q.id;
        }
      });
      return [req.productId, bestId];
    })
  );

  const cheapestId = [...quotes]
    .map((q) => ({
      id: q.id,
      total: money(
        q.lines.reduce((sum, line) => {
          const offer = resolveOffer(line, q.id, qtyEdits, setPartPicks);
          if (!offer) return sum;
          if (offer.isSet && !(offer.selectedPartIndexes || []).length) {
            return sum + Number(line.lineTotal || 0);
          }
          return sum + (offer.lineTotal || 0);
        }, 0)
      ),
    }))
    .sort((a, b) => a.total - b.total)[0]?.id;

  return (
    <div>
      <AcceptedBanner
        acceptance={acceptance}
        onReset={onReset}
        onGoToPo={onGoToPo || onSupplierAcceptSelection}
        historicalPreview={historicalPreview}
      />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">Supplier quotes</p>
          <h3 className="mt-1 text-lg font-bold text-brand-800">Compare &amp; pick</h3>
          <p className="mt-1 text-xs text-mute">
            Left = your RFQ product. Cells show supplier products + price. Pick one → detail expands under that row.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-line rounded-lg overflow-hidden text-xs font-semibold">
            <button
              type="button"
              className={`px-3 py-2 ${
                matchMode === "product" ? "bg-brand-600 text-white" : "bg-white text-mute hover:text-brand-700"
              }`}
              onClick={() => setMatchMode("product")}
            >
              By product
            </button>
            <button
              type="button"
              className={`px-3 py-2 ${
                matchMode === "supplier" ? "bg-brand-600 text-white" : "bg-white text-mute hover:text-brand-700"
              }`}
              onClick={() => setMatchMode("supplier")}
            >
              By supplier
            </button>
          </div>
          <p className="text-xs text-mute hidden sm:block">{quotes.length} responses</p>
        </div>
      </div>

      <div className="mb-4 border border-line rounded-xl bg-paper/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">{t("filterProducts")}</p>
            <p className="mt-0.5 text-xs text-mute">{t("filterProductsHint")}</p>
          </div>
          <p className="text-xs text-mute">
            {t("filterShowing", { shown: visibleLines.length, total: requestLines.length })}
          </p>
        </div>
        <div className="mt-3 flex flex-col xl:flex-row xl:items-stretch gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("filterProductPlaceholder")}</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-mute" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={t("filterProductPlaceholder")}
              className="field-input w-full !pl-9 !py-2 h-full"
            />
          </label>
          <div
            role="tablist"
            aria-label={t("filterProducts")}
            className="grid grid-cols-2 sm:grid-cols-5 overflow-hidden rounded-lg border border-line bg-white shrink-0"
          >
            {[
              ["all", t("filterAll")],
              ["unpicked", t("filterUnpicked")],
              ["picked", t("filterPicked")],
              ["noquote", t("filterNoQuote")],
              ["alternate", t("filterAlternate")],
            ].map(([id, label], i) => {
              const active = productStatus === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setProductStatus(id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                    i > 0 ? "border-t sm:border-t-0 sm:border-l border-line" : ""
                  } ${
                    active ? "bg-brand-600 text-white" : "bg-white text-mute hover:bg-paper hover:text-brand-700"
                  }`}
                >
                  <span className="truncate">{label}</span>
                  <span
                    className={`tabular-nums text-[10px] font-bold min-w-[1.25rem] text-center ${
                      active ? "text-white/80" : "text-mute"
                    }`}
                  >
                    {statusCounts[id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {categories.length > 1 ? (
            <label className="inline-flex items-center gap-1.5 text-xs text-mute">
              <span className="sr-only">{t("filterByCategory")}</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink"
              >
                <option value="">{t("filterAnyCategory")}</option>
                {categories.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {quotingSuppliers.length > 1 ? (
            <label className="inline-flex items-center gap-1.5 text-xs text-mute">
              <span className="sr-only">{t("filterBySupplier")}</span>
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink max-w-[14rem]"
              >
                <option value="">{t("filterAnySupplier")}</option>
                {quotingSuppliers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {hasGreen ? (
            <button
              type="button"
              onClick={() => setFilterGreen((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                filterGreen ? "bg-[#1f8a45] text-white border-[#1f8a45]" : "bg-white text-mute border-line hover:text-brand-700"
              }`}
            >
              {t("filterGreen")}
            </button>
          ) : null}
          {hasCustom ? (
            <button
              type="button"
              onClick={() => setFilterCustom((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                filterCustom ? "bg-brand-600 text-white border-brand-600" : "bg-white text-mute border-line hover:text-brand-700"
              }`}
            >
              {t("filterCustom")}
            </button>
          ) : null}
          {hasListedMix ? (
            <>
              <button
                type="button"
                onClick={() => setFilterListed((v) => (v === "yes" ? "" : "yes"))}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                  filterListed === "yes"
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-mute border-line hover:text-brand-700"
                }`}
              >
                {t("filterListedPrice")}
              </button>
              <button
                type="button"
                onClick={() => setFilterListed((v) => (v === "no" ? "" : "no"))}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                  filterListed === "no"
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-mute border-line hover:text-brand-700"
                }`}
              >
                {t("filterNoListedPrice")}
              </button>
            </>
          ) : null}
          {filtersActive ? (
            <button type="button" className="px-2.5 py-1.5 text-xs font-semibold text-brand-700" onClick={clearProductFilters}>
              {t("clearFilters")}
            </button>
          ) : null}
        </div>
      </div>

      {matchMode === "product" ? (
        <div>
          <div className="mb-3 border border-line bg-paper/80 rounded-xl px-3.5 py-2.5 text-xs text-mute leading-relaxed">
            <span className="font-semibold text-brand-800">Select per item.</span> This only picks the
            current RFQ line from that supplier — other lines stay independent.
          </div>

          {visibleLines.length === 0 ? (
            <p className="border border-dashed border-line rounded-xl px-4 py-8 text-center text-sm text-mute">
              {t("filterNone")}
            </p>
          ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {visibleLines.map((req) => {
              const active = req.productId === focusLine?.productId;
              const picked = picks[req.productId];
              return (
                <button
                  key={req.productId}
                  type="button"
                  onClick={() => setFocusProductId(req.productId)}
                  className={`shrink-0 max-w-[14rem] text-left border rounded-xl px-3 py-2.5 ${
                    active ? "border-brand-600 bg-brand-50" : "border-line bg-white hover:border-brand-600/40"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600">
                    Item {req.lineNo}
                    {picked ? " · picked" : ""}
                  </span>
                  <span
                    className="mt-0.5 block text-sm font-semibold text-brand-800 line-clamp-2 break-words"
                    title={req.requestName}
                  >
                    {req.requestName}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-mute">Qty {req.qty}</span>
                  {req.unitPrice != null ? (
                    <span className="mt-0.5 block text-[11px] text-mute">
                      {req.requestedUnitPrice != null &&
                      Number(req.requestedUnitPrice) < Number(req.unitPrice) ? (
                        <>
                          <span className="line-through">{formatPrice(req.unitPrice)}</span>
                          {" → "}
                          <span className="font-semibold text-brand-700">{formatPrice(req.requestedUnitPrice)}</span>
                        </>
                      ) : (
                        formatPrice(req.unitPrice)
                      )}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          )}

          {visibleLines.length > 0 ? (
          <div className="mt-4 border border-line rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-brand-50/70 border-b border-line">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">Same goods</p>
              <p className="mt-1 text-base font-bold text-brand-800 break-words" title={focusLine?.requestName}>
                {focusLine?.requestName}
              </p>
            </div>
            <ul className="divide-y divide-line">
              {offersForFocus.map(({ quote: q, line }) => {
                const isLowest = line && q.id === lowestOfferQuoteId;
                const isPicked = focusLine && picks[focusLine.productId] === q.id;
                return (
                  <li
                    key={q.id}
                    className={`px-4 py-3.5 flex flex-wrap items-start gap-3 ${
                      isPicked
                        ? "bg-brand-50 ring-1 ring-inset ring-brand-600/30"
                        : isLowest
                          ? "bg-brand-50/50"
                          : "bg-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-brand-800">{q.supplierName}</p>
                        {isPicked ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <ProductOfferBlock
                        line={line}
                        requestName={focusLine.requestName}
                        quote={q}
                        isLowest={isLowest}
                        locked={locked}
                        t={t}
                        onTogglePart={(index) =>
                          toggleSetPart(q.id, focusLine.productId, index, line.setParts?.length || 0)
                        }
                        onSelectAllParts={() =>
                          setAllSetParts(q.id, focusLine.productId, line.setParts?.length || 0, true)
                        }
                        onSelectNoneParts={() =>
                          setAllSetParts(q.id, focusLine.productId, line.setParts?.length || 0, false)
                        }
                      />
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold ${isLowest ? "text-brand-600" : "text-brand-800"}`}>
                        {line ? formatPrice(line.lineTotal) : "—"}
                      </p>
                      <button
                        type="button"
                        disabled={!line || locked}
                        className={`mt-2 !px-3 !py-1.5 text-xs ${
                          isPicked ? "btn-primary" : "btn-soft !border-brand-600 !text-brand-700"
                        } disabled:opacity-40`}
                        onClick={() => {
                          if (!focusLine || !line) return;
                          if (line.isSet && !(line.selectedPartIndexes || []).length) {
                            setAllSetParts(q.id, focusLine.productId, line.setParts?.length || 0, true);
                            return;
                          }
                          pickLine(focusLine.productId, q.id);
                        }}
                      >
                        {isPicked ? "Selected for item" : "Select for this item"}
                      </button>
                      <button
                        type="button"
                        className="btn-soft mt-2 w-full !px-3 !py-1.5 text-xs"
                        onClick={() => {
                          setReviewQuoteId(q.id);
                          setMatchMode("supplier");
                        }}
                      >
                        See full column
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          ) : null}
        </div>
      ) : (
        <div>
          <div id="quote-compare-table" className="scroll-mt-28 overflow-x-auto border border-line rounded-xl bg-white">
            <table className="w-full border-collapse text-sm table-fixed">
              <colgroup>
                <col className="w-44" />
                {quotes.map((q) => (
                  <col key={q.id} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-line">
                  <th className="sticky left-0 z-20 w-44 min-w-44 max-w-44 bg-paper/80 text-brand-800 text-left font-semibold px-3 py-3 border-r border-line overflow-hidden">
                    Your RFQ product
                  </th>
                  {quotes.map((q) => {
                    const isCheapest = q.id === cheapestId;
                    const isFocus = q.id === reviewQuoteId;
                    const colPicked = requestLines.filter((r) => picks[r.productId] === q.id).length;
                    const colTotal = money(
                      q.lines.reduce(
                        (sum, line) => sum + (resolveOffer(line, q.id, qtyEdits, setPartPicks)?.lineTotal || 0),
                        0
                      )
                    );
                    return (
                      <th
                        key={q.id}
                        id={`quote-col-${q.id}`}
                        className={`px-3.5 py-3 text-left font-normal text-brand-800 min-w-[16rem] w-[16rem] align-top ${
                          isFocus
                            ? "bg-brand-50 ring-2 ring-inset ring-brand-600"
                            : isCheapest
                              ? "bg-brand-50"
                              : "bg-paper/80"
                        }`}
                      >
                        <p className="font-semibold leading-snug flex items-center gap-1.5 flex-wrap" title={q.supplierName}>
                          <span className="min-w-0">{q.supplierName}</span>
                          {getSupplier(q.supplierName)?.verified ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand-700 shrink-0">
                              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
                                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M5 8.2 7 10.2 11.2 5.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {t("supplierVerified")}
                            </span>
                          ) : null}
                        </p>
                        <p className={`mt-1 flex items-baseline justify-between gap-2 ${isCheapest ? "text-brand-700" : "text-ink"}`}>
                          <span className="text-lg font-bold tabular-nums">
                            {formatPrice(colTotal)}
                            {isCheapest ? (
                              <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] font-semibold tracking-wide text-brand-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />
                                Best
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[11px] font-medium text-mute tabular-nums shrink-0">
                            {colPicked}/{requestLines.length} {t("quotePickedShort")}
                          </span>
                        </p>
                        <SupplierQuoteStats
                          name={q.supplierName}
                          paymentTerms={q.paymentTerms}
                          leadDays={q.leadDays}
                        />
                        <button
                          type="button"
                          disabled={locked}
                          className="mt-2.5 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40"
                          onClick={() => pickAllFromSupplier(q.id)}
                        >
                          {t("takeAllQuotes")}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleLines.length === 0 ? (
                  <tr>
                    <td colSpan={quotes.length + 1} className="px-4 py-8 text-center text-sm text-mute">
                      {t("filterNone")}
                    </td>
                  </tr>
                ) : (
                visibleLines.map((req) => {
                  const pickedQuoteId = picks[req.productId] || null;
                  const pickedSupplier = pickedQuoteId
                    ? quotes.find((q) => q.id === pickedQuoteId)?.supplierName
                    : null;
                  const pickedOffer = pickedQuoteId
                    ? resolveOffer(
                        quotes.find((q) => q.id === pickedQuoteId)?.lines.find((l) => l.productId === req.productId),
                        pickedQuoteId,
                        qtyEdits,
                        setPartPicks
                      )
                    : null;
                  const showDetail = detailProductId === req.productId && pickedOffer && !pickedOffer.isSet;

                  return (
                    <Fragment key={req.productId}>
                      <tr onClick={() => setDetailProductId(req.productId)}>
                        <th
                          scope="row"
                          className="sticky left-0 z-10 w-44 min-w-44 max-w-44 text-left font-medium px-3 py-3 border-b border-r border-line align-top cursor-pointer bg-white overflow-hidden"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wide text-mute">
                            L{req.lineNo}
                          </p>
                          <p
                            className="mt-0.5 text-sm text-brand-800 leading-snug line-clamp-2"
                            title={req.requestName}
                          >
                            {req.requestName}
                          </p>
                          <p className="mt-0.5 text-[11px] text-mute font-normal">Qty {req.qty}</p>
                          {req.unitPrice != null ? (
                            <p className="mt-0.5 text-[11px] font-normal text-mute">
                              {req.requestedUnitPrice != null &&
                              Number(req.requestedUnitPrice) < Number(req.unitPrice) ? (
                                <>
                                  <span className="line-through">{formatPrice(req.unitPrice)}</span>
                                  {" → "}
                                  <span className="font-semibold text-brand-700">
                                    {formatPrice(req.requestedUnitPrice)}
                                  </span>
                                </>
                              ) : (
                                formatPrice(req.unitPrice)
                              )}
                            </p>
                          ) : null}
                        </th>
                        {quotes.map((q) => {
                          const offered = resolveOffer(
                            q.lines.find((l) => l.productId === req.productId),
                            q.id,
                            qtyEdits,
                            setPartPicks
                          );
                          const isLineLowest = offered && lowestByProductId[req.productId] === q.id;
                          const isPicked = picks[req.productId] === q.id;
                          const key = qtyKey(q.id, req.productId);
                          const displayOffer =
                            offered && qtyEdits[key] != null && !offered.isSet
                              ? { ...offered, qty: qtyEdits[key] }
                              : offered;
                          return (
                            <CompactCell
                              key={`${req.productId}-${q.id}`}
                              offered={displayOffer}
                              isPicked={isPicked}
                              isLineLowest={isLineLowest}
                              highlighted={q.id === reviewQuoteId}
                              locked={locked}
                              t={t}
                              onPick={() => {
                                if (offered?.isSet) {
                                  const partCount = offered.setParts?.length || 0;
                                  const selected = Array.isArray(setPartPicks[key]) ? setPartPicks[key] : [];
                                  if (isPicked || selected.length > 0) {
                                    setAllSetParts(q.id, req.productId, partCount, false);
                                    return;
                                  }
                                  setAllSetParts(q.id, req.productId, partCount, true);
                                  return;
                                }
                                if (isPicked) {
                                  setPicks((prev) => {
                                    const next = { ...prev };
                                    delete next[req.productId];
                                    return next;
                                  });
                                  return;
                                }
                                pickLine(req.productId, q.id);
                              }}
                              onQtyChange={(value) => {
                                setQtyEdits((prev) => ({ ...prev, [key]: value }));
                              }}
                              onRestoreQty={() => {
                                setQtyEdits((prev) => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                              }}
                              onZoomImage={setZoomImage}
                              onTogglePart={(index) => {
                                toggleSetPart(q.id, req.productId, index, offered?.setParts?.length || 0);
                              }}
                              onSelectAllParts={() =>
                                setAllSetParts(q.id, req.productId, offered?.setParts?.length || 0, true)
                              }
                              onSelectNoneParts={() =>
                                setAllSetParts(q.id, req.productId, offered?.setParts?.length || 0, false)
                              }
                            />
                          );
                        })}
                      </tr>
                      {showDetail ? (
                        <InlineDetailRow
                          req={req}
                          offered={pickedOffer}
                          supplierName={pickedSupplier || ""}
                          colSpan={quotes.length + 1}
                        />
                      ) : null}
                    </Fragment>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 sticky bottom-4 z-30 border border-line bg-white/95 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-800">
            {pickedCount}/{requestLines.length} selected
            {allPicked ? ` · ${formatPrice(draftAcceptance.total)}` : ""}
          </p>
          <p className="text-xs text-mute truncate">
            {allPicked
              ? draftAcceptance.label
              : missing.length
                ? `Need ${missing.map((m) => `L${m.lineNo}`).join(", ")}`
                : "Select a price in each row"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            className="btn-soft !px-4 !py-2"
            disabled={locked || pickedCount === 0}
            onClick={() => setPicks({})}
          >
            Clear
          </button>
          {acceptance ? (
            <button
              type="button"
              className="btn-primary !px-5 !py-2 disabled:opacity-40"
              disabled={historicalPreview}
              title={historicalPreview ? t("quoteVersionPoLocked") : ""}
              onClick={onGoToPo || onSupplierAcceptSelection}
            >
              Purchase Order
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary !px-5 !py-2 disabled:opacity-40"
              disabled={!allPicked || historicalPreview}
              title={historicalPreview ? t("quoteVersionReadonly") : ""}
              onClick={() => onAccept(draftAcceptance)}
            >
              Submit to supplier
            </button>
          )}
        </div>
      </div>
      {zoomImage ? (
        <ProductImageLightbox
          src={zoomImage.src}
          alt={zoomImage.alt}
          onClose={() => setZoomImage(null)}
          t={t}
        />
      ) : null}
    </div>
  );
}
