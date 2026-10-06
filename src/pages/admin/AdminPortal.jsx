import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../../hooks/useStore";
import { PasswordChecklist, PasswordInput } from "../../components/AccountForm";
import AttachmentLinks, { linePhotoSrc, PreviewThumb } from "../../components/AttachmentLinks";
import { buildQuotePdf, downloadBlob } from "../../lib/quotePdf";
import { compressImageFile, PRODUCT_IMAGE_MAX, productImageList } from "../../lib/compressImage";
import { uploadCatalogImage } from "../../lib/catalogImage";

function legacyImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  const path = value.split("?")[0];
  if (path.startsWith("/assets/") || value.includes("www-cms.mattex.com.hk")) return value;
  return "";
}
import { marketplaceHomeHref } from "../../lib/origins";
import {
  groupOf,
  groupSelectedProducts,
  releaseSelectedProducts,
  saveCatalogGroups,
  useCatalogGroups,
} from "../../lib/catalogGroups";
import { phoneSlotLabel } from "../../lib/phone";
import {
  addAdminCategory,
  createAdminProduct,
  createStaff,
  resendStaffInvite,
  updateStaff,
  changeOwnStaffPassword,
  decideRfq,
  decideRfqCancel,
  decideRfqReverse,
  deliverAdminAlertEmails,
  formatPrice,
  displayLeadTime,
  disableStaff,
  enableStaff,
  hardDeleteStaff,
  canDeleteStaffForever,
  hardDeleteBuyer,
  canDeleteBuyerForever,
  listAssignableBuyers,
  dismissProductReport,
  fixProductReport,
  getAdminCategories,
  listAdminCategories,
  renameAdminCategory,
  deleteAdminCategory,
  assignAdminProductsCategory,
  restoreAdminProduct,
  getAllRfqs,
  getStaffList,
  getStaffSession,
  getCatalogSyncError,
  importAdminCsv,
  inboxStatus,
  listAdminProducts,
  listSalesUnits,
  listBuyers,
  loginStaff,
  logoutStaff,
  markAdminAlertsSeen,
  pullSharedStore,
  refreshRemoteRfqs,
  assignRfqToBuyer,
  setRfqBuyerPhone,
  buyerWhatsappHref,
  createGuestQuoteSnapshot,
  markGuestQuoteWhatsappSent,
  rfqQuotedOffline,
  rfqCanSendWhatsappQuote,
  formatBuyerPhoneDisplay,
  getProduct,
  productSkuId,
  publishAdminProduct,
  unpublishAdminProduct,
  productCatalogStatus,
  publishHardBlockers,
  publishWarnBlockers,
  quotePdfItems,
  quoteRfqToBuyer,
  quoteVersionList,
  quoteDraftIsDirty,
  rfqLinesForQuoteVersion,
  loadQuoteVersionIntoDraft,
  applyRfqRequestVersion,
  rfqRequestEffectiveVersionNo,
  requestAdminNotifyPermission,
  rfqBuyerKind,
  isDev1InboxRfq,
  rfqProjectName,
  setRfqLineNoOffer,
  setRfqLineQty,
  setRfqLineQuotedPrice,
  setRfqLineRemark,
  setBuyerEnabled,
  showAdminWebNotification,
  softDeleteAdminProduct,
  hardDeleteAdminProduct,
  canDeleteProductForever,
  rejectBuyer,
  updateAdminProduct,
  uploadRfqToTms,
  deliverRfqAcceptedEmail,
  deliverRfqNoOfferEmail,
  deliverRfqCancelAcceptedEmail,
  deliverRfqCancelDeclinedEmail,
  deliverRfqReverseAcceptedEmail,
  deliverRfqReverseDeclinedEmail,
  rfqLastActivity,
  rfqActivityLabel,
  formatQuoteVersionStamp,
  hydrateRfqDecisionActivity,
} from "../../lib/store";
import { submitRfqToTms } from "../../lib/tmsSubmit";
import { downloadProductExcelTemplate, excelFileToCsv } from "../../lib/excelImport";
import { clearTmsSession } from "../../lib/tmsSession";
import { transactedRefsForLine } from "../../lib/tmsTransacted";
import QuoteVersionSelect, { DRAFT_VALUE, RfqRequestVersionSelect } from "../../components/QuoteVersionSelect";
import RfqActivityLog from "../../components/RfqActivityLog";
import { SHOW_PRODUCT_IMPORT, SHOW_RFQ_QUOTES } from "../../lib/flags";
import BannersPanel from "./BannersPanel";

const NAV = [
  { id: "rfqs", label: "RFQ inbox" },
  { id: "products", label: "Products" },
  { id: "banners", label: "Banners" },
  { id: "accounts", label: "Accounts" },
];

const PRODUCT_SOURCES = [
  { id: "mattex", label: "Mattex Products" },
  { id: "category", label: "Product Category" },
  { id: "chain", label: "Mattex Chain Products" },
];

const ACCOUNT_SOURCES = [
  { id: "sales", label: "Sales" },
  { id: "buyer", label: "Buyer" },
];

const ACCOUNT_STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "invited", label: "Invited" },
  { id: "disabled", label: "Disabled" },
];

const BUYER_STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "disabled", label: "Disabled" },
  { id: "rejected", label: "Rejected" },
];

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "unpublished", label: "Unpublish" },
  { id: "deleted", label: "Removed" },
];

const RFQ_ACTION_TAB = { id: "action", label: "Pending" };

const STICKY_ACTION_TH =
  "sticky right-0 top-0 z-20 bg-brand-50 px-3 py-2 shadow-[-8px_0_12px_-8px_rgba(16,21,19,0.2)]";
const STICKY_ACTION_TD =
  "sticky right-0 z-[1] bg-white px-3 py-2 shadow-[-8px_0_12px_-8px_rgba(16,21,19,0.14)]";

const RFQ_STATUS_TABS = [
  RFQ_ACTION_TAB,
  { id: "all", label: "All" },
  { id: "received", label: "Received" },
  { id: "reviewing", label: "Reviewing" },
  { id: "reverse", label: "Reverse requested" },
  { id: "cancel", label: "Cancel requested" },
  { id: "tms", label: "Accepted" },
  { id: "accepted", label: "iRFQ created" },
  { id: "revising", label: "Revising" },
  { id: "returned", label: "Returned" },
  { id: "quoted", label: "Quoted" },
  { id: "rejected", label: "No Offer Rejected" },
  { id: "cancelled", label: "Cancelled" },
];

const RFQ_STATUS_TABS_SLICE = [
  RFQ_ACTION_TAB,
  { id: "all", label: "All" },
  { id: "accepted", label: "In review" },
  { id: "revising", label: "Revising" },
  { id: "rejected", label: "No Offer Rejected" },
  { id: "cancelled", label: "Cancelled" },
];

function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {" *"}
    </span>
  );
}

function leadLabel(p) {
  return displayLeadTime(p);
}

function productStatusKey(p) {
  return productCatalogStatus(p);
}

function statusLabel(p) {
  const key = productCatalogStatus(p);
  if (key === "deleted") return "Removed";
  if (key === "unpublished") return "Unpublish";
  return "Published";
}

const STATUS_CHIP = {
  published: "bg-emerald-100 text-emerald-800",
  unpublished: "bg-slate-100 text-slate-800",
  draft: "bg-amber-100 text-amber-950",
  hold: "bg-orange-100 text-orange-900",
  deleted: "bg-red-100 text-red-800",
};

const PUBLISH_BLOCKER_LABELS = {
  officialSku: "Provisional SKU ID",
  category: "Category",
  name: "Name",
  unit: "Unit",
  moq: "MOQ",
  lead: "Lead time",
  duplicateSku: "Duplicate SKU",
};

function blockerText(keys) {
  return (keys || []).map((key) => PUBLISH_BLOCKER_LABELS[key] || key).join(", ");
}

const PRODUCT_TABLE_HEADS = [
  { key: "officialSku", label: "Provisional SKU ID" },
  { key: "category", label: "Category" },
  { key: "name", label: "IMG + Product name" },
  { key: "size", label: "Size / Description" },
  { key: "certs", label: "Certifications / Relevant Reports" },
  { key: "spec", label: "Primary Spec Description" },
  { key: "tag", label: "Tag (Green / Hit / Tailor Made)" },
  { key: "unit", label: "Sales Unit" },
  { key: "moq", label: "MOQ" },
  { key: "lead", label: "Lead Time" },
  { key: "purposes", label: "Purposes (Indicator for Searching)" },
  { key: "remark", label: "Remark" },
];

function StatusBadge({ product }) {
  const key = productStatusKey(product);
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CHIP[key]}`}>
      {statusLabel(product)}
    </span>
  );
}

function cellText(value) {
  const text = String(value || "").trim();
  return text || "—";
}

function productLeadLabel(p) {
  return cellText(displayLeadTime(p));
}

function productPrimarySpec(p) {
  const own = String(p.primarySpec || "").trim();
  if (own) return own;
  const specs = Array.isArray(p.specs) ? p.specs : [];
  const skip = /^(size|cert|sales unit|moq|lead|use):/i;
  const line = specs.find((item) => !skip.test(String(item)));
  return String(line || "").trim();
}

function lineAttachmentList(line) {
  return Array.isArray(line?.attachments) ? line.attachments.filter((file) => file?.name || file?.url) : [];
}

function lineImageSrc(line, product) {
  if (line?.custom) return linePhotoSrc(line);
  if (product?.image) return product.image;
  if (line?.image) return line.image;
  return linePhotoSrc(line);
}

function ProductThumb({ product }) {
  if (product.image) {
    return <img src={product.image} alt="" className="h-11 w-11 shrink-0 rounded-md border border-line bg-white object-cover" />;
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-line bg-paper text-[9px] font-semibold uppercase tracking-wide text-mute">
      Gen
    </span>
  );
}

function ProductTagChips({ product }) {
  const tags = [
    product.green ? { id: "green", label: "Green", className: "bg-emerald-100 text-emerald-800" } : null,
    product.hit ? { id: "hit", label: "Hit", className: "bg-orange-100 text-orange-900" } : null,
    product.tailorMade ? { id: "tailor", label: "Tailor Made", className: "bg-brand-100 text-brand-800" } : null,
  ].filter(Boolean);
  if (!tags.length) return "—";
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag.id} className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tag.className}`}>
          {tag.label}
        </span>
      ))}
    </span>
  );
}

function productRowLabel(p) {
  return productSkuId(p) || p.name || p.id;
}

function statusCounts(products) {
  const counts = { all: products.length, published: 0, unpublished: 0, deleted: 0 };
  products.forEach((p) => {
    counts[productStatusKey(p)] += 1;
  });
  return counts;
}

async function inviteSentLabel(result, who) {
  if (!result?.href) return `Invite email sent to ${who}.`;
  try {
    await navigator.clipboard.writeText(result.href);
    return `Invite sent to ${who}. Link copied — paste it to them if the email does not arrive.`;
  } catch {
    return `Invite sent to ${who}.`;
  }
}

function accountStatusKey(u) {
  if (u.approvalStatus === "rejected") return "rejected";
  if (u.enabled === false) return "disabled";
  if (u.invitePending) return "invited";
  return "active";
}

function accountStatusLabel(u) {
  if (!u) return "No marketplace account";
  if (u.approvalStatus === "rejected") return "Rejected";
  if (u.enabled === false) return "Disabled";
  if (u.invitePending) return "Invited";
  return "Active";
}

const ACCOUNT_STATUS_CHIP = {
  new: "bg-sky-100 text-sky-900",
  invited: "bg-violet-100 text-violet-900",
  active: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-50 text-red-800",
  disabled: "bg-slate-100 text-slate-600",
  missing: "bg-paper text-mute",
};

