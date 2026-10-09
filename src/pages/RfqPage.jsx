/**
 * RFQ draft — select products, then confirm logistics on the next page.
 */
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import {
  addCustomLine,
  getProduct,
  getDraft,
  isOrderable,
  draftTotals,
  formatPrice,
  removeLine,
  removeLines,
  setDraftAddress,
  setDraftProject,
  setDraftNote,
  setDraftResponseDate,
  setDraftDeliveryDate,
  setDraftDeliveryMode,
  setDraftDeliveryLots,
  setDraftCanonicalCategory,
  setDraftAcceptSubstitutes,
  inferCanonicalCategory,
  setLineQty,
  setLineIntent,
  setLineRequestedPrice,
  rejectIfProductsOffline,
  submitRfq,
  updateCustomLine,
  requireBuyerAuth,
  openAuthModal,
  isLoggedIn,
  ensureBuyerSession,
  isAuthInviteHidden,
  setPendingCartWhatsappSubmit,
  completeCartWhatsappSubmit,
  takeLastCartWhatsappResult,
} from "../lib/store";
import { useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import CustomProductForm from "../components/CustomProductForm";
import { useLanguage } from "../i18n";
import { allProductsTo, withLocale } from "../lib/locale";
import Seo from "../components/Seo";
import { VariantA, ConfirmRfqView, CUSTOM_PLACEMENT } from "./rfq-prototype/RfqDraftVariants";
import { SHOW_RFQ } from "../lib/flags";
import { useRevealFormIssue } from "../lib/formFocus";
import { clearSpecConfirm, clearSpecMatchIfSubmitted, clearSpecQuoteDraft, readSpecConfirm, readSpecQuoteDraft, saveSpecQuoteDraft } from "../lib/specMatchSession";

export default function RfqPage() {
  const { user, draft, lastCartWhatsappResult } = useStore();
  const { t, lang } = useLanguage();
  useEffect(() => {
    if (!user?.email) return;
    ensureBuyerSession();
  }, [user?.email]);
  const [params] = useSearchParams();
  const variant = String(params.get("variant") || "A").toUpperCase();
  const customPlacement = CUSTOM_PLACEMENT[variant] || "inline";
  const specQuoteRef = useRef(readSpecQuoteDraft());
  const [specQuote, setSpecQuote] = useState(() => specQuoteRef.current);
  const sourceDraft = specQuote || draft;
  const totals = draftTotals(sourceDraft || { lines: [], note: "", responseDate: "", address: "" });

  function writeSpecQuote(patch) {
    const next = { ...(specQuoteRef.current || {}), ...patch };
    specQuoteRef.current = next;
    saveSpecQuoteDraft(next);
    setSpecQuote(next);
  }

  function saveLogistics(fields) {
    if (specQuoteRef.current) {
      writeSpecQuote(fields);
      return;
    }
    setDraftNote(fields.note);
    setDraftResponseDate(fields.responseDate);
    setDraftDeliveryDate(fields.deliveryDate);
    setDraftDeliveryMode(fields.deliveryMode);
    setDraftDeliveryLots(fields.deliveryLots);
    setDraftProject(fields.project);
    setDraftAddress(fields.address);
    setDraftCanonicalCategory(fields.canonicalCategory);
    setDraftAcceptSubstitutes(fields.acceptSubstitutes);
  }
  const profileProjects = Array.isArray(user?.projects) && user.projects.length ? user.projects : String(user?.project || "").trim() ? [user.project] : [];
  const profileAddress = String(user?.companyAddress || "").trim();
  const [note, setNote] = useState(totals.note || "");
  const [responseDate, setResponseDate] = useState(totals.responseDate || "");
  const [deliveryDate, setDeliveryDate] = useState(totals.deliveryDate || "");
  const [deliveryMode, setDeliveryMode] = useState(totals.deliveryMode || "one_time");
  const [deliveryLots, setDeliveryLots] = useState(totals.deliveryLots || []);
  const [project, setProject] = useState(totals.project || "");
  const [address, setAddress] = useState(totals.address || profileAddress);
  const [canonicalCategory, setCanonicalCategory] = useState(totals.canonicalCategory || "");
  const [acceptSubstitutes, setAcceptSubstitutes] = useState(Boolean(totals.acceptSubstitutes));
  const [success, setSuccess] = useState(null);
  const [formError, setFormError] = useState("");
  const [formErrorKind, setFormErrorKind] = useState("");
  const [formErrorField, setFormErrorField] = useState("");
  const [successKind, setSuccessKind] = useState("");
  const [wizardStep, setWizardStep] = useState(1);
  const specConfirm = readSpecConfirm();
  const specConfirmIds = useRef(specConfirm ? new Set(specConfirm.ids) : null);
  useEffect(() => {
    if (specConfirmIds.current || !specQuoteRef.current) return;
    clearSpecQuoteDraft();
    specQuoteRef.current = null;
    setSpecQuote(null);
  }, []);
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState(() =>
    specConfirm?.ids?.length ? specConfirm.ids.map(String) : totals.lines.map((l) => String(l.productId))
  );
  const [editingId, setEditingId] = useState(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [confirmKind, setConfirmKind] = useState(specConfirm ? "quote" : null);
  const [confirmChannel, setConfirmChannel] = useState("rfq");
  const submitLock = useRef(false);
  const { revealIssue } = useRevealFormIssue();

  const selectableLineIds = totals.lines
    .filter((line) => line.custom || isOrderable(getProduct(line.productId)))
    .map((line) => String(line.productId));

  useEffect(() => {
    const allowed = new Set(selectableLineIds);
    setSelectedIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [selectableLineIds.join("|")]);

  useEffect(() => {
    setNote(totals.note || "");
    setResponseDate(totals.responseDate || "");
    setDeliveryDate(totals.deliveryDate || "");
    setDeliveryMode(totals.deliveryMode || "one_time");
    setDeliveryLots(totals.deliveryLots || []);
    setProject(totals.project || "");
    setAddress(totals.address || profileAddress);
    setCanonicalCategory(totals.canonicalCategory || "");
    setAcceptSubstitutes(Boolean(totals.acceptSubstitutes));
  }, [
    totals.note,
    totals.responseDate,
    totals.deliveryDate,
    totals.deliveryMode,
    JSON.stringify(totals.deliveryLots || []),
    totals.project,
    totals.address,
    profileAddress,
    totals.canonicalCategory,
    totals.acceptSubstitutes,
  ]);

  useEffect(() => {
    if (specQuoteRef.current) {
      if (!String(specQuoteRef.current.address || "").trim() && profileAddress) writeSpecQuote({ address: profileAddress });
      return;
    }
    if (String(totals.address || "").trim() || !profileAddress) return;
    setDraftAddress(profileAddress);
  }, [totals.address, profileAddress]);

  const lineIdsKey = totals.lines.map((l) => String(l.productId)).join(",");

  useEffect(() => {
    const ids = lineIdsKey ? lineIdsKey.split(",") : [];
    setSelectedIds((prev) => {
      if (specConfirmIds.current) {
        const next = ids.filter((id) => specConfirmIds.current.has(id));
        if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
        return next;
      }
      const keep = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !prev.includes(id));
      const next = [...keep, ...added];
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
    if (editingId && !ids.includes(String(editingId))) setEditingId(null);
  }, [lineIdsKey, editingId]);

  const selectedKey = selectedIds.join(",");
  useEffect(() => {
    if (canonicalCategory) return;
    const selected = new Set(selectedKey ? selectedKey.split(",") : []);
    const quoteLines = totals.lines.filter(
      (line) => line.intent !== "buy" && selected.has(String(line.productId))
    );
    const inferred = inferCanonicalCategory(quoteLines);
    if (inferred) {
      setCanonicalCategory(inferred);
      if (specQuoteRef.current) writeSpecQuote({ canonicalCategory: inferred });
      else setDraftCanonicalCategory(inferred);
    }
  }, [canonicalCategory, selectedKey, lineIdsKey, totals.lines]);

  const selectedTotals = useMemo(
    () => draftTotals(sourceDraft || { lines: [] }, selectedIds),
    [sourceDraft, selectedIds]
  );

  useEffect(() => {
    if (!lastCartWhatsappResult?.rfq) return;
    const result = takeLastCartWhatsappResult();
    if (!result?.rfq) return;
    setFormError("");
    setFormErrorKind("");
    setFormErrorField("");
    setConfirmKind(null);
    setConfirmChannel("rfq");
    setSuccess(result.rfq);
    setSuccessKind(result.kind);
    clearSpecMatchIfSubmitted([...(specConfirmIds.current || [])]);
    clearSpecConfirm();
    specConfirmIds.current = null;
  }, [lastCartWhatsappResult]);

  const allSelected =
    selectableLineIds.length > 0 && selectedIds.length === selectableLineIds.length &&
    selectableLineIds.every((id) => selectedIds.includes(id));

  function handleAddCustom(payload) {
    if (!requireBuyerAuth({ custom: true })) return;
    const result = addCustomLine(payload);
    if (!result.ok) {
      setFormError(t("customNameRequired"));
      return;
    }
    setShowAddCustom(false);
    setFormError("");
  }

  function handleUpdateCustom(productId, payload) {
    const result = updateCustomLine(productId, payload);
    if (!result.ok) {
      setFormError(t("customNameRequired"));
      return;
    }
    setEditingId(null);
    setFormError("");
  }

  if (success) {
    const remainingCount = (draft?.lines || []).length;
    return (
      <Shell>
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{t("submitted")}</p>
            <h2 className="mt-1 text-xl font-bold text-brand-800">
              {successKind === "buy" ? t("rfqSentBuy") : successKind === "quote" ? t("rfqSentQuote") : t("rfqSent")}
            </h2>
            <p className="mt-2 text-sm text-mute">
              {success.id} · {success.lines.length} line(s) · {formatPrice(success.pricedSubtotal)}
            </p>
            {success.channel !== "whatsapp" && success.buyerEmail && !String(success.buyerEmail).startsWith("guest@") ? (
              <p className="mt-2 text-sm font-medium text-brand-800">{t("rfqEmailSent", { email: success.buyerEmail })}</p>
            ) : null}
            {success.channel === "whatsapp" ? (
              <p className="mt-2 text-sm font-medium text-brand-800">
                {user?.email && !String(success.buyerEmail || "").startsWith("guest@")
                  ? t("waSavedInSubbie")
                  : t("waDraftReadyGuest")}
              </p>
            ) : null}
            {remainingCount > 0 ? (
              <p className="mt-3 text-sm font-medium text-brand-800">
                {remainingCount === 1
                  ? t("draftRemainingOne")
                  : t("draftRemaining", { n: remainingCount })}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {remainingCount > 0 ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setSuccess(null);
                    setSuccessKind("");
                    setConfirmKind(null);
                  }}
                >
                  {t("continueRemainingDraft")}
                </button>
              ) : null}
              <Link to={allProductsTo(lang)} className={remainingCount > 0 ? "btn-soft !border-brand-600 !text-brand-600" : "btn-primary"}>
                {t("keepShopping")}
              </Link>
              {SHOW_RFQ && user?.email ? (
              <Link to={withLocale(lang, "/rfqs")} className="btn-soft !border-brand-600 !text-brand-600">
                {t("viewMyRfqs")}
              </Link>
              ) : null}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (!totals.lines.length) {
    const member = Boolean(user?.email);
    return (
      <Shell>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-10 space-y-4">
          <div className="bg-white border border-line rounded-xl p-8 text-center">
            <p className="text-lg font-semibold text-brand-800">{t("emptyDraft")}</p>
            <p className="mt-2 text-sm text-mute">{t("emptyDraftHint")}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link to={allProductsTo(lang)} className="btn-soft">
                {t("browseCatalog")}
              </Link>
              {member ? (
                <a href="#add-custom-product" className="btn-primary">
                  + {t("noProductsCustomCta")}
                </a>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => requireBuyerAuth()}
                >
                  + {t("noProductsCustomCta")}
                </button>
              )}
            </div>
            {member ? (
              <p className="mt-4 text-sm text-mute">{t("emptyDraftCustomHint")}</p>
            ) : null}
          </div>
          {member ? (
            <div
              id="add-custom-product"
              className="bg-white border border-line rounded-xl p-6 sm:p-8"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 mb-2">
                {t("customItem")}
              </p>
              <h2 className="font-display text-2xl font-semibold text-brand-800 leading-tight">
                {t("addCustomProduct")}
              </h2>
              <p className="mt-2 text-sm text-mute leading-relaxed">{t("customProductHint")}</p>
              <div className="mt-5">
                <CustomProductForm compact onSubmit={handleAddCustom} />
              </div>
            </div>
          ) : null}
        </div>
      </Shell>
    );
  }

  function toggleId(id) {
    const key = String(id);
    if (!selectableLineIds.includes(key) && !selectedIds.includes(key)) return;
    if (!selectableLineIds.includes(key)) {
      setSelectedIds((prev) => prev.filter((x) => x !== key));
      return;
    }
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    setFormError("");
    setFormErrorKind("");
  }

  function toggleAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(selectableLineIds);
    setFormError("");
    setFormErrorKind("");
  }

  function toggleSection(ids) {
    const keys = ids.map(String).filter((id) => selectableLineIds.includes(id));
    const allOn = keys.length > 0 && keys.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allOn ? prev.filter((id) => !keys.includes(id)) : [...new Set([...prev, ...keys])]
    );
    setFormError("");
    setFormErrorKind("");
  }

  function onContinueKind(kind, channel = "rfq") {
    const viaWhatsapp = channel === "whatsapp";
    if (!viaWhatsapp && !requireBuyerAuth()) return;
    const ids = totals.lines
      .filter((line) => (kind === "buy" ? line.intent === "buy" : line.intent !== "buy"))
      .map((line) => String(line.productId))
      .filter((id) => selectedIds.includes(id));
    if (!ids.length) {
      setFormErrorKind(kind);
      setFormError(t("noneSelected"));
      revealIssue();
      return;
    }
    const blocked = ids.filter((id) => {
      const line = totals.lines.find((row) => String(row.productId) === id);
      return line && !line.custom && !isOrderable(getProduct(id));
    });
    if (blocked.length) {
      setFormErrorKind(kind);
      setFormError(t("discontinuedSubmitError"));
      revealIssue();
      return;
    }
    setFormError("");
    setFormErrorKind("");
    setFormErrorField("");
    if (kind === "buy" || kind === "quote") {
      saveLogistics({
        note,
        responseDate,
        deliveryDate,
        deliveryMode,
        deliveryLots,
        project,
        address,
        canonicalCategory,
        acceptSubstitutes,
      });
      setConfirmChannel(viaWhatsapp ? "whatsapp" : "rfq");
      setConfirmKind(kind);
      window.scrollTo(0, 0);
      return;
    }
    setConfirmChannel(viaWhatsapp ? "whatsapp" : "rfq");
    setConfirmKind(kind);
    window.scrollTo(0, 0);
  }

  function linesBelowMoq(ids) {
    return totals.lines.filter((line) => {
      if (!ids.includes(String(line.productId))) return false;
      if (line.custom) return false;
      const moq = Math.max(1, Number(line.moq) || 1);
      return Number(line.qty) < moq;
    });
  }

  async function onSubmitKind(kind) {
    if (submitLock.current) return;
    submitLock.current = true;
    const viaWhatsapp = confirmChannel === "whatsapp";
    try {
    if (!viaWhatsapp && !requireBuyerAuth()) return;
    const ids = totals.lines
      .filter((line) => (kind === "buy" ? line.intent === "buy" : line.intent !== "buy"))
      .map((line) => String(line.productId))
      .filter((id) => selectedIds.includes(id));
    const under = linesBelowMoq(ids);
    if (under.length) {
      setFormErrorKind(kind);
      setFormError(t("qtyBelowMoq", { n: under[0].moq || 1 }));
      revealIssue();
      return;
    }
    const offline = await rejectIfProductsOffline(ids);
    if (!offline.ok) {
      setFormErrorKind(kind);
      setFormErrorField("discontinued");
      setFormError(t("discontinuedSubmitError"));
      revealIssue();
      return;
    }
    saveLogistics({
      note,
      responseDate,
      deliveryDate,
      deliveryMode,
      deliveryLots,
      project,
      address,
      canonicalCategory,
      acceptSubstitutes,
    });
    if (viaWhatsapp) {
      if (!isLoggedIn() && !isAuthInviteHidden()) {
        setPendingCartWhatsappSubmit({ kind, ids });
        openAuthModal("invite");
        return;
      }
      const result = completeCartWhatsappSubmit({ kind, ids });
      if (!result.ok) {
        setFormErrorKind(kind);
        setFormErrorField(result.error || "");
        if (result.error === "none_selected") setFormError(t("noneSelected"));
        else if (result.error === "discontinued") setFormError(t("discontinuedSubmitError"));
        else setFormError(t("submitFailed"));
        revealIssue();
        return;
      }
      setFormError("");
      setFormErrorKind("");
      setFormErrorField("");
      setConfirmKind(null);
      setConfirmChannel("rfq");
      setSuccess(result.rfq);
      setSuccessKind(kind);
      clearSpecMatchIfSubmitted(ids);
      clearSpecConfirm();
      specConfirmIds.current = null;
      return;
    }
    const quotingSpec = Boolean(specQuoteRef.current);
    const result = submitRfq(ids, quotingSpec ? { kind, channel: "rfq", draft: specQuoteRef.current } : { kind, channel: "rfq" });
    if (!result.ok) {
      setFormErrorKind(kind);
      setFormErrorField(result.error || "");
      if (result.error === "response_date") setFormError(t("responseDateRequired"));
      else if (result.error === "delivery_date") setFormError(t("deliveryDateRequired"));
      else if (result.error === "delivery_lots") setFormError(t("deliveryLotsRequired"));
      else if (result.error === "address") setFormError(kind === "buy" ? t("buyNeedsAddress") : t("addressRequired"));
      else if (result.error === "none_selected") setFormError(t("noneSelected"));
      else if (result.error === "discontinued") setFormError(t("discontinuedSubmitError"));
      else setFormError(t("submitFailed"));
      revealIssue();
      return;
    }
    if (quotingSpec) {
      clearSpecQuoteDraft();
      specQuoteRef.current = null;
      setSpecQuote(null);
    } else {
      removeLines(ids);
    }
    clearSpecMatchIfSubmitted(ids);
    clearSpecConfirm();
    specConfirmIds.current = null;
    setFormError("");
    setFormErrorKind("");
    setFormErrorField("");
    setConfirmKind(null);
    setConfirmChannel("rfq");
    setSuccess(result.rfq);
    setSuccessKind(kind);
    } finally {
      submitLock.current = false;
    }
  }

  function onSubmit() {
    onSubmitKind("quote");
  }

  function onConfirmBack() {
    if (specConfirmIds.current) {
      clearSpecConfirm();
      clearSpecQuoteDraft();
      specQuoteRef.current = null;
      setSpecQuote(null);
      specConfirmIds.current = null;
      navigate(withLocale(lang, "/spec-match"));
      return;
    }
    setConfirmKind(null);
  }

  function setWorkingLineQty(productId, qty) {
    if (!specQuoteRef.current) {
      setLineQty(productId, qty);
      return;
    }
    writeSpecQuote({
      lines: specQuoteRef.current.lines.map((line) =>
        String(line.productId) === String(productId) ? { ...line, qty: Math.max(1, Math.floor(Number(qty)) || 1) } : line
      ),
    });
  }

  function removeWorkingLine(productId) {
    if (!specQuoteRef.current) {
      removeLine(productId);
      return;
    }
    writeSpecQuote({
      lines: specQuoteRef.current.lines.filter((line) => String(line.productId) !== String(productId)),
    });
  }

  const variantProps = {
    lines: totals.lines,
    selectedIds,
    selectedTotals,
    allSelected,
    note,
    responseDate,
    deliveryDate,
    deliveryMode,
    deliveryLots,
    project,
    address,
    canonicalCategory,
    acceptSubstitutes,
    formError,
    formErrorKind,
    formErrorField,
    toggleId,
    toggleAll,
    toggleSection,
    onSubmitKind,
    onContinueKind,
    confirmKind,
    confirmChannel,
    setConfirmKind,
    setLineQty: setWorkingLineQty,
    setLineIntent,
    setLineRequestedPrice,
    removeLine: removeWorkingLine,
    removeLines,
    setNote,
    setResponseDate,
    setDeliveryDate,
    setDeliveryMode,
    setDeliveryLots,
    setProject,
    setAddress,
    setCanonicalCategory,
    setAcceptSubstitutes,
    setDraftNote,
    setDraftResponseDate,
    setDraftDeliveryDate,
    setDraftDeliveryMode,
    setDraftDeliveryLots,
    setDraftProject,
    setDraftAddress,
    setDraftCanonicalCategory,
    profileProjects,
    setDraftAcceptSubstitutes,
    marketplaceRfqEnabled: Boolean(user?.email),
    onSubmit,
    setFormError: (msg) => {
      setFormError(msg);
      if (!msg) setFormErrorField("");
    },
    wizardStep,
    setWizardStep,
    editingId,
    setEditingId,
    showAddCustom,
    showAddCustom,
    setShowAddCustom,
    onToggleAddCustom: () => {
      if (!requireBuyerAuth()) return;
      setEditingId(null);
      setShowAddCustom((v) => !v);
    },
    onAddCustom: handleAddCustom,
    onUpdateCustom: handleUpdateCustom,
    customPlacement,
    onBack: onConfirmBack,
  };

  return (
    <Shell>
      {confirmKind ? (
        <ConfirmRfqView {...variantProps} />
      ) : (
        <VariantA {...variantProps} />
      )}
    </Shell>
  );
}

function Shell({ children }) {
  const { t, lang } = useLanguage();
  useStore();
  const specFile = getDraft().specFile;
  return (
    <div className="bg-paper min-h-screen">
      <Seo lang={lang} path={withLocale(lang, "/rfq")} title={`${t("rfqDraftTitle")} | Mattex Marketplace`} description={t("reviewQuoteHint")} noindex />
      <SiteHeader fluid />
      {specFile?.url ? (
        <p className="w-full px-4 sm:px-6 lg:px-8 pt-4 text-sm text-ink">
          <a className="font-semibold text-brand-700 hover:underline" href={specFile.url} target="_blank" rel="noreferrer">
            {specFile.name}
          </a>
        </p>
      ) : null}
      {children}
    </div>
  );
}
