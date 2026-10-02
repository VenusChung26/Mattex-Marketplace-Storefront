/**
 * PROTOTYPE — custom-product composer placements on /rfq?variant=
 * Question: Where should adding a custom product live so the quote list and submit bar stay usable?
 * A Inline in list · B Modal overlay · C Right drawer
 */
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { draftTotals, formatPrice, getEffectivePrice, getProduct, isDiscontinued } from "../../lib/store";
import CustomProductForm from "../../components/CustomProductForm";
import CustomProductModal from "../../components/CustomProductModal";
import AttachmentLinks, { PreviewThumb } from "../../components/AttachmentLinks";
import { QtyStepper } from "../../components/ProductCard";
import { useLanguage } from "../../i18n";

export const RFQ_PROTOTYPE_VARIANTS = [
  { key: "A", name: "Inline in list" },
  { key: "B", name: "Modal overlay" },
  { key: "C", name: "Right drawer" },
];

export const CUSTOM_PLACEMENT = {
  A: "inline",
  B: "modal",
  C: "drawer",
};

function firstImageAttachment(files) {
  const list = Array.isArray(files) ? files : [];
  const found = list.find((file) => {
    const type = String(file?.type || "");
    const url = String(file?.url || file?.href || "");
    const name = String(file?.name || "");
    return (
      file?.kind === "image" ||
      type.startsWith("image/") ||
      url.startsWith("data:image/") ||
      /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url) ||
      /\.(png|jpe?g|webp|gif|svg)$/i.test(name)
    );
  });
  return found?.url || found?.href || "";
}

function lineThumb(line) {
  const direct = String(line?.image || "").trim();
  if (direct) return direct;
  const extra = (Array.isArray(line?.images) ? line.images : []).map((src) => String(src || "").trim()).find(Boolean);
  if (extra) return extra;
  const fromFile = firstImageAttachment(line?.attachments);
  if (fromFile) return fromFile;
  if (line?.custom) return "";
  return String(getProduct(line?.productId)?.image || "").trim();
}

function LineThumb({ line, className = "h-16 w-16 sm:h-[4.5rem] sm:w-24" }) {
  const { t } = useLanguage();
  const src = lineThumb(line);
  return (
    <span className={`${className} shrink-0 overflow-hidden rounded-md border border-line bg-paper`}>
      {src ? (
        <PreviewThumb src={src} name={line?.name} className="h-full w-full rounded-none border-0" />
      ) : (
        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-bold uppercase leading-tight text-brand-700">
          {line?.custom ? t("customItem") : ""}
        </span>
      )}
    </span>
  );
}