function AccountStatusChip({ account }) {
  const key = account ? accountStatusKey(account) : "missing";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACCOUNT_STATUS_CHIP[key]}`}>
      {accountStatusLabel(account)}
    </span>
  );
}

function accountCounts(rows) {
  const counts = { all: rows.length, active: 0, disabled: 0, new: 0, invited: 0, rejected: 0 };
  rows.forEach((u) => {
    counts[accountStatusKey(u)] += 1;
  });
  return counts;
}

function searchNeedle(q) {
  return String(q || "").trim().toLowerCase();
}

function matchesSearch(needle, ...parts) {
  if (!needle) return true;
  return parts.some((part) => String(part || "").toLowerCase().includes(needle));
}

function productSearchHay(p) {
  return [
    p.name,
    p.productNo,
    p.provisionalSku,
    p.id,
    p.category,
    p.sizeDesc,
    p.remark,
    p.certifications,
    p.standard,
    p.primarySpec,
    statusLabel(p),
    (p.purposes || []).join(" "),
  ];
}

function accountSearchHay(u) {
  return [
    u.name,
    u.email,
    u.companyName,
    u.companyReg,
    u.phone,
    u.companyPhone,
    u.jobTitle,
    u.bootstrap ? "bootstrap" : "staff",
    accountStatusLabel(u),
  ];
}

function rfqSearchHay(rfq) {
  const lines = rfq.lines || [];
  return [
    rfq.id,
    rfq.buyerName,
    rfq.buyerEmail,
    rfq.tmsDocumentNo,
    rfq.project,
    rfqProjectName(rfq),
    rfq.channel,
    rfqInboxLabel(rfq),
    ...lines.flatMap((line) => [line.name, line.productNo]),
  ];
}

function ChevronIcon({ open }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} fill="none" aria-hidden>
      <path d="M6 3.5 11 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function findReportedProduct(products, report) {
  if (!report) return null;
  return products.find((p) => p.id === report.productId) || products.find((p) => p.productNo && p.productNo === report.productNo) || null;
}

export default function AdminPortal() {
  const { staff, allRfqs, reports, adminAlerts } = useStore();
  const [params, setSearchParams] = useSearchParams();
  const focusRfqId = String(params.get("rfq") || params.get("id") || "").trim();
  const focusBuyerParam = String(params.get("buyer") || "").trim();
  const [page, setPage] = useState(focusRfqId ? "rfqs" : focusBuyerParam ? "accounts" : "rfqs");
  const [jumpAlert, setJumpAlert] = useState(null);
  const mailedAlertIds = useRef(new Set());
  const notifiedAlertIds = useRef(new Set());
  const [productSource, setProductSource] = useState("mattex");
  const [productsNavOpen, setProductsNavOpen] = useState(false);
  const [accountSource, setAccountSource] = useState(focusBuyerParam && !focusRfqId ? "buyer" : "sales");
  const [accountsNavOpen, setAccountsNavOpen] = useState(Boolean(focusBuyerParam && !focusRfqId));
  const [focusBuyerEmail, setFocusBuyerEmail] = useState(focusBuyerParam && !focusRfqId ? focusBuyerParam : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [editing, setEditing] = useState("");
  const [focusReport, setFocusReport] = useState(null);
  const [jumpProductId, setJumpProductId] = useState("");
  const [flash, setFlash] = useState("");
  const [flashError, setFlashError] = useState(false);
  const [inboxHomeKey, setInboxHomeKey] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwOk, setPwOk] = useState("");
  const products = listAdminProducts();

  useEffect(() => {
    if (focusRfqId) {
      setPage("rfqs");
      return;
    }
    if (focusBuyerParam) {
      setFocusBuyerEmail(focusBuyerParam);
      setAccountSource("buyer");
      setAccountsNavOpen(true);
      setPage("accounts");
    }
  }, [focusRfqId, focusBuyerParam]);

  useEffect(() => {
    if (!staff) return;
    requestAdminNotifyPermission();
  }, [staff]);

  useEffect(() => {
    if (!staff?.email || page !== "rfqs") return undefined;
    refreshRemoteRfqs();
    const timer = window.setInterval(() => refreshRemoteRfqs(), 15000);
    return () => window.clearInterval(timer);
  }, [staff?.email, page]);

  useEffect(() => {
    if (!staff) return undefined;
    const alerts = Array.isArray(adminAlerts) ? adminAlerts : [];
    const now = Date.now();
    const fresh = alerts.filter((alert) => {
      const created = new Date(alert.createdAt).getTime();
      return Number.isFinite(created) && now - created < 120000;
    });
    const toMail = fresh.filter((alert) => !alert.mailed && !mailedAlertIds.current.has(alert.id));
    if (toMail.length) {
      toMail.forEach((alert) => mailedAlertIds.current.add(alert.id));
      deliverAdminAlertEmails(toMail);
    }
    fresh.forEach((alert) => {
      if (notifiedAlertIds.current.has(alert.id)) return;
      notifiedAlertIds.current.add(alert.id);
      showAdminWebNotification(alert.title, alert.body, alert.href);
    });
    const unseen = alerts.filter((alert) => !alert.seen);
    setJumpAlert(unseen[0] || null);
    return undefined;
  }, [staff, adminAlerts]);

  useEffect(() => {
    if (!jumpAlert) return undefined;
    const timer = window.setTimeout(() => setJumpAlert(null), 6000);
    return () => window.clearTimeout(timer);
  }, [jumpAlert]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => {
      setFlash("");
      setFlashError(false);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function note(result, fallback) {
    if (!result?.ok) {
      setFlashError(true);
      const reason = result?.error;
      setFlash(
        reason === "staff"
          ? "Sign in as sales staff to change this."
          : reason === "published"
            ? "Unpublish this product before Delete forever."
            : reason === "reason"
              ? "Enter a rejection reason."
              : reason === "in_use"
                ? "Move products out of this category first."
                : reason === "save" || reason === "quota"
                ? "這次未送出，稍後再試"
                : reason === "not_configured"
                  ? "Email is not set up on this computer. The RFQ change was saved."
                  : reason || "Unable to save"
      );
    } else {
      setFlashError(false);
      setFlash(fallback || "Saved");
    }
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-charcoal text-white font-sans">
        <header className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/assets/mattex-logo.webp" alt="" className="h-8 w-auto shrink-0 brightness-0 invert" />
            <span className="block text-[15px] sm:text-lg font-semibold tracking-tight leading-tight">
              Mattex Marketplace Admin Portal
            </span>
          </div>
          <a href={marketplaceHomeHref("en")} className="shrink-0 text-xs text-white/60 hover:text-white">
            Marketplace
          </a>
        </header>
        <main className="mx-auto max-w-md px-4 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">Staff only</p>
          <h1 className="mt-2 font-display text-3xl">Mattex Sales portal</h1>
          <p className="mt-2 text-sm text-white/60">Product ops, Excel, buyer accounts, RFQ review, TMS upload.</p>
          <form
            className="mt-8 space-y-4 rounded-2xl bg-white p-6 text-ink"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginBusy(true);
              setError("");
              const result = await loginStaff({ email, password });
              if (!result.ok) {
                setLoginBusy(false);
                setError(
                  result.error === "buyer"
                    ? "This email is a buyer account."
                    : result.error === "invite"
                      ? "This account still needs to set a password from the invite email."
                      : result.error === "not_configured"
                        ? "Portal sign-in is not configured on this server."
                        : "Sign-in failed."
                );
                return;
              }
              setLoginBusy(false);
            }}
          >
            <label className="block text-sm font-medium">
              Email<RequiredMark />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@mattex.com.hk"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                autoComplete="username"
              />
            </label>
            <label className="block text-sm font-medium">
              Password<RequiredMark />
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={loginBusy}>
              {loginBusy ? "Signing in…" : "Enter portal"}
            </button>
            <p className="text-center">
              <Link to="/forgot-password" className="text-sm font-semibold text-brand-700 hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>
        </main>
      </div>
    );
  }

  const inboxRfqs = SHOW_RFQ_QUOTES ? allRfqs : allRfqs.filter(isDev1InboxRfq);
  const pendingRfqs = inboxRfqs.filter(rfqNeedsAction).length;
  const product = products.find((p) => p.id === editing) || null;

  function goRfqInbox() {
    setFocusReport(null);
    setFocusBuyerEmail("");
    setSearchParams({});
    setPage("rfqs");
    setInboxHomeKey((n) => n + 1);
  }

  function openBuyerInfo(email) {
    const next = String(email || "").trim();
    if (!next) return;
    setFocusReport(null);
    setFocusBuyerEmail(next);
    setAccountSource("buyer");
    setAccountsNavOpen(true);
    setPage("accounts");
  }

  function openRfqDetail(id) {
    const next = String(id || "").trim();
    if (!next) return;
    setFocusReport(null);
    setFocusBuyerEmail("");
    setSearchParams({ rfq: next });
    setPage("rfqs");
  }

  async function openJumpAlert(alert) {
    const href = String(alert?.href || "/admin");
    let rfq = "";
    let buyer = "";
    try {
      const url = new URL(href, window.location.origin);
      rfq = String(url.searchParams.get("rfq") || "").trim();
      buyer = String(url.searchParams.get("buyer") || "").trim();
    } catch {
      rfq = "";
      buyer = "";
    }
    if (rfq) {
      await pullSharedStore();
      openRfqDetail(rfq);
    } else if (buyer) {
      setSearchParams({ buyer });
    } else {
      goRfqInbox();
    }
    markAdminAlertsSeen();
    setJumpAlert(null);
  }

  function openReportedProduct(report) {
    const match = findReportedProduct(products, report);
    if (!match) {
      note({ ok: false, error: "Product not found in catalog" });
      return;
    }
    setFocusReport(report);
    setEditing(match.id);
    setPage("products");
    setProductSource("mattex");
    setProductsNavOpen(true);
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink font-sans">
      <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col self-start bg-charcoal text-white">
        <div className="flex shrink-0 items-center gap-2.5 px-4 py-4">
          <img src="/assets/mattex-logo.webp" alt="" className="h-8 w-auto shrink-0 brightness-0 invert" />
          <span className="min-w-0 text-[15px] font-semibold leading-tight tracking-tight">
            Mattex Marketplace Admin Portal
          </span>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            if (item.id === "products") {
              const active = page === "products";
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusReport(null);
                      setFocusBuyerEmail("");
                      if (active && productsNavOpen) {
                        setProductsNavOpen(false);
                        return;
                      }
                      setPage("products");
                      setProductSource("mattex");
                      setProductsNavOpen(true);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                      active ? "bg-brand-600 text-white" : "text-white/80 hover:bg-white/10"
                    }`}
                    aria-expanded={productsNavOpen}
                  >
                    <span>{item.label}</span>
                    <ChevronIcon open={productsNavOpen} />
                  </button>
                  {productsNavOpen ? (
                    <div className="mt-1 space-y-0.5 border-l border-white/15 ml-3 pl-2">
                      {PRODUCT_SOURCES.map((src) => (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => {
                            setFocusReport(null);
                            setFocusBuyerEmail("");
                            setPage("products");
                            setProductSource(src.id);
                            setProductsNavOpen(true);
                          }}
                          className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-snug ${
                            active && productSource === src.id
                              ? "bg-white/15 text-white"
                              : "text-white/65 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>{src.label}</span>
                          {src.id === "chain" ? (
                            <span className="mt-0.5 shrink-0 rounded bg-white/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white/55">
                              Soon
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }
            if (item.id === "accounts") {
              const active = page === "accounts";
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusReport(null);
                      setFocusBuyerEmail("");
                      if (active && accountSource === "sales" && accountsNavOpen) {
                        setAccountsNavOpen(false);
                        return;
                      }
                      setPage("accounts");
                      setAccountSource("sales");
                      setAccountsNavOpen(true);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                      active ? "bg-brand-600 text-white" : "text-white/80 hover:bg-white/10"
                    }`}
                    aria-expanded={accountsNavOpen}
                  >
                    <span>{item.label}</span>
                    <ChevronIcon open={accountsNavOpen} />
                  </button>
                  {accountsNavOpen ? (
                    <div className="mt-1 space-y-0.5 border-l border-white/15 ml-3 pl-2">
                      {ACCOUNT_SOURCES.map((src) => (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => {
                            setFocusReport(null);
                            setFocusBuyerEmail("");
                            setPage("accounts");
                            setAccountSource(src.id);
                            setAccountsNavOpen(true);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-snug ${
                            active && accountSource === src.id
                              ? "bg-white/15 text-white"
                              : "text-white/65 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>{src.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "rfqs") {
                    goRfqInbox();
                    return;
                  }
                  setFocusReport(null);
                  setFocusBuyerEmail("");
                  setPage(item.id);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  page === item.id ? "bg-brand-600 text-white" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <span>{item.label}</span>
                {item.id === "rfqs" && pendingRfqs ? <span className="text-xs">{pendingRfqs}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="shrink-0 px-4 pb-6 pt-3 text-xs text-white/50">
          <p>{staff.email}</p>
          <button
            type="button"
            className="mt-2 hover:text-white"
            onClick={() => {
              setPasswordOpen(true);
              setPwCurrent("");
              setPwNext("");
              setPwConfirm("");
              setPwError("");
              setPwOk("");
            }}
          >
            Change password
          </button>
          <button
            type="button"
            className="mt-2 block hover:text-white"
            onClick={() => {
              clearTmsSession();
              logoutStaff();
            }}
          >
            Log out
          </button>
          <a href={marketplaceHomeHref("en")} className="mt-2 block hover:text-white">
            Marketplace
          </a>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="border-b border-line bg-white px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Mattex operations</p>
          <p className="text-sm text-mute">Same marketplace catalog — this portal only adds product / RFQ ops.</p>
          {flash ? <p className={`mt-2 text-sm ${flashError ? "text-red-700" : "text-brand-700"}`}>{flash}</p> : null}
          {jumpAlert ? (
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">New marketplace alert</p>
                <p className="mt-1 text-sm font-semibold text-brand-900">{jumpAlert.title}</p>
                {jumpAlert.body ? <p className="mt-0.5 text-sm text-ink">{jumpAlert.body}</p> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() => openJumpAlert(jumpAlert)}
                >
                  {jumpAlert.kind === "rfq" || String(jumpAlert.href || "").includes("rfq=") ? "Go to RFQ" : "Jump"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
                  onClick={() => {
                    markAdminAlertsSeen();
                    setJumpAlert(null);
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </header>
        <div className="p-6">
          {page === "products" && productSource === "mattex" ? (
            <ProductsPanel
              products={products}
              product={product}
              editing={editing}
              setEditing={setEditing}
              note={note}
              reports={reports}
              focusReport={focusReport}
              openProductId={jumpProductId}
              onOpenedProduct={() => setJumpProductId("")}
              onClearFocus={() => setFocusReport(null)}
            />
          ) : null}
          {page === "products" && productSource === "category" ? (
            <CategoryPanel
              products={products}
              note={note}
              onOpenProduct={(p) => {
                setFocusReport(null);
                setEditing(p.id);
                setJumpProductId(p.id);
                setPage("products");
                setProductSource("mattex");
                setProductsNavOpen(true);
              }}
            />
          ) : null}
          {page === "products" && productSource === "chain" ? <ChainProductsPanel /> : null}
          {page === "banners" ? <BannersPanel note={note} /> : null}
          {page === "rfqs" ? (
            <RfqPanel
              key={inboxHomeKey}
              rfqs={allRfqs}
              note={note}
              focusId={focusRfqId}
              onClearFocus={() => {
                setSearchParams({});
                setPage("rfqs");
              }}
              onOpenDetail={openRfqDetail}
              onOpenBuyer={openBuyerInfo}
            />
          ) : null}
          {page === "accounts" ? (
            <AccountPanel note={note} kind={accountSource} focusEmail={focusBuyerEmail} onOpenRfq={openRfqDetail} />
          ) : null}
        </div>
      </div>
      {passwordOpen ? (
        <AdminModal
          title="Change password"
          onClose={() => setPasswordOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={() => setPasswordOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={async () => {
                  const length = pwNext.length >= 8;
                  const letter = /[A-Za-z]/.test(pwNext);
                  const number = /\d/.test(pwNext);
                  if (!String(pwCurrent || "").trim()) {
                    setPwOk("");
                    setPwError("Enter your current password.");
                    return;
                  }
                  if (!length || !letter || !number) {
                    setPwOk("");
                    setPwError("Password needs 8+ characters, a letter, and a number.");
                    return;
                  }
                  if (!pwConfirm || pwNext !== pwConfirm) {
                    setPwOk("");
                    setPwError("Passwords do not match.");
                    return;
                  }
                  const result = await changeOwnStaffPassword({ currentPassword: pwCurrent, nextPassword: pwNext });
                  if (!result.ok) {
                    setPwOk("");
                    setPwError(
                      result.error === "current"
                        ? "Current password is incorrect."
                        : result.error === "same"
                          ? "New password must be different."
                          : "Password needs 8+ characters, a letter, and a number."
                    );
                    return;
                  }
                  setPwError("");
                  setPwOk("Password updated.");
                  setPwCurrent("");
                  setPwNext("");
                  setPwConfirm("");
                }}
              >
                Save password
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Current password<RequiredMark />
              <input type="password" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" />
            </label>
            <label className="block text-sm font-medium">
              New password<RequiredMark />
              <input type="password" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" value={pwNext} onChange={(e) => setPwNext(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="block text-sm font-medium">
              Confirm new password<RequiredMark />
              <input type="password" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} autoComplete="new-password" />
            </label>
            <PasswordChecklist password={pwNext} confirmPassword={pwConfirm} hasError={Boolean(pwError)} />
            {pwError ? <p className="text-sm text-red-700">{pwError}</p> : null}
            {pwOk ? <p className="text-sm text-brand-700">{pwOk}</p> : null}
          </div>
        </AdminModal>
      ) : null}
      {flash ? (
        <div
          className={`fixed top-4 left-1/2 z-[80] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl px-5 py-4 text-base font-semibold text-white shadow-xl ${flashError ? "bg-red-700" : "bg-brand-800"}`}
          role="status"
        >
          {flash}
        </div>
      ) : null}
    </div>
  );
}

function AdminModal({ title, onClose, children, wide, footer }) {
  const closeReady = useRef(false);
  useEffect(() => {
    closeReady.current = false;
    const readyTimer = window.setTimeout(() => {
      closeReady.current = true;
    }, 280);
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(readyTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div
        className="absolute inset-0 bg-charcoal/50 backdrop-blur-[2px]"
        onClick={() => {
          if (closeReady.current) onClose();
        }}
      />
      <div
        className={`modal-panel relative flex w-full flex-col overflow-hidden rounded-xl border border-line bg-white ${wide ? "max-w-4xl" : "max-w-2xl"} max-h-[min(90vh,52rem)] shadow-[0_24px_60px_rgba(16,21,19,0.25)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-6 py-4">
          <h2 id="admin-modal-title" className="font-display text-xl leading-snug text-brand-800">
            {title}
          </h2>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-mute transition-colors hover:bg-paper hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer ? <div className="flex shrink-0 justify-end border-t border-line bg-paper/80 px-6 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

function HoverTip({ text, children }) {
  const [show, setShow] = useState(false);
  if (!text) return children;
  return (
    <span
      className="relative inline-flex [&_button:disabled]:pointer-events-none"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show ? (
        <span
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md bg-charcoal px-2.5 py-1.5 text-left text-[11px] font-medium normal-case leading-snug tracking-normal text-white shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

function AdminSearchBar({ value, onChange, placeholder, label }) {
  return (
    <label className="mb-4 block">
      <span className="sr-only">{label || placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-mute focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
      />
    </label>
  );
}

function FilterTabs({ tabs, counts, value, onChange, label }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-brand-600 text-white" : "text-mute hover:bg-brand-50 hover:text-ink"
            }`}
          >
            {tab.label}
            <span className={`tabular-nums text-[11px] ${active ? "text-white/80" : "text-mute"}`}>{counts[tab.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

function StatusTabs({ products, statusTab, setStatusTab }) {
  return (
    <FilterTabs
      tabs={STATUS_TABS}
      counts={statusCounts(products)}
      value={statusTab}
      onChange={setStatusTab}
      label="Product status"
    />
  );
}

function CategoryPanel({ products, note, onOpenProduct }) {
  const categories = listAdminCategories();
  const [activeId, setActiveId] = useState(categories[0]?.id || "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [addName, setAddName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addSelected, setAddSelected] = useState(() => new Set());
  const [preview, setPreview] = useState(null);

  const active = categories.find((c) => c.id === activeId) || categories[0] || null;
  useEffect(() => {
    if (activeId && categories.some((c) => c.id === activeId)) return;
    setActiveId(categories[0]?.id || "");
  }, [activeId, categories]);

  const inCategory = active ? products.filter((p) => p.category === active.name) : [];
  const needle = searchNeedle(query);
  const visible = needle ? inCategory.filter((p) => matchesSearch(needle, ...productSearchHay(p))) : inCategory;
  const selectable = visible.filter((p) => !p.deleted);
  const liveSelected = selectable.filter((p) => selected.has(p.id));
  const allSelectableSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));
  const someSelectableSelected = selectable.some((p) => selected.has(p.id));

  function selectCategory(id) {
    setActiveId(id);
    setSelected(new Set());
    setQuery("");
    setMoveTo("");
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectableSelected) selectable.forEach((p) => next.delete(p.id));
      else selectable.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function addCategory() {
    const result = addAdminCategory(addName);
    if (result.ok) {
      setAddName("");
      setActiveId(result.category.id);
      note(result, `Category “${result.category.name}” added`);
      return;
    }
    note(result, result.error === "exists" ? "That category already exists." : "Enter a category name.");
  }

  const editingCategory = categories.find((c) => c.id === editingId) || null;

  function closeRename() {
    setEditingId("");
    setEditName("");
  }

  function saveRename() {
    if (!editingId) return;
    const result = renameAdminCategory(editingId, editName);
    if (result.ok) {
      closeRename();
      note(result, `Renamed to “${result.category.name}”`);
      return;
    }
    note(result, result.error === "exists" ? "That category already exists." : "Unable to rename.");
  }

  function removeCategory(cat) {
    const result = deleteAdminCategory(cat.id);
    if (result.ok) {
      note(result, `Deleted “${cat.name}”`);
      return;
    }
    note(result, result.error === "in_use" ? "Move or restore products out of this category first." : "Unable to delete.");
  }

  function moveSelected() {
    if (!moveTo || !liveSelected.length) {
      note({ ok: false, error: "Select products and a destination category." });
      return;
    }
    const result = assignAdminProductsCategory(
      liveSelected.map((p) => p.id),
      moveTo
    );
    note(result, result.ok ? `Moved ${result.moved} product${result.moved === 1 ? "" : "s"}` : "Unable to move products.");
    setSelected(new Set());
  }

  const addNeedle = searchNeedle(addQuery);
  const addCandidates = products.filter((p) => {
    if (p.deleted) return false;
    if (active && p.category === active.name) return false;
    if (!addNeedle) return true;
    return matchesSearch(addNeedle, ...productSearchHay(p));
  });
  const addVisible = addCandidates.slice(0, 80);
  const allAddSelected = addVisible.length > 0 && addVisible.every((p) => addSelected.has(p.id));
  const someAddSelected = addVisible.some((p) => addSelected.has(p.id));

  function toggleAllAddVisible() {
    setAddSelected((prev) => {
      const next = new Set(prev);
      if (allAddSelected) addVisible.forEach((p) => next.delete(p.id));
      else addVisible.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function confirmAddProducts() {
    const ids = [...addSelected];
    if (!ids.length || !active) {
      note({ ok: false, error: "Select products to add." });
      return;
    }
    const result = assignAdminProductsCategory(ids, active.name);
    note(result, result.ok ? `Added ${result.moved} product${result.moved === 1 ? "" : "s"}` : "Unable to add products.");
    setAddOpen(false);
    setAddSelected(new Set());
    setAddQuery("");
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-brand-900">Product Category</h1>
          <p className="text-sm text-mute">Add, rename, or delete empty categories. Hover Delete to see why a category cannot be removed.</p>
        </div>
        <div className="flex min-w-[18rem] flex-col gap-1">
          <span className="text-sm font-medium text-ink">Category name</span>
          <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="New category name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <button type="button" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={addCategory}>
            Add
          </button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <div className="overflow-auto rounded-xl border border-line bg-white max-h-[calc(100vh-16rem)]">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0 bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Count</th>
                <th className={`${STICKY_ACTION_TH} text-right`} />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const selectedCat = active?.id === cat.id;
                return (
                  <tr key={cat.id} className={`border-t border-line/80 ${selectedCat ? "bg-brand-50" : "hover:bg-brand-50/60"}`}>
                    <td className="px-3 py-2">
                      <button type="button" className="text-left font-medium text-ink" onClick={() => selectCategory(cat.id)} title={cat.name}>
                        {cat.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      <button type="button" className="text-brand-800" onClick={() => selectCategory(cat.id)}>
                        {cat.count}
                        {cat.deletedCount ? <span className="ml-1 text-[10px] text-mute">({cat.deletedCount} deleted)</span> : null}
                      </button>
                    </td>
                    <td className={`${STICKY_ACTION_TD} text-right ${selectedCat ? "!bg-brand-50" : ""}`}>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded border border-line px-2 py-1 text-[10px] font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(cat.id);
                            setEditName(cat.name);
                          }}
                        >
                          Edit
                        </button>
                        <HoverTip
                          text={
                            categories.length <= 1
                              ? "Cannot delete the last category."
                              : cat.count > 0
                                ? `Cannot delete: ${cat.count} product${cat.count === 1 ? "" : "s"} still in this category. Move them first.`
                                : ""
                          }
                        >
                          <button
                            type="button"
                            className="rounded border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-40"
                            disabled={categories.length <= 1 || cat.count > 0}
                            onClick={() => removeCategory(cat)}
                          >
                            Delete
                          </button>
                        </HoverTip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          {active ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg text-brand-900">{active.name}</h2>
                  <p className="text-xs text-mute">{active.count} products · one product, one category</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-sm font-semibold text-brand-800"
                  onClick={() => {
                    setAddOpen(true);
                    setAddQuery("");
                    setAddSelected(new Set());
                  }}
                >
                  Add products
                </button>
              </div>
              <AdminSearchBar value={query} onChange={setQuery} label="Search in category" placeholder="Search products in this category…" />
              {liveSelected.length ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
                  <p className="text-sm font-medium text-brand-900">{liveSelected.length} selected</p>
                  <select className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                    <option value="">Move to another category…</option>
                    {categories
                      .filter((c) => c.id !== active.id)
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <button type="button" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={moveSelected}>
                    Move
                  </button>
                  <button type="button" className="text-xs font-semibold text-mute" onClick={() => setSelected(new Set())}>
                    Clear
                  </button>
                </div>
              ) : null}
              <div className="overflow-auto rounded-xl border border-line bg-white max-h-[calc(100vh-22rem)]">
                <table className="min-w-[40rem] w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all products in this category"
                          checked={allSelectableSelected}
                          disabled={!selectable.length}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelectableSelected && !allSelectableSelected;
                          }}
                          onChange={toggleAllVisible}
                        />
                      </th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Status</th>
                      <th className={`${STICKY_ACTION_TH} w-12`} />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length ? (
                      visible.map((p) => (
                        <tr
                          key={p.id}
                          className={`border-t border-line/80 cursor-pointer ${p.deleted ? "bg-slate-50 text-mute" : "hover:bg-brand-50/60"}`}
                          onClick={() => setPreview(p)}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              disabled={p.deleted}
                              checked={selected.has(p.id) && !p.deleted}
                              onChange={() => {
                                if (p.deleted) return;
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(p.id)) next.delete(p.id);
                                  else next.add(p.id);
                                  return next;
                                });
                              }}
                              aria-label={`Select ${productRowLabel(p)}`}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">{cellText(productSkuId(p))}</td>
                          <td className="px-3 py-2">{cellText(p.name)}</td>
                          <td className="px-3 py-2">
                            <StatusBadge product={p} />
                          </td>
                          <td className={`${STICKY_ACTION_TD} ${p.deleted ? "!bg-slate-50" : ""}`} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-line text-brand-800 hover:bg-brand-50"
                              title="Open product"
                              aria-label={`Open ${productRowLabel(p)}`}
                              onClick={() => onOpenProduct?.(p)}
                            >
                              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                                <path d="M3 8h8M8 3l5 5-5 5" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-16 text-center text-sm text-mute">
                          {needle ? "No products match this search." : "No products in this category."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-mute">Add a category to get started.</p>
          )}
        </div>
      </div>
      {addOpen && active ? (
        <AdminModal
          title={`Add products to ${active.name}`}
          onClose={() => setAddOpen(false)}
          wide
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={confirmAddProducts}>
                Add {addSelected.size || ""}
              </button>
            </div>
          }
        >
          <AdminSearchBar value={addQuery} onChange={setAddQuery} label="Search products" placeholder="Search name, SKU, category…" />
          <div className="overflow-auto rounded-lg border border-line max-h-80">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all products to add"
                      checked={allAddSelected}
                      disabled={!addVisible.length}
                      ref={(el) => {
                        if (el) el.indeterminate = someAddSelected && !allAddSelected;
                      }}
                      onChange={toggleAllAddVisible}
                    />
                  </th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Category</th>
                </tr>
              </thead>
              <tbody>
                {addVisible.map((p) => (
                  <tr key={p.id} className="border-t border-line/80">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={addSelected.has(p.id)}
                        onChange={() => {
                          setAddSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">{cellText(productSkuId(p))}</td>
                    <td className="px-3 py-2">{cellText(p.name)}</td>
                    <td className="px-3 py-2">{cellText(p.category)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {addCandidates.length > 80 ? <p className="mt-2 text-xs text-mute">Showing first 80 matches. Search to narrow.</p> : null}
        </AdminModal>
      ) : null}
      {editingCategory ? (
        <AdminModal
          title="Edit category"
          onClose={closeRename}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={closeRename}>
                Cancel
              </button>
              <button type="button" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={saveRename}>
                Save name
              </button>
            </div>
          }
        >
          <p className="text-sm text-mute">
            {editingCategory.count} product{editingCategory.count === 1 ? "" : "s"} stay in this category. Marketplace catalog uses the same name.
          </p>
          <label className="mt-3 block text-sm font-medium text-ink">
            Category name<RequiredMark />
            <textarea
              className="mt-1 w-full resize-y rounded-lg border border-line px-3 py-2 text-sm leading-snug"
              rows={3}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveRename();
                }
              }}
              autoFocus
            />
          </label>
        </AdminModal>
      ) : null}
      {preview ? (
        <AdminModal
          title={preview.name || "Product"}
          onClose={() => setPreview(null)}
          wide
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={() => setPreview(null)}>
                Close
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  const target = preview;
                  setPreview(null);
                  onOpenProduct?.(target);
                }}
              >
                Edit
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {productImageList(preview).length ? (
                productImageList(preview).map((src, index) => (
                  <img key={`${src.slice(-16)}-${index}`} src={src} alt="" className="h-20 w-20 rounded-md border border-line object-cover bg-white" />
                ))
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-line bg-paper text-[10px] font-semibold uppercase tracking-wide text-mute">
                  No image
                </span>
              )}
            </div>
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">Name</dt>
                <dd className="mt-0.5 font-medium text-ink">{cellText(preview.name)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">SKU</dt>
                <dd className="mt-0.5 font-mono text-[12px]">{cellText(productSkuId(preview))}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">Category</dt>
                <dd className="mt-0.5">{cellText(preview.category)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">Status</dt>
                <dd className="mt-0.5">
                  <StatusBadge product={preview} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">Tags</dt>
                <dd className="mt-0.5">
                  <ProductTagChips product={preview} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">MOQ</dt>
                <dd className="mt-0.5">{cellText(preview.moq)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">Unit</dt>
                <dd className="mt-0.5">{cellText(preview.unit || preview.salesUnit)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">Lead</dt>
                <dd className="mt-0.5">{productLeadLabel(preview)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">Remark</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{cellText(preview.remark)}</dd>
              </div>
            </dl>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
}

function ChainProductsPanel() {
  const [statusTab, setStatusTab] = useState("all");
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl text-brand-900">Mattex Chain Products</h1>
        <p className="text-sm text-mute">
          Chain SKUs will appear here and can be sent to Marketplace later. This list is not connected yet.
        </p>
      </div>
      <StatusTabs products={[]} statusTab={statusTab} setStatusTab={setStatusTab} />
      <div className="overflow-auto rounded-xl border border-line bg-white max-h-[calc(100vh-16rem)]">
        <table className="min-w-[90rem] w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
            <tr>
              {PRODUCT_TABLE_HEADS.map((h) => (
                <th key={h.key} className="px-3 py-2" title={h.label}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={PRODUCT_TABLE_HEADS.length} className="px-3 py-16 text-center text-sm text-mute">
                No Mattex Chain products yet. When this catalog is connected, selected SKUs can be published to Marketplace from here.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductCategoryField({ value, onChange, note }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const categories = getAdminCategories();

  function addCategory() {
    const result = addAdminCategory(name);
    if (result.ok) {
      onChange(result.category.name);
      setName("");
      setError("");
      setAdding(false);
      note?.(result, `Category “${result.category.name}” added`);
      return;
    }
    if (result.error === "exists") setError("That category already exists.");
    else if (result.error === "name") setError("Enter a category name.");
    else setError(result.error || "Unable to add category.");
  }

  return (
    <div className="text-sm font-medium text-ink">
      <span>Category<RequiredMark /></span>
      <select
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select category…
        </option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {adding ? (
        <div className="mt-2 space-y-1">
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-normal"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="New category name"
              aria-label="New category name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory();
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setName("");
                  setError("");
                }
              }}
            />
            <button
              type="button"
              className="rounded-lg bg-brand-600 px-2 py-1.5 text-xs font-semibold text-white"
              onClick={addCategory}
            >
              Add
            </button>
            <button
              type="button"
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold text-ink"
              onClick={() => {
                setAdding(false);
                setName("");
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
          {error ? <p className="text-xs font-normal text-red-700">{error}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          className="mt-1 text-xs font-semibold text-brand-800 hover:underline"
          onClick={() => setAdding(true)}
        >
          Add category
        </button>
      )}
    </div>
  );
}

function SalesUnitField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const needle = String(value || "").trim().toLowerCase();
  const matches = listSalesUnits().filter((unit) => !needle || unit.toLowerCase().includes(needle));
  return (
    <label className="relative text-sm font-medium text-ink">
      Sales unit<RequiredMark />
      <input
        className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal placeholder:text-mute"
        value={value}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder="e.g. m², pcs, sheet"
      />
      {open && matches.length ? (
        <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {matches.map((unit) => (
            <li key={unit}>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm font-normal hover:bg-brand-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(unit);
                  setOpen(false);
                }}
              >
                {unit}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

function ProductsPanel({ products, product, editing, setEditing, note, reports = [], focusReport, onClearFocus, openProductId, onOpenedProduct }) {
  useCatalogGroups();
  const jumped = openProductId ? products.find((row) => row.id === openProductId) : null;
  const [form, setForm] = useState(() => (jumped || (focusReport && product) ? toForm(jumped || product) : null));
  const [modal, setModal] = useState(() => (jumped || focusReport ? "edit" : null));
  const [formError, setFormError] = useState("");
  const [statusTab, setStatusTab] = useState(() => (jumped ? productStatusKey(jumped) : "all"));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [imageOver, setImageOver] = useState(false);
  const imageInputRef = useRef(null);
  const actionLock = useRef(false);
  const [acting, setActing] = useState(false);
  async function runAction(work) {
    if (actionLock.current) return;
    actionLock.current = true;
    setActing(true);
    try {
      await work();
    } finally {
      actionLock.current = false;
      setActing(false);
    }
  }
  const needle = searchNeedle(query);
  const searchedProducts = needle
    ? products.filter((p) => matchesSearch(needle, ...productSearchHay(p)))
    : products;
  const visibleProducts = statusTab === "all"
    ? searchedProducts
    : searchedProducts.filter((p) => productStatusKey(p) === statusTab);
  const selectedProducts = visibleProducts.filter((p) => selected.has(p.id));
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((p) => selected.has(p.id));
  const someVisibleSelected = visibleProducts.some((p) => selected.has(p.id));
  const awaitingPublish = products.filter((p) => !p.deleted && productStatusKey(p) !== "published");
  const draft = form || toForm(product);
  const purposeTags = String(draft.purposes || "").split(/[\n,;]+/).map((tag) => tag.trim()).filter(Boolean);
  const formOpen = modal === "create" || modal === "edit";
  const productReports = (product
    ? reports.filter((r) => r.productId === product.id || (product.productNo && r.productNo === product.productNo))
    : []
  ).filter((r) => r.status === "open" || r.status === "looking" || r.id === focusReport?.id);

  useEffect(() => {
    if (!openProductId) return;
    const target = products.find((row) => row.id === openProductId);
    if (target) {
      setEditing(target.id);
      setForm(toForm(target));
      setFormError("");
      setModal("edit");
      setStatusTab(productStatusKey(target));
    }
  }, [openProductId]);

  function closeModal() {
    setModal(null);
    setFormError("");
    setImageOver(false);
    onOpenedProduct?.();
    onClearFocus?.();
  }

  function field(key, value) {
    setForm({ ...(form || toForm(product)), [key]: value });
  }

  function fields(patch) {
    setForm({ ...(form || toForm(product)), ...patch });
  }

  async function onImageFiles(fileList) {
    const picked = Array.from(fileList || []).filter((file) => String(file.type || "").startsWith("image/"));
    if (!picked.length) {
      setFormError("Please choose an image file.");
      return;
    }
    const current = productImageList({ image: (form || toForm(product)).image, images: (form || toForm(product)).images });
    const remaining = PRODUCT_IMAGE_MAX - current.length;
    if (remaining <= 0) {
      setFormError("You can upload up to 5 images.");
      return;
    }
    const draft = form || toForm(product);
    const added = [];
    let error = "";
    for (const file of picked.slice(0, remaining)) {
      let dataUrl;
      try {
        dataUrl = await compressImageFile(file);
      } catch {
        error = "Each image must be under 800 KB after compress (max 1,600px).";
        break;
      }
      if (!String(dataUrl).startsWith("data:image/webp")) {
        error = "Photo must be WebP.";
        break;
      }
      try {
        added.push(await uploadCatalogImage(dataUrl, draft.productNo || product?.id));
      } catch {
        error = "這次未送出，稍後再試";
        break;
      }
    }
    if (added.length) {
      const next = [...current, ...added.map((item) => item.image)].slice(0, PRODUCT_IMAGE_MAX);
      const prior = legacyImageUrl(draft.imageFallback) || legacyImageUrl(draft.image);
      const previous = Array.isArray(draft.imageFallbacks) ? draft.imageFallbacks : [];
      const fallbacks = next.map((_, index) => legacyImageUrl(previous[index]) || (index === 0 ? prior : ""));
      fields({
        image: next[0] || "",
        imageFallback: fallbacks[0] || "",
        images: next,
        imageFallbacks: fallbacks,
        imageSource: next.length ? "upload" : "generated",
      });
    }
    setFormError(error);
  }

  function openCreate() {
    onClearFocus?.();
    setEditing("");
    setForm(toForm(null));
    setFormError("");
    setModal("create");
  }

  function openEdit(p) {
    setEditing(p.id);
    setForm(toForm(p));
    setFormError("");
    setModal("edit");
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleProducts.forEach((p) => next.delete(p.id));
      } else {
        visibleProducts.forEach((p) => next.add(p.id));
      }
      return next;
    });
  }

  function clearSelected() {
    setSelected(new Set());
  }

  function editSelected() {
    if (selectedProducts.length !== 1) {
      note({ ok: false, error: "Select one product to edit." });
      return;
    }
    openEdit(selectedProducts[0]);
  }

  function openBulkConfirm(type, { awaiting } = {}) {
    let items = selectedProducts;
    if (type === "publish") {
      items = awaiting || !selectedProducts.length
        ? awaitingPublish
        : selectedProducts.filter((p) => !p.deleted && productStatusKey(p) !== "published");
      if (!items.length) {
        note({
          ok: false,
          error: awaiting || !selectedProducts.length
            ? "No Unpublish products to go live."
            : "Select Unpublish products to Publish.",
        });
        return;
      }
    } else if (type === "unpublish") {
      items = selectedProducts.filter((p) => productStatusKey(p) === "published");
      if (!items.length) {
        note({ ok: false, error: "Select Published products to Unpublish." });
        return;
      }
    } else if (type === "delete") {
      items = selectedProducts.filter((p) => !p.deleted);
      if (!items.length) {
        note({ ok: false, error: "Select products to remove (soft delete)." });
        return;
      }
    } else if (type === "forever") {
      items = selectedProducts.filter((p) => canDeleteProductForever(p));
      if (!items.length) {
        note({ ok: false, error: "Select Unpublish or Removed products to Delete forever. Unpublish live SKUs first." });
        return;
      }
    } else if (type === "restore") {
      items = selectedProducts.filter((p) => p.deleted);
      if (!items.length) {
        note({ ok: false, error: "Select Removed products to Restore." });
        return;
      }
    }
    setBulkConfirm({ type, items });
  }

  async function requestPublish(target) {
    if (!target || target.deleted) {
      note({ ok: false, error: "Restore this product before Publish." });
      return;
    }
    const hard = publishHardBlockers(target);
    if (hard.length) {
      note({ ok: false, error: `Cannot publish. Need: ${blockerText(hard)}` });
      return;
    }
    const warn = publishWarnBlockers(target);
    if (warn.length) {
      setBulkConfirm({ type: "publish", items: [target] });
      return;
    }
    const result = await publishAdminProduct(target.id);
    if (result?.ok) closeModal();
    note(result, "已送到市集");
  }

  async function applyBulkConfirm() {
    if (!bulkConfirm) return;
    const { type, items } = bulkConfirm;
    let ok = 0;
    let fail = 0;
    let lastError = "";
    for (const p of items) {
      let result = { ok: false };
      if (type === "publish") {
        if (publishHardBlockers(p).length) {
          fail += 1;
          continue;
        }
        result = await publishAdminProduct(p.id);
      } else if (type === "unpublish") result = unpublishAdminProduct(p.id);
      else if (type === "delete") result = softDeleteAdminProduct(p.id);
      else if (type === "forever") result = hardDeleteAdminProduct(p.id);
      else if (type === "restore") result = restoreAdminProduct(p.id);
      if (result?.ok) ok += 1;
      else {
        fail += 1;
        if (result?.error) lastError = result.error;
      }
    }
    setBulkConfirm(null);
    clearSelected();
    const labels = { publish: "published", unpublish: "taken offline", delete: "removed", forever: "deleted forever", restore: "restored" };
    if (!ok) {
      if (lastError === "staff" || lastError === "published") {
        note({ ok: false, error: lastError });
        return;
      }
      note({
        ok: false,
        error:
          type === "publish"
            ? "Nothing published. Need official SKU, name, unit, category, and a unique SKU."
            : type === "unpublish"
              ? "Unable to Unpublish selected products."
              : type === "restore"
                ? "Unable to restore selected products."
                : type === "forever"
                  ? "Unable to Delete forever. Unpublish live SKUs first."
                  : "Unable to update selected products.",
      });
      return;
    }
    note({ ok: true }, `${ok} ${labels[type]}${fail ? ` · ${fail} skipped` : ""}`);
  }

  const bulkTitles = {
    publish: "Confirm publish (go live)",
    unpublish: "Confirm Unpublish (take offline)",
    delete: "Remove from catalog",
    forever: "Delete forever",
    restore: "Confirm Restore",
  };

  const publishableCount = bulkConfirm?.type === "publish"
    ? bulkConfirm.items.filter((p) => !publishHardBlockers(p).length).length
    : 0;

  async function saveProduct() {
    if (draft.priceMode === "amount") {
      const amount = Number(String(draft.price ?? "").replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) {
        setFormError("Enter a price, or choose Price Upon Request.");
        return;
      }
    }
    const payload = fromForm(draft);
    if (modal === "create" || !editing) {
      const result = await createAdminProduct(payload);
      if (!result.ok) {
        setFormError(result.error === "name" ? "Please enter a product name." : result.error || "Unable to add product.");
        note(result);
        return;
      }
      const sku = result.product?.provisionalSku || "";
      closeModal();
      setForm(null);
      setEditing("");
      note(result, sku ? `已儲存，未上架 ${sku}` : "已儲存，未上架");
      return;
    }
    const result = await updateAdminProduct(editing, payload);
    if (!result.ok) {
      setFormError("");
      note(result);
      return;
    }
    const live = Boolean(result.live);
    closeModal();
    setForm(null);
    setEditing("");
    note(result, live ? "已更新到市集" : "已儲存，未上架");
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-brand-900">Mattex Products</h1>
          <p className="text-sm text-mute">
            Published is live. Unpublish is not live — incomplete fields only warn when you Publish. Removed is a soft delete: hidden until Restore. Delete forever removes it from the catalog.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {SHOW_PRODUCT_IMPORT ? (
            <button
              type="button"
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-50"
              onClick={() => setModal("import")}
            >
              Import Excel
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            onClick={() => openBulkConfirm("publish", { awaiting: true })}
          >
            Publish{awaitingPublish.length ? ` (${awaitingPublish.length} not live)` : ""}
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={openCreate}
          >
            Add Product
          </button>
        </div>
      </div>
      <AdminSearchBar
        value={query}
        onChange={setQuery}
        label="Search products"
        placeholder="Search name, SKU, category, purpose…"
      />
      <StatusTabs products={searchedProducts} statusTab={statusTab} setStatusTab={setStatusTab} />
      {selectedProducts.length ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
          <p className="text-sm font-medium text-brand-900">{selectedProducts.length} selected</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              disabled={selectedProducts.length !== 1}
              title={selectedProducts.length === 1 ? "Edit selected product" : "Select one product to edit"}
              onClick={editSelected}
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 disabled:opacity-50"
              disabled={selectedProducts.length < 2}
              title="Select at least two products"
              onClick={async () => {
                const result = await saveCatalogGroups(groupSelectedProducts(selectedProducts));
                if (!result.ok) note?.({ ok: false, error: result.error || "Unable to save the group" });
              }}
            >
              Group as one product
            </button>
            <button
              type="button"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
              disabled={!selectedProducts.some((row) => groupOf(row.id))}
              onClick={async () => {
                const result = await saveCatalogGroups(releaseSelectedProducts(selectedProducts.map((row) => row.id)));
                if (!result.ok) note?.({ ok: false, error: result.error || "Unable to update the group" });
              }}
            >
              Remove from group
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700"
              onClick={() => openBulkConfirm("delete")}
            >
              Remove
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800"
              onClick={() => openBulkConfirm("forever")}
            >
              Delete forever
            </button>
            <button
              type="button"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
              onClick={() => openBulkConfirm("restore")}
            >
              Restore selected
            </button>
            <button
              type="button"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
              onClick={() => openBulkConfirm("unpublish")}
            >
              Unpublish selected
            </button>
            <button
              type="button"
              className="rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800"
              onClick={() => openBulkConfirm("publish")}
            >
              Publish selected
            </button>
            <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-mute hover:text-ink" onClick={clearSelected}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
      <div className="overflow-auto rounded-xl border border-line bg-white max-h-[calc(100vh-16rem)]">
        <table className="min-w-[90rem] w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all visible products"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                />
              </th>
              {PRODUCT_TABLE_HEADS.map((h) => (
                <th key={h.key} className="px-3 py-2" title={h.label}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleProducts.length ? (
              visibleProducts.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`cursor-pointer border-t border-line/80 hover:bg-brand-50/60 ${p.deleted ? "bg-slate-50 text-mute" : ""} ${editing === p.id && formOpen ? "bg-brand-50" : ""} ${checked ? "bg-brand-50/80" : ""}`}
                    onClick={() => openEdit(p)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${productRowLabel(p)}`} checked={checked} onChange={() => toggleSelected(p.id)} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{cellText(productSkuId(p))}</td>
                    <td className="px-3 py-2">{cellText(p.category)}</td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[16rem] max-w-[22rem] items-start gap-2">
                        <ProductThumb product={p} />
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">{cellText(p.name)}</p>
                          {groupOf(p.id) ? <p className="mt-0.5 text-[11px] font-semibold text-brand-700">{groupOf(p.id).name}</p> : null}
                          {getCatalogSyncError(p.id) === "quota" ? (
                            <p className="mt-1 text-xs font-semibold text-[#8a2b2b]">這次未送出，稍後再試</p>
                          ) : null}
                          <div className="mt-1">
                            <StatusBadge product={p} />
                          </div>
                          <p className="mt-1 text-xs font-semibold text-ink">
                            {Number(p.price) > 0 && !p.priceUponRequest ? `$${Number(p.price).toFixed(2)}` : "Price Upon Request"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[160px] text-mute" title={p.sizeDesc || ""}>
                      <p className="line-clamp-3">{cellText(p.sizeDesc)}</p>
                    </td>
                    <td className="px-3 py-2 max-w-[150px] text-mute" title={p.certifications || ""}>
                      <p className="line-clamp-3">{cellText(p.certifications)}</p>
                    </td>
                    <td className="px-3 py-2 max-w-[160px] text-mute" title={productPrimarySpec(p)}>
                      <p className="line-clamp-3">{cellText(productPrimarySpec(p))}</p>
                    </td>
                    <td className="px-3 py-2">
                      <ProductTagChips product={p} />
                    </td>
                    <td className="px-3 py-2">{cellText(p.salesUnit || p.unit)}</td>
                    <td className="px-3 py-2">{cellText(p.moq)}</td>
                    <td className="px-3 py-2">{cellText(leadLabel(p))}</td>
                    <td className="px-3 py-2 max-w-[200px] text-mute" title={(p.purposes || []).join(", ")}>
                      <p className="line-clamp-3">{cellText((p.purposes || []).join(", "))}</p>
                    </td>
                    <td className="px-3 py-2 max-w-[140px] text-mute" title={p.remark || ""}>
                      <p className="line-clamp-3">{cellText(p.remark)}</p>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={PRODUCT_TABLE_HEADS.length + 1} className="px-3 py-16 text-center text-sm text-mute">
                  {needle ? "No products match this search." : "No products in this status."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <AdminModal
          title={modal === "edit" && product ? `Edit ${product.name}` : "Add Product"}
          onClose={closeModal}
          wide
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              {product && product.deleted ? (
                <button
                  type="button"
                  className="rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-800 disabled:opacity-40"
                  disabled={acting}
                  onClick={() => runAction(async () => {
                    const result = restoreAdminProduct(product.id);
                    note(result, "Restored as Unpublish");
                    if (result?.ok) closeModal();
                  })}
                >
                  Restore
                </button>
              ) : null}
              {product && !product.deleted ? (
                <button
                  type="button"
                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-700 disabled:opacity-40"
                  disabled={acting}
                  onClick={() => runAction(async () => {
                    const result = softDeleteAdminProduct(product.id);
                    note(result, "Removed from catalog");
                    if (result?.ok) closeModal();
                  })}
                >
                  Remove
                </button>
              ) : null}
              {product ? (
                <HoverTip text={canDeleteProductForever(product) ? "" : "Unpublish this product before Delete forever."}>
                  <button
                    type="button"
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    disabled={acting || !canDeleteProductForever(product)}
                    onClick={() => {
                      if (!canDeleteProductForever(product)) return;
                      setBulkConfirm({ type: "forever", items: [product] });
                    }}
                  >
                    Delete forever
                  </button>
                </HoverTip>
              ) : null}
              {product && !product.deleted && product.published ? (
                <button
                  type="button"
                  className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-50 disabled:opacity-40"
                  disabled={acting}
                  onClick={() => runAction(async () => {
                    const result = unpublishAdminProduct(product.id);
                    note(
                      result,
                      result?.ok
                        ? "Unpublish — not live"
                        : "Unable to Unpublish"
                    );
                  })}
                >
                  Unpublish
                </button>
              ) : null}
              {product && !product.deleted && !product.published ? (
                <button
                  type="button"
                  className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 disabled:opacity-40"
                  disabled={acting}
                  onClick={() => runAction(() => requestPublish(product))}
                >
                  Publish
                </button>
              ) : null}
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={closeModal}>
                Cancel
              </button>
              {product?.deleted ? null : (
                <button type="button" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={acting} onClick={() => runAction(saveProduct)}>
                  {modal === "edit" ? "Save" : "Add Product"}
                </button>
              )}
            </div>
          }
        >
          {productReports.length ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Buyer report</p>
              {productReports.map((r) => (
                <div key={r.id} className="mt-2">
                  <p className="font-medium text-ink">
                    {r.id} · {r.type}
                  </p>
                  <p className="text-xs text-mute">From {r.filerRole} {r.filerEmail}</p>
                  <p className="mt-1 text-ink">{r.text}</p>
                </div>
              ))}
            </div>
          ) : null}
          <label className="block text-sm font-medium text-ink">
            Product name<RequiredMark />
            <textarea
              className="mt-1 w-full resize-y rounded-lg border border-line px-3 py-2 text-sm leading-snug placeholder:text-mute"
              rows={2}
              value={draft.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="e.g. Gypsum Block — 500×500×80mm"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-medium text-ink">Tags</p>
            <div className="flex flex-wrap justify-end gap-2">
              {[
                { key: "green", label: "Green" },
                { key: "hit", label: "Hit" },
                { key: "tailorMade", label: "Tailor Made Product" },
              ].map((tag) => (
                <label
                  key={tag.key}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm leading-none ${
                    draft[tag.key] ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0"
                    checked={Boolean(draft[tag.key])}
                    onChange={(e) => field(tag.key, e.target.checked)}
                  />
                  {tag.label}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium text-ink">Product images</p>
            <div
              className={`mt-1 rounded-lg border border-dashed p-2.5 ${
                imageOver ? "border-brand-600 bg-brand-50" : "border-line bg-paper/60"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setImageOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget)) setImageOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setImageOver(false);
                onImageFiles(e.dataTransfer.files);
              }}
            >
              <div className="flex flex-wrap gap-2">
                {productImageList(draft).map((src, index) => (
                  <span key={`${src.slice(-16)}-${index}`} className="relative">
                    <img src={src} alt="" className="h-14 w-14 object-cover border border-line bg-white" />
                    <button
                      type="button"
                      className="absolute top-0.5 right-0.5 bg-white/90 px-1 text-[10px] font-semibold text-mute hover:text-[#8a2b2b]"
                      onClick={() => {
                        const next = productImageList(draft).filter((_, i) => i !== index);
                        fields({ image: next[0] || "", images: next, imageSource: next.length ? "upload" : "generated" });
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {productImageList(draft).length < PRODUCT_IMAGE_MAX ? (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="relative h-14 w-14 shrink-0 overflow-hidden border border-line bg-white text-2xl font-light text-mute"
                    aria-label="Add photo"
                  >
                    +
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-mute">
                {imageOver ? "Drop to upload" : "JPG / PNG / WebP · up to 5 photos · longest side 1,600px · max 800 KB each after compress."}
              </p>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  onImageFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProductCategoryField value={draft.category} onChange={(value) => field("category", value)} note={note} />
            <label className="text-sm font-medium text-ink">
              Provisional SKU ID<RequiredMark />
              <input
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal placeholder:text-mute"
                value={draft.productNo}
                onChange={(e) => field("productNo", e.target.value)}
                placeholder="e.g. MKT-GB-0001"
              />
            </label>
            <SalesUnitField value={draft.salesUnit} onChange={(value) => field("salesUnit", value)} />
            <label className="text-sm font-medium text-ink">
              Price
              <select
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                value={draft.priceMode || "request"}
                onChange={(e) => field("priceMode", e.target.value)}
              >
                <option value="request">Price Upon Request</option>
                <option value="amount">Set price</option>
              </select>
            </label>
            {draft.priceMode === "amount" ? (
              <label className="text-sm font-medium text-ink">
                Amount (HKD)<RequiredMark />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal placeholder:text-mute"
                  value={draft.price}
                  onChange={(e) => field("price", e.target.value)}
                  placeholder="e.g. 125"
                />
              </label>
            ) : null}
            <label className="text-sm font-medium text-ink">
              MOQ
              <input
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal placeholder:text-mute"
                value={draft.moq}
                onChange={(e) => field("moq", e.target.value)}
                placeholder="e.g. 100"
              />
            </label>
            <label className="text-sm font-medium text-ink">
              Lead time
              <input
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal placeholder:text-mute"
                value={draft.leadTime}
                onChange={(e) => field("leadTime", e.target.value)}
                placeholder="e.g. 14 days"
              />
            </label>
            <label className="text-sm font-medium text-ink">
              Certifications
              <input
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal placeholder:text-mute"
                value={draft.certifications}
                onChange={(e) => field("certifications", e.target.value)}
                placeholder="e.g. ISO 9001, HKGBC Green"
              />
            </label>
            <label className="text-sm font-medium text-ink sm:col-span-2 lg:col-span-3">
              Size / Description
              <input
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal placeholder:text-mute"
                value={draft.sizeDesc}
                onChange={(e) => field("sizeDesc", e.target.value)}
                placeholder="e.g. 500 × 500 × 80mm"
              />
            </label>
            <label className="text-sm font-medium text-ink sm:col-span-2 lg:col-span-3">
              Primary spec description
              <textarea
                className="mt-1 w-full resize-y rounded-lg border border-line px-3 py-2 font-normal leading-snug placeholder:text-mute"
                rows={3}
                value={draft.primarySpec}
                onChange={(e) => field("primarySpec", e.target.value)}
                placeholder="e.g. Density 1100 & 1200kg/m³, compressive strength…"
              />
            </label>
            <label className="text-sm font-medium text-ink sm:col-span-2 lg:col-span-3">
              Purposes (indicator for searching)
              <textarea
                className="mt-1 w-full resize-y rounded-lg border border-line px-3 py-2 font-normal leading-snug placeholder:text-mute"
                rows={4}
                value={draft.purposes}
                onChange={(e) => field("purposes", e.target.value)}
                placeholder={"e.g. Partition wall\nFire-rated ceiling\nWet area"}
              />
              <p className="mt-1 text-xs font-normal text-mute">按 Enter 換行，就係一個新 tag</p>
              {purposeTags.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {purposeTags.map((tag, index) => (
                    <span key={`${tag}-${index}`} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">{tag}</span>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="text-sm font-medium text-ink sm:col-span-2 lg:col-span-3">
              Remark
              <textarea
                className="mt-1 w-full resize-y rounded-lg border border-line px-3 py-2 font-normal leading-snug placeholder:text-mute"
                rows={4}
                value={draft.remark}
                onChange={(e) => field("remark", e.target.value)}
                placeholder="e.g. Also known as…"
              />
            </label>
          </div>
          {formError ? <p className="mt-3 text-sm text-red-700">{formError}</p> : null}
        </AdminModal>
      ) : null}

      {SHOW_PRODUCT_IMPORT && modal === "import" ? (
        <AdminModal title="Import Excel" onClose={closeModal} wide>
          <ExcelPanel note={note} />
        </AdminModal>
      ) : null}

      {bulkConfirm ? (
        <AdminModal
          title={bulkTitles[bulkConfirm.type]}
          onClose={() => setBulkConfirm(null)}
          wide
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={() => setBulkConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${bulkConfirm.type === "delete" || bulkConfirm.type === "forever" ? "bg-red-700" : "bg-brand-600"}`}
                disabled={acting || (bulkConfirm.type === "publish" && !publishableCount)}
                onClick={() => runAction(applyBulkConfirm)}
              >
                {bulkConfirm.type === "publish"
                  ? `Publish ${publishableCount}`
                  : bulkConfirm.type === "unpublish"
                    ? `Unpublish ${bulkConfirm.items.length}`
                    : bulkConfirm.type === "restore"
                      ? `Restore ${bulkConfirm.items.length}`
                      : bulkConfirm.type === "forever"
                        ? `Delete forever ${bulkConfirm.items.length}`
                        : `Remove ${bulkConfirm.items.length}`}
              </button>
            </div>
          }
        >
          <p className="text-sm text-mute">
            {bulkConfirm.type === "publish"
              ? "Official SKU, name, unit and category are required. Duplicate SKUs are skipped. Missing MOQ or lead time is a warning — confirm to go live anyway."
              : bulkConfirm.type === "restore"
                ? "Restore takes the SKU out of Removed. It becomes Unpublish and does not go live."
                : bulkConfirm.type === "forever"
                  ? "This cannot be undone. The SKU leaves the catalog. Old RFQs keep the name and SKU from when they were sent."
                  : bulkConfirm.type === "delete"
                    ? "Removed SKUs leave the marketplace (soft delete) until Restore."
                    : "Confirm these products before the change is applied."}
          </p>
          <div className="mt-3 overflow-auto rounded-lg border border-line max-h-80">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
                <tr>
                  <th className="px-3 py-2">Provisional SKU ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  {bulkConfirm.type === "publish" ? <th className="px-3 py-2">Publish check</th> : null}
                </tr>
              </thead>
              <tbody>
                {bulkConfirm.items.map((p) => {
                  const hard = bulkConfirm.type === "publish" ? publishHardBlockers(p) : [];
                  const warn = bulkConfirm.type === "publish" ? publishWarnBlockers(p) : [];
                  return (
                    <tr key={p.id} className="border-t border-line/80">
                      <td className="px-3 py-2 font-medium">{productSkuId(p) || "—"}</td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2">
                        <StatusBadge product={p} />
                      </td>
                      {bulkConfirm.type === "publish" ? (
                        <td className="px-3 py-2">
                          {hard.length ? (
                            <span className="text-red-700">Skip — need {blockerText(hard)}</span>
                          ) : warn.length ? (
                            <span className="text-amber-800">Will publish · missing {blockerText(warn)}</span>
                          ) : (
                            <span className="text-emerald-800">Ready</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
}

function toForm(p) {
  if (!p) {
    return {
      name: "",
      category: getAdminCategories()[0] || "",
      productNo: "",
      salesUnit: "",
      priceMode: "request",
      price: "",
      moq: "",
      leadTime: "",
      sizeDesc: "",
      certifications: "",
      primarySpec: "",
      purposes: "",
      remark: "",
      green: false,
      hit: false,
      tailorMade: false,
      image: "",
      imageFallback: "",
      images: [],
      imageFallbacks: [],
      imageSource: "generated",
    };
  }
  return {
    name: p.name || "",
    category: p.category || getAdminCategories()[0] || "",
    productNo: p.productNo || "",
    salesUnit: p.salesUnit || p.unit || "",
    priceMode: Number(p.price) > 0 && !p.priceUponRequest ? "amount" : "request",
    price: Number(p.price) > 0 && !p.priceUponRequest ? String(p.price) : "",
    moq: String(p.moq ?? ""),
    leadTime: leadLabel(p),
    sizeDesc: p.sizeDesc || "",
    certifications: p.certifications || p.standard || "",
    primarySpec: p.primarySpec || "",
    purposes: (p.purposes || []).join("\n"),
    remark: p.remark || "",
    green: Boolean(p.green),
    hit: Boolean(p.hit),
    tailorMade: Boolean(p.tailorMade),
    image: p.image || "",
    imageFallback: p.imageFallback || "",
    images: productImageList(p),
    imageFallbacks: Array.isArray(p.imageFallbacks) ? p.imageFallbacks : [],
    imageSource: p.imageSource || (p.image ? "upload" : "generated"),
  };
}

function fromForm(draft) {
  const upon = draft.priceMode !== "amount";
  const amount = Number(String(draft.price ?? "").replace(/,/g, ""));
  const price = !upon && Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
  const { priceMode, ...rest } = draft;
  return {
    ...rest,
    moq: draft.moq,
    purposes: draft.purposes,
    price,
    priceUponRequest: price == null,
  };
}

function ExcelPanel({ note }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [csvResult, setCsvResult] = useState([]);

  async function importFile() {
    setFileError("");
    setBusy(true);
    try {
      const csv = await excelFileToCsv(file);
      const result = await importAdminCsv(csv);
      setCsvResult(result.results || []);
      note(result, "Excel import finished.");
    } catch (error) {
      const message = error?.message || "Unable to read Excel file.";
      setFileError(message);
      note({ ok: false, error: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 grid gap-6 lg:grid-cols-2">
      <section>
        <p className="text-sm text-mute">
          Select an Excel file (.xlsx). Extra columns ignored. Missing name/category fails that row only. Empty
          Provisional SKU ID gets a temporary ID. Live rows stay published.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={downloadProductExcelTemplate}>
            Download template
          </button>
          <label className="cursor-pointer rounded-lg border border-line px-3 py-2 text-sm hover:bg-brand-50">
            Choose Excel file
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const next = e.target.files?.[0] || null;
                setFile(next);
                setFileError("");
                setCsvResult([]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink">
          {file ? file.name : "No Excel file selected."}
        </p>
        {fileError ? <p className="mt-2 text-sm text-red-700">{fileError}</p> : null}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={!file || busy}
            onClick={importFile}
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-brand-800">Row results</h3>
        {csvResult.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {csvResult.map((row) => (
              <li key={row.line} className={row.ok ? "text-brand-800" : "text-red-700"}>
                Line {row.line}: {row.msg}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-mute">No import yet.</p>
        )}
      </section>
    </div>
  );
}

const REJECT_PRESETS = ["No offer", "Cannot supply", "Out of stock", "Spec not available", "Quantity too low"];

function rfqStamp(rfq) {
  return formatQuoteVersionStamp(rfq.submittedAt || rfq.createdAt);
}

function RfqActivityDates({ rfq }) {
  const last = rfqLastActivity(rfq, { audience: "staff" });
  const submitted = rfqStamp(rfq);
  if (!last || last.kind === "submitted") {
    return <span className="whitespace-nowrap">{submitted || "—"}</span>;
  }
  return (
    <div className="whitespace-nowrap">
      <div>{submitted || "—"}</div>
      <div className="mt-0.5 text-[10px] font-medium leading-snug text-ink">
        {rfqActivityLabel(last)} · {formatQuoteVersionStamp(last.at)}
      </div>
    </div>
  );
}

function rfqProductLabel(line) {
  return `${line.productNo || line.name} × ${line.qty}`;
}

function productForLine(line) {
  if (!line) return null;
  const byId = line.productId ? getProduct(line.productId) : null;
  if (byId) return byId;
  const sku = String(line.productNo || line.baseProductNo || "").trim().toUpperCase();
  if (!sku) return null;
  return listAdminProducts().find((p) => String(p.productNo || "").toUpperCase() === sku) || null;
}

function TmsLinkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <path d="M6 3.5H3.5A1.5 1.5 0 0 0 2 5v7.5A1.5 1.5 0 0 0 3.5 14H11a1.5 1.5 0 0 0 1.5-1.5V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 2.5h4.5V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 8.5 13.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ProductPreviewModal({ line, product, onClose }) {
  const name = product?.name || line?.name || "Product";
  const sku = product?.productNo || line?.productNo || "—";
  const specs = product?.specs || [];
  return (
    <AdminModal title={name} onClose={onClose} wide>
      <div className="mt-3 grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div>
          {lineImageSrc(line, product) ? (
            <PreviewThumb src={lineImageSrc(line, product)} name={name} className="h-32 w-32 rounded-lg" />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-line text-xs text-mute">No image</div>
          )}
          {Array.isArray(line?.images) && line.images.filter(Boolean).length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {line.images.filter(Boolean).map((src, index) => (
                <PreviewThumb key={`${src.slice(0, 24)}-${index}`} src={src} name={name} className="h-14 w-14" />
              ))}
            </div>
          ) : null}
        </div>
        <div className="text-sm">
          <p className="font-mono text-xs text-mute">
            {sku}
            {line?.qty ? ` · × ${line.qty}${product?.unit ? ` ${product.unit}` : ""}` : ""}
          </p>
          {product?.category ? <p className="mt-1 text-xs text-mute">{product.category}</p> : null}
          {line?.description || product?.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{line?.description || product.description}</p> : null}
          {lineAttachmentList(line).length ? (
            <AttachmentLinks files={lineAttachmentList(line)} className="mt-3 text-xs text-brand-800" label="Attachment" />
          ) : null}
          {product?.moq ? <p className="mt-2 text-xs text-mute">MOQ {product.moq} {product.unit || ""}</p> : null}
          {specs.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-mute">
              {specs.slice(0, 8).map((spec) => (
                <li key={spec}>{spec}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </AdminModal>
  );
}

function RfqLineRow({ rfq, line, showPricing, compact, note, readOnly = false }) {
  const product = productForLine(line);
  const refs = transactedRefsForLine(line, product);
  const status = inboxStatus(rfq);
  const canNoOffer = !readOnly && (showPricing || status === "accepted" || status === "quoted");
  const canEditPrice = showPricing && !line.noOffer && !readOnly;
  const [preview, setPreview] = useState(false);
  const [price, setPrice] = useState(() => (line.quotedUnitPrice != null ? String(line.quotedUnitPrice) : ""));
  const [qty, setQty] = useState(() => String(line.qty || 1));
  const [remark, setRemark] = useState(() => String(line.remark || ""));

  useEffect(() => {
    setPrice(line.quotedUnitPrice != null ? String(line.quotedUnitPrice) : "");
  }, [line.quotedUnitPrice, line.productId]);

  useEffect(() => {
    setQty(String(line.qty || 1));
    setRemark(String(line.remark || ""));
  }, [line.qty, line.remark, line.productId]);

  function savePrice(raw) {
    const current = line.quotedUnitPrice != null ? String(line.quotedUnitPrice) : "";
    if (String(raw ?? "") === current) return;
    const result = setRfqLineQuotedPrice(rfq.id, line.productId, raw);
    note?.(result, raw === "" || raw == null ? "Price cleared" : "Price saved");
  }

  function saveQty() {
    const next = Math.max(1, Math.floor(Number(qty) || 1));
    if (next === Number(line.qty || 1)) {
      setQty(String(next));
      return;
    }
    note?.(setRfqLineQty(rfq.id, line.productId, next), "Qty saved");
  }

  function saveRemark() {
    if (String(remark) === String(line.remark || "")) return;
    note?.(setRfqLineRemark(rfq.id, line.productId, remark), "Remark saved");
  }

  return (
    <li className={`overflow-hidden rounded-lg border border-line/80 bg-paper/40 ${compact ? "p-2" : "p-2.5"} ${line.noOffer ? "opacity-80" : ""}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <button type="button" className="shrink-0" onClick={() => setPreview(true)} aria-label={`Preview ${product?.name || line.name}`}>
          <ProductThumb product={product || { image: lineImageSrc(line, product) }} />
        </button>
        <div className="min-w-0 flex-1 overflow-hidden">
          <button type="button" className="text-left text-sm font-medium text-ink hover:underline" onClick={() => setPreview(true)}>
            {product?.name || line.name || line.productNo || "Product"}
          </button>
          <p className="text-[11px] text-mute">
            {line.productNo || product?.productNo || "—"}
            {line.custom ? " · Tailor Made Product" : ""}
            {line.noOffer ? " · No offer" : ""}
          </p>
          {canNoOffer ? null : (
            <p className="mt-1 text-[11px] text-ink">
              <span className="font-semibold uppercase tracking-wide text-mute">Qty</span> {line.qty || 1}
              {line.remark ? <span className="ml-2 text-mute">{line.remark}</span> : null}
            </p>
          )}
          {line.custom && line.description ? (
            <p className="mt-1 whitespace-pre-wrap text-[11px] text-ink">{line.description}</p>
          ) : null}
          {line.custom && lineAttachmentList(line).length ? (
            <AttachmentLinks files={lineAttachmentList(line)} className="mt-1 text-[11px] text-brand-800" label="Attachment" />
          ) : null}
        </div>
        {canNoOffer || showPricing ? (
        <div className="flex w-[7.5rem] shrink-0 flex-col items-stretch gap-1.5">
          {canEditPrice ? (
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink">Price<RequiredMark /></span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                placeholder={refs.placeholder}
                onChange={(e) => setPrice(e.target.value)}
                onBlur={() => savePrice(price)}
                className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right text-xs"
              />
            </label>
          ) : showPricing && !line.noOffer ? (
            <p className="rounded-lg border border-line bg-paper px-2 py-1.5 text-right text-xs font-semibold text-ink">
              {line.quotedUnitPrice != null ? formatPrice(line.quotedUnitPrice) : "—"}
            </p>
          ) : null}
          {canNoOffer ? (
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50"
              onClick={() => note?.(setRfqLineNoOffer(rfq.id, line.productId, !line.noOffer), line.noOffer ? "Offer restored" : "Item marked no offer")}
            >
              {line.noOffer ? "Undo no offer" : "No offer"}
            </button>
          ) : null}
        </div>
        ) : null}
      </div>
      {canNoOffer ? (
        <div className="mt-2 grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
          <label className="block min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-mute">Qty</span>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={saveQty}
              className="mt-0.5 w-full rounded-lg border border-line bg-white px-2 py-1 text-xs"
            />
          </label>
          <label className="block min-w-0 overflow-hidden">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-mute">Remark</span>
            <textarea
              rows={1}
              value={remark}
              placeholder="e.g. confirm size / lead"
              onChange={(e) => setRemark(e.target.value)}
              onBlur={saveRemark}
              className="mt-0.5 box-border block min-h-[1.75rem] w-full max-w-full resize-y rounded-lg border border-line bg-white px-2 py-1 text-xs leading-snug placeholder:text-mute"
            />
          </label>
        </div>
      ) : null}
      {showPricing && !readOnly && refs.options.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-14">
          {refs.options.map((opt) => (
            <span key={`${opt.productCode}-${opt.price}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-white pl-2 pr-1 py-0.5 text-[10px]">
              <button
                type="button"
                className="font-semibold text-brand-800 hover:underline"
                onClick={() => {
                  setPrice(String(opt.price));
                  savePrice(opt.price);
                }}
              >
                ${opt.price}
              </button>
              <a
                href={opt.href}
                target="_blank"
                rel="noreferrer"
                title={`TMS filter: ${opt.query || opt.label} · ${opt.productCode} · ${opt.label}`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50"
              >
                <TmsLinkIcon />
                <span className="sr-only">Open TMS {opt.query || opt.productCode}</span>
              </a>
            </span>
          ))}
        </div>
      ) : null}
      {preview ? <ProductPreviewModal line={line} product={product} onClose={() => setPreview(false)} /> : null}
    </li>
  );
}

function MemberAssignSearch({ rfqId, note, compact }) {
  const members = listAssignableBuyers();
  const boxRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(null);
  const needle = searchNeedle(query);
  const matches = (needle ? members.filter((b) => matchesSearch(needle, ...accountSearchHay(b))) : members).slice(0, 12);

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(email) {
    const buyer = members.find((b) => sameEmail(b.email, email));
    if (!buyer) return;
    setQuery("");
    setOpen(false);
    setPending(buyer);
  }

  function confirmAssign() {
    if (!pending?.email) return;
    const result = assignRfqToBuyer(rfqId, pending.email);
    setPending(null);
    if (!result?.ok && result?.error === "locked") {
      note?.({ ok: false, error: "This RFQ already belongs to a marketplace account and cannot be reassigned." });
      return;
    }
    note?.(result, "RFQ assigned to member");
  }

  return (
    <>
    <label className={`block text-mute ${compact ? "text-[10px]" : "text-[11px]"}`}>
      Assign to a registered buyer account
      <div ref={boxRef} className="relative mt-1">
        <input
          type="search"
          autoComplete="off"
          value={query}
          placeholder="Search name, email, company…"
          className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              pick(matches[active]?.email);
            }
          }}
        />
        {open ? (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg">
            {matches.length ? (
              matches.map((b, index) => (
                <li key={b.email}>
                  <button
                    type="button"
                    className={`flex w-full flex-col items-start px-2 py-1.5 text-left text-xs ${
                      index === active ? "bg-brand-50 text-brand-900" : "text-ink hover:bg-brand-50"
                    }`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(b.email)}
                  >
                    <span className="font-semibold">{b.name || b.companyName || b.email}</span>
                    <span className="text-[10px] text-mute">
                      {b.email}
                      {b.companyName && b.name ? ` · ${b.companyName}` : ""}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2 py-2 text-xs text-mute">No matching members</li>
            )}
          </ul>
        ) : null}
      </div>
    </label>
      {pending ? (
        <AdminModal
          title="Confirm assign buyer"
          onClose={() => setPending(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="button" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={confirmAssign}>
                Confirm assign
              </button>
            </div>
          }
        >
          <p className="text-sm text-ink">
            Assign this guest RFQ to <span className="font-semibold">{pending.name || pending.email}</span>
            {pending.companyName ? ` · ${pending.companyName}` : ""} ({pending.email})?
          </p>
          <p className="mt-2 text-sm text-mute">After confirm, the buyer cannot be changed. The RFQ moves to that member’s My RFQs.</p>
        </AdminModal>
      ) : null}
    </>
  );
}

function RfqBuyerMeta({ rfq, note, onOpenBuyer, compact }) {
  const kind = rfqBuyerKind(rfq);
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            kind === "member" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
          }`}
        >
          {kind === "member" ? "Member" : "Guest"}
        </span>
        <BuyerNameLink name={rfq.buyerName} email={rfq.buyerEmail} onOpen={onOpenBuyer} />
      </div>
      {kind === "guest" ? <MemberAssignSearch rfqId={rfq.id} note={note} compact={compact} /> : null}
    </div>
  );
}

function rfqStatusKey(rfq) {
  if (rfq.reverseStatus === "requested") return "reverse";
  if (rfq.cancelStatus === "requested") return "cancel";
  const status = inboxStatus(rfq);
  if (status === "revising") return "revising";
  if (status === "no_offer" || status === "rejected") return "rejected";
  if (status === "accepted" || status === "quoted") {
    if (!SHOW_RFQ_QUOTES) return "accepted";
    if (status === "quoted") return "quoted";
    return rfq.tmsDocumentNo ? "accepted" : "tms";
  }
  if (["received", "reviewing", "returned", "cancelled"].includes(status)) return status;
  return "received";
}

function rfqNeedsAction(rfq) {
  if (rfq.reverseStatus === "requested" || rfq.cancelStatus === "requested") return true;
  const status = inboxStatus(rfq);
  return status === "received" || status === "reviewing";
}

function rfqStatusCounts(rfqs) {
  const counts = { action: 0, all: rfqs.length, received: 0, reviewing: 0, reverse: 0, cancel: 0, tms: 0, accepted: 0, revising: 0, returned: 0, quoted: 0, rejected: 0, cancelled: 0 };
  rfqs.forEach((rfq) => {
    counts[rfqStatusKey(rfq)] += 1;
    if (rfqNeedsAction(rfq)) counts.action += 1;
  });
  return counts;
}

function rfqInboxLabel(rfq) {
  const status = inboxStatus(rfq);
  if (rfq.reverseStatus === "requested") return "Reverse requested";
  if (rfq.cancelStatus === "requested") return "Cancel requested";
  if (status === "revising") return "Revising";
  if (status === "cancelled") return "Cancelled";
  if (status === "no_offer" || status === "rejected") return "No Offer Rejected";
  if (status === "accepted" && rfqQuotedOffline(rfq) && SHOW_RFQ_QUOTES) return "WhatsApp quote";
  if (status === "accepted" && rfq.tmsDocumentNo && SHOW_RFQ_QUOTES) return "iRFQ created";
  if (status === "accepted") return SHOW_RFQ_QUOTES ? "Accepted" : "In review";
  if (status === "returned") return "Returned";
  if (status === "reviewing") return "Reviewing";
  if (status === "quoted") return SHOW_RFQ_QUOTES ? "Quoted" : "In review";
  return "Received";
}

function rfqInboxChipClass(rfq) {
  const status = inboxStatus(rfq);
  if (rfq.reverseStatus === "requested") return "bg-violet-100 text-violet-900";
  if (rfq.cancelStatus === "requested") return "bg-amber-100 text-amber-950";
  if (status === "revising") return "bg-sky-50 text-sky-900";
  if (status === "cancelled") return "bg-slate-100 text-slate-600";
  if (status === "no_offer" || status === "rejected") return "bg-red-50 text-red-800";
  if (status === "accepted" && rfqQuotedOffline(rfq)) return "bg-emerald-50 text-emerald-800";
  if (status === "accepted" && rfq.tmsDocumentNo) return "bg-emerald-50 text-emerald-800";
  if (status === "accepted") return "bg-amber-50 text-amber-900";
  if (status === "returned") return "bg-orange-50 text-orange-800";
  if (status === "reviewing") return "bg-sky-50 text-sky-800";
  if (status === "quoted") return "bg-brand-50 text-brand-800";
  return "bg-blue-50 text-blue-800";
}

function buyerDomId(email) {
  return `admin-buyer-${String(email || "").replace(/[^a-zA-Z0-9]/g, "-")}`;
}

function sameEmail(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function formatSignedUp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function sortNewestAccounts(list) {
  return [...(list || [])].sort((a, b) => {
    const tb = Date.parse(b?.createdAt || "") || 0;
    const ta = Date.parse(a?.createdAt || "") || 0;
    if (tb !== ta) return tb - ta;
    return String(b?.email || "").localeCompare(String(a?.email || ""));
  });
}

function BuyerNameLink({ name, email, onOpen, className = "" }) {
  if (!email && !name) return <span className="text-mute">—</span>;
  if (!onOpen || !email) {
    return (
      <span className={className}>
        {name ? <span className="font-medium">{name}</span> : null}
        {name && email ? " · " : ""}
        {email ? <span className={name ? "text-mute" : ""}>{email}</span> : null}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`text-left text-brand-800 hover:underline ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(email);
      }}
    >
      {name ? <span className="font-medium">{name}</span> : null}
      {name && email ? <span className="text-mute"> · </span> : null}
      {email ? <span className={name ? "text-mute" : "font-medium"}>{email}</span> : null}
    </button>
  );
}

function RfqStatusChip({ rfq }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${rfqInboxChipClass(rfq)}`}>
      {rfqInboxLabel(rfq)}
    </span>
  );
}

function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-white p-1" role="group" aria-label="RFQ view">
      {[
        { id: "card", label: "Cards" },
        { id: "list", label: "List" },
      ].map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-brand-600 text-white" : "text-mute hover:bg-brand-50 hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function rfqIsOpen(rfq) {
  const status = inboxStatus(rfq);
  return (
    (status === "received" || status === "reviewing" || status === "returned") &&
    rfq.cancelStatus !== "requested" &&
    rfq.reverseStatus !== "requested"
  );
}

function rfqCanPrice(rfq) {
  const status = inboxStatus(rfq);
  return status === "accepted" || status === "quoted";
}

function rfqLinesPriced(rfq) {
  const lines = (rfq?.lines || []).filter((line) => !line.noOffer);
  return Boolean(lines.length) && lines.every((line) => Number(line.quotedUnitPrice) > 0);
}

function rfqActionKind(rfq, open) {
  const status = inboxStatus(rfq);
  if (status === "revising") return "";
  if (rfq.reverseStatus === "requested") return "reverse";
  if (rfq.cancelStatus === "requested") return "cancel";
  if (open) return "decide";
  if (status === "accepted" || status === "quoted") return rfq.tmsDocumentNo && rfq.tmsUrl ? "open" : "price";
  return "";
}

function tmsIrfqDetailsHref(rfq, tms) {
  const id = tms?.id || rfq?.tmsId;
  const fromApi = String(tms?.url || rfq?.tmsUrl || "").trim();
  const origin = fromApi.match(/^https?:\/\/[^/]+/)?.[0] || "https://uat-tms-v2.mattex.com.hk";
  if (id) return `${origin}/inbound/inbound-rfq/${id}`;
  if (fromApi && /\/inbound\/inbound-rfq\/[^/?]+/.test(fromApi) && !fromApi.includes("pageSize=")) return fromApi;
  return "";
}

function RfqActions({
  rfq,
  open,
  accepting,
  quoting,
  onAccept,
  onReject,
  onCreateTms,
  onSubmitBuyer,
  onSendWhatsapp,
  onMarkWhatsappSent,
  waOpened = false,
  waBusy = false,
  onAcceptCancel,
  onDeclineCancel,
  onAcceptReverse,
  onDeclineReverse,
  prominent = false,
  note,
}) {
  const status = inboxStatus(rfq);
  const kind = rfqActionKind(rfq, open);
  const wrap = prominent ? "flex flex-wrap items-center gap-3" : "flex flex-wrap justify-end gap-2";
  const primary = prominent
    ? "rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
    : "rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60";
  const secondary = prominent
    ? "rounded-lg border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50 disabled:opacity-60"
    : "rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-50 disabled:opacity-60";
  const danger = prominent
    ? "rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
    : "rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50";
  const warn = prominent
    ? "rounded-lg border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
    : "rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60";
  const dark = prominent
    ? "rounded-lg bg-charcoal px-5 py-2.5 text-sm font-semibold text-white"
    : "rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white";
  const quietReject = prominent
    ? "rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
    : "rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50";

  const tmsOpen = rfq.tmsDocumentNo ? (
    <a href={tmsIrfqDetailsHref(rfq)} target="_blank" rel="noreferrer" className={dark}>
      Open {rfq.tmsDocumentNo}
    </a>
  ) : null;

  if (!kind) {
    if (!tmsOpen) return null;
    return <div className={wrap}>{tmsOpen}</div>;
  }

  if (kind === "reverse") {
    return (
      <div className={wrap}>
        <button type="button" className={primary} onClick={() => onAcceptReverse?.(rfq)}>
          Accept reverse
        </button>
        <button type="button" className={secondary} onClick={() => onDeclineReverse?.(rfq)}>
          Keep RFQ
        </button>
        {tmsOpen}
      </div>
    );
  }

  if (kind === "cancel") {
    return (
      <div className={wrap}>
        <button type="button" className={primary} onClick={() => onAcceptCancel(rfq)}>
          Accept cancel
        </button>
        <button type="button" className={secondary} onClick={() => onDeclineCancel(rfq)}>
          Keep RFQ
        </button>
        {tmsOpen}
      </div>
    );
  }
  const priced = rfqLinesPriced(rfq);
  const guestBuyer = rfqBuyerKind(rfq) !== "member";
  const waReady = rfqCanSendWhatsappQuote(rfq);
  const waSent = rfqQuotedOffline(rfq);
  const quoteTools = SHOW_RFQ_QUOTES;
  const waTitle =
    waReady.ok
      ? ""
      : waReady.reason === "phone"
        ? "Add a parseable phone in Follow-up first"
        : waReady.reason === "prices"
          ? "Enter a price for every offer line first"
          : "Acknowledge the RFQ first";
  return (
    <div className={wrap}>
      {open ? (
        <>
          <button type="button" className={primary} disabled={accepting} onClick={() => onAccept(rfq)}>
            Acknowledge
          </button>
          <button
            type="button"
            className={quietReject}
            onClick={() => onReject(rfq)}
          >
            Reject (No Offer)
          </button>
        </>
      ) : null}
      {(status === "accepted" || status === "quoted") && quoteTools ? (
        <>
          <button
            type="button"
            className={guestBuyer ? secondary : primary}
            disabled={!priced || quoting || guestBuyer}
            onClick={() => onSubmitBuyer?.(rfq)}
            title={
              guestBuyer
                ? "Guest has no marketplace account. Assign a member, or WhatsApp the quote."
                : priced
                  ? ""
                  : "Enter a price for every offer line first"
            }
          >
            {quoting ? "Submitting…" : status === "quoted" && !guestBuyer ? "Update quote to buyer" : "Submit To Buyer"}
          </button>
          {guestBuyer && onSendWhatsapp ? (
            <>
              <button
                type="button"
                className={primary}
                disabled={!waReady.ok || waBusy}
                onClick={() => onSendWhatsapp?.(rfq)}
                title={waTitle}
              >
                {waBusy ? "Opening…" : waSent ? "Update quote on WhatsApp" : "Send quote on WhatsApp"}
              </button>
              <button
                type="button"
                className={secondary}
                disabled={!waOpened || waBusy}
                onClick={() => onMarkWhatsappSent?.(rfq)}
                title={waOpened ? "Mark this quote as sent on WhatsApp (does not submit to My RFQs)" : "Open WhatsApp first, then mark sent"}
              >
                Quote sent on WhatsApp
              </button>
            </>
          ) : null}
          {rfq.tmsDocumentNo ? (
            <a
              href={tmsIrfqDetailsHref(rfq)}
              target="_blank"
              rel="noreferrer"
              className={dark}
            >
              Open {rfq.tmsDocumentNo}
            </a>
          ) : (
            <button type="button" className={warn} disabled={accepting} onClick={() => onCreateTms?.(rfq)}>
              {accepting ? "Creating iRFQ…" : "Create TMS iRFQ"}
            </button>
          )}
          <button type="button" className={quietReject} onClick={() => onReject(rfq)}>
            Reject (No Offer)
          </button>
        </>
      ) : null}
      {(status === "accepted" || status === "quoted") && !quoteTools ? (
        <button type="button" className={quietReject} onClick={() => onReject(rfq)}>
          Reject (No Offer)
        </button>
      ) : null}
    </div>
  );
}

async function makeRfqPdf(rfq) {
  const kind = rfq.askKind === "buy" ? "buy" : "quote";
  return buildQuotePdf({ kind, items: quotePdfItems(rfq.lines || []), refNo: rfq.id });
}

function RfqDetail({
  rfq,
  note,
  accepting,
  quoting,
  waOpened,
  waBusy,
  onBack,
  onOpenBuyer,
  onAccept,
  onReject,
  onCreateTms,
  onSubmitBuyer,
  onSendWhatsapp,
  onMarkWhatsappSent,
  onAcceptCancel,
  onDeclineCancel,
  onAcceptReverse,
  onDeclineReverse,
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [viewMode, setViewMode] = useState(DRAFT_VALUE);
  const [requestViewMode, setRequestViewMode] = useState("");
  const status = inboxStatus(rfq);
  const open = rfqIsOpen(rfq);
  const versions = quoteVersionList(rfq);
  const viewingDraft = viewMode === DRAFT_VALUE || !versions.length;
  const requestEffective = rfqRequestEffectiveVersionNo(rfq);
  const viewingRequestNo = Number(requestViewMode) || requestEffective;
  const historicalRequest =
    Boolean(requestEffective) && Number(viewingRequestNo) > 0 && Number(viewingRequestNo) !== Number(requestEffective);
  const requestPreview = historicalRequest ? applyRfqRequestVersion(rfq, viewingRequestNo) : rfq;
  const previewLines = historicalRequest
    ? requestPreview.lines || []
    : viewingDraft
      ? rfq.lines || []
      : rfqLinesForQuoteVersion(rfq, viewMode);
  const showPricing = SHOW_RFQ_QUOTES && rfqCanPrice(rfq);
  const account = listBuyers().find((b) => sameEmail(b.email, rfq.buyerEmail));
  const actionKind = rfqActionKind(rfq, open);
  const guestBuyer = rfqBuyerKind(rfq) !== "member";
  const waSent = rfqQuotedOffline(rfq);
  const lastActivity = rfqLastActivity(rfq, { audience: "staff" });

  useEffect(() => {
    hydrateRfqDecisionActivity(rfq.id);
  }, [rfq.id]);

  useEffect(() => {
    setViewMode(DRAFT_VALUE);
    setRequestViewMode(requestEffective ? String(requestEffective) : "");
  }, [rfq.id, requestEffective]);

  function loadPreviewIntoDraft() {
    if (viewingDraft) return;
    if (quoteDraftIsDirty(rfq)) {
      const ok = window.confirm("Load this version into draft? Unsaved worksheet prices will be overwritten.");
      if (!ok) return;
    }
    const result = loadQuoteVersionIntoDraft(rfq.id, viewMode);
    if (result?.ok) {
      setViewMode(DRAFT_VALUE);
      note?.(result, `Loaded v${viewMode} into draft. Send or update to freeze a new version.`);
    } else {
      note?.(result, "Could not load this version into draft.");
    }
  }
  const actionCopy =
    actionKind === "reverse"
      ? "Buyer asked to reverse this RFQ so they can revise it."
      : actionKind === "cancel"
      ? "Buyer asked to cancel this RFQ."
                    : actionKind === "decide"
        ? SHOW_RFQ_QUOTES
          ? "Acknowledge to price this RFQ, or Reject (No Offer)."
          : "Acknowledge this RFQ to start handling it, or Reject (No Offer)."
        : actionKind === "price"
          ? !SHOW_RFQ_QUOTES
            ? "RFQ accepted. Buyer sees In review. Follow up by phone if needed."
            : guestBuyer
            ? "Guest has no marketplace account — cannot send this quote to My RFQs. Send quote on WhatsApp, assign a registered member, or Create TMS iRFQ."
            : status === "quoted"
            ? "Quote is with the buyer. You can update prices or Create TMS iRFQ."
            : "Enter a unit price for each line, then Submit To Buyer or Create TMS iRFQ."
          : actionKind === "open"
            ? !SHOW_RFQ_QUOTES
              ? "RFQ accepted. Buyer sees In review. Follow up by phone if needed."
              : rfq.tmsDocumentNo
              ? `iRFQ is ready in TMS${status === "quoted" && !guestBuyer ? " · quote sent to buyer" : waSent ? " · quote sent on WhatsApp" : guestBuyer ? " · guest quote stays off marketplace" : ""}.`
              : guestBuyer
                ? waSent
                  ? "Quote sent on WhatsApp. Assign a member to also submit into My RFQs, or update the WhatsApp quote."
                  : "Guest has no marketplace account. Send quote on WhatsApp, or assign a member."
                : "Quote sent to buyer."
            : "";

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const pdf = await makeRfqPdf(rfq);
      downloadBlob(pdf.blob, pdf.filename);
      note({ ok: true }, `Downloaded ${pdf.filename}`);
    } catch (error) {
      note({ ok: false, error: error?.message || "Unable to build PDF" });
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="text-sm font-semibold text-brand-800 hover:underline" onClick={onBack}>
        ← RFQ inbox
      </button>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-brand-900">{rfq.id}</h1>
          <p className="mt-1 text-sm text-mute">
            {(rfq.askKind || "quote").toUpperCase()} · {rfq.channel === "email" ? "email" : "portal"} · {rfqStamp(rfq)}
            {rfqProjectName(rfq) ? ` · ${rfqProjectName(rfq)}` : ""}
          </p>
          {lastActivity && lastActivity.kind !== "submitted" ? (
            <p className="mt-1 text-xs text-ink">
              Last action · {rfqActivityLabel(lastActivity)} · {formatQuoteVersionStamp(lastActivity.at)}
            </p>
          ) : null}
        </div>
        <RfqStatusChip rfq={rfq} />
      </div>
      {actionKind ? (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            actionKind === "open" ? "border-line bg-white" : "border-brand-200 bg-brand-50"
          }`}
        >
          {actionCopy ? <p className="text-sm font-medium text-ink">{actionCopy}</p> : null}
          <RfqActions
            rfq={rfq}
            open={open}
            accepting={accepting}
            quoting={quoting}
            prominent
            note={note}
            onAccept={onAccept}
            onReject={onReject}
            onCreateTms={onCreateTms}
            onSubmitBuyer={onSubmitBuyer}
            onSendWhatsapp={onSendWhatsapp}
            onMarkWhatsappSent={onMarkWhatsappSent}
            waOpened={waOpened}
            waBusy={waBusy}
            onAcceptCancel={onAcceptCancel}
            onDeclineCancel={onDeclineCancel}
            onAcceptReverse={onAcceptReverse}
            onDeclineReverse={onDeclineReverse}
          />
        </div>
      ) : status === "revising" ? (
        <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Buyer is revising this RFQ. Nothing to do until they resubmit.
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-mute">
              {showPricing ? (viewingDraft ? "Price lines · Draft" : "Price lines · read-only preview") : "Buyer products"}
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <RfqRequestVersionSelect
                rfq={rfq}
                value={requestViewMode || (requestEffective ? String(requestEffective) : "")}
                onChange={setRequestViewMode}
                id={`portal-rfq-version-${rfq.id}`}
              />
            {showPricing && versions.length ? (
              <div className="flex flex-wrap items-end gap-2">
                <QuoteVersionSelect
                  rfq={rfq}
                  value={viewMode}
                  onChange={setViewMode}
                  showDraft
                  id={`portal-quote-version-${rfq.id}`}
                />
                {viewingDraft ? null : (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-50"
                      onClick={() => setViewMode(DRAFT_VALUE)}
                    >
                      Return to Draft
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={loadPreviewIntoDraft}
                    >
                      Load into draft
                    </button>
                  </>
                )}
              </div>
            ) : null}
            </div>
          </div>
          {historicalRequest ? (
            <p className="mt-2 text-xs text-mute">Viewing a previous RFQ request. Switch to Current to see the latest submission.</p>
          ) : SHOW_RFQ_QUOTES && !viewingDraft ? (
            <p className="mt-2 text-xs text-mute">
              Viewing a frozen send. Line prices are read-only. Submit / WhatsApp still use Draft. Load into draft, then send, to freeze a new version.
            </p>
          ) : SHOW_RFQ_QUOTES && versions.length ? (
            <p className="mt-2 text-xs text-mute">Worksheet edits stay draft until Submit To Buyer or Quote sent on WhatsApp.</p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {(previewLines || []).map((line, index) => (
              <RfqLineRow
                key={`${rfq.id}-${line.productId || index}-${historicalRequest ? viewingRequestNo : viewingDraft ? "draft" : viewMode}`}
                rfq={historicalRequest ? requestPreview : rfq}
                line={line}
                note={note}
                showPricing={showPricing && !historicalRequest}
                readOnly={!viewingDraft || historicalRequest || status === "revising"}
              />
            ))}
          </ul>
          {status === "rejected" && rfq.reason ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Rejected: {rfq.reason}</p>
          ) : null}
          {rfq.reverseStatus === "requested" ? (
            <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
              Buyer asked to reverse this RFQ. Accept to let them revise, or keep the RFQ.
            </p>
          ) : null}
          {rfq.cancelStatus === "requested" ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Buyer asked to cancel. Accept to close, or keep the RFQ.</p>
          ) : null}
          {status === "cancelled" ? <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-mute">Cancelled</p> : null}
          {SHOW_RFQ_QUOTES && status === "quoted" && !guestBuyer ? (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Quote submitted to buyer
            </p>
          ) : null}
          {SHOW_RFQ_QUOTES && guestBuyer && waSent ? (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Quote sent on WhatsApp{rfq.quoteDeliveredAt ? ` · ${String(rfq.quoteDeliveredAt).slice(0, 16).replace("T", " ")}` : ""}. Assign a member to also submit into My RFQs.
            </p>
          ) : null}
          {status === "accepted" ? (
            <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${SHOW_RFQ_QUOTES && rfq.tmsDocumentNo ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
              {!SHOW_RFQ_QUOTES
                ? "Accepted. Buyer sees In review. Follow up by phone if needed."
                : rfq.tmsDocumentNo
                ? `iRFQ created · ${rfq.tmsDocumentNo}`
                : rfq.lastTmsError
                  ? `TMS failed: ${rfq.lastTmsError}`
                  : guestBuyer
                    ? waSent
                      ? "Accepted. Quote sent on WhatsApp — assign a member or update the WhatsApp quote."
                      : "Accepted. Guest cannot receive a marketplace quote — send on WhatsApp, assign a member, or Create TMS iRFQ."
                    : "Accepted. Enter prices, then Submit To Buyer or Create TMS iRFQ."}
            </p>
          ) : null}
        </section>
        <aside className="space-y-3">
          <section className="rounded-xl border border-line bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-mute">Buyer</h2>
            <div className="mt-2">
              <RfqBuyerMeta rfq={rfq} note={note} onOpenBuyer={onOpenBuyer} />
            </div>
            {account ? (
              <>
                <p className="mt-2 text-sm">{account.companyName || "—"}</p>
                {Array.isArray(account.roles) && account.roles.length ? (
                  <p className="mt-2 text-sm text-ink">
                    {account.roles.map((role) => (role === "contractor" ? "Contractor" : "Buyer")).join(" · ")}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">{accountStatusLabel(account)}</p>
              </>
            ) : (
              <p className="mt-2 text-xs text-mute">No marketplace account for this email.</p>
            )}
          </section>
          <section className="rounded-xl border border-line bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-mute">Follow-up</h2>
            <p className="mt-1 text-xs text-mute">{followUpHint(account, rfq, guestBuyer)}</p>
            <div className="mt-3">
              <RfqFollowUpContact rfq={rfq} account={account} note={note} />
            </div>
          </section>
          <RfqActivityLog rfq={rfq} lang="en" audience="staff" title="Activity" />
          <section className="rounded-xl border border-line bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-mute">PDF</h2>
            <p className="mt-1 text-xs text-mute">Download a copy of this RFQ.</p>
            <div className="mt-3">
              <button
                type="button"
                className="rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                disabled={pdfBusy}
                onClick={downloadPdf}
              >
                {pdfBusy ? "Building…" : "Download PDF"}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function RfqPanel({ rfqs: rawRfqs, note, focusId = "", onClearFocus, onOpenDetail, onOpenBuyer }) {
  const rfqs = SHOW_RFQ_QUOTES ? rawRfqs : rawRfqs.filter(isDev1InboxRfq);
  const [view, setView] = useState("list");
  const [statusTab, setStatusTab] = useState("action");
  const [query, setQuery] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [acceptingId, setAcceptingId] = useState("");
  const [quotingId, setQuotingId] = useState("");
  const [waBusyId, setWaBusyId] = useState("");
  const [waOpenedId, setWaOpenedId] = useState("");
  const [pinnedId, setPinnedId] = useState("");
  const [rfqPulling, setRfqPulling] = useState(false);
  const focused = Boolean(focusId) && rfqs.some((r) => r.id === focusId);
  const needle = searchNeedle(query);
  const searchedRfqs = needle
    ? rfqs.filter((r) => matchesSearch(needle, ...rfqSearchHay(r)))
    : rfqs;
  const statusTabs = SHOW_RFQ_QUOTES ? RFQ_STATUS_TABS : RFQ_STATUS_TABS_SLICE;
  const activeStatusTab = statusTabs.some((tab) => tab.id === statusTab) ? statusTab : "action";
  const visibleRfqs =
    activeStatusTab === "all"
      ? searchedRfqs
      : activeStatusTab === "action"
        ? searchedRfqs.filter(rfqNeedsAction)
        : searchedRfqs.filter((r) => rfqStatusKey(r) === activeStatusTab);

  useEffect(() => {
    if (!focusId) return;
    const rfq = rfqs.find((r) => r.id === focusId);
    if (!rfq) return;
    if (rfqNeedsAction(rfq)) {
      setStatusTab("action");
      return;
    }
    const key = rfqStatusKey(rfq);
    setStatusTab(statusTabs.some((tab) => tab.id === key) ? key : "all");
  }, [focusId]);

  useEffect(() => {
    if (!focusId) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(`admin-rfq-${focusId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusId, view]);

  useEffect(() => {
    if (!focusId || focused) {
      setRfqPulling(false);
      return undefined;
    }
    let cancelled = false;
    setRfqPulling(true);
    const tick = async () => {
      await refreshRemoteRfqs();
      if (!cancelled) setRfqPulling(false);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [focusId, focused]);

  useEffect(() => {
    setWaOpenedId("");
  }, [focusId]);

  function followRfq(rfq) {
    if (!rfq?.id) return;
    setPinnedId(rfq.id);
    if (rfqNeedsAction(rfq)) setStatusTab("action");
    else {
      const key = rfqStatusKey(rfq);
      setStatusTab(statusTabs.some((tab) => tab.id === key) ? key : "all");
    }
    window.setTimeout(() => {
      document.getElementById(`admin-rfq-${rfq.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }

  function mailNote(mail, okMessage, failMessage) {
    if (mail?.ok === false && mail.error === "email") {
      note({ ok: true }, okMessage.replace(/Buyer email sent\.?/, "No buyer email (guest or invalid address)."));
      return;
    }
    if (mail?.ok === false && mail.error === "not_configured") {
      note({ ok: true }, okMessage.replace(/Buyer email sent\.?/, "Buyer email was not sent. Email is not set up on this computer."));
      return;
    }
    if (mail?.ok === false) {
      note({ ok: false, error: failMessage || "Buyer email could not be sent." });
      return;
    }
    note(
      { ok: true },
      mail?.skipped ? okMessage.replace("Buyer email sent.", "Localhost does not send the buyer email.") : okMessage
    );
  }

  function openReject(rfq) {
    setRejecting(rfq);
    setRejectReason("No offer");
    setRejectError("");
  }

  function closeReject() {
    setRejecting(null);
    setRejectReason("");
    setRejectError("");
  }

  async function confirmReject() {
    const why = rejectReason.trim() || "No offer";
    const result = decideRfq(rejecting.id, { decision: "no_offer", reason: why });
    if (!result?.ok) {
      setRejectError(result?.error || "Unable to reject.");
      note(result, "RFQ marked No Offer Rejected");
      return;
    }
    const next = result.rfq || { ...rejecting, reviewStatus: "no_offer", reason: why };
    closeReject();
    followRfq(next);
    const mail = await deliverRfqNoOfferEmail(next);
    mailNote(mail, "RFQ moved to No Offer Rejected. Buyer email sent.", "RFQ rejected. Buyer email could not be sent.");
  }

  async function acceptCancel(rfq) {
    const result = decideRfqCancel(rfq.id, { accept: true });
    if (!result?.ok) {
      note(result, "Cancel accepted");
      return;
    }
    followRfq(result.rfq || { ...rfq, cancelStatus: "accepted", reviewStatus: "cancelled" });
    const mail = await deliverRfqCancelAcceptedEmail(result.rfq || rfq);
    mailNote(mail, "Cancel accepted. Buyer email sent.", "Cancel accepted. Buyer email could not be sent.");
  }

  async function declineCancel(rfq) {
    const result = decideRfqCancel(rfq.id, { accept: false });
    if (!result?.ok) {
      note(result, "RFQ kept");
      return;
    }
    followRfq(result.rfq || { ...rfq, cancelStatus: "declined" });
    const mail = await deliverRfqCancelDeclinedEmail(result.rfq || rfq);
    mailNote(mail, "RFQ kept in In review. Buyer email sent.", "RFQ kept. Buyer email could not be sent.");
  }

  async function acceptReverse(rfq) {
    const result = decideRfqReverse(rfq.id, { accept: true });
    if (!result?.ok) {
      note(result, "Reverse accepted");
      return;
    }
    followRfq(result.rfq || { ...rfq, reviewStatus: "revising", reverseStatus: "" });
    const mail = await deliverRfqReverseAcceptedEmail(result.rfq || rfq);
    mailNote(mail, "Reverse accepted. Buyer can revise. Email sent.", "Reverse accepted. Buyer email could not be sent.");
  }

  async function declineReverse(rfq) {
    const result = decideRfqReverse(rfq.id, { accept: false });
    if (!result?.ok) {
      note(result, "RFQ kept");
      return;
    }
    followRfq(result.rfq || { ...rfq, reverseStatus: "declined" });
    const mail = await deliverRfqReverseDeclinedEmail(result.rfq || rfq);
    mailNote(mail, "RFQ kept in In review. Buyer email sent.", "RFQ kept. Buyer email could not be sent.");
  }

  async function createIrfq(rfq) {
    setAcceptingId(rfq.id);
    let pdfName = "";
    let pdfBlob = null;
    let pdfUrl = "";
    try {
      const kind = rfq.askKind === "buy" ? "buy" : "quote";
      const pdf = await buildQuotePdf({ kind, items: quotePdfItems(rfq.lines || []), refNo: rfq.id });
      pdfName = pdf.filename;
      pdfBlob = pdf.blob;
      pdfUrl = pdf.url || "";
    } catch {
      pdfName = "";
    }
    try {
      const tms = await submitRfqToTms({
        kind: rfq.askKind === "buy" ? "buy" : "quote",
        rfq,
        project: rfqProjectName(rfq),
        pdfBlob,
        pdfFilename: pdfName,
        staffEmail: getStaffSession()?.email || "",
      });
      const detailUrl = tmsIrfqDetailsHref(rfq, tms);
      const handoff = uploadRfqToTms(rfq.id, {
        whatsappPdfName: pdfName,
        tms: {
          ...tms,
          documentNo: tms.documentNo || tms.id,
          url: detailUrl,
        },
      });
      setAcceptingId("");
      note(
        handoff,
        tms?.documentNo
          ? tms.handlerAssigned
            ? `iRFQ created · ${tms.documentNo} · you are the handler`
            : `iRFQ created · ${tms.documentNo} · handler left blank`
          : "iRFQ created"
      );
    } catch (error) {
      const message = error?.message || "TMS create failed";
      uploadRfqToTms(rfq.id, { fail: message, whatsappPdfName: pdfName });
      setAcceptingId("");
      note({ ok: false, error: message }, `iRFQ was not created: ${message}`);
    } finally {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    }
  }

  async function acceptRfq(rfq) {
    const result = decideRfq(rfq.id, { decision: "accepted" });
    if (!result?.ok) {
      note(
        result,
        SHOW_RFQ_QUOTES
          ? "RFQ accepted — enter prices, then Submit To Buyer or Create TMS iRFQ"
          : "RFQ accepted — buyer sees In review. Follow up by phone if needed."
      );
      return;
    }
    const next = result.rfq || { ...rfq, reviewStatus: "accepted" };
    followRfq(next);
    const mail = await deliverRfqAcceptedEmail(next);
    mailNote(
      mail,
      SHOW_RFQ_QUOTES
        ? "RFQ accepted. Buyer email sent. Enter prices, then Submit To Buyer or Create TMS iRFQ."
        : "RFQ moved to In review. Buyer email sent.",
      "RFQ accepted. Buyer email could not be sent."
    );
  }

  async function createTmsIrfq(rfq) {
    await createIrfq(rfq);
  }

  function submitToBuyer(rfq) {
    setQuotingId(rfq.id);
    const result = quoteRfqToBuyer(rfq.id);
    setQuotingId("");
    if (result?.error === "prices") {
      note(result, "Enter a price for every line before submitting to the buyer.");
      return;
    }
    if (result?.error === "not_accepted") {
      note(result, "Accept the RFQ first.");
      return;
    }
    if (result?.error === "guest") {
      note(result, "Guest has no marketplace account. Assign a member or WhatsApp the quote.");
      return;
    }
    note(result, "Quote submitted to buyer");
  }

  function sendWhatsappQuote(rfq) {
    const ready = rfqCanSendWhatsappQuote(rfq);
    if (!ready.ok) {
      note(
        { ok: false, error: ready.reason },
        ready.reason === "phone"
          ? "Add a parseable phone in Follow-up first."
          : ready.reason === "prices"
            ? "Enter a price for every offer line first."
            : "Accept the RFQ first."
      );
      return;
    }
    setWaBusyId(rfq.id);
    const created = createGuestQuoteSnapshot(rfq.id);
    if (!created?.ok) {
      setWaBusyId("");
      note(created, created?.error === "guest" ? "Guest quote was not created." : "Unable to freeze this quote.");
      return;
    }
    const href = created.href;
    let opened = false;
    try {
      const win = window.open(href, "_blank", "noopener,noreferrer");
      opened = Boolean(win);
    } catch {
      opened = false;
    }
    setWaBusyId("");
    setWaOpenedId(rfq.id);
    note(
      { ok: true },
      opened
        ? "WhatsApp opened with the frozen quote link. Click Quote sent on WhatsApp when you have sent it."
        : "WhatsApp URL opened (popup may be blocked). Click Quote sent on WhatsApp when you have sent it."
    );
  }

  function markWhatsappSent(rfq) {
    if (waOpenedId !== rfq.id) {
      note({ ok: false, error: "not_opened" }, "Open WhatsApp first, then mark sent.");
      return;
    }
    const result = markGuestQuoteWhatsappSent(rfq.id);
    if (result?.ok) setWaOpenedId("");
    note(result, "Quote marked sent on WhatsApp (not submitted to My RFQs)");
  }

  const empty = (
    <p className="text-sm text-mute">
      No RFQs yet. On{" "}
      <a href={marketplaceHomeHref("en")} className="font-semibold text-brand-700 hover:underline">
        Marketplace
      </a>
      , log in as a buyer and Request for Quote from Cart, or send a guest WhatsApp quote — both land here.
    </p>
  );

  const detailRfq = focusId ? rfqs.find((r) => r.id === focusId) : null;
  if (detailRfq) {
    return (
      <div>
        <RfqDetail
          rfq={detailRfq}
          note={note}
          accepting={acceptingId === detailRfq.id}
          quoting={quotingId === detailRfq.id}
          waOpened={waOpenedId === detailRfq.id}
          waBusy={waBusyId === detailRfq.id}
          onBack={onClearFocus}
          onOpenBuyer={onOpenBuyer}
          onAccept={acceptRfq}
          onReject={openReject}
          onCreateTms={createTmsIrfq}
          onSubmitBuyer={submitToBuyer}
          onSendWhatsapp={sendWhatsappQuote}
          onMarkWhatsappSent={markWhatsappSent}
          onAcceptCancel={acceptCancel}
          onDeclineCancel={declineCancel}
          onAcceptReverse={acceptReverse}
          onDeclineReverse={declineReverse}
        />
        {rejecting ? (
          <AdminModal title={`Reject (No Offer) ${rejecting.id}`} onClose={closeReject}>
            <p className="mt-2 text-sm text-mute">
              {rejecting.buyerName ? `${rejecting.buyerName} · ` : ""}
              {rejecting.buyerEmail}
            </p>
            <p className="mt-3 text-sm font-medium">Buyer RFQ status will become No Offer Rejected.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REJECT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    rejectReason === preset ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-line text-ink hover:bg-brand-50"
                  }`}
                  onClick={() => {
                    setRejectReason(preset);
                    setRejectError("");
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm">
              Reason<RequiredMark />
              <textarea
                className="mt-1 w-full min-h-[88px] rounded-lg border border-line px-3 py-2 text-sm"
                placeholder="Select a reason above or write your own"
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  setRejectError("");
                }}
              />
            </label>
            {rejectError ? <p className="mt-2 text-sm text-red-700">{rejectError}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={closeReject}>
                Cancel
              </button>
              <button type="button" className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={confirmReject}>
                Confirm no offer
              </button>
            </div>
          </AdminModal>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-brand-900">RFQ inbox</h1>
          <p className="text-sm text-mute">
            Accept the RFQ to start handling it. Buyer sees Submitted, then In review. Quotes and purchase orders stay hidden.
          </p>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>
      <AdminSearchBar
        value={query}
        onChange={setQuery}
        label="Search RFQs"
        placeholder="Search RFQ no., buyer, product, TMS…"
      />
      <FilterTabs tabs={statusTabs} counts={rfqStatusCounts(searchedRfqs)} value={activeStatusTab} onChange={setStatusTab} label="RFQ status" />
      {focusId ? (
        <p
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            focused ? "border-brand-200 bg-brand-50 text-brand-900" : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {focused
            ? `Opened from Marketplace · ${focusId}. Buyer can still open the same RFQ under My RFQs.`
            : rfqPulling
              ? `Loading ${focusId} from Marketplace…`
              : `${focusId} is not in this inbox yet. Refresh, or wait a moment for Marketplace to sync.`}
        </p>
      ) : null}

      {!rfqs.length ? (
        empty
      ) : !visibleRfqs.length ? (
        <p className="rounded-xl border border-dashed border-line bg-white px-4 py-16 text-center text-sm text-mute">
          {needle
            ? "No RFQs match this search."
            : activeStatusTab === "action"
              ? (
                <>
                  No pending RFQs.{" "}
                  <button type="button" className="font-semibold text-brand-800 hover:underline" onClick={() => setStatusTab("all")}>
                    View all RFQs
                  </button>
                </>
              )
              : "No RFQs in this status."}
        </p>
      ) : view === "list" ? (
        <div className="overflow-auto rounded-xl border border-line bg-white max-h-[calc(100vh-16rem)]">
          <table className="min-w-[64rem] w-full text-left text-[12px]">
            <thead className="pointer-events-none sticky top-0 z-10 bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
              <tr>
                {["RFQ", "Buyer", "Channel", "Products", "Status", "Activity", "Action"].map((h) => (
                  <th key={h} className={h === "Action" ? STICKY_ACTION_TH : "px-3 py-2"}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRfqs.map((r) => {
                const open = rfqIsOpen(r);
                const lines = r.lines || [];
                const isFocus = r.id === focusId || r.id === pinnedId;
                return (
                  <tr
                    id={`admin-rfq-${r.id}`}
                    key={r.id}
                    className={`border-t border-line/80 align-top ${isFocus ? "bg-brand-50" : ""}`}
                  >
                    <td className="px-3 py-2 font-semibold">
                      <button type="button" className="hover:underline" onClick={() => onOpenDetail?.(r.id)}>
                        {r.id}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <RfqBuyerMeta rfq={r} note={note} onOpenBuyer={onOpenBuyer} compact />
                    </td>
                    <td className="px-3 py-2 uppercase">{r.channel || "rfq"}</td>
                    <td className="px-3 py-2 min-w-[22rem]">
                      <ul className="space-y-2">
                        {lines.map((l) => (
                          <RfqLineRow
                            key={`${r.id}-${l.productId}`}
                            rfq={r}
                            line={l}
                            note={note}
                            showPricing={SHOW_RFQ_QUOTES && rfqCanPrice(r)}
                            compact
                          />
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2">
                      <RfqStatusChip rfq={r} />
                    </td>
                    <td className="px-3 py-2 text-mute">
                      <RfqActivityDates rfq={r} />
                    </td>
                    <td className={`${STICKY_ACTION_TD} min-w-[11rem] ${isFocus ? "!bg-brand-50" : ""}`}>
                      <RfqActions
                        rfq={r}
                        open={open}
                        accepting={acceptingId === r.id}
                        quoting={quotingId === r.id}
                        note={note}
                        onAccept={acceptRfq}
                        onReject={openReject}
                        onCreateTms={createTmsIrfq}
                        onSubmitBuyer={submitToBuyer}
                        onAcceptCancel={acceptCancel}
                        onDeclineCancel={declineCancel}
                        onAcceptReverse={acceptReverse}
                        onDeclineReverse={declineReverse}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleRfqs.map((r) => {
            const status = inboxStatus(r);
            const open = rfqIsOpen(r);
            const isFocus = r.id === focusId || r.id === pinnedId;
            return (
              <article
                id={`admin-rfq-${r.id}`}
                key={r.id}
                className={`rounded-xl border bg-white p-4 ${isFocus ? "border-brand-600 ring-2 ring-brand-200" : "border-line"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button type="button" className="font-semibold hover:underline" onClick={() => onOpenDetail?.(r.id)}>
                      {r.id}
                    </button>
                    <div className="mt-1 text-xs">
                      <RfqBuyerMeta rfq={r} note={note} onOpenBuyer={onOpenBuyer} compact />
                    </div>
                    <p className="text-[11px] text-mute">
                      {(r.askKind || "quote").toUpperCase()} · {r.channel || "rfq"}
                    </p>
                    <div className="mt-1 text-[11px] text-mute">
                      <RfqActivityDates rfq={r} />
                    </div>
                  </div>
                  <RfqStatusChip rfq={r} />
                </div>
                <ul className="mt-3 space-y-2">
                  {(r.lines || []).map((l) => (
                    <RfqLineRow
                      key={`${r.id}-${l.productId}`}
                      rfq={r}
                      line={l}
                      note={note}
                      showPricing={SHOW_RFQ_QUOTES && rfqCanPrice(r)}
                    />
                  ))}
                </ul>
                {status === "no_offer" && r.reason ? (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">No Offer Rejected: {r.reason}</p>
                ) : null}
                {r.reverseStatus === "requested" ? (
                  <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
                    Buyer asked to reverse this RFQ. Accept to let them revise, or keep the RFQ.
                  </p>
                ) : null}
                {r.cancelStatus === "requested" ? (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Buyer asked to cancel. Accept to close, or keep the RFQ.</p>
                ) : null}
                {status === "cancelled" ? (
                  <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-mute">Cancelled</p>
                ) : null}
                {SHOW_RFQ_QUOTES && status === "quoted" ? (
                  <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    {rfqBuyerKind(r) === "guest"
                      ? "Priced. Guest cannot receive this in marketplace My RFQs."
                      : "Quote submitted to buyer"}
                  </p>
                ) : null}
                {status === "accepted" ? (
                  <p
                    className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                      SHOW_RFQ_QUOTES && r.tmsDocumentNo ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
                    }`}
                  >
                    {!SHOW_RFQ_QUOTES
                      ? "Accepted. Buyer sees In review. Follow up by phone if needed."
                      : r.tmsDocumentNo
                      ? `iRFQ created · ${r.tmsDocumentNo}`
                      : r.lastTmsError
                        ? `TMS failed: ${r.lastTmsError}`
                        : rfqBuyerKind(r) === "guest"
                          ? "Accepted. Guest cannot receive a marketplace quote — assign a member or WhatsApp, or Create TMS iRFQ."
                          : "Accepted. Enter prices, then Submit To Buyer or Create TMS iRFQ."}
                  </p>
                ) : null}
                <div className="mt-3">
                  <RfqActions
                    rfq={r}
                    open={open}
                    accepting={acceptingId === r.id}
                    quoting={quotingId === r.id}
                    note={note}
                    onAccept={acceptRfq}
                    onReject={openReject}
                    onCreateTms={createTmsIrfq}
                    onSubmitBuyer={submitToBuyer}
                    onAcceptCancel={acceptCancel}
                    onDeclineCancel={declineCancel}
                    onAcceptReverse={acceptReverse}
                    onDeclineReverse={declineReverse}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
      {rejecting ? (
        <AdminModal title={`Reject (No Offer) ${rejecting.id}`} onClose={closeReject}>
          <p className="mt-2 text-sm text-mute">
            {rejecting.buyerName ? `${rejecting.buyerName} · ` : ""}
            {rejecting.buyerEmail}
          </p>
          <p className="mt-3 text-sm font-medium">Buyer RFQ status will become No Offer Rejected.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REJECT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  rejectReason === preset ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-line text-ink hover:bg-brand-50"
                }`}
                onClick={() => {
                  setRejectReason(preset);
                  setRejectError("");
                }}
              >
                {preset}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm">
            Reason<RequiredMark />
            <textarea
              className="mt-1 w-full min-h-[88px] rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="Select a reason above or write your own"
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                setRejectError("");
              }}
            />
          </label>
          {rejectError ? <p className="mt-2 text-sm text-red-700">{rejectError}</p> : null}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={closeReject}>
              Cancel
            </button>
            <button type="button" className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={confirmReject}>
              Confirm no offer
            </button>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
}

function ReportPanel({ reports, note, onOpenProduct }) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl text-brand-900">Product reports</h1>
        <p className="text-sm text-mute">Open a report to jump to that SKU. Ignore closes it. Fix + Unpublish takes it offline if data is complete. Then Publish to go live.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
      {reports.length ? reports.map((r) => (
        <article
          key={r.id}
          className="cursor-pointer rounded-xl border border-line bg-white p-4 hover:border-brand-300 hover:bg-brand-50/40"
          onClick={() => onOpenProduct?.(r)}
        >
          <div className="flex justify-between gap-2">
            <p className="font-semibold">{r.id} · {r.type}</p>
            <span className="text-[11px] font-semibold uppercase text-brand-700">
              {r.status === "dismissed" ? "ignored" : r.status === "looking" ? "open" : r.status}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-brand-800">{r.productNo}</p>
          <p className="text-xs text-mute">From {r.filerRole} {r.filerEmail}</p>
          <p className="mt-2 text-sm">{r.text}</p>
          {r.status === "open" || r.status === "looking" ? (
            <div className="mt-3 flex flex-wrap justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="rounded-lg border border-line px-2 py-1 text-xs"
                onClick={() => note(dismissProductReport(r.id), "Ignored")}
              >
                Ignore
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-300 px-2 py-1 text-xs"
                onClick={() => {
                  const result = fixProductReport(r.id, { unpublish: true });
                  note(result, "Fixed + Unpublish — hidden from marketplace");
                  if (result?.ok) onOpenProduct?.(r);
                }}
              >
                Fix + Unpublish
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white"
                onClick={() => {
                  const result = fixProductReport(r.id, { unpublish: true });
                  note(result, "Fixed — click Publish when ready");
                  if (result?.ok) onOpenProduct?.(r);
                }}
              >
                Fixed
              </button>
            </div>
          ) : null}
        </article>
      )) : <p className="text-sm text-mute md:col-span-2">No reports. Buyers file them on the original product detail page.</p>}
      </div>
    </div>
  );
}

function BuyerInfoField({ label, children, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className="mt-0.5 text-sm text-ink break-words">{children || "—"}</p>
    </div>
  );
}

function slotOn(value) {
  return value === "1" || value === "2" ? value : "";
}

function buyerPhoneSources(account, rfq) {
  const rfqHasContact = Boolean(
    String(rfq?.buyerPhone || "").trim() ||
      String(rfq?.buyerOtherPhone || "").trim() ||
      slotOn(rfq?.buyerWhatsappOn) ||
      slotOn(rfq?.buyerWechatOn)
  );
  const source = rfqHasContact ? rfq : account;
  return {
    phone: String((rfqHasContact ? source?.buyerPhone : source?.phone) || "").trim(),
    otherPhone: String((rfqHasContact ? source?.buyerOtherPhone : source?.otherPhone) || "").trim(),
    whatsappOn: slotOn(rfqHasContact ? source?.buyerWhatsappOn : source?.whatsappOn),
    wechatOn: slotOn(rfqHasContact ? source?.buyerWechatOn : source?.wechatOn),
  };
}

function followUpHint(account, rfq, guestBuyer) {
  if (guestBuyer) return "Guest RFQ has no marketplace phone. Add a number, then click it to open WhatsApp.";
  const sources = buyerPhoneSources(account, rfq);
  const apps = followUpAppRows(sources);
  const hasWhatsapp = apps.some((row) => row.key === "whatsapp");
  const hasWechat = apps.some((row) => row.key === "wechat");
  const hasPhone = followUpPlainPhones(sources).length > 0;
  if (hasPhone && (hasWhatsapp || hasWechat)) {
    return "Click WhatsApp or WeChat to open that app. A number without those options is a phone number — click to call.";
  }
  if (hasWhatsapp && hasWechat) return "Click WhatsApp to open WhatsApp, or WeChat to open WeChat.";
  if (hasWhatsapp) return "Click the number to open WhatsApp.";
  if (hasWechat) return "Click the number to open WeChat.";
  if (hasPhone) return "Click the number to call.";
  return "This marketplace account has no phone number. Add a number in this slot.";
}

function phoneForSlot(sources, slot) {
  if (slot === "1") return sources.phone;
  if (slot === "2") return sources.otherPhone;
  return "";
}

function whatsappAppHref(phone) {
  const web = buyerWhatsappHref(phone);
  if (!web) return "";
  const id = web.slice("https://wa.me/".length).split("?")[0];
  return id ? `whatsapp://send?phone=${id}` : "";
}

function followUpAppRows(sources) {
  const rows = [];
  const whatsapp = phoneForSlot(sources, sources.whatsappOn);
  const wechat = phoneForSlot(sources, sources.wechatOn);
  if (whatsapp) rows.push({ key: "whatsapp", label: "WhatsApp", phone: whatsapp, href: whatsappAppHref(whatsapp), title: "Open WhatsApp" });
  if (wechat) rows.push({ key: "wechat", label: "WeChat", phone: wechat, href: "weixin://", title: "Open WeChat" });
  return rows;
}

function phoneCallHref(phone) {
  const dial = String(phone || "").replace(/[^\d+]/g, "");
  return dial ? `tel:${dial}` : "";
}

function followUpPlainPhones(sources, extra = "") {
  const used = new Set(followUpAppRows(sources).map((row) => row.phone));
  const phones = [];
  for (const value of [sources.phone, sources.otherPhone, extra]) {
    const phone = String(value || "").trim();
    if (!phone || used.has(phone)) continue;
    used.add(phone);
    phones.push(phone);
  }
  return phones;
}

function BuyerPhoneLink({ phone, className = "text-brand-800 hover:underline" }) {
  const value = String(phone || "").trim();
  if (!value) return "—";
  const wa = buyerWhatsappHref(value);
  const href = wa || `tel:${value}`;
  return (
    <a
      className={className}
      href={href}
      target={wa ? "_blank" : undefined}
      rel={wa ? "noreferrer" : undefined}
      title={wa ? "Open WhatsApp chat" : `Call ${value}`}
    >
      {value}
    </a>
  );
}

function RfqFollowUpContact({ rfq, account, note }) {
  const member = rfqBuyerKind(rfq) === "member";
  const stored = String(rfq.buyerPhone || (member ? account?.phone : "") || "").trim();
  const [phone, setPhone] = useState(stored);
  const [editing, setEditing] = useState(!stored);
  useEffect(() => {
    setPhone(stored);
    setEditing(!stored);
  }, [rfq.id, stored]);
  useEffect(() => {
    if (!member) return;
    if (String(rfq.buyerPhone || "").trim()) return;
    const accountPhone = String(account?.phone || "").trim();
    if (!accountPhone) return;
    setRfqBuyerPhone(rfq.id, accountPhone);
  }, [account?.phone, member, rfq.buyerPhone, rfq.id]);
  const sources = buyerPhoneSources(account, rfq);
  const appRows = followUpAppRows(sources);
  const plainRows = member
    ? followUpPlainPhones(sources, stored).map((phone, index) => ({
        key: `phone-${index}`,
        label: "Phone",
        phone,
        href: phoneCallHref(phone),
        title: "Call",
      }))
    : [];
  const rows = appRows.length || plainRows.length
    ? [...appRows, ...plainRows]
    : stored
      ? [{ key: "phone", label: "WhatsApp", phone: stored, href: whatsappAppHref(stored), title: "Open WhatsApp" }]
      : [];

  function save() {
    const next = String(phone || "").trim();
    if (next === stored) {
      if (next) setEditing(false);
      return;
    }
    note?.(setRfqBuyerPhone(rfq.id, next), next ? "Contact number saved" : "Contact number cleared");
    setEditing(!next);
  }

  if (!editing && rows.length) {
    return (
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.key}>
            <p className="text-[11px] font-medium text-mute">{row.label}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              {row.href ? (
                <a
                  href={row.href}
                  className={`text-sm font-semibold hover:underline ${row.label === "Phone" ? "text-brand-800" : "text-[#1f8a45]"}`}
                  title={row.title}
                >
                  {formatBuyerPhoneDisplay(row.phone)}
                </a>
              ) : (
                <span className="text-sm text-ink">{formatBuyerPhoneDisplay(row.phone)}</span>
              )}
              {index === 0 ? (
                <button type="button" className="text-xs font-semibold text-brand-800 hover:underline" onClick={() => setEditing(true)}>
                  Edit
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[11px] font-medium text-mute">
        Contact no.
        <input
          type="tel"
          value={phone}
          placeholder="Add a number…"
          className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
          onChange={(e) => setPhone(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </label>
    </div>
  );
}

function BuyerInfoModal({ email, note, onClose, onOpenRfq, onReject, onForever }) {
  const buyer = listBuyers().find((b) => sameEmail(b.email, email));
  const rfqs = getAllRfqs().filter((r) => sameEmail(r.buyerEmail, email));
  const hintName = buyer?.name || rfqs[0]?.buyerName || "";
  const displayEmail = buyer?.email || email || "";
  const signedUp = buyer?.createdAt ? String(buyer.createdAt).slice(0, 16).replace("T", " ") : "";
  const canEnable = Boolean(buyer && buyer.approvalStatus !== "rejected" && buyer.enabled === false);
  const canDisable = Boolean(buyer && buyer.enabled !== false && buyer.approvalStatus !== "rejected");
  const canReject = Boolean(buyer && buyer.approvalStatus !== "rejected");
  const canForever = Boolean(buyer && canDeleteBuyerForever(buyer));

  return (
    <AdminModal
      title={buyer?.companyName || hintName || email || "Buyer"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={onClose}>
            Close
          </button>
          {canReject ? (
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800"
              onClick={() => onReject?.(buyer.email)}
            >
              Reject
            </button>
          ) : null}
          {canDisable ? (
            <button
              type="button"
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
              onClick={() => note(setBuyerEnabled(buyer.email, false), "Buyer disabled")}
            >
              Disable
            </button>
          ) : null}
          {canEnable ? (
            <button
              type="button"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => note(setBuyerEnabled(buyer.email, true), "Buyer enabled")}
            >
              Enable
            </button>
          ) : null}
          {canForever ? (
            <button
              type="button"
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => onForever?.(buyer)}
            >
              Delete forever
            </button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-brand-900">{hintName || displayEmail || "—"}</p>
          {buyer?.jobTitle ? <p className="mt-0.5 text-sm text-mute">{buyer.jobTitle}</p> : null}
          {signedUp ? <p className="mt-1 text-xs text-mute">Signed up {signedUp}</p> : null}
          {buyer && buyer.approvalStatus !== "rejected" && buyer.enabled !== false ? (
            <p className="mt-2 text-xs text-mute">Can log in now. Disable to pause, or Reject to refuse the account.</p>
          ) : null}
          {canForever ? (
            <p className="mt-2 text-xs text-mute">Delete forever removes the login. RFQs stay with this name and email frozen.</p>
          ) : null}
        </div>
        <AccountStatusChip account={buyer} />
      </div>

      {buyer?.approvalStatus === "rejected" && buyer.rejectReason ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Rejection emailed: {buyer.rejectReason}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        <section className="rounded-xl border border-line bg-paper/60 p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-mute">Contact</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <BuyerInfoField label="Email">
              {displayEmail ? (
                <a className="text-brand-800 hover:underline" href={`mailto:${displayEmail}`}>
                  {displayEmail}
                </a>
              ) : null}
            </BuyerInfoField>
            <BuyerInfoField label={phoneSlotLabel("Mobile", "1", buyer?.whatsappOn, buyer?.wechatOn)}>
              <BuyerPhoneLink phone={buyer?.phone} />
            </BuyerInfoField>
            <BuyerInfoField label={phoneSlotLabel("Other phone", "2", buyer?.whatsappOn, buyer?.wechatOn)}>
              {buyer?.otherPhone ? <BuyerPhoneLink phone={buyer.otherPhone} /> : null}
            </BuyerInfoField>
            <BuyerInfoField label="Roles">
              {Array.isArray(buyer?.roles) && buyer.roles.length
                ? buyer.roles.map((role) => (role === "contractor" ? "Contractor" : "Buyer")).join(" · ")
                : ""}
            </BuyerInfoField>
          </div>
        </section>
        <section className="rounded-xl border border-line bg-paper/60 p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-mute">Company</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <BuyerInfoField label="Company">{buyer?.companyName}</BuyerInfoField>
            <BuyerInfoField label="Company phone">{buyer?.companyPhone}</BuyerInfoField>
            <BuyerInfoField label="Company reg.">{buyer?.companyReg}</BuyerInfoField>
            <BuyerInfoField label="Project">{buyer?.project}</BuyerInfoField>
            <BuyerInfoField label="Address" wide>
              {buyer?.companyAddress}
            </BuyerInfoField>
          </div>
        </section>
        {rfqs.length ? (
          <section className="rounded-xl border border-line bg-white p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-mute">RFQs · {rfqs.length}</h3>
            <ul className="mt-3 max-h-40 space-y-1.5 overflow-auto">
              {rfqs.slice(0, 12).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <button type="button" className="font-semibold text-brand-800 hover:underline" onClick={() => onOpenRfq?.(r.id)}>
                    {r.id}
                  </button>
                  <RfqStatusChip rfq={r} />
                  <span className="text-xs text-mute">{rfqStamp(r)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AdminModal>
  );
}

function AccountPanel({ note, kind = "sales", focusEmail = "", onOpenRfq }) {
  const staff = getStaffList();
  const buyers = listBuyers();
  const [statusTab, setStatusTab] = useState(() => {
    if (kind !== "buyer" || !focusEmail) return "all";
    const buyer = listBuyers().find((u) => sameEmail(u.email, focusEmail));
    return buyer ? accountStatusKey(buyer) : "all";
  });
  const [modal, setModal] = useState(() => (kind === "buyer" && focusEmail ? { type: "buyer", email: focusEmail } : null));
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formError, setFormError] = useState("");
  const [acting, setActing] = useState(false);
  const actionLock = useRef(false);
  const [rejectReason, setRejectReason] = useState("");
  const [query, setQuery] = useState("");
  const isSales = kind === "sales";
  const rows = sortNewestAccounts(isSales ? staff : buyers);
  const needle = searchNeedle(query);
  const searched = needle ? rows.filter((u) => matchesSearch(needle, ...accountSearchHay(u))) : rows;
  const visible = statusTab === "all" ? searched : searched.filter((u) => accountStatusKey(u) === statusTab);
  const editing = modal?.type === "edit" ? modal.account : null;

  useEffect(() => {
    if (kind === "buyer" && focusEmail) {
      const buyer = listBuyers().find((u) => sameEmail(u.email, focusEmail));
      setStatusTab(buyer ? accountStatusKey(buyer) : "all");
      setModal({ type: "buyer", email: focusEmail });
    } else {
      setStatusTab("all");
      setModal(null);
    }
    setFormError("");
    setQuery("");
  }, [kind, focusEmail]);

  useEffect(() => {
    if (!focusEmail || kind !== "buyer") return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(buyerDomId(focusEmail))?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [kind, focusEmail, statusTab]);

  function staffNote(result, fallback) {
    if (!result?.ok && result?.error === "last") {
      note({ ok: false, error: "Keep at least one active sales account." });
      return;
    }
    if (!result?.ok && result?.error === "active") {
      note({ ok: false, error: "Disable this account first." });
      return;
    }
    if (!result?.ok && result?.error === "self") {
      note({ ok: false, error: "Another sales account must Delete forever." });
      return;
    }
    if (!result?.ok && result?.error === "taken") {
      note({ ok: false, error: "That email is already in use." });
      return;
    }
    if (!result?.ok && result?.error === "email") {
      note({ ok: false, error: "Enter a valid email." });
      return;
    }
    if (!result?.ok && result?.error === "name") {
      note({ ok: false, error: "Enter a name." });
      return;
    }
    note(result, fallback);
  }

  function openInvite() {
    setFormEmail("");
    setFormName("");
    setFormError("");
    setModal({ type: "invite" });
  }

  function openEdit(account) {
    setFormEmail(account.email);
    setFormName(account.name || "");
    setFormError("");
    setModal({ type: "edit", account });
  }

  function closeModal() {
    setModal(null);
    setFormError("");
    setRejectReason("");
  }

  async function runAction(work) {
    if (actionLock.current) return;
    actionLock.current = true;
    setActing(true);
    try {
      await work();
    } finally {
      actionLock.current = false;
      setActing(false);
    }
  }

  async function saveStaff() {
    if (modal?.type === "invite") {
      const result = await createStaff({ email: formEmail, name: formName });
      if (!result?.ok) {
        setFormError(
          result?.error === "taken"
            ? "That email is already in use."
            : result?.error === "email"
              ? "Enter a valid email."
              : result?.error === "name"
                ? "Enter a name."
                : "Unable to invite staff."
        );
        staffNote(result);
        return;
      }
      staffNote(result, await inviteSentLabel(result, normalizeStaffLabel(formName, formEmail)));
      closeModal();
      return;
    }
    if (!editing) return;
    const result = updateStaff(editing.email, { name: formName });
    if (!result?.ok) {
      setFormError(result?.error === "name" ? "Enter a name." : "Unable to save.");
      staffNote(result);
      return;
    }
    staffNote(result, "Saved");
    closeModal();
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-brand-900">{isSales ? "Sales" : "Buyer"}</h1>
          <p className="text-sm text-mute">
            {isSales
              ? "Invite portal logins by email. They set a password from the invite link. Disable hides sign-in. Delete forever is only on disabled accounts, with a confirm, and cannot remove the last active sales login."
              : "New sign-ups can log in immediately. Disable to pause login, or Reject to refuse the account. Delete forever is only after Disable or Reject, and keeps historical RFQs."}
          </p>
        </div>
        {isSales ? (
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={openInvite}
          >
            Invite staff
          </button>
        ) : null}
      </div>
      <AdminSearchBar
        value={query}
        onChange={setQuery}
        label={isSales ? "Search sales" : "Search buyers"}
        placeholder={isSales ? "Search name or email…" : "Search company, name or email…"}
      />
      <FilterTabs
        tabs={isSales ? ACCOUNT_STATUS_TABS : BUYER_STATUS_TABS}
        counts={accountCounts(searched)}
        value={statusTab}
        onChange={setStatusTab}
        label={isSales ? "Sales status" : "Buyer status"}
      />
      <div className="overflow-auto rounded-xl border border-line bg-white max-h-[calc(100vh-16rem)]">
        <table className="min-w-[48rem] w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
            <tr>
              {(isSales ? ["Name", "Email", "Type", "Status", "Action"] : ["Company", "Name", "Email", "Signed up", "Status", "Action"]).map((h) => (
                <th key={h} className={h === "Action" ? STICKY_ACTION_TH : "px-3 py-2"}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((u) => (
                <tr
                  id={!isSales ? buyerDomId(u.email) : undefined}
                  key={u.email}
                  className={`group cursor-pointer border-t border-line/80 hover:bg-brand-50/60 ${
                    !isSales && sameEmail(u.email, focusEmail) ? "bg-brand-50 ring-2 ring-inset ring-brand-200" : ""
                  }`}
                  onClick={isSales ? () => openEdit(u) : () => setModal({ type: "buyer", email: u.email })}
                >
                  {isSales ? (
                    <>
                      <td className="px-3 py-2 font-medium">{u.name}</td>
                      <td className="px-3 py-2 text-mute">{u.email}</td>
                      <td className="px-3 py-2">{u.bootstrap ? "Bootstrap" : u.invitePending ? "Invited" : "Staff"}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium">{u.companyName || "—"}</td>
                      <td className="px-3 py-2">{u.name || "—"}</td>
                      <td className="px-3 py-2 text-mute">{u.email}</td>
                      <td className="px-3 py-2 text-mute whitespace-nowrap">{formatSignedUp(u.createdAt)}</td>
                    </>
                  )}
                  <td className="px-3 py-2">
                    <AccountStatusChip account={u} />
                  </td>
                  <td
                    className={`${STICKY_ACTION_TD} min-w-[8.5rem] whitespace-nowrap group-hover:bg-brand-50/60 ${
                      !isSales && sameEmail(u.email, focusEmail) ? "!bg-brand-50" : ""
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {isSales ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-800 hover:underline"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {isSales && u.invitePending ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-40"
                          disabled={acting}
                          onClick={() => runAction(async () => {
                            const result = await resendStaffInvite(u.email);
                            staffNote(result, await inviteSentLabel(result, u.name || u.email));
                          })}
                        >
                          Resend invite
                        </button>
                      ) : null}
                      {!isSales && u.approvalStatus !== "rejected" ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-800 hover:underline"
                          onClick={() => {
                            setRejectReason("");
                            setFormError("");
                            setModal({ type: "reject", email: u.email });
                          }}
                        >
                          Reject
                        </button>
                      ) : null}
                      {!isSales && (u.approvalStatus === "pending" || u.approvalStatus === "rejected") ? null : u.enabled !== false ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700 hover:underline"
                          onClick={() =>
                            isSales
                              ? staffNote(disableStaff(u.email), "Disabled")
                              : note(setBuyerEnabled(u.email, false), "Buyer disabled")
                          }
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-700 hover:underline"
                          onClick={() =>
                            isSales
                              ? staffNote(enableStaff(u.email), "Enabled")
                              : note(setBuyerEnabled(u.email, true), "Buyer enabled")
                          }
                        >
                          Enable
                        </button>
                      )}
                      {(isSales ? canDeleteStaffForever(u) : canDeleteBuyerForever(u)) ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-800 hover:underline"
                          onClick={() => setModal({ type: "forever", account: u })}
                        >
                          Delete forever
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isSales ? 5 : 6} className="px-3 py-16 text-center text-sm text-mute">
                  {needle
                    ? "No accounts match this search."
                    : rows.length
                      ? "No accounts in this status."
                      : isSales
                        ? "No sales accounts yet."
                        : "No registered buyers yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isSales && modal?.type === "buyer" ? (
        <BuyerInfoModal
          email={modal.email}
          note={note}
          onClose={closeModal}
          onOpenRfq={onOpenRfq}
          onForever={(account) => setModal({ type: "forever", account })}
          onReject={(email) => {
            setRejectReason("");
            setFormError("");
            setModal({ type: "reject", email });
          }}
        />
      ) : null}
      {!isSales && modal?.type === "reject" ? (
        <AdminModal
          title="Reject buyer"
          onClose={closeModal}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={closeModal}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  const result = rejectBuyer(modal.email, { reason: rejectReason });
                  if (!result?.ok) {
                    setFormError(result?.error === "reason" ? "Enter a rejection reason." : "Unable to reject.");
                    note(result);
                    return;
                  }
                  note(result, "Rejection email sent");
                  closeModal();
                }}
              >
                Reject
              </button>
            </div>
          }
        >
          <p className="text-sm text-mute">They cannot log in. This cannot be reversed with Enable. A rejection email will open.</p>
          <label className="mt-3 block text-sm font-medium">
            Reason<RequiredMark />
            <textarea
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              rows={4}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                setFormError("");
              }}
              placeholder="Why this account is refused"
            />
          </label>
          {formError ? <p className="mt-2 text-sm text-red-700">{formError}</p> : null}
        </AdminModal>
      ) : null}
      {modal?.type === "forever" ? (
        <AdminModal
          title="Delete forever"
          onClose={closeModal}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={closeModal}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  const account = modal.account;
                  const result = isSales ? hardDeleteStaff(account.email) : hardDeleteBuyer(account.email);
                  if (isSales) staffNote(result, "Deleted forever");
                  else {
                    if (!result?.ok && result?.error === "active") {
                      note({ ok: false, error: "Disable or Reject this buyer first." });
                      return;
                    }
                    note(result, "Deleted forever");
                  }
                  if (result?.ok) closeModal();
                }}
              >
                Delete forever
              </button>
            </div>
          }
        >
          <p className="text-sm text-ink">
            Delete <span className="font-semibold">{modal.account?.name || modal.account?.companyName || modal.account?.email}</span> ({modal.account?.email}) forever?
          </p>
          <p className="mt-2 text-sm text-mute">
            {isSales
              ? "They cannot log in. RFQs they were reviewing already returned to the shared queue when disabled. Activity still shows who handled each RFQ."
              : "They cannot log in. RFQs and POs stay with this name and email frozen. The same email can register again as a new account and will not inherit old RFQs."}
          </p>
          <p className="mt-2 text-sm font-medium text-red-800">This cannot be undone.</p>
        </AdminModal>
      ) : null}
      {isSales && (modal?.type === "invite" || modal?.type === "edit") ? (
        <AdminModal
          title={editing ? `Edit ${editing.name || editing.email}` : "Invite staff"}
          onClose={closeModal}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={acting} onClick={() => runAction(saveStaff)}>
                {editing ? "Save" : "Send invite"}
              </button>
            </div>
          }
        >
          <p className="text-sm text-mute">
            {editing
              ? editing.invitePending
                ? "Update the display name. They still set a password from the invite email."
                : "Update the display name. Email cannot be changed."
              : "We'll open an email so they can set their own password. No temporary password is created."}
          </p>
          <label className="mt-4 block text-sm font-medium text-ink">
            Name<RequiredMark />
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                setFormError("");
              }}
              placeholder="Alex Chan"
            />
          </label>
          <label className="mt-3 block text-sm font-medium text-ink">
            Email<RequiredMark />
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm disabled:bg-paper disabled:text-mute"
              value={formEmail}
              disabled={Boolean(editing)}
              onChange={(e) => {
                setFormEmail(e.target.value);
                setFormError("");
              }}
              placeholder="ops2@mattex.com"
            />
          </label>
          {formError ? <p className="mt-3 text-sm font-medium text-red-700">{formError}</p> : null}
        </AdminModal>
      ) : null}
    </div>
  );
}

function normalizeStaffLabel(name, email) {
  return String(name || email || "").trim();
}
