/**
 * My RFQs — quote compare, accept, payment, and delivery.
 */
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { buildSupplierBankInfo, formatPrice, getProduct, inboxStatus, requestRfqCancel, requestRfqReverse, canBuyerRequestCancel, canBuyerReverse, resubmitRfq, rfqDiscussEmailHref, rfqDiscussWhatsappText, openWhatsappChat, rfqProjectName, createBuyerPurchaseOrder, quoteVersionList, quoteEffectiveVersionNo, getEffectiveQuoteVersion, rfqActivityLog, rfqLastActivity, rfqActivityLabel, formatQuoteVersionStamp, hydrateRfqDecisionActivity, updateBuyerRfqDetails, rfqRequestVersionList, rfqRequestEffectiveVersionNo, applyRfqRequestVersion, ensureBuyerSession } from "../lib/store";
import { useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import Seo from "../components/Seo";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { SHOW_RFQ_QUOTES } from "../lib/flags";
import AttachmentLinks, { linePhotoSrc, PreviewThumb } from "../components/AttachmentLinks";
import { DEMO_QUOTED_RFQ, buildPrototypeQuotes, buildSalesQuote } from "./rfqs-prototype/quoteMocks";
import QuoteVariant from "./rfqs-prototype/QuoteCompareVariantA";
import RfqStepBar, { RFQ_PHASE_STEPS } from "./rfqs-prototype/RfqStepBar";
import QuoteVersionSelect, { RfqRequestVersionSelect } from "../components/QuoteVersionSelect";
import CustomProductForm from "../components/CustomProductForm";
import RfqActivityLog from "../components/RfqActivityLog";

function isCodPaymentTerm(value) {
  const raw = String(value || "").toLowerCase();
  return /\bcod\b/.test(raw) || raw.includes("貨到付款") || raw.includes("cash on delivery");
}

function acceptedQuotesAreCod(acceptance, quotes) {
  const names = acceptance?.supplierNames;
  if (!names?.length || !quotes?.length) return false;
  return names.every((name) => {
    const q = quotes.find((x) => x.supplierName === name);
    return isCodPaymentTerm(q?.paymentTerms);
  });
}

function canOpenDelivery(payment, acceptance, quotes, po) {
  if (!po?.supplierAccepted) return false;
  return Boolean(
    payment?.supplierAccepted || payment?.method === "cod" || acceptedQuotesAreCod(acceptance, quotes)
  );
}

function downloadRfq(rfq) {
  if (!rfq) return;
  const lines = [
    `Mattex Marketplace — RFQ`,
    `ID: ${rfq.id}`,
    `Status: ${rfq.status}`,
    `Submitted: ${formatQuoteVersionStamp(rfq.submittedAt)}`,
    rfq.responseDate ? `Quotation deadline: ${rfq.responseDate}` : null,
    rfq.deliveryDate ? `Requested delivery: ${rfq.deliveryDate}` : null,
    `Delivery: ${rfq.deliveryMode === "partial" ? "partial" : "one-time"}`,
    ...(rfq.deliveryMode === "partial" && Array.isArray(rfq.deliveryLots)
      ? rfq.deliveryLots.map(
          (lot, i) => `Lot ${i + 1}: ${lot.date || "—"}${lot.note ? ` — ${lot.note}` : ""}`
        )
      : []),
    rfq.canonicalCategory ? `Canonical category: ${rfq.canonicalCategory}` : null,
    rfqProjectName(rfq) ? `Project: ${rfqProjectName(rfq)}` : null,
    rfq.address ? `Address: ${rfq.address}` : null,
    `Substitutes: ${rfq.acceptSubstitutes ? "accepted (buyer must still confirm)" : "not accepted"}`,
    rfq.note ? `Note: ${rfq.note}` : null,
    "",
    "Activity",
    "--------",
    ...rfqActivityLog(rfq, { audience: "buyer" }).map(
      (event) => `${formatQuoteVersionStamp(event.at)} — ${rfqActivityLabel(event, "en")}`
    ),
    "",
    "Line items",
    "---------",
    ...rfq.lines.map((l) => {
      const unit = lineQuoteUnit(l);
      const price = unit == null ? "Price Upon Request" : formatPrice(unit);
      const asked =
        l.requestedUnitPrice != null && unit != null && Number(l.requestedUnitPrice) < Number(unit)
          ? formatPrice(l.requestedUnitPrice)
          : null;
      const lineTotal =
        unit == null
          ? "—"
          : asked
            ? `${formatPrice(l.requestedUnitPrice * l.qty)} (listed ${formatPrice(unit * l.qty)})`
            : formatPrice(unit * l.qty);
      const tag = l.custom ? " [Tailor Made Product]" : "";
      const intent = l.intent === "buy" ? " [Direct buy]" : " [Quote request]";
      const desc = l.description ? ` | Spec: ${l.description}` : "";
      return `${l.name}${tag}${intent} × ${l.qty}${l.supplier ? ` (${l.supplier})` : ""}${desc} | Unit: ${price}${asked ? ` | Asked: ${asked}` : ""} | Line: ${lineTotal}`;
    }),
    "",
    `Priced subtotal: ${formatPrice(rfq.quotedSubtotal != null ? rfq.quotedSubtotal : rfq.pricedSubtotal)}`,
    rfq.unpricedCount ? `Unpriced lines: ${rfq.unpricedCount}` : "All lines priced",
  ]
    .filter((row) => row != null)
    .join("\n");

  const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${rfq.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function lineQuoteUnit(l) {
  if (l?.quotedUnitPrice != null && Number(l.quotedUnitPrice) > 0) return Number(l.quotedUnitPrice);
  return l?.unitPrice;
}

function lineThumb(l) {
  const photo = linePhotoSrc(l);
  if (photo) return photo;
  if (l?.custom) return "";
  return getProduct(l?.productId)?.image || "";
}

function RfqDetailsSummary({ rfq, t, editing = false, onPatch }) {
  const [note, setNote] = useState(rfq?.note || "");
  const [address, setAddress] = useState(rfq?.address || "");
  const [responseDate, setResponseDate] = useState(rfq?.responseDate || "");
  const [deliveryDate, setDeliveryDate] = useState(rfq?.deliveryDate || "");
  const [project, setProject] = useState(rfqProjectName(rfq) || "");

  useEffect(() => {
    setNote(rfq?.note || "");
    setAddress(rfq?.address || "");
    setResponseDate(rfq?.responseDate || "");
    setDeliveryDate(rfq?.deliveryDate || "");
    setProject(rfqProjectName(rfq) || "");
  }, [rfq?.id, rfq?.note, rfq?.address, rfq?.responseDate, rfq?.deliveryDate, rfq?.project, rfq?.projects]);

  if (!rfq) return null;

  function save(patch) {
    onPatch?.(patch);
  }

  return (
    <details className="mt-3 rounded-lg border border-line bg-paper/50 px-3 py-2" open={editing || undefined}>
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 py-1">
        <span>
          <span className="block text-sm font-semibold text-brand-800">{t("rfqRequestDetails")}</span>
          <span className="mt-0.5 block text-xs text-mute">
            {editing ? t("rfqDetailsEditHint") : t("rfqDetailsReadOnlyHint")}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-brand-700">{t("rfqDetailsExpand")}</span>
      </summary>
      <div className="mt-3 border-t border-line pt-3 space-y-3">
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-ink">
              <span className="text-mute">{t("quotationDeadlineLabel")}</span>
              <input
                type="date"
                className="mt-0.5 w-full rounded border border-line bg-white px-2 py-1.5 text-sm"
                value={responseDate}
                onChange={(e) => setResponseDate(e.target.value)}
                onBlur={() => save({ responseDate })}
              />
            </label>
            <label className="block text-sm text-ink">
              <span className="text-mute">{t("deliveryDateLabel")}</span>
              <input
                type="date"
                className="mt-0.5 w-full rounded border border-line bg-white px-2 py-1.5 text-sm"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                onBlur={() => save({ deliveryDate })}
              />
            </label>
            <label className="block text-sm text-ink sm:col-span-2">
              <span className="text-mute">{t("projectLabel")}</span>
              <input
                type="text"
                className="mt-0.5 w-full rounded border border-line bg-white px-2 py-1.5 text-sm"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                onBlur={() => save({ project, projects: project })}
              />
            </label>
            <label className="block text-sm text-ink sm:col-span-2">
              <span className="text-mute">{t("addressLabel")}</span>
              <input
                type="text"
                className="mt-0.5 w-full rounded border border-line bg-white px-2 py-1.5 text-sm"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => save({ address })}
              />
            </label>
            <label className="block text-sm text-ink sm:col-span-2">
              <span className="text-mute">{t("noteLabel")}</span>
              <textarea
                rows={2}
                className="mt-0.5 w-full resize rounded border border-line bg-white px-2 py-1.5 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => save({ note })}
              />
            </label>
          </div>
        ) : (
        <div className="space-y-1">
          <p className="text-xs text-mute">{t("submitted")} {formatQuoteVersionStamp(rfq.submittedAt)}</p>
          {rfq.responseDate ? (
            <p className="text-sm text-ink">
              <span className="text-mute">{t("quotationDeadlineLabel")}</span> {rfq.responseDate}
            </p>
          ) : null}
          {rfq.deliveryDate ? (
            <p className="text-sm text-ink">
              <span className="text-mute">{t("deliveryDateLabel")}</span> {rfq.deliveryDate}
            </p>
          ) : null}
          <p className="text-sm text-ink">
            <span className="text-mute">{t("deliveryModeLabel")}</span>{" "}
            {rfq.deliveryMode === "partial" ? t("deliveryModePartial") : t("deliveryModeOneTime")}
          </p>
          {rfq.deliveryMode === "partial" && Array.isArray(rfq.deliveryLots)
            ? rfq.deliveryLots.map((lot, index) => (
                <p key={`lot-${index}`} className="text-sm text-ink">
                  <span className="text-mute">{t("deliveryLotLabel", { n: index + 1 })}</span> {lot.date || "—"}
                  {lot.address ? ` · ${lot.address}` : ""}
                  {lot.note ? ` · ${lot.note}` : ""}
                </p>
              ))
            : null}
          {rfq.canonicalCategory ? (
            <p className="text-sm text-ink">
              <span className="text-mute">{t("categoryLabel")}</span> {rfq.canonicalCategory}
            </p>
          ) : null}
          <p className="text-sm text-ink">
            <span className="text-mute">{t("projectLabel")}</span> {rfqProjectName(rfq) || t("filterProjectUnassigned")}
          </p>
          {rfq.address ? (
            <p className="text-sm text-ink">
              <span className="text-mute">{t("addressLabel")}</span> {rfq.address}
            </p>
          ) : null}
          <p className="text-sm text-ink">
            <span className="text-mute">{t("substitutesLabel")}</span>{" "}
            {rfq.acceptSubstitutes ? t("substitutesAccepted") : t("substitutesNotAccepted")}
          </p>
          {rfq.note ? (
            <p className="text-sm text-ink">
              <span className="text-mute">{t("noteLabel")}</span> {rfq.note}
            </p>
          ) : null}
        </div>
        )}

        <ul className="divide-y divide-line border-y border-line">
          {(rfq.lines || []).map((l) => {
            const thumb = lineThumb(l);
            return (
              <li key={String(l.productId)} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-start gap-2.5 flex-1">
                  {thumb ? (
                    <PreviewThumb src={thumb} name={l.name} className="h-10 w-10" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-md border border-line bg-paper" />
                  )}
                  <span className="min-w-0">
                    <span className="font-medium text-sm text-ink">{l.name}</span>
                    {l.productNo ? <span className="block text-xs text-mute">{l.productNo}</span> : null}
                  </span>
                </span>
                <span className="text-sm text-mute shrink-0">× {l.qty}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

function rfqListSubtotal(rfq) {
  const effective = getEffectiveQuoteVersion(rfq);
  if (effective?.quotedSubtotal != null) return effective.quotedSubtotal;
  if (rfq?.quotedSubtotal != null) return rfq.quotedSubtotal;
  const priced = (rfq?.lines || []).filter((line) => Number(line.quotedUnitPrice) > 0);
  if (priced.length) {
    return priced.reduce((sum, line) => sum + Number(line.quotedUnitPrice) * (Number(line.qty) || 0), 0);
  }
  return rfq?.pricedSubtotal;
}

function rfqDocStatus(rfq, acceptedByRfq) {
  if (!rfq) return "";
  if (rfq.cancelStatus === "accepted" || rfq.reviewStatus === "cancelled") return "cancelled";
  if (rfq.cancelStatus === "requested") return "cancel_requested";
  if (rfq.reverseStatus === "requested") return "reverse_requested";
  if (rfq.reviewStatus === "revising") return "revising";
  if (acceptedByRfq?.[rfq.id]) return "accepted";
  if (rfq.id === DEMO_QUOTED_RFQ.id) return "quoted";
  if (rfq.reviewStatus === "quoted") return "quoted";
  if (rfq.reviewStatus === "accepted") return "accepted";
  if (rfq.reviewStatus === "rejected" || rfq.reviewStatus === "no_offer") return "rejected";
  if (rfq.reviewStatus === "returned") return "returned";
  if (rfq.reviewStatus) return "submitted";
  return buildPrototypeQuotes(rfq).length ? "quoted" : rfq.status || "";
}

function rfqDocStatusLabel(status, t) {
  if (status === "cancel_requested") return t("rfqCancelRequested");
  if (status === "reverse_requested") return t("rfqReverseRequested");
  if (status === "revising") return t("rfqRevising");
  if (status === "cancelled") return t("rfqCancelled");
  if (status === "quoted") return SHOW_RFQ_QUOTES ? t("docFilterQuoted") : t("rfqStatusInReview");
  if (status === "accepted") return SHOW_RFQ_QUOTES ? t("docFilterAccepted") : t("rfqStatusInReview");
  if (status === "submitted") return t("docFilterSubmitted");
  if (status === "rejected") return t("rfqStatusRejected");
  return status;
}

function rfqShortId(id) {
  return String(id || "").replace(/^RFQ-?/i, "");
}

function rfqLineSummary(rfq, t) {
  const first = rfq?.lines?.[0]?.name;
  if (!first) {
    return rfq?.lines?.length === 1 ? t("rfqLineCountOne") : t("rfqLineCount", { n: rfq?.lines?.length || 0 });
  }
  if ((rfq.lines || []).length <= 1) return first;
  return `${first} +${rfq.lines.length - 1}`;
}

const SEARCH_RESULT_LIMIT = 40;

function sortRfqsNewestFirst(rfqs) {
  return [...(rfqs || [])].sort((a, b) => {
    const tb = new Date(b.submittedAt || 0).getTime();
    const ta = new Date(a.submittedAt || 0).getTime();
    if (tb !== ta) return tb - ta;
    const nb = Number(String(b.id || "").replace(/\D/g, "")) || 0;
    const na = Number(String(a.id || "").replace(/\D/g, "")) || 0;
    return nb - na;
  });
}

function rfqMatchesQuery(rfq, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const names = (rfq.lines || []).map((line) => line.name).join(" ");
  const project = rfqProjectName(rfq);
  return `${rfq.id} ${rfq.canonicalCategory || ""} ${project} ${names}`.toLowerCase().includes(q);
}

const UNASSIGNED_PROJECT = "__unassigned__";

function RfqDocSwitcher({ list, selectedId, onSelect, onViewQuote, acceptedByRfq, t }) {
  const rootRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const selected = list.find((rfq) => rfq.id === selectedId) || list[0] || null;

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

  const counts = useMemo(() => {
    const next = { all: list.length, quoted: 0, submitted: 0, accepted: 0 };
    for (const rfq of list) {
      const status = rfqDocStatus(rfq, acceptedByRfq);
      if (status === "accepted") next.accepted += 1;
      else if (status === "quoted") next.quoted += 1;
      else next.submitted += 1;
    }
    return next;
  }, [list, acceptedByRfq]);

  const projects = useMemo(() => {
    const names = new Set();
    let unassigned = false;
    for (const rfq of list) {
      const name = rfqProjectName(rfq);
      if (name) names.add(name);
      else unassigned = true;
    }
    return { names: [...names].sort((a, b) => a.localeCompare(b)), unassigned };
  }, [list]);

  const filtered = useMemo(
    () =>
      list.filter((rfq) => {
        const status = rfqDocStatus(rfq, acceptedByRfq) || "submitted";
        if (statusFilter !== "all" && status !== statusFilter) return false;
        const project = rfqProjectName(rfq);
        if (projectFilter === UNASSIGNED_PROJECT) {
          if (project) return false;
        } else if (projectFilter !== "all" && project !== projectFilter) {
          return false;
        }
        return rfqMatchesQuery(rfq, query);
      }),
    [list, acceptedByRfq, statusFilter, projectFilter, query]
  );

  const results = filtered.slice(0, SEARCH_RESULT_LIMIT);

  function pick(id) {
    const rfq = list.find((row) => row.id === id);
    onSelect(id);
    if (SHOW_RFQ_QUOTES && rfq && rfqDocStatus(rfq, acceptedByRfq) === "quoted") onViewQuote?.(id);
    setQuery("");
    setOpen(false);
  }

  if (!list.length || !selected) return null;

  const quotedRows = SHOW_RFQ_QUOTES ? list.filter((rfq) => rfqDocStatus(rfq, acceptedByRfq) === "quoted") : [];
  const filters = [
    { id: "all", label: t("docFilterAll"), count: counts.all },
    ...(SHOW_RFQ_QUOTES ? [{ id: "quoted", label: t("docFilterQuoted"), count: counts.quoted }] : []),
    { id: "submitted", label: t("docFilterSubmitted"), count: counts.submitted },
    { id: "accepted", label: SHOW_RFQ_QUOTES ? t("docFilterAccepted") : t("rfqStatusInReview"), count: counts.accepted },
  ];
  return (
    <div ref={rootRef} className="relative mb-3">
      <div className="bg-white border border-line rounded-xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute mr-auto">
            {t("switchRfq")} · {list.length}
          </p>
          {list.length > 1 ? (
            <>
              <label className="sr-only" htmlFor="rfq-project-filter">
                {t("filterProject")}
              </label>
              <select
                id="rfq-project-filter"
                value={projectFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setProjectFilter(next);
                  const scoped =
                    next === "all"
                      ? list
                      : list.filter((rfq) => {
                          const name = rfqProjectName(rfq);
                          return next === UNASSIGNED_PROJECT ? !name : name === next;
                        });
                  if (scoped.length && !scoped.some((rfq) => rfq.id === selectedId)) {
                    onSelect(scoped[0].id);
                  }
                }}
                className="min-w-[9rem] border border-line bg-paper/60 px-2 py-1.5 text-sm text-ink"
              >
                <option value="all">{t("filterProjectAll")}</option>
                {projects.names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {projects.unassigned ? (
                  <option value={UNASSIGNED_PROJECT}>{t("filterProjectUnassigned")}</option>
                ) : null}
              </select>
            </>
          ) : null}
          <div className="w-full sm:w-72 shrink-0">
            <label className="sr-only" htmlFor="rfq-doc-search">
              {t("searchRfqs")}
            </label>
            <input
              id="rfq-doc-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchRfqs")}
              className="w-full border border-line bg-paper/60 px-3 py-1.5 text-sm text-ink"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {filters.map((filter) => {
            const active = statusFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border rounded-full ${
                  active
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-line bg-white text-mute hover:border-brand-300"
                }`}
              >
                {filter.label} {filter.count}
              </button>
            );
          })}
        </div>

        <div id="rfq-doc-results" role="listbox" className="mt-2 max-h-64 overflow-auto divide-y divide-line border-t border-line">
          {results.length ? (
            results.map((rfq) => {
              const active = rfq.id === selectedId;
              const itemStatus = rfqDocStatus(rfq, acceptedByRfq);
              return (
                <button
                  key={rfq.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(rfq.id)}
                  className={`w-full text-left px-2 py-2 flex items-start justify-between gap-3 ${
                    active ? "bg-brand-50" : "hover:bg-paper"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-brand-800">{rfq.id}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600">
                        {rfqDocStatusLabel(itemStatus, t)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-mute truncate">{rfqLineSummary(rfq, t)}</span>
                    <span className="mt-0.5 block text-[11px] text-mute truncate">
                      {rfqProjectName(rfq) || t("filterProjectUnassigned")}
                      {" · "}
                      {formatQuoteVersionStamp(rfqLastActivity(rfq, { audience: "buyer" })?.at || rfq.submittedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {formatPrice(rfqListSubtotal(rfq))}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-2 py-4 text-sm text-mute">{t("noMatchingRfqs")}</p>
          )}
        </div>
        {filtered.length > results.length ? (
          <p className="mt-1 px-1 text-[11px] text-mute">{t("showingRfqsOf", { shown: results.length, total: filtered.length })}</p>
        ) : null}
      </div>

      {quotedRows.length ? (
        <ul className="mt-2 space-y-2">
          {quotedRows.map((rfq) => {
            const active = rfq.id === selectedId;
            return (
              <li key={`quoted-row-${rfq.id}`}>
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                    active ? "border-brand-600 bg-brand-50" : "border-line bg-white"
                  }`}
                >
                  <button type="button" className="min-w-0 text-left" onClick={() => pick(rfq.id)}>
                    <p className="text-sm font-semibold text-brand-800">{rfq.id}</p>
                    <p className="mt-0.5 text-xs text-mute">
                      {t("quotedTotalLabel")} · {formatPrice(rfqListSubtotal(rfq))}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="btn-primary !px-3 !py-1.5 !text-xs shrink-0"
                    onClick={() => pick(rfq.id)}
                  >
                    {t("viewQuote")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function RfqsPage() {
  const { user, rfqs } = useStore();
  const { t, lang } = useLanguage();
  useEffect(() => {
    if (!user?.email) return;
    ensureBuyerSession();
  }, [user?.email]);
  const [params] = useSearchParams();
  const storedList = rfqs || [];
  const usingDemo = SHOW_RFQ_QUOTES && storedList.length === 0;
  const list = sortRfqsNewestFirst(usingDemo ? [DEMO_QUOTED_RFQ] : storedList);

  const initial = params.get("id") || (list[0] && list[0].id) || null;
  const [selectedId, setSelectedId] = useState(initial);
  const [acceptedByRfq, setAcceptedByRfq] = useState({});
  const [stepByRfq, setStepByRfq] = useState({});
  const [poByRfq, setPoByRfq] = useState({});
  const [paymentByRfq, setPaymentByRfq] = useState({});
  const [deliveryByRfq, setDeliveryByRfq] = useState({});
  const [focusQuoteId, setFocusQuoteId] = useState(null);
  const [focusTick, setFocusTick] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmReverse, setConfirmReverse] = useState(false);
  const [cancelFlash, setCancelFlash] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [quoteViewVersion, setQuoteViewVersion] = useState("");
  const [requestViewVersion, setRequestViewVersion] = useState("");
  const contactRef = useRef(null);

  const selected = useMemo(() => {
    if (selectedId === DEMO_QUOTED_RFQ.id) return usingDemo ? DEMO_QUOTED_RFQ : null;
    return list.find((rfq) => rfq.id === selectedId) || list[0] || null;
  }, [selectedId, list, usingDemo]);

  const quotes = useMemo(() => {
    if (!SHOW_RFQ_QUOTES || !selected) return [];
    if (selected.id === DEMO_QUOTED_RFQ.id) return buildPrototypeQuotes(selected);
    const versions = quoteVersionList(selected);
    if (versions.length) {
      const effective = quoteEffectiveVersionNo(selected);
      const viewNo = Number(quoteViewVersion) || effective;
      return buildSalesQuote(selected, viewNo);
    }
    if (selected.reviewStatus === "quoted" || selected.reviewStatus === "accepted") {
      return buildSalesQuote(selected);
    }
    if (selected.reviewStatus) return [];
    return buildPrototypeQuotes(selected);
  }, [selected, quoteViewVersion]);

  const selectedVersions = selected ? quoteVersionList(selected) : [];
  const selectedEffectiveNo = selected ? quoteEffectiveVersionNo(selected) : 0;
  const viewingQuoteVersion = Number(quoteViewVersion) || selectedEffectiveNo;
  const historicalQuoteView =
    selectedVersions.length > 0 && Number(viewingQuoteVersion) !== Number(selectedEffectiveNo);

  useEffect(() => {
    setQuoteViewVersion(selectedEffectiveNo ? String(selectedEffectiveNo) : "");
  }, [selected?.id, selectedEffectiveNo]);

  const requestVersions = selected ? rfqRequestVersionList(selected) : [];
  const requestEffectiveNo = selected ? rfqRequestEffectiveVersionNo(selected) : 0;
  const viewingRequestNo = Number(requestViewVersion) || requestEffectiveNo;
  const historicalRequestView =
    requestVersions.length > 0 && Number(viewingRequestNo) !== Number(requestEffectiveNo);
  const displayRfq = selected && historicalRequestView ? applyRfqRequestVersion(selected, viewingRequestNo) : selected;

  useEffect(() => {
    setRequestViewVersion(requestEffectiveNo ? String(requestEffectiveNo) : "");
  }, [selected?.id, requestEffectiveNo]);

  useEffect(() => {
    setCancelFlash("");
    setConfirmCancel(false);
    setConfirmReverse(false);
  }, [selected?.id]);

  const acceptance = selected ? acceptedByRfq[selected.id] || null : null;
  const hasAccepted = Boolean(acceptance);
  const quoteSupplierAccepted = Boolean(acceptance?.quoteSupplierAccepted);
  const payment = selected ? paymentByRfq[selected.id] || null : null;
  const delivery = selected ? deliveryByRfq[selected.id] || null : null;
  const po = selected ? poByRfq[selected.id] || selected.buyerPo || null : null;
  const poCreated = Boolean(po?.id || po?.status === "created" || po?.confirmedAt);
  const paymentDone = Boolean(payment?.supplierAccepted);
  const deliveryUnlocked = false;
  const deliveryDone = Boolean(delivery?.buyerAccepted);

  const progressIdRaw = !SHOW_RFQ_QUOTES
    ? "submitted"
    : poCreated
    ? "purchaseOrder"
    : quotes.length || inboxStatus(selected) === "quoted"
      ? "quotes"
      : "submitted";
  const progressId = progressIdRaw;

  const inbox = selected ? inboxStatus(selected) : "";
  const awaitingSales = Boolean(selected?.reviewStatus && ["received", "reviewing"].includes(selected.reviewStatus));
  const rawActive = (selected && stepByRfq[selected.id]) || (awaitingSales ? "submitted" : inbox === "quoted" ? "quotes" : "quotes");
  const activeStep = !SHOW_RFQ_QUOTES
    ? "submitted"
    : rawActive === "purchaseOrder" || rawActive === "quotes" || rawActive === "submitted"
      ? rawActive
      : "quotes";

  const displayStatus = selected?.cancelStatus === "accepted" || inbox === "cancelled"
    ? t("rfqCancelled")
    : selected?.cancelStatus === "requested"
      ? t("rfqCancelRequested")
      : selected?.reverseStatus === "requested"
        ? t("rfqReverseRequested")
        : inbox === "revising"
          ? t("rfqRevising")
      : !SHOW_RFQ_QUOTES && inbox === "accepted"
        ? t("rfqStatusInReview")
        : !SHOW_RFQ_QUOTES && awaitingSales
          ? t("rfqAwaitingSalesSlice")
          : poCreated
        ? t("poCreated")
        : hasAccepted
          ? t("createPurchaseOrder")
          : inbox === "quoted"
            ? t("rfqQuotedStatus")
            : awaitingSales
              ? t("rfqAwaitingSales")
              : quotes.length
                ? t("rfqQuotedStatus")
                : selected?.status === "whatsapp_sent"
                  ? t("waSavedInSubbie")
                  : selected?.status === "email_sent"
                    ? t("emailSavedInSubbie")
                    : selected?.status || "";

  function setActiveStep(stepId) {
    if (!selected) return;
    if (stepId !== "submitted" && stepId !== "quotes" && stepId !== "purchaseOrder") return;
    setStepByRfq((prev) => ({ ...prev, [selected.id]: stepId }));
  }

  function viewQuote(id) {
    setSelectedId(id);
    setStepByRfq((prev) => ({ ...prev, [id]: "quotes" }));
  }

  useEffect(() => {
    const id = params.get("id");
    if (id) setSelectedId(id);
  }, [params]);

  useEffect(() => {
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [list, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setStepByRfq((prev) => {
      if (prev[selected.id]) return prev;
      const inbox = inboxStatus(selected);
      const initial =
        inbox === "quoted" || selected.id === DEMO_QUOTED_RFQ.id
          ? "quotes"
          : selected.reviewStatus
            ? "submitted"
            : "quotes";
      return { ...prev, [selected.id]: initial };
    });
  }, [selected?.id]);

  useEffect(() => {
    if (selected?.id) hydrateRfqDecisionActivity(selected.id);
  }, [selected?.id]);

  useEffect(() => {
    setFocusQuoteId(null);
    setConfirmCancel(false);
    setContactOpen(false);
  }, [selected?.id]);

  useEffect(() => {
    if (!contactOpen) return undefined;
    function onPointer(e) {
      if (contactRef.current && !contactRef.current.contains(e.target)) setContactOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setContactOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [contactOpen]);

  useEffect(() => {
    if (!focusQuoteId) return undefined;
    function onDocClick(event) {
      if (event.target.closest("[data-quote-jump]")) return;
      setFocusQuoteId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [focusQuoteId]);

  if (!user) {
    return (
      <Shell>
        <div className="bg-white border border-line rounded-xl p-6">
          <h2 className="text-lg font-bold text-brand-800">{t("loginRequired")}</h2>
          <p className="mt-2 text-sm text-mute">{t("loginRequiredRfq")}</p>
          <Link to={withLocale(lang, "/login")} className="btn-primary mt-5 inline-flex">
            {t("login")}
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div className="mb-3">
        <h1 className="reveal text-2xl font-bold text-brand-800">{t("myRfqsTitle")}</h1>
        {usingDemo ? (
          <p className="mt-1 text-sm text-mute">Prototype demo RFQ loaded (no history yet). Compare supplier quotes below.</p>
        ) : null}
      </div>

      {!list.length ? (
        <section className="bg-white border border-line rounded-xl px-6 py-16 sm:py-20 text-center">
          <h2 className="text-lg font-semibold text-brand-800">{t("noRfqs")}</h2>
          <p className="mt-2 text-sm text-mute">{t("noRfqsHint")}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link to={withLocale(lang, "/rfq")} className="btn-primary">
              {t("openRfqDraftBtn")}
            </Link>
            <Link to={withLocale(lang, "/")} className="btn-soft">
              {t("browseCatalog")}
            </Link>
          </div>
        </section>
      ) : (
        <>
      <RfqDocSwitcher
        list={list}
        selectedId={selected?.id || selectedId}
        onSelect={setSelectedId}
        onViewQuote={viewQuote}
        acceptedByRfq={acceptedByRfq}
        t={t}
      />

      <section className="bg-white border border-line rounded-xl p-4 sm:p-5 min-h-[24rem] pb-28">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <h2 className="text-xl font-bold text-brand-800">{selected.id}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-brand-600">{displayStatus}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-mute">
                    {rfqProjectName(selected) || t("filterProjectUnassigned")}
                    {" · "}
                    {(selected.lines || []).length === 1
                      ? t("rfqLineCountOne")
                      : t("rfqLineCount", { n: (selected.lines || []).length })}
                    {" · "}
                    {formatPrice(rfqListSubtotal(selected))}
                  </p>
                  {(() => {
                    const last = rfqLastActivity(selected, { audience: "buyer" });
                    if (!last) return null;
                    return (
                      <p className="mt-1 text-xs text-ink">
                        {t("rfqActivityLast")} · {rfqActivityLabel(last, lang)} · {formatQuoteVersionStamp(last.at)}
                      </p>
                    );
                  })()}
                </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex flex-wrap justify-end gap-2">
                    <div className="relative" ref={contactRef}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 border border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                        aria-expanded={contactOpen}
                        aria-haspopup="menu"
                        onClick={() => {
                          setContactOpen((open) => !open);
                          setConfirmCancel(false);
                        }}
                      >
                        {t("rfqDiscuss")}
                        <span className="text-[10px] text-mute" aria-hidden>
                          ▾
                        </span>
                      </button>
                      {contactOpen ? (
                        <div
                          role="menu"
                          className="absolute right-0 z-40 mt-1 min-w-[11rem] border border-line bg-white py-1 shadow-[0_12px_28px_rgba(16,21,19,0.18)]"
                        >
                          <a
                            role="menuitem"
                            href={rfqDiscussEmailHref(selected, lang)}
                            className="block px-4 py-2.5 text-sm text-ink hover:bg-brand-50 hover:text-brand-800"
                            onClick={() => setContactOpen(false)}
                          >
                            {t("rfqDiscussEmail")}
                          </a>
                          <button
                            role="menuitem"
                            type="button"
                            className="block w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-brand-50 hover:text-brand-800"
                            onClick={() => {
                              setContactOpen(false);
                              openWhatsappChat(rfqDiscussWhatsappText(selected, lang));
                            }}
                          >
                            {t("rfqDiscussWhatsapp")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadRfq(selected)}
                      className="inline-flex items-center border border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                    >
                      {t("rfqDownload")}
                    </button>
                    {selected.id !== DEMO_QUOTED_RFQ.id && canBuyerReverse(selected) ? (
                      <button
                        type="button"
                        className="inline-flex items-center border border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                        onClick={() => {
                          setContactOpen(false);
                          setConfirmCancel(false);
                          setConfirmReverse(true);
                        }}
                      >
                        {t("rfqReverse")}
                      </button>
                    ) : null}
                    {selected.id !== DEMO_QUOTED_RFQ.id && canBuyerRequestCancel(selected) ? (
                      <button
                        type="button"
                        className="inline-flex items-center border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setContactOpen(false);
                          setConfirmReverse(false);
                          setConfirmCancel(true);
                        }}
                      >
                        {t("rfqCancel")}
                      </button>
                    ) : null}
                    {inbox === "revising" && !historicalRequestView ? (
                      <button
                        type="button"
                        className="inline-flex items-center bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                        onClick={() => {
                          const result = resubmitRfq(selected.id);
                          if (result?.ok) {
                            setRequestViewVersion("");
                            setCancelFlash(t("rfqResubmitHint"));
                          }
                        }}
                      >
                        {t("rfqResubmit")}
                      </button>
                    ) : null}
                  </div>
                  {confirmReverse && selected.id !== DEMO_QUOTED_RFQ.id && canBuyerReverse(selected) ? (
                    <div className="max-w-xs rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-right">
                      <p className="text-xs text-brand-900">{t("rfqReverseHint")}</p>
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" className="btn-soft !px-3 !py-1.5 !text-xs" onClick={() => setConfirmReverse(false)}>
                          {t("rfqCancelBack")}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={() => {
                            const result = requestRfqReverse(selected.id);
                            setConfirmReverse(false);
                            if (result?.ok && result.rfq?.reviewStatus === "revising") setCancelFlash(t("rfqReverseCopied"));
                            else if (result?.ok) setCancelFlash(t("rfqReverseNotified"));
                          }}
                        >
                          {t("rfqReverseConfirm")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {confirmCancel && selected.id !== DEMO_QUOTED_RFQ.id && canBuyerRequestCancel(selected) ? (
                    <div className="max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-right">
                      <p className="text-xs text-amber-900">{t("rfqCancelHint")}</p>
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" className="btn-soft !px-3 !py-1.5 !text-xs" onClick={() => setConfirmCancel(false)}>
                          {t("rfqCancelBack")}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={() => {
                            const result = requestRfqCancel(selected.id);
                            setConfirmCancel(false);
                            if (result?.ok && result.rfq?.reviewStatus === "cancelled") setCancelFlash(t("rfqCancelled"));
                            else if (result?.ok) setCancelFlash(t("rfqCancelNotified"));
                          }}
                        >
                          {t("rfqCancelConfirm")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {inboxStatus(selected) === "returned" ? (
                <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-amber-900">{t("rfqReturnedTitle")}</p>
                  {selected.reason ? <p className="mt-1 text-amber-800">{selected.reason}</p> : null}
                  <button
                    type="button"
                    className="btn-primary mt-2 !py-1.5 !px-3 !text-xs"
                    onClick={() => resubmitRfq(selected.id)}
                  >
                    {t("rfqResubmit")}
                  </button>
                </div>
              ) : null}
              {inboxStatus(selected) === "rejected" || inboxStatus(selected) === "no_offer" ? (
                <div className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <p className="font-semibold">{t("rfqRejectedTitle")}</p>
                  {selected.reason ? <p className="mt-1">{selected.reason}</p> : null}
                </div>
              ) : null}
              {inboxStatus(selected) === "accepted" ? (
                <p className="mt-2 text-xs text-mute">{SHOW_RFQ_QUOTES ? t("rfqAcceptedLocked") : t("rfqInReviewHint")}</p>
              ) : null}
              {cancelFlash ? (
                <p className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">{cancelFlash}</p>
              ) : null}
              {selected.reverseStatus === "requested" ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {t("rfqReverseRequestedHint")}
                </p>
              ) : null}
              {selected.cancelStatus === "requested" ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {t("rfqCancelRequestedHint")}
                </p>
              ) : null}
              {selected.cancelStatus === "accepted" || inbox === "cancelled" ? (
                <div className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-mute">
                  <p>{t("rfqCancelled")}</p>
                </div>
              ) : null}
              {selected.cancelStatus === "declined" ? (
                <p className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-mute">{t("rfqCancelDeclined")}</p>
              ) : null}

              <div className="mt-3">
                <RfqRequestVersionSelect
                  rfq={selected}
                  value={requestViewVersion || String(requestEffectiveNo)}
                  onChange={setRequestViewVersion}
                  currentLabel={t("rfqVersionCurrent")}
                  label={t("rfqVersion")}
                  id={`mm-rfq-version-${selected.id}`}
                />
                {historicalRequestView ? (
                  <p className="mt-1 text-xs text-mute">{t("rfqVersionHistoricalHint")}</p>
                ) : null}
              </div>

              <div className="mt-3">
                <RfqActivityLog rfq={selected} lang={lang} audience="buyer" title={t("rfqActivityTitle")} />
              </div>

              <RfqDetailsSummary
                rfq={displayRfq}
                t={t}
                editing={inbox === "revising" && !historicalRequestView}
                onPatch={(patch) => updateBuyerRfqDetails(selected.id, patch)}
              />

              {SHOW_RFQ_QUOTES ? (
              <div className="mt-4">
                <RfqStepBar
                  steps={RFQ_PHASE_STEPS}
                  activeId={activeStep}
                  progressId={progressId}
                  onSelect={setActiveStep}
                />
              </div>
              ) : null}

              <div className="mt-4">
                {activeStep === "submitted" || !SHOW_RFQ_QUOTES ? (
                  <SubmittedStep
                    rfq={displayRfq || selected}
                    t={t}
                    editing={inbox === "revising" && !historicalRequestView}
                    onChangeLine={(productId, qty) => updateBuyerRfqDetails(selected.id, { lines: [{ productId, qty }] })}
                    onRemoveLine={(productId) => updateBuyerRfqDetails(selected.id, { removeProductIds: [productId] })}
                    onAddCustom={(payload) => updateBuyerRfqDetails(selected.id, { addLines: [{ ...payload, custom: true }] })}
                  />
                ) : null}

                {SHOW_RFQ_QUOTES && activeStep === "quotes" ? (
                  <>
                    {selectedVersions.length ? (
                      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-line bg-paper/50 px-3 py-2.5">
                        <QuoteVersionSelect
                          rfq={selected}
                          value={quoteViewVersion || String(selectedEffectiveNo)}
                          onChange={setQuoteViewVersion}
                          currentLabel={t("quoteVersionCurrent")}
                          label={t("quoteVersion")}
                          id={`mm-quote-version-${selected.id}`}
                        />
                        {historicalQuoteView ? (
                          <p className="text-xs text-mute">{t("quoteVersionHistoricalHint")}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <QuoteVariant
                    rfq={selected}
                    quotes={quotes}
                    focusQuoteId={focusQuoteId}
                    focusTick={focusTick}
                    acceptance={acceptance}
                    historicalPreview={historicalQuoteView}
                    onAccept={(payload) => {
                      if (historicalQuoteView) return;
                      setAcceptedByRfq((prev) => ({
                        ...prev,
                        [selected.id]: {
                          ...payload,
                          quoteSubmitted: true,
                          quoteSupplierAccepted: false,
                        },
                      }));
                    }}
                    onSupplierAcceptSelection={() => {
                      if (historicalQuoteView) return;
                      setAcceptedByRfq((prev) => ({
                        ...prev,
                        [selected.id]: {
                          ...(prev[selected.id] || {}),
                          quoteSupplierAccepted: true,
                        },
                      }));
                      setActiveStep("purchaseOrder");
                    }}
                    onGoToPo={() => {
                      if (historicalQuoteView) return;
                      setActiveStep("purchaseOrder");
                    }}
                    onReset={() => {
                      setAcceptedByRfq((prev) => {
                        const next = { ...prev };
                        delete next[selected.id];
                        return next;
                      });
                      setPoByRfq((prev) => {
                        const next = { ...prev };
                        delete next[selected.id];
                        return next;
                      });
                      setPaymentByRfq((prev) => {
                        const next = { ...prev };
                        delete next[selected.id];
                        return next;
                      });
                      setDeliveryByRfq((prev) => {
                        const next = { ...prev };
                        delete next[selected.id];
                        return next;
                      });
                      setActiveStep("quotes");
                    }}
                  />
                  </>
                ) : null}

                {SHOW_RFQ_QUOTES && activeStep === "purchaseOrder" ? (
                  <PurchaseOrderStep
                    rfq={selected}
                    acceptance={acceptance}
                    quotes={quotes}
                    po={po}
                    t={t}
                    onCreated={(next) => setPoByRfq((prev) => ({ ...prev, [selected.id]: next }))}
                    onBack={() => setActiveStep("quotes")}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-mute">{t("selectRfqHint")}</p>
          )}
        </section>
        </>
      )}
    </Shell>
  );
}

function Shell({ children, wide = false, fluid = false }) {
  const { t, lang } = useLanguage();
  const width = fluid ? "w-full max-w-none" : wide ? "max-w-[100rem]" : "max-w-3xl";
  return (
    <div className="bg-paper min-h-screen">
      <Seo lang={lang} path={withLocale(lang, "/rfqs")} title={`${t("myRfqs")} | Mattex Marketplace`} description={t("loginRequiredRfq")} noindex />
      <SiteHeader fluid={fluid} wide={wide} />
      <main className={`${width} mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6`}>{children}</main>
    </div>
  );
}

function SubmittedStep({ rfq, t, editing = false, onChangeLine, onRemoveLine, onAddCustom }) {
  if (!rfq) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-brand-800">{t("lineItems")}</h3>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {(rfq.lines || []).map((l) => {
          const thumb = lineThumb(l);
          return (
          <li key={`${l.productId}-${l.qty}`} className="flex justify-between gap-3 py-2.5 text-sm">
            <span className="flex min-w-0 items-start gap-2.5">
              {thumb ? (
                <PreviewThumb src={thumb} name={l.name} className="h-10 w-10" />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded-md border border-line bg-paper" />
              )}
              <span className="min-w-0">
              <span className="font-medium text-ink">
                {l.name}{editing ? "" : ` × ${l.qty}`}
                {l.intent === "buy" || l.intent === "quote" ? (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 px-1.5 py-0.5">
                    {t(l.intent === "buy" ? "intentBuy" : "intentQuote")}
                  </span>
                ) : null}
                {l.green ? (
                  <span className="ml-2 inline-flex items-center gap-0.5 bg-[#1f8a45] text-white text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5">
                    {t("greenBadge")}
                  </span>
                ) : null}
                {l.custom ? (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 px-1.5 py-0.5">
                    {l.tailorMade ? t("tailorMadeBadge") : t("customItem")}
                  </span>
                ) : null}
              </span>
              {l.productNo ? <span className="block text-xs text-mute mt-0.5">{l.productNo}</span> : null}
              {l.description ? <span className="block text-xs text-mute mt-0.5">{l.description}</span> : null}
              <AttachmentLinks files={l.attachments} />
              {l.supplier ? <span className="block text-xs text-mute mt-0.5">{l.supplier}</span> : null}
              {editing ? (
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-xs text-mute">
                    {t("qty")}
                    <input
                      type="number"
                      min="1"
                      className="ml-1 w-16 rounded border border-line px-1.5 py-1 text-sm text-ink"
                      value={l.qty}
                      onChange={(e) => onChangeLine?.(l.productId, Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    />
                  </label>
                  {(rfq.lines || []).length > 1 ? (
                    <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => onRemoveLine?.(l.productId)}>
                      {t("remove")}
                    </button>
                  ) : null}
                </span>
              ) : null}
              </span>
            </span>
            <span className="text-mute shrink-0 text-right">
              {(() => {
                const unit = lineQuoteUnit(l);
                if (unit == null) return formatPrice(null);
                if (l.quotedUnitPrice != null) {
                  return (
                    <>
                      {l.unitPrice != null && Number(l.unitPrice) !== Number(unit) ? (
                        <span className="block text-xs line-through">{formatPrice(l.unitPrice)}</span>
                      ) : null}
                      <span className="font-semibold text-brand-700">{formatPrice(unit)}</span>
                    </>
                  );
                }
                if (l.requestedUnitPrice != null && Number(l.requestedUnitPrice) < Number(l.unitPrice)) {
                  return (
                    <>
                      <span className="block text-xs line-through">{formatPrice(l.unitPrice)}</span>
                      <span className="font-semibold text-brand-700">{formatPrice(l.requestedUnitPrice)}</span>
                    </>
                  );
                }
                return formatPrice(l.unitPrice);
              })()}
            </span>
          </li>
          );
        })}
      </ul>
      {editing ? (
        <div className="mt-4 rounded-lg border border-line bg-paper/50 p-3">
          <CustomProductForm
            compact
            onSubmit={(payload) => {
              onAddCustom?.(payload);
            }}
          />
        </div>
      ) : null}
      {rfq.note ? (
        <p className="mt-4 text-sm text-mute">
          <span className="font-medium text-ink">{t("noteLabel")}</span> {rfq.note}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-line">
        <p className="text-sm text-mute">
          {rfq.unpricedCount ? `${rfq.unpricedCount} item(s) price upon request` : "All line items priced"}
        </p>
        <p className="text-base font-bold text-brand-700">
          {t("pricedSubtotal")}: {formatPrice(rfq.quotedSubtotal != null ? rfq.quotedSubtotal : rfq.pricedSubtotal)}
        </p>
      </div>
    </div>
  );
}

function DocStatus({ steps }) {
  return (
    <ol className="mt-4 space-y-2">
      {steps.map((s) => (
        <li key={s.label} className="flex items-start gap-2.5 text-sm">
          <span
            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-bold ${
              s.done
                ? "bg-brand-600 text-white"
                : s.current
                  ? "border-2 border-brand-600 text-brand-700"
                  : "border border-line text-mute"
            }`}
          >
            {s.done ? "✓" : s.n}
          </span>
          <span className={s.done || s.current ? "text-ink" : "text-mute"}>
            <span className="font-medium">{s.label}</span>
            {s.hint ? <span className="block text-xs text-mute mt-0.5">{s.hint}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PurchaseOrderStep({ rfq, acceptance, po, t, onCreated, onBack }) {
  const created = Boolean(po?.id || po?.status === "created" || po?.confirmedAt);
  const lines = created && po?.lines?.length ? po.lines : acceptance?.lines || [];
  const total = created ? po?.total : acceptance?.total;
  const label = created ? po?.label : acceptance?.label;

  if (!created && !acceptance) {
    return (
      <div className="border border-dashed border-line rounded-xl px-5 py-8 text-center">
        <p className="font-semibold text-brand-800">{t("createPurchaseOrder")}</p>
        <p className="mt-2 text-sm text-mute">{t("poNeedQuotesHint")}</p>
        <button type="button" className="btn-primary mt-4 !px-5" onClick={onBack}>
          {t("goToQuotes")}
        </button>
      </div>
    );
  }

  function createPo() {
    const poLines = (acceptance?.lines || []).map((line) => ({
      productId: line.productId,
      name: line.offer?.name || line.requestName,
      qty: line.offer?.qty,
      supplierName: line.supplierName,
      lineTotal: line.lineTotal,
    }));
    if (rfq.id === DEMO_QUOTED_RFQ.id) {
      onCreated?.({
        id: `PO-DEMO-${String(Date.now()).slice(-4)}`,
        status: "created",
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        lines: poLines,
        total: acceptance?.total || 0,
        label: acceptance?.label || "",
      });
      return;
    }
    const result = createBuyerPurchaseOrder(rfq.id, {
      lines: poLines,
      total: acceptance?.total || 0,
      label: acceptance?.label || "",
    });
    if (result?.ok) onCreated?.(result.rfq.buyerPo);
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">{t("createPurchaseOrder")}</p>
      <h3 className="mt-1 text-lg font-bold text-brand-800">
        {created ? t("poCreated") : t("confirmCreatePo")}
      </h3>
      <p className="mt-1 text-sm text-mute">{t("poFromQuotesHint")}</p>
      {created && po?.id ? (
        <p className="mt-2 text-sm font-semibold text-brand-800">{po.id}</p>
      ) : null}
      {label ? (
        <p className="mt-1 text-sm text-mute">
          {label} · {formatPrice(total)}
        </p>
      ) : null}

      <div className="mt-5 border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper/80 text-[11px] uppercase tracking-wide text-mute">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Item</th>
              <th className="text-left font-semibold px-3 py-2">Supplier</th>
              <th className="text-right font-semibold px-3 py-2">Qty</th>
              <th className="text-right font-semibold px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((line, index) => (
              <tr key={`${line.productId || line.name || index}`}>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-ink">{line.offer?.name || line.name || line.requestName}</p>
                </td>
                <td className="px-3 py-2.5 text-mute">{line.supplierName || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{line.offer?.qty ?? line.qty ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  {formatPrice(line.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-paper/50">
              <td colSpan={3} className="px-3 py-2.5 text-sm font-semibold text-ink">
                Total
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-brand-700 tabular-nums">
                {formatPrice(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn-soft !px-4 !py-2.5" onClick={onBack}>
          {t("goToQuotes")}
        </button>
        {!created ? (
          <button type="button" className="btn-primary !px-5 !py-2.5" onClick={createPo}>
            {t("confirmCreatePo")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!value || !navigator.clipboard) return;
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-mute">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink break-all">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function BankTransferInfo({ acceptance }) {
  const names = acceptance.supplierNames?.length ? acceptance.supplierNames : ["Supplier"];
  const totals = {};
  (acceptance.lines || []).forEach((line) => {
    const name = line.supplierName || "Supplier";
    totals[name] = (totals[name] || 0) + Number(line.lineTotal || 0);
  });

  return (
    <div className="mt-5 space-y-3">
      {names.map((name) => {
        const info = buildSupplierBankInfo(name);
        const amount = totals[name] != null ? Math.round(totals[name] * 100) / 100 : acceptance.total;
        return (
          <div key={name} className="border border-line rounded-xl p-4 bg-paper/40">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">Bank transfer</p>
            <h4 className="mt-1 text-sm font-bold text-brand-800">Pay {info.supplierName}</h4>
            <p className="mt-1 text-xs text-mute">
              Transfer {formatPrice(amount)} in {info.currency}. Use the RFQ / PO number as the payment reference.
            </p>
            <div className="mt-3 divide-y divide-line">
              <CopyField label="Bank" value={`${info.bankShort} (${info.bankCode}) · ${info.bankName}`} />
              <CopyField label="Account name" value={info.accountName} />
              <CopyField label="Account number" value={info.accountNumber} />
              <CopyField label="SWIFT / BIC" value={info.swift} />
              <CopyField label="FPS ID" value={info.fpsId} />
              <CopyField label="Currency" value={info.currency} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentStep({ acceptance, quotes, po, payment, onChange, onContinue, onBack }) {
  if (!acceptance?.quoteSupplierAccepted) {
    return (
      <div className="border border-dashed border-line rounded-xl px-5 py-8 text-center">
        <p className="font-semibold text-brand-800">Submit a selection first</p>
        <p className="mt-2 text-sm text-mute">Pick offers on Quotes, send them to the supplier, then wait for accept.</p>
        <button type="button" className="btn-soft mt-4 !px-5" onClick={onBack}>
          Go back
        </button>
      </div>
    );
  }

  if (!po?.supplierAccepted) {
    return (
      <div className="border border-dashed border-line rounded-xl px-5 py-8 text-center">
        <p className="font-semibold text-brand-800">Purchase Order required</p>
        <p className="mt-2 text-sm text-mute">Confirm the PO and wait for the supplier to accept it before payment.</p>
        <button type="button" className="btn-soft mt-4 !px-5" onClick={onBack}>
          Go to Purchase Order
        </button>
      </div>
    );
  }

  const method = payment?.method || "";
  const receiptName = payment?.receiptName || "";
  const supplierAccepted = Boolean(payment?.supplierAccepted);
  const isCod = method === "cod" || acceptedQuotesAreCod(acceptance, quotes);
  const canContinue = isCod ? Boolean(method) : Boolean(method && receiptName && supplierAccepted);

  function onUploadReceipt(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({
      ...payment,
      receiptName: file.name,
      supplierAccepted: false,
    });
    e.target.value = "";
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">Payment</p>
      <h3 className="mt-1 text-lg font-bold text-brand-800">Pay &amp; confirm with receipt</h3>
      <p className="mt-1 text-sm text-mute">
        {acceptance.label} · {formatPrice(acceptance.total)}
      </p>

      <DocStatus
        steps={[
          {
            n: 1,
            label: "Choose payment method",
            done: Boolean(method),
            current: !method,
          },
          {
            n: 2,
            label: "Upload payment receipt",
            hint: isCod
              ? "Optional for COD — pay on delivery. You can open Delivery now."
              : "Bank / card transfer proof.",
            done: isCod || Boolean(receiptName),
            current: !isCod && Boolean(method) && !receiptName,
          },
          {
            n: 3,
            label: "Supplier accepts receipt",
            hint: isCod ? "Not required for COD (貨到付款)." : "Supplier confirms payment received.",
            done: isCod || supplierAccepted,
            current: !isCod && Boolean(receiptName) && !supplierAccepted,
          },
        ]}
      />

      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        {[
          { id: "online", title: "Online payment", hint: "Bank transfer using the account below, then upload receipt." },
          { id: "cod", title: "COD — 貨到付款", hint: "Pay on delivery. Bank details are not required." },
        ].map((opt) => {
          const selected = method === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() =>
                onChange({
                  ...payment,
                  method: opt.id,
                  // Changing method clears prior confirm
                  supplierAccepted: false,
                })
              }
              className={`text-left border rounded-xl px-4 py-4 transition-colors ${
                selected ? "border-brand-600 bg-brand-50" : "border-line bg-white hover:border-brand-600/50"
              }`}
            >
              <p className="font-semibold text-brand-800">{opt.title}</p>
              <p className="mt-1 text-xs text-mute leading-relaxed">{opt.hint}</p>
            </button>
          );
        })}
      </div>

      {method === "online" ? <BankTransferInfo acceptance={acceptance} /> : null}

      <div className="mt-5 border border-line rounded-xl p-4">
        <p className="text-sm font-semibold text-brand-800">Payment receipt</p>
        <p className="mt-1 text-xs text-mute">
          {isCod
            ? "COD (貨到付款) — pay on delivery. Receipt and supplier accept are not required to open Delivery."
            : "Buyer uploads · supplier must accept before delivery."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="btn-soft !px-4 !py-2 cursor-pointer">
            <input type="file" accept="image/*,.pdf" className="sr-only" onChange={onUploadReceipt} />
            {receiptName ? "Replace file" : "Upload receipt"}
          </label>
          {receiptName ? (
            <span className="text-sm text-ink truncate max-w-[16rem]" title={receiptName}>
              {receiptName}
            </span>
          ) : (
            <span className="text-sm text-mute">No file yet</span>
          )}
        </div>

        {receiptName && !supplierAccepted ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-mute">Waiting for supplier to accept this receipt…</p>
            <button
              type="button"
              className="btn-primary !px-4 !py-2 text-sm"
              onClick={() => onChange({ ...payment, supplierAccepted: true })}
            >
              Simulate supplier accept
            </button>
          </div>
        ) : null}

        {supplierAccepted ? (
          <p className="mt-4 text-sm font-semibold text-brand-700 border-t border-line pt-4">
            Supplier accepted the receipt.
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn-soft !px-4 !py-2.5" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary !px-5 !py-2.5 disabled:opacity-40"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continue to delivery
        </button>
      </div>
    </div>
  );
}

function DeliveryStep({ rfq, acceptance, quotes, po, payment, delivery, onChange, onBack }) {
  if (!acceptance) {
    return (
      <div className="border border-dashed border-line rounded-xl px-5 py-8 text-center">
        <p className="font-semibold text-brand-800">No accepted selection yet</p>
        <p className="mt-2 text-sm text-mute">Complete Quotes → Purchase Order → Payment first, or jump there from the step bar.</p>
      </div>
    );
  }

  if (!canOpenDelivery(payment, acceptance, quotes, po)) {
    return (
      <div className="border border-dashed border-line rounded-xl px-5 py-8 text-center">
        <p className="font-semibold text-brand-800">Finish payment first</p>
        <p className="mt-2 text-sm text-mute">Upload receipt and wait for supplier accept, then return here. COD (貨到付款) can skip this gate.</p>
        <button type="button" className="btn-soft mt-4 !px-5" onClick={onBack}>
          Go to Payment
        </button>
      </div>
    );
  }

  const noteName = delivery?.noteName || "";
  const buyerAccepted = Boolean(delivery?.buyerAccepted);

  function onUploadNote(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({
      ...delivery,
      noteName: file.name,
      buyerAccepted: false,
    });
    e.target.value = "";
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">Delivery &amp; docs</p>
      <h3 className="mt-1 text-lg font-bold text-brand-800">Delivery note confirmation</h3>
      <p className="mt-1 text-sm text-mute">
        {acceptance.label} · {formatPrice(acceptance.total)} ·{" "}
        {payment?.method === "cod" ? "COD" : "Online"}
      </p>

      <DocStatus
        steps={[
          {
            n: 1,
            label: "Supplier uploads delivery note",
            done: Boolean(noteName),
            current: !noteName,
          },
          {
            n: 2,
            label: "Buyer accepts delivery note",
            hint: "Confirm goods / note match the order.",
            done: buyerAccepted,
            current: Boolean(noteName) && !buyerAccepted,
          },
        ]}
      />

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="block text-sm font-medium mb-1">Site / delivery address</span>
          <input className="field-input" defaultValue={rfq.address || ""} readOnly />
        </label>
      </div>

      <div className="mt-5 border border-line rounded-xl p-4">
        <p className="text-sm font-semibold text-brand-800">Delivery note</p>
        <p className="mt-1 text-xs text-mute">Supplier uploads · buyer must accept to close delivery.</p>

        {!noteName ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-mute">Waiting for supplier upload…</p>
            <label className="btn-primary !px-4 !py-2 cursor-pointer text-sm">
              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={onUploadNote} />
              Simulate supplier upload
            </label>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-ink truncate max-w-[16rem]" title={noteName}>
                {noteName}
              </span>
              <label className="btn-soft !px-3 !py-1.5 cursor-pointer text-xs">
                <input type="file" accept="image/*,.pdf" className="sr-only" onChange={onUploadNote} />
                Replace
              </label>
            </div>

            {!buyerAccepted ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-xs text-mute">Review the note, then accept as buyer.</p>
                <button
                  type="button"
                  className="btn-primary !px-4 !py-2 text-sm"
                  onClick={() => onChange({ ...delivery, buyerAccepted: true })}
                >
                  Buyer accept delivery note
                </button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-brand-700 border-t border-line pt-4">
                Buyer accepted the delivery note. Delivery complete.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn-soft !px-4 !py-2.5" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