function GreenProductTag({ t, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 bg-[#1f8a45] text-white text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 shrink-0 ${className}`}
    >
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

function IntentBadge({ intent, t }) {
  if (!intent) return null;
  const buy = intent === "buy";
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 ${
        buy ? "text-brand-800 bg-brand-100" : "text-brand-700 bg-brand-50"
      }`}
    >
      {buy ? t("intentBuy") : t("intentQuote")}
    </span>
  );
}

function isBuyLine(line) {
  return line.intent === "buy";
}

function splitDraftLines(lines) {
  const buyLines = [];
  const quoteLines = [];
  for (const line of lines || []) {
    if (isBuyLine(line)) buyLines.push(line);
    else quoteLines.push(line);
  }
  return { buyLines, quoteLines };
}

function selectedFor(lines, selectedIds) {
  const set = new Set((lines || []).map((l) => String(l.productId)));
  return (selectedIds || []).filter((id) => set.has(String(id)));
}

function customLineProps(props) {
  return {
    editingId: props.editingId,
    setEditingId: props.setEditingId,
    showAddCustom: props.showAddCustom,
    setShowAddCustom: props.setShowAddCustom,
    onToggleAddCustom: props.onToggleAddCustom,
    onAddCustom: props.onAddCustom,
    onUpdateCustom: props.onUpdateCustom,
  };
}

function canBuyFromStock(line) {
  return Boolean(line) && !line.custom && line.unitPrice != null;
}

function hasLowerAsk(line) {
  return (
    line?.unitPrice != null &&
    line?.requestedUnitPrice != null &&
    Number(line.requestedUnitPrice) > 0 &&
    Number(line.requestedUnitPrice) < Number(line.unitPrice)
  );
}

function LineMoney({ line, t, compact = false }) {
  const product = line.custom ? null : getProduct(line.productId);
  const priced = product ? getEffectivePrice(product) : {};
  const quoted = priced.status === "quoted";
  const listPrice = priced.quote?.listPrice;
  const showListStrike =
    quoted && listPrice != null && line.unitPrice != null && Number(listPrice) !== Number(line.unitPrice);
  const badge = quoted ? (
    <span className="ml-1 align-middle text-[10px] font-bold uppercase tracking-wide text-brand-800 bg-brand-50 border border-brand-200 px-1 py-0.5">
      {t("quotedPriceLabel")}
    </span>
  ) : null;
  if (line.unitPrice == null) return compact ? formatPrice(null) : <span className="text-mute">{formatPrice(null)}</span>;
  if (hasLowerAsk(line)) {
    return (
      <span className={compact ? "text-right" : "block text-right"}>
        <span className={`${compact ? "block text-xs" : "block text-xs"} font-medium text-mute line-through`}>
          {formatPrice(line.unitPrice * line.qty)}
        </span>
        <span className="font-semibold text-brand-700">{formatPrice(line.requestedUnitPrice * line.qty)}</span>
        {badge}
        {!compact ? <span className="block text-[10px] font-medium text-mute">{t("requestedTotal")}</span> : null}
      </span>
    );
  }
  return (
    <span className={compact ? "text-right" : "text-right"}>
      {showListStrike ? (
        <span className="mr-1.5 text-xs font-medium text-mute line-through">{formatPrice(listPrice * line.qty)}</span>
      ) : null}
      {formatPrice(line.unitPrice * line.qty)}
      {badge}
    </span>
  );
}

function DropLane({ visible, active, invalid, label, invalidLabel }) {
  if (!visible) return null;
  const text = invalid ? invalidLabel : label;
  return (
    <div
      className={`px-4 py-2.5 text-center text-sm font-semibold border-b shrink-0 sticky top-0 z-10 ${
        invalid
          ? active
            ? "bg-amber-600 text-white"
            : "bg-amber-50 text-amber-900"
          : active
            ? "bg-brand-700 text-white"
            : "bg-brand-50 text-brand-800 border-dashed border-brand-200"
      }`}
    >
      {text}
    </div>
  );
}

function IntentDraftSections(props) {
  const {
    lines,
    selectedIds,
    toggleId,
    toggleSection,
    setLineQty,
    setLineIntent,
    removeLine,
    removeLines,
    onContinueKind,
    formError,
    formErrorKind,
    embedded = false,
    showActions = true,
    customPlacement = "inline",
    showAddCustom,
    setShowAddCustom,
    onAddCustom,
  } = props;
  const { t } = useLanguage();
  const { buyLines, quoteLines } = splitDraftLines(lines);
  const buySelected = selectedFor(buyLines, selectedIds);
  const quoteSelected = selectedFor(quoteLines, selectedIds);
  const buyTotals = draftTotals({ lines: buyLines }, buySelected);
  const quoteTotals = draftTotals({ lines: quoteLines }, quoteSelected);
  const buyAll = buyLines.length > 0 && buySelected.length === buyLines.length;
  const quoteAll = quoteLines.length > 0 && quoteSelected.length === quoteLines.length;
  const showBuySection = buyLines.length > 0;
  const [dragging, setDragging] = useState(null);
  const [overSection, setOverSection] = useState(null);
  const [dropError, setDropError] = useState("");
  const [leavePrompt, setLeavePrompt] = useState(null);
  const dragSession = useRef(null);

  useEffect(() => {
    if (!dropError) return undefined;
    const timer = window.setTimeout(() => setDropError(""), 4500);
    return () => window.clearTimeout(timer);
  }, [dropError]);

  function hitDropTarget(x, y) {
    let found = null;
    for (const el of document.querySelectorAll("[data-drop-target]")) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        found = el.getAttribute("data-drop-target");
      }
    }
    return found;
  }

  function moveLine(productId, intent) {
    if (!setLineIntent) return;
    const result = setLineIntent(productId, intent);
    if (!result?.ok && result?.reason === "unpriced") {
      setDropError(t("cannotMoveToStock"));
    }
  }

  function finishDrop(payload, target) {
    if (!payload || !target || payload.from === target) return;
    if (target === "buy" && !payload.canBuy) {
      setDropError(t("cannotMoveToStock"));
      return;
    }
    if (payload.from === "buy" && target === "quote") {
      setLeavePrompt({ productId: payload.productId, name: payload.name });
      return;
    }
    moveLine(payload.productId, target);
  }

  function beginDrag(line, from, event) {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setDropError("");
    const payload = {
      productId: String(line.productId),
      name: line.name,
      from,
      canBuy: canBuyFromStock(line),
    };
    const origin = { x: event.clientX, y: event.clientY };
    dragSession.current = { payload, origin, active: false };

    function onMove(ev) {
      const session = dragSession.current;
      if (!session) return;
      const dx = ev.clientX - session.origin.x;
      const dy = ev.clientY - session.origin.y;
      if (!session.active && dx * dx + dy * dy < 36) return;
      session.active = true;
      setDragging({ ...session.payload, x: ev.clientX, y: ev.clientY });
      setOverSection(hitDropTarget(ev.clientX, ev.clientY));
      const edge = 80;
      if (ev.clientY < edge) window.scrollBy(0, -22);
      else if (ev.clientY > window.innerHeight - edge) window.scrollBy(0, 22);
    }

    function onUp(ev) {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("blur", onUp);
      const session = dragSession.current;
      dragSession.current = null;
      const target = ev?.clientX != null ? hitDropTarget(ev.clientX, ev.clientY) : null;
      if (session?.active) finishDrop(session.payload, target);
      setDragging(null);
      setOverSection(null);
    }

    window.addEventListener("pointermove", onMove, { capture: true, passive: true });
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    window.addEventListener("blur", onUp);
  }

  const listProps = {
    toggleId,
    setLineQty,
    removeLine,
    removeLines,
    embedded: true,
    showIntent: false,
    dragging,
    overSection,
    onDragLineStart: showBuySection ? beginDrag : undefined,
  };

  function sectionClass(target) {
    const invalid = target === "buy" && dragging && !dragging.canBuy;
    return `relative bg-white border rounded-xl overflow-hidden transition-shadow flex flex-col min-h-[14rem] lg:max-h-[calc(100vh-12.5rem)] ${
      dragging
        ? overSection === target
          ? invalid
            ? "border-amber-600 ring-2 ring-amber-500/40 bg-amber-50/40"
            : "border-brand-600 ring-2 ring-brand-600/40 bg-brand-50/50"
          : "border-dashed border-brand-300"
        : "border-line"
    }`;
  }

  const gridClass = showBuySection
    ? embedded
      ? "space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-stretch"
      : "space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-stretch"
    : embedded
      ? "space-y-4"
      : "space-y-5";

  return (
    <div className={gridClass}>
      {dropError ? (
        <p className={`${showBuySection ? "lg:col-span-2 " : ""}text-sm text-amber-950 bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start justify-between gap-3`}>
          <span>{dropError}</span>
          <button type="button" className="text-xs font-semibold text-amber-900 hover:underline shrink-0" onClick={() => setDropError("")}>
            {t("dismiss")}
          </button>
        </p>
      ) : null}

      {showBuySection ? (
      <section data-drop-target="buy" className={sectionClass("buy")}>
        <DropLane
          visible={Boolean(dragging)}
          active={overSection === "buy"}
          invalid={Boolean(dragging) && !dragging.canBuy}
          label={t("dropToBuy")}
          invalidLabel={t("dropInvalidStock")}
        />
        <LinesList
          {...listProps}
          lines={buyLines}
          selectedIds={buySelected}
          allSelected={buyAll}
          toggleAll={() => toggleSection(buyLines.map((l) => String(l.productId)))}
          title={t("sectionBuy")}
          subtitle={t("sectionBuyHint")}
          selectAllLabel={t("selectAllBuy")}
          allowCustom={false}
          tone="buy"
          dropIntent="buy"
          emptyMessage={t("emptyBuySection")}
        />
        {showActions && buyLines.length ? (
          <div className="mt-auto px-4 sm:px-5 py-4 border-t border-line bg-brand-50/40 shrink-0">
            <SubmitBar
              bare
              selectedIds={buySelected}
              selectedTotals={buyTotals}
              formError={formErrorKind === "buy" ? formError : ""}
              onSubmit={() => onContinueKind("buy")}
              onSubmitChannel={(channel) => onContinueKind("buy", channel)}
              submitLabel={t("createOrder")}
              marketplaceRfqEnabled={props.marketplaceRfqEnabled}
            />
          </div>
        ) : null}
      </section>
      ) : null}

      <section data-drop-target="quote" className={sectionClass("quote")}>
        <DropLane
          visible={Boolean(dragging)}
          active={overSection === "quote"}
          invalid={false}
          label={t("dropToQuote")}
          invalidLabel=""
        />
        <LinesList
          {...listProps}
          lines={quoteLines}
          selectedIds={quoteSelected}
          allSelected={quoteAll}
          toggleAll={() => toggleSection(quoteLines.map((l) => String(l.productId)))}
          title={t("sectionQuote")}
          subtitle={showBuySection ? t("sectionQuoteHint") : t("sectionQuoteHintOnly")}
          selectAllLabel={t("selectAllQuote")}
          allowCustom
          tone="quote"
          dropIntent="quote"
          emptyMessage={t("emptyQuoteSection")}
          customPlacement={customPlacement}
          {...customLineProps(props)}
        />
        {showActions && quoteLines.length ? (
          <div className="mt-auto px-4 sm:px-5 py-4 border-t border-line shrink-0">
            <SubmitBar
              bare
              selectedIds={quoteSelected}
              selectedTotals={quoteTotals}
              formError={formErrorKind === "quote" ? formError : ""}
              onSubmit={() => onContinueKind("quote")}
              onSubmitChannel={(channel) => onContinueKind("quote", channel)}
              submitLabel={t("requestQuoteCta")}
              marketplaceRfqEnabled={props.marketplaceRfqEnabled}
            />
          </div>
        ) : null}
      </section>

      {customPlacement === "modal" ? (
        <CustomProductModal
          open={Boolean(showAddCustom)}
          onClose={() => setShowAddCustom?.(false)}
          onSubmit={(payload) => onAddCustom?.(payload)}
        />
      ) : null}

      {dragging ? (
        <>
          <div
            className="fixed z-[90] pointer-events-none max-w-[16rem] truncate px-3 py-2 bg-white border border-brand-600 text-sm font-semibold text-ink shadow-[0_12px_28px_rgba(16,21,19,0.18)]"
            style={{ left: dragging.x + 12, top: dragging.y + 12 }}
          >
            {dragging.name}
          </div>
          <div className="fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4 pointer-events-none lg:hidden">
            <div className={`w-full max-w-xl grid gap-2 ${showBuySection ? "grid-cols-2" : "grid-cols-1"}`}>
              {(showBuySection ? ["buy", "quote"] : ["quote"]).map((target) => {
                const invalid = target === "buy" && !dragging.canBuy;
                const active = overSection === target;
                return (
                  <div
                    key={target}
                    data-drop-target={target}
                    className={`pointer-events-auto px-3 py-3 text-center text-xs sm:text-sm font-semibold border shadow-[0_12px_28px_rgba(16,21,19,0.18)] ${
                      invalid
                        ? active
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-amber-50 text-amber-900 border-amber-300"
                        : active
                          ? "bg-brand-700 text-white border-brand-700"
                          : "bg-white text-brand-800 border-brand-300"
                    }`}
                  >
                    {invalid ? t("dropInvalidStock") : target === "buy" ? t("dropToBuy") : t("dropToQuote")}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {leavePrompt ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
          <div className="absolute inset-0 bg-charcoal/50" onClick={() => setLeavePrompt(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-stock-title"
            className="relative bg-white border border-line max-w-md w-full p-6 shadow-[0_24px_60px_rgba(16,21,19,0.25)]"
          >
            <h3 id="leave-stock-title" className="text-lg font-bold text-brand-800">
              {t("dragLeaveStockTitle")}
            </h3>
            <p className="mt-2 text-sm text-mute leading-relaxed">
              {t("dragLeaveStockBody", { name: leavePrompt.name })}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-soft !px-4 !py-2" onClick={() => setLeavePrompt(null)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn-primary !px-4 !py-2"
                onClick={() => {
                  moveLine(leavePrompt.productId, "quote");
                  setLeavePrompt(null);
                }}
              >
                {t("dragLeaveStockConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ConfirmRfqView(props) {
  const {
    confirmKind,
    confirmChannel,
    lines,
    selectedIds,
    onSubmitKind,
    setConfirmKind,
    formError,
    setLineQty,
    removeLine,
    toggleId,
  } = props;
  const { t } = useLanguage();
  const group = (lines || []).filter((line) =>
    confirmKind === "buy" ? line.intent === "buy" : line.intent !== "buy"
  ).filter((line) => selectedIds.includes(String(line.productId)));
  const groupTotals = draftTotals({ lines: group }, group.map((l) => String(l.productId)));
  const viaWhatsapp = confirmChannel === "whatsapp";

  function handleRemove(productId) {
    removeLine?.(productId);
    toggleId?.(productId);
    if (group.length <= 1) setConfirmKind(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
      <button
        type="button"
        onClick={() => setConfirmKind(null)}
        className="text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        ← {t("confirmPageBack")}
      </button>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-600">{t("rfqDraft")}</p>
      <h1 className="reveal mt-1 text-2xl sm:text-3xl font-bold text-brand-800">{t("confirmPageTitle")}</h1>
      <p className="mt-2 text-sm text-mute">
        {viaWhatsapp
          ? t("confirmPageHintWhatsapp")
          : confirmKind === "buy"
            ? t("confirmPageHintBuy")
            : t("confirmPageHintQuote")}
      </p>

      <section id="rfq-confirm-lines" className="mt-6 bg-white border border-line rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-line bg-brand-50/80">
          <h2 className="text-base sm:text-lg font-bold text-brand-800">
            {confirmKind === "buy" ? t("sectionBuy") : t("sectionQuote")}
          </h2>
          <p className="mt-0.5 text-xs text-mute">{t("selectedProducts")}</p>
        </div>
        <ul className="divide-y divide-line">
          {group.map((l) => {
            const moq = Math.max(1, Number(l.moq) || 1);
            const belowMoq = !l.custom && Number(l.qty) < moq;
            return (
              <li key={l.productId} className="px-4 sm:px-5 py-3 flex flex-wrap justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 flex items-center gap-3">
                  <LineThumb line={l} />
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{l.name}</span>
                    {l.green ? (
                      <span className="ml-1.5 align-middle">
                        <GreenProductTag t={t} />
                      </span>
                    ) : null}
                    {l.custom ? <span className="text-mute"> · {t("customItem")}</span> : null}
                    {hasLowerAsk(l) ? (
                      <span className="block text-xs font-normal text-mute mt-0.5">
                        {t("listedPrice")} {formatPrice(l.unitPrice)} · {t("requestedPrice")} {formatPrice(l.requestedUnitPrice)}
                      </span>
                    ) : null}
                    <AttachmentLinks files={l.attachments} />
                    {belowMoq ? (
                      <p className="mt-1 text-xs font-medium text-amber-800">{t("qtyBelowMoq", { n: moq })}</p>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 flex flex-col items-end gap-1.5 w-[13rem] max-w-full">
                  <span className="font-semibold text-right w-full">
                    <LineMoney line={l} t={t} compact />
                  </span>
                  <QtyStepper
                    value={l.qty}
                    min={moq}
                    unit={l.unit || ""}
                    onChange={(qty) => setLineQty(l.productId, qty)}
                    size="row"
                    t={t}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(l.productId)}
                    className="text-[11px] font-semibold text-mute/80 hover:text-[#8a2b2b]"
                  >
                    {t("remove")}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4 bg-white border border-line rounded-xl p-4 sm:p-5 space-y-4">
    <h2 className="text-base sm:text-lg font-bold text-brand-800">{t("deliveryRequest")}</h2>
        <MetaForm {...props} compact requiredMarks={!viaWhatsapp} />
        <SubmitBar
          bare
          selectedIds={group.map((l) => String(l.productId))}
          selectedTotals={groupTotals}
          formError={formError}
          onSubmit={() => onSubmitKind(confirmKind)}
          submitLabel={
            viaWhatsapp
              ? t("sendViaWhatsapp")
              : confirmKind === "buy"
                ? t("confirmBuyCreateRfq")
                : t("submitQuoteRfq")
          }
        />
      </section>
    </div>
  );
}

export function VariantA(props) {
  const { t } = useLanguage();
  const hasBuy = (props.lines || []).some((line) => line.intent === "buy");

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{t("rfqDraft")}</p>
      <h1 className="reveal mt-1 text-2xl sm:text-3xl font-bold text-brand-800">{t("reviewQuote")}</h1>
      <p className="mt-2 text-sm text-mute">{hasBuy ? t("reviewQuoteHint") : t("reviewQuoteHintQuoteOnly")}</p>
      <div className="mt-6">
        <IntentDraftSections {...props} />
      </div>
    </div>
  );
}

export function VariantB(props) {
  const {
    lines,
    selectedIds,
    selectedTotals,
    formError,
    formErrorKind,
    onContinueKind,
  } = props;
  const { t } = useLanguage();
  const { buyLines, quoteLines } = splitDraftLines(lines);
  const buySelected = selectedFor(buyLines, selectedIds);
  const buyTotals = draftTotals({ lines: buyLines }, buySelected);
  const quoteSelected = selectedFor(quoteLines, selectedIds);
  const quoteTotals = draftTotals({ lines: quoteLines }, quoteSelected);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">RFQ workspace</p>
          <h1 className="reveal mt-1 text-2xl sm:text-3xl font-bold text-brand-800">Build this quote</h1>
        </div>
        <p className="text-sm text-mute">
          {selectedIds.length}/{lines.length} selected · {formatPrice(selectedTotals.pricedSubtotal)}
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)] gap-5 items-start">
        <IntentDraftSections {...props} showActions={false} />

        <aside className="bg-white border border-line rounded-xl p-5 lg:sticky lg:top-20 space-y-4">
          <h2 className="font-display text-xl font-semibold text-brand-800">{t("confirmPageTitle")}</h2>
          <p className="text-sm text-mute">{t("reviewQuoteHint")}</p>
          <div className="pt-3 border-t border-line space-y-4">
            {buyLines.length ? (
            <div>
              <p className="text-xs text-mute uppercase tracking-wide">{t("sectionBuy")}</p>
              <p className="text-xl font-bold text-brand-600 mt-1">{formatPrice(buyTotals.pricedSubtotal)}</p>
              {formErrorKind === "buy" && formError ? (
                <p data-form-alert className="mt-2 text-sm text-red-700 font-medium">{formError}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onContinueKind("buy", "whatsapp")}
                  disabled={buySelected.length === 0}
                  className="btn-primary flex-1 !py-3 disabled:opacity-45"
                >
                  {t("sendViaWhatsapp")}
                </button>
              </div>
            </div>
            ) : null}
            <div>
              <p className="text-xs text-mute uppercase tracking-wide">{t("sectionQuote")}</p>
              <p className="text-xl font-bold text-brand-600 mt-1">{formatPrice(quoteTotals.pricedSubtotal)}</p>
              {formErrorKind === "quote" && formError ? (
                <p data-form-alert className="mt-2 text-sm text-red-700 font-medium">{formError}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onContinueKind("quote", "whatsapp")}
                  disabled={quoteSelected.length === 0}
                  className="btn-primary flex-1 !py-3 disabled:opacity-45"
                >
                  {t("sendViaWhatsapp")}
                </button>
              </div>
            </div>
            <Link to="/#products" className="btn-soft w-full !py-2.5">
              {t("keepShopping")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function VariantC(props) {
  const {
    lines,
    selectedIds,
    selectedTotals,
    responseDate,
    deliveryDate,
    deliveryMode,
    deliveryLots,
    project,
    address,
    canonicalCategory,
    acceptSubstitutes,
    note,
    formError,
    onSubmitKind,
    setFormError,
    wizardStep,
    setWizardStep,
  } = props;
  const { t } = useLanguage();

  const steps = [
    { id: 1, label: "Select" },
    { id: 2, label: "Details" },
    { id: 3, label: "Submit" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">RFQ Draft</p>
      <h1 className="reveal mt-1 text-2xl sm:text-3xl font-bold text-brand-800">Create RFQ</h1>

      <ol className="mt-6 flex gap-2">
        {steps.map((s) => (
          <li key={s.id} className="flex-1">
            <button
              type="button"
              onClick={() => setWizardStep(s.id)}
              className={`w-full text-left px-3 py-2.5 border text-sm font-semibold transition-colors ${
                wizardStep === s.id
                  ? "bg-brand-600 text-white border-brand-600"
                  : wizardStep > s.id
                    ? "bg-brand-50 text-brand-800 border-brand-200"
                    : "bg-white text-mute border-line"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide opacity-80">Step {s.id}</span>
              <span className="block">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className={wizardStep === 1 ? "mt-5" : "mt-5 bg-white border border-line rounded-xl p-5 sm:p-6"}>
        {wizardStep === 1 ? (
          <>
            <p className="text-sm text-mute mb-4">{t("reviewQuoteHint")}</p>
            <IntentDraftSections {...props} showActions={false} />
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="btn-primary !px-5"
                disabled={selectedIds.length === 0}
                onClick={() => setWizardStep(2)}
              >
                Continue · {selectedIds.length} selected
              </button>
            </div>
          </>
        ) : null}

        {wizardStep === 2 ? (
          <>
            <p className="text-sm text-mute mb-4">{t("reviewQuoteHint")}</p>
            <MetaForm {...props} />
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" className="btn-soft !px-5" onClick={() => setWizardStep(1)}>
                Back
              </button>
              <button type="button" className="btn-primary !px-5" onClick={() => setWizardStep(3)}>
                Review
              </button>
            </div>
          </>
        ) : null}

        {wizardStep === 3 ? (
          <>
            <p className="text-sm text-mute mb-4">Confirm before sending.</p>
            <ul className="divide-y divide-line border-y border-line text-sm">
              {lines
                .filter((l) => selectedIds.includes(String(l.productId)))
                .map((l) => (
                  <li key={l.productId} className="py-3 flex justify-between gap-3">
                    <span>
                      {l.name} × {l.qty}
                      {l.intent === "buy" ? " · buy" : " · quote"}
                      {l.custom ? " · Tailor Made Product" : ""}
                    </span>
                    <span className="text-mute">
                      <LineMoney line={l} t={t} compact />
                    </span>
                  </li>
                ))}
            </ul>
            <dl className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">{t("quotationDeadline")}</dt>
                <dd className="font-medium">{responseDate || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">{t("requestDeliveryDate")}</dt>
                <dd className="font-medium">{deliveryDate || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">{t("deliveryMode")}</dt>
                <dd className="font-medium">
                  {deliveryMode === "partial" ? t("deliveryModePartial") : t("deliveryModeOneTime")}
                </dd>
              </div>
              {deliveryMode === "partial" && (deliveryLots || []).length ? (
                <div className="sm:col-span-2 space-y-1.5">
                  {(deliveryLots || []).map((lot, index) => (
                    <div key={`review-lot-${index}`}>
                      <dt className="text-xs uppercase tracking-wide text-mute">
                        {t("deliveryLotLabel", { n: index + 1 })}
                      </dt>
                      <dd className="font-medium">
                        {lot.date || "—"}
                        {lot.address ? ` · ${lot.address}` : ""}
                        {lot.note ? ` · ${lot.note}` : ""}
                      </dd>
                    </div>
                  ))}
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">{t("projectName")}</dt>
                <dd className="font-medium">{project || t("filterProjectUnassigned")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">{t("canonicalCategory")}</dt>
                <dd className="font-medium">{canonicalCategory || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-mute">{t("siteAddress")}</dt>
                <dd className="font-medium">{address || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-mute">{t("substitutesLabel")}</dt>
                <dd className="font-medium">
                  {acceptSubstitutes ? t("substitutesAccepted") : t("substitutesNotAccepted")}
                </dd>
              </div>
              {note ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-mute">{t("noteLabel")}</dt>
                  <dd className="font-medium">{note}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 text-lg font-bold text-brand-700">
              Subtotal {formatPrice(selectedTotals.pricedSubtotal)}
            </p>
            {formError ? (
              <p data-form-alert className="mt-2 text-sm text-red-700 font-medium">
                {formError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" className="btn-soft !px-5" onClick={() => setWizardStep(2)}>
                Back
              </button>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn-primary !px-5"
                  disabled={!lines.some((l) => l.intent === "buy" && selectedIds.includes(String(l.productId)))}
                  onClick={() => onSubmitKind("buy")}
                >
                  {t("confirmBuyCreateRfq")}
                </button>
                <button
                  type="button"
                  className="btn-primary !px-5"
                  disabled={!lines.some((l) => l.intent !== "buy" && selectedIds.includes(String(l.productId)))}
                  onClick={() => onSubmitKind("quote")}
                >
                  {t("submitQuoteRfq")}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DragGrip({ hint, onPointerDown }) {
  return (
    <button
      type="button"
      title={hint}
      aria-label={hint}
      onPointerDown={onPointerDown}
      className="shrink-0 group inline-flex items-center justify-center h-11 w-6 bg-transparent border-0 p-0 text-mute/60 hover:text-brand-700 cursor-grab active:cursor-grabbing select-none touch-none"
    >
      <span className="grid grid-cols-2 gap-y-[3px] gap-x-[4px] pointer-events-none" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="h-[3.5px] w-[3.5px] rounded-full bg-current" />
        ))}
      </span>
    </button>
  );
}

function LinesList({
  lines,
  selectedIds,
  allSelected,
  toggleId,
  toggleAll,
  setLineQty,
  removeLine,
  removeLines,
  embedded = false,
  editingId,
  setEditingId,
  showAddCustom,
  setShowAddCustom,
  onToggleAddCustom,
  onAddCustom,
  onUpdateCustom,
  title,
  subtitle,
  selectAllLabel,
  allowCustom = true,
  showIntent = true,
  tone = "default",
  emptyMessage,
  dropIntent,
  dragging,
  onDragLineStart,
  customPlacement = "inline",
}) {
  const { t } = useLanguage();
  const bodyRef = useRef(null);

  useEffect(() => {
    if (showAddCustom) bodyRef.current?.scrollTo({ top: 0 });
  }, [showAddCustom]);
  const headerBg =
    tone === "buy" ? "bg-brand-50" : tone === "quote" ? "bg-[#f3f4f3]" : "bg-brand-50/50";

  return (
    <div className={embedded ? "flex flex-col flex-1 min-h-0" : "bg-white border border-line rounded-xl overflow-hidden"}>
      <div className={`px-4 sm:px-5 py-3.5 border-b border-line shrink-0 ${headerBg}`}>
        {title ? (
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-brand-800">{title}</h2>
                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-white border border-line text-[11px] font-semibold text-ink tabular-nums">
                  {lines.length}
                </span>
              </div>
              {subtitle ? <p className="mt-1 text-xs text-mute leading-snug">{subtitle}</p> : null}
              {onDragLineStart ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-mute cursor-default pointer-events-none select-none">
                  <span className="inline-flex h-5 w-4 items-center justify-center text-mute/60" aria-hidden>
                    <span className="grid grid-cols-2 gap-y-[2px] gap-x-[3px]">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
                      ))}
                    </span>
                  </span>
                  {t("dragToMove")}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={!lines.length}
                className="h-4 w-4 accent-brand-600"
              />
              {selectAllLabel || t("selectAll")}
            </label>
            {lines.length ? (
              <button
                type="button"
                onClick={() => {
                  const ids = lines.map((l) => l.productId);
                  if (removeLines) removeLines(ids);
                  else ids.forEach((id) => removeLine(id));
                }}
                className="text-xs font-semibold text-mute/80 hover:text-[#8a2b2b]"
              >
                {t("removeAllItems")}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {allowCustom ? (
              <button
                type="button"
                onClick={() => {
                  if (onToggleAddCustom) onToggleAddCustom();
                  else {
                    setEditingId?.(null);
                    setShowAddCustom?.((v) => !v);
                  }
                }}
                className={
                  showAddCustom
                    ? "btn-soft !px-3 !py-2 !text-sm"
                    : "btn-primary !px-3 !py-2 !text-sm"
                }
              >
                {showAddCustom ? t("cancel") : `+ ${t("addCustomProduct")}`}
              </button>
            ) : null}
            <p className="text-xs text-mute tabular-nums">
              {t("selectedCountShort", { selected: selectedIds.length, total: lines.length })}
            </p>
          </div>
        </div>
      </div>

      <div ref={bodyRef} className="overflow-y-auto flex-1 min-h-0">
        {allowCustom && showAddCustom && customPlacement === "inline" ? (
          <div className="px-4 sm:px-5 py-4 border-b border-line bg-paper/50">
            <CustomProductForm
              compact
              onSubmit={onAddCustom}
              onCancel={() => setShowAddCustom(false)}
            />
          </div>
        ) : null}

        {lines.length ? (
          <div className="divide-y divide-line">
          {lines.map((l) => {
            const id = String(l.productId);
            const checked = selectedIds.includes(id);
            const isEditing = editingId === id;
            const catalog = l.custom ? null : getProduct(l.productId);
            const discontinued = Boolean(catalog && isDiscontinued(catalog));
            const meta = [
              l.tailorMade && (l.baseProductNo || l.productNo)
                ? t("tailorMadeBasedOn", { sku: l.baseProductNo || l.productNo })
                : l.productNo,
              l.category,
              l.supplier,
            ]
              .filter(Boolean)
              .join(" · ");
            const unpriced = l.unitPrice == null && !l.custom;
            return (
              <div
                key={l.productId}
                className={`px-3 py-3 flex gap-2 sm:gap-2.5 items-center ${
                  checked ? "bg-white" : "bg-paper/50"
                } ${dragging?.productId === id ? "opacity-45" : ""} ${discontinued ? "opacity-80" : ""}`}
              >
                <label className={`shrink-0 ${discontinued ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={checked && !discontinued}
                    disabled={discontinued}
                    onChange={() => toggleId(id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                </label>
                {!isEditing && onDragLineStart ? (
                  <DragGrip
                    hint={unpriced ? t("dropInvalidStock") : t("dragGripHint")}
                    onPointerDown={(e) => {
                      onDragLineStart(l, dropIntent || (isBuyLine(l) ? "buy" : "quote"), e);
                    }}
                  />
                ) : null}
                {isEditing && l.custom ? (
                  <div className="flex-1 min-w-0">
                    <CustomProductForm
                      mode="edit"
                      compact
                      initial={{
                        name: l.name,
                        description: l.description || "",
                        qty: l.qty,
                        image: l.image || "",
                        images: Array.isArray(l.images) ? l.images : [],
                        category: l.category || "",
                        attachments: l.attachments || [],
                      }}
                      onSubmit={(payload) => onUpdateCustom(l.productId, payload)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <>
                    <LineThumb line={l} className="h-14 w-14 sm:h-16 sm:w-20" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold text-ink text-sm truncate">{l.name}</p>
                        {l.green ? <GreenProductTag t={t} /> : null}
                        {showIntent ? <IntentBadge intent={l.intent} t={t} /> : null}
                        {l.custom ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 px-1.5 py-0.5 shrink-0">
                            {l.tailorMade ? t("tailorMadeBadge") : t("customItem")}
                          </span>
                        ) : null}
                        {discontinued ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[#8a2b2b] bg-[#f8e8e8] px-1.5 py-0.5 shrink-0">
                            {t("discontinuedUnavailable")}
                          </span>
                        ) : null}
                      </div>
                      {meta ? <p className="mt-0.5 text-[11px] text-mute truncate">{meta}</p> : null}
                      {l.custom && l.description ? (
                        <p className="mt-0.5 text-[11px] text-mute whitespace-pre-wrap break-words line-clamp-3">
                          <span className="font-medium text-ink/80">{t("customProductDesc")}: </span>
                          {l.description}
                        </p>
                      ) : null}
                      {unpriced ? (
                        <p className="mt-1 inline-flex text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-50 px-1.5 py-0.5">
                          {t("noListedPrice")}
                        </p>
                      ) : null}
                      <AttachmentLinks files={l.attachments} />
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5 w-[13rem] max-w-[46%]">
                      <p className="text-sm font-semibold text-right w-full">
                        <LineMoney line={l} t={t} compact />
                      </p>
                      <div
                        className="w-full"
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <QtyStepper
                          value={l.qty}
                          min={Math.max(1, Number(l.moq) || 1)}
                          unit={l.unit || ""}
                          onChange={(qty) => setLineQty(l.productId, qty)}
                          size="row"
                          t={t}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        {l.custom ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddCustom?.(false);
                              setEditingId?.(id);
                            }}
                            className="text-[11px] font-semibold text-mute hover:text-brand-600"
                          >
                            {t("edit")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeLine(l.productId)}
                          className="text-[11px] font-semibold text-mute/80 hover:text-[#8a2b2b]"
                        >
                          {t("remove")}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          </div>
        ) : emptyMessage && !(showAddCustom && customPlacement === "inline") ? (
          <p className="m-4 flex items-center justify-center border border-dashed border-line bg-paper/40 px-4 py-10 text-sm text-mute text-center leading-relaxed">
            {emptyMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ensureDeliveryLots(lots, deliveryDate) {
  const next = (Array.isArray(lots) ? lots : []).map((lot) => ({
    date: lot?.date || "",
    note: lot?.note || "",
    address: lot?.address || "",
  }));
  if (!next.length) next.push({ date: deliveryDate || "", note: "", address: "" });
  while (next.length < 2) next.push({ date: "", note: "", address: "" });
  return next;
}

function invalidFieldClass(invalid, extra = "") {
  return `field-input ${extra} ${invalid ? "border-red-500 ring-2 ring-red-200 bg-red-50" : ""}`.trim();
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoFromParts(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  let y;
  let m;
  let d;
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
  } else {
    return "";
  }
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "";
  return isoFromParts(y, m, d);
}

function DatePickerField({ value, onChange, min, invalid, className = "" }) {
  const { lang } = useLanguage();
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value || "");
  const selected = parseDateInput(value) || "";
  const minIso = min || todayIso();
  const seed = parseDateInput(value) || minIso;
  const seedDate = new Date(`${seed}T00:00:00`);
  const [viewYear, setViewYear] = useState(seedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(seedDate.getMonth());

  useEffect(() => {
    setText(value || "");
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const iso = parseDateInput(value) || minIso;
    const d = new Date(`${iso}T00:00:00`);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, value, minIso]);

  function commit(nextIso, close = true) {
    const iso = parseDateInput(nextIso);
    if (!iso) return;
    if (iso < minIso) return;
    setText(iso);
    onChange(iso);
    if (close) setOpen(false);
  }

  const weekdays = lang === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(lang === "zh" ? "zh-HK" : "en-GB", {
    month: "long",
    year: "numeric",
  });
  const first = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7) cells.push(null);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="YYYY-MM-DD"
          value={text}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const iso = parseDateInput(next);
            if (iso && iso >= minIso) onChange(iso);
          }}
          onBlur={() => {
            const iso = parseDateInput(text);
            if (iso && iso >= minIso) commit(iso, false);
            else setText(value || "");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              const iso = parseDateInput(text);
              if (iso && iso >= minIso) commit(iso);
            }
          }}
          className={`${invalidFieldClass(invalid, className)} pr-10`}
          aria-invalid={invalid ? true : undefined}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-brand-800 hover:bg-brand-50"
          aria-label="Open calendar"
          onClick={() => {
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
            <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 8h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open ? (
        <div className="absolute z-30 mt-1 w-[17.5rem] rounded-xl border border-line bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm font-semibold text-brand-800 hover:bg-brand-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const d = new Date(viewYear, viewMonth - 1, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              }}
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-ink">{monthLabel}</p>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm font-semibold text-brand-800 hover:bg-brand-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const d = new Date(viewYear, viewMonth + 1, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              }}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-mute">
            {weekdays.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="mt-0.5 grid grid-cols-7 gap-0.5">
            {cells.map((day, index) => {
              if (!day) return <span key={`e-${index}`} />;
              const iso = isoFromParts(viewYear, viewMonth + 1, day);
              const disabled = iso < minIso;
              const isSelected = iso === selected;
              const isToday = iso === todayIso();
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(iso)}
                  className={`h-8 rounded-lg text-sm ${
                    disabled
                      ? "cursor-not-allowed text-mute/40"
                      : isSelected
                        ? "bg-brand-600 font-semibold text-white"
                        : isToday
                          ? "font-semibold text-brand-800 hover:bg-brand-50"
                          : "text-ink hover:bg-brand-50"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-mute">{lang === "zh" ? "可開日曆選擇，或直接輸入日期" : "Pick from the calendar, or type the date"}</p>
        </div>
      ) : null}
    </div>
  );
}

function FieldError({ show, children }) {
  if (!show) return null;
  return (
    <span data-form-alert className="mt-1 block text-xs font-medium text-red-700">
      {children}
    </span>
  );
}

function MetaForm({
  note,
  responseDate,
  deliveryDate,
  deliveryMode,
  deliveryLots,
  project,
  address,
  acceptSubstitutes,
  setNote,
  setResponseDate,
  setDeliveryDate,
  setDeliveryMode,
  setDeliveryLots,
  setProject,
  setAddress,
  setAcceptSubstitutes,
  setDraftNote,
  setDraftResponseDate,
  setDraftDeliveryDate,
  setDraftDeliveryMode,
  setDraftDeliveryLots,
  setDraftProject,
  setDraftAddress,
  setDraftAcceptSubstitutes,
  setFormError,
  formErrorField = "",
  compact = false,
  requiredMarks = true,
  profileProjects = [],
}) {
  const { t } = useLanguage();
  const today = todayIso();
  const deadlineInvalid = formErrorField === "response_date";
  const deliveryInvalid = formErrorField === "delivery_date";
  const lotsInvalid = formErrorField === "delivery_lots";
  const addressInvalid = formErrorField === "address";
  const selectedProjects = String(project || "")
    .split(" · ")
    .map((row) => row.trim())
    .filter(Boolean);
  const projectOptions = [...new Set([...(profileProjects || []), ...selectedProjects])];
  const reqMark = requiredMarks ? <span className="text-brand-600">*</span> : null;

  function commitProjects(next) {
    const joined = next.filter(Boolean).join(" · ");
    setProject(joined);
    setDraftProject(joined);
    setFormError("");
  }

  return (
    <div id="rfq-details" className={compact ? "space-y-3" : "bg-white border border-line rounded-xl p-4 sm:p-5 space-y-4"}>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1">
            {t("quotationDeadline")} {reqMark}
          </span>
          <DatePickerField
            value={responseDate || ""}
            min={today}
            invalid={deadlineInvalid}
            onChange={(next) => {
              setResponseDate(next);
              setDraftResponseDate(next);
              setFormError("");
            }}
          />
          <FieldError show={deadlineInvalid}>{t("responseDateRequired")}</FieldError>
          <span className="mt-1 block text-xs text-mute">{t("quotationDeadlineHint")}</span>
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">
            {t("requestDeliveryDate")} {reqMark}
          </span>
          <DatePickerField
            value={deliveryDate || ""}
            min={today}
            invalid={deliveryInvalid}
            onChange={(next) => {
              setDeliveryDate(next);
              setDraftDeliveryDate(next);
              setFormError("");
            }}
          />
          <FieldError show={deliveryInvalid}>{t("deliveryDateRequired")}</FieldError>
        </label>
      </div>
      <p className="text-sm font-semibold text-brand-800">{t("deliveryRequest")}</p>
      <fieldset className="block">
        <legend className="block text-sm font-medium mb-2">
          {t("deliveryMode")} {reqMark}
        </legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { value: "one_time", label: t("deliveryModeOneTime"), hint: t("deliveryModeOneTimeHint") },
            { value: "partial", label: t("deliveryModePartial"), hint: t("deliveryModePartialHint") },
          ].map((opt) => {
            const checked = (deliveryMode || "one_time") === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 cursor-pointer rounded-lg border px-3 py-3 ${
                  checked ? "border-brand-600 bg-brand-50" : "border-line bg-paper/60"
                }`}
              >
                <input
                  type="radio"
                  name="delivery-mode"
                  value={opt.value}
                  checked={checked}
                  onChange={() => {
                    setDeliveryMode(opt.value);
                    setDraftDeliveryMode(opt.value);
                    if (opt.value === "partial") {
                      const next = ensureDeliveryLots(deliveryLots, deliveryDate);
                      setDeliveryLots?.(next);
                      setDraftDeliveryLots?.(next);
                    }
                    setFormError("");
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{opt.label}</span>
                  <span className="mt-1 block text-xs text-mute">{opt.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {deliveryMode === "partial" ? (
        <div className={`space-y-3 rounded-lg border px-3 py-3 ${lotsInvalid ? "border-red-500 bg-red-50" : "border-line bg-paper/40"}`}>
          <div>
            <p className="mt-0.5 text-xs text-mute">{t("deliveryLotsHint")}</p>
            <FieldError show={lotsInvalid}>{t("deliveryLotsRequired")}</FieldError>
          </div>
          {(deliveryLots || []).map((lot, index) => (
            <div key={`lot-${index}`} className="rounded-lg border border-line bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {t("deliveryLotLabel", { n: index + 1 })}
                </p>
                {(deliveryLots || []).length > 2 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-mute hover:text-[#8a2b2b]"
                    onClick={() => {
                      const next = (deliveryLots || []).filter((_, i) => i !== index);
                      setDeliveryLots(next);
                      setDraftDeliveryLots(next);
                      if (index === 0 && next[0]?.date) {
                        setDeliveryDate(next[0].date);
                        setDraftDeliveryDate(next[0].date);
                      }
                      setFormError("");
                    }}
                  >
                    {t("removeDeliveryLot")}
                  </button>
                ) : null}
              </div>
              <label className="block">
                <span className="block text-sm font-medium mb-1">
                  {t("deliveryLotDate")} {reqMark}
                </span>
                <DatePickerField
                  value={lot.date || ""}
                  min={today}
                  invalid={lotsInvalid && index === 0}
                  onChange={(next) => {
                    const lots = (deliveryLots || []).map((row, i) =>
                      i === index ? { ...row, date: next } : row
                    );
                    setDeliveryLots(lots);
                    setDraftDeliveryLots(lots);
                    if (index === 0) {
                      setDeliveryDate(next);
                      setDraftDeliveryDate(next);
                    }
                    setFormError("");
                  }}
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">
                  {t("siteAddress")} {reqMark}
                </span>
                <input
                  type="text"
                  value={lot.address || ""}
                  placeholder={t("addressPlaceholder")}
                  onChange={(e) => {
                    const next = (deliveryLots || []).map((row, i) =>
                      i === index ? { ...row, address: e.target.value } : row
                    );
                    setDeliveryLots(next);
                    setDraftDeliveryLots(next);
                    if (index === 0) {
                      setAddress(e.target.value);
                      setDraftAddress(e.target.value);
                    }
                    setFormError("");
                  }}
                  className={invalidFieldClass(addressInvalid && index === 0, "w-full")}
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  onChange={(e) => {
                    if (!e.target.checked) return;
                    const src = (deliveryLots || [])[index]?.address || "";
                    const next = (deliveryLots || []).map((row) => ({ ...row, address: src }));
                    setDeliveryLots(next);
                    setDraftDeliveryLots(next);
                    setAddress(src);
                    setDraftAddress(src);
                  }}
                />
                {t("applyAddressAll")}
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">{t("deliveryLotNote")}</span>
                <textarea
                  value={lot.note || ""}
                  rows={compact ? 2 : 3}
                  placeholder={t("deliveryLotNotePlaceholder")}
                  onChange={(e) => {
                    const next = (deliveryLots || []).map((row, i) =>
                      i === index ? { ...row, note: e.target.value } : row
                    );
                    setDeliveryLots(next);
                    setDraftDeliveryLots(next);
                  }}
                  className="field-input resize-y"
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            className="btn-soft !px-3 !py-2 !text-sm"
            onClick={() => {
              const next = [...ensureDeliveryLots(deliveryLots, deliveryDate), { date: "", note: "", address: "" }];
              setDeliveryLots(next);
              setDraftDeliveryLots(next);
            }}
          >
            + {t("addDeliveryLot")}
          </button>
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("projectName")}</p>
        <div className="flex flex-wrap gap-2">
          {projectOptions.map((name) => {
            const checked = selectedProjects.includes(name);
            return (
              <label
                key={name}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  checked ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-brand-600"
                  checked={checked}
                  onChange={() => {
                    commitProjects(checked ? selectedProjects.filter((row) => row !== name) : [...selectedProjects, name]);
                  }}
                />
                {name}
              </label>
            );
          })}
        </div>
        <input
          type="text"
          defaultValue=""
          placeholder={t("projectPlaceholder")}
          className="field-input w-full"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const next = String(e.currentTarget.value || "").trim();
            if (!next) return;
            commitProjects(selectedProjects.includes(next) ? selectedProjects : [...selectedProjects, next]);
            e.currentTarget.value = "";
          }}
        />
        <span className="block text-xs text-mute">{t("projectHint")}</span>
      </div>
      {deliveryMode === "partial" ? null : (
      <label className="block">
        <span className="block text-sm font-medium mb-1">
          {t("siteAddress")} {reqMark}
        </span>
        <input
          type="text"
          value={address || ""}
          onChange={(e) => {
            setAddress(e.target.value);
            setDraftAddress(e.target.value);
            setFormError("");
          }}
          placeholder={t("addressPlaceholder")}
          className={invalidFieldClass(addressInvalid, "w-full")}
          aria-invalid={addressInvalid ? true : undefined}
        />
        <FieldError show={addressInvalid}>{t("addressRequired")}</FieldError>
      </label>
      )}
      <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-line bg-paper/60 px-3 py-3">
        <input
          type="checkbox"
          checked={Boolean(acceptSubstitutes)}
          onChange={(e) => {
            setAcceptSubstitutes(e.target.checked);
            setDraftAcceptSubstitutes(e.target.checked);
          }}
          className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
        />
        <span>
          <span className="block text-sm font-medium text-ink">{t("acceptSubstitutes")}</span>
          <span className="mt-1 block text-xs text-mute">{t("acceptSubstitutesHint")}</span>
        </span>
      </label>
      <label className="block">
        <span className="block text-sm font-medium mb-1">{t("orderNote")}</span>
        <textarea
          value={note || ""}
          onChange={(e) => {
            setNote(e.target.value);
            setDraftNote(e.target.value);
          }}
          rows={compact ? 3 : 4}
          placeholder={t("orderNotePlaceholder")}
          className="field-input resize-y"
        />
      </label>
    </div>
  );
}

function SubmitBar({
  selectedIds,
  selectedTotals,
  formError,
  onSubmit,
  onSubmitChannel,
  submitLabel,
  bare = false,
  showKeepShopping = true,
  marketplaceRfqEnabled = true,
  rfqDisabledTitle = "",
}) {
  const { t } = useLanguage();
  const rfqLocked = !marketplaceRfqEnabled;
  return (
    <div className={bare ? "" : "bg-white border border-line rounded-xl p-4 sm:p-5"}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-mute">
            {selectedIds.length === 1
              ? t("selectedSubtotalOne")
              : t("selectedSubtotal", { n: selectedIds.length })}
          </p>
          <p className="text-xl font-bold text-brand-600 mt-0.5">
            {formatPrice(selectedTotals.pricedSubtotal)}
          </p>
          {selectedTotals.unpricedCount ? (
            <p className="text-xs text-mute mt-1">
              {selectedTotals.unpricedCount} line(s) priced on request
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {showKeepShopping && !bare ? (
            <Link to="/#products" className="btn-soft !px-4 !py-2.5">
              {t("keepShopping")}
            </Link>
          ) : null}
          {onSubmitChannel ? (
            <>
              <button
                type="button"
                onClick={() => onSubmitChannel("whatsapp")}
                disabled={selectedIds.length === 0}
                className="btn-soft !px-5 !py-2.5 disabled:opacity-45"
              >
                {t("sendViaWhatsapp")}
              </button>
              <button
                type="button"
                onClick={() => onSubmitChannel("rfq")}
                disabled={selectedIds.length === 0 || rfqLocked}
                title={rfqLocked ? rfqDisabledTitle || t("guestRfqNeedsAccount") : undefined}
                className="btn-primary !px-5 !py-2.5 disabled:opacity-45"
              >
                {submitLabel || t("requestQuoteCta")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={selectedIds.length === 0}
              className="btn-primary !px-5 !py-2.5 disabled:opacity-45"
            >
              {submitLabel || t("submitRfq")}
            </button>
          )}
        </div>
      </div>
      {formError ? (
        <p data-form-alert className="mt-3 text-sm text-red-700 font-medium">
          {formError}
        </p>
      ) : null}
    </div>
  );
}
