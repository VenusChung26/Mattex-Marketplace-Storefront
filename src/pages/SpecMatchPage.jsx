import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Seo from "../components/Seo";
import CustomProductForm from "../components/CustomProductForm";
import { QtyStepper } from "../components/ProductCard";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { uploadSpecFile } from "../lib/rfqBlob";
import { commitSpecMatch, formatPrice, formatQuoteDate, isLoggedIn, matchSpecToCatalog, requireBuyerAuth, WHATSAPP_HREF } from "../lib/store";
import { findProductOffer } from "../lib/offer";
import { usePromo } from "../lib/promo";
import { buildPreview, downloadFile } from "../lib/filePreview";
import {
  clearSpecConfirm,
  clearSpecMatch,
  loadSpecMatch,
  saveSpecMatch,
  saveSpecQuoteDraft,
  setSpecConfirm,
  takePendingSpecFile,
} from "../lib/specMatchSession";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg,image/webp,image/gif";
const SAMPLE_FILE_NAME = "sample-specification";
const SAMPLE_LINES = [
  { buyerName: "Gypsum block", buyerSpec: "500 x 250 x 150 mm", qty: 20 },
  { buyerName: "Reinforcement mesh", buyerSpec: "", qty: 10 },
  { buyerName: "Bamboo scaffolding coupon", buyerSpec: "", qty: 1 },
];

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file"));
    reader.readAsDataURL(file);
  });
}

function shownMatch(row) {
  const matches = Array.isArray(row?.matches) ? row.matches : [];
  if (!matches.length) return null;
  return matches.find((match) => match.productId === row.shownId) || matches[0];
}

function otherMatches(row) {
  const current = shownMatch(row);
  const topHits = Number(current?.hits) || 0;
  const minHits = Math.max(2, Math.ceil(topHits / 2));
  return (row.matches || [])
    .filter((item) => item.productId !== current?.productId && Number(item.hits) >= minHits)
    .slice(0, 3);
}

function normalizeChoice(choice, match) {
  const value = choice === "mm" ? "catalog" : choice || "";
  if (value === "catalog" && !match) return "";
  if (value === "tailor" && !match?.tailorMade) return "";
  if (value === "no") return "file";
  if (value === "catalog" || value === "tailor" || value === "file") return value;
  return "";
}

function toRows(raw) {
  return (Array.isArray(raw) ? raw : []).map((row, index) => {
    const matches = Array.isArray(row.matches) ? row.matches : [];
    return {
      key: `line-${index}-${row.buyerName || "item"}`,
      buyerName: row.buyerName || "",
      buyerSpec: row.buyerSpec || "",
      qty: Math.max(1, Math.floor(Number(row.qty)) || 1),
      matches,
      shownId: matches[0]?.productId || "",
      choice: "",
      switched: false,
      boundId: "",
      editName: "",
      editSpec: "",
      editImages: [],
      attachments: [],
    };
  });
}

function withLiveCatalog(rows) {
  return rows.map((row) => {
    const matches = matchSpecToCatalog(row.buyerName, row.buyerSpec);
    const shownId = matches.some((match) => match.productId === row.shownId) ? row.shownId : matches[0]?.productId || "";
    const match = matches.find((item) => item.productId === shownId) || null;
    const choice = normalizeChoice(row.choice, match);
    const next = { ...row, matches, shownId, choice };
    if (row.choice === "no" && choice === "file" && !String(row.editName || "").trim()) {
      return {
        ...next,
        editName: row.buyerName || "",
        editSpec: row.buyerSpec || "",
        editImages: [],
      };
    }
    return next;
  });
}

function quoteLineId() {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function quoteLinesFromRows(rows) {
  return rows
    .map((row) => {
      const qty = Math.max(1, Math.floor(Number(row.qty)) || 1);
      if (row.choice === "catalog" || row.choice === "mm") {
        const productId = row.shownId || row.productId;
        return productId ? { key: row.key, line: { productId, qty, intent: "quote" } } : null;
      }
      const name = String(row.editName || row.buyerName || "").trim();
      if (!name) return null;
      const photos = (Array.isArray(row.editImages) ? row.editImages : []).map((src) => String(src || "").trim()).filter(Boolean);
      const match = (row.matches || []).find((item) => item.productId === (row.shownId || row.productId));
      return {
        key: row.key,
        line: {
        productId: String(row.boundId || "").startsWith("custom_") ? row.boundId : quoteLineId(),
        qty,
        custom: true,
        intent: "quote",
        name,
        description: String(row.editSpec ?? row.buyerSpec ?? "").trim(),
        category: "",
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        image: photos[0] || "",
        images: photos.slice(1),
        tailorMade: row.choice === "tailor",
        baseProductId: row.choice === "tailor" ? String(row.shownId || row.productId || "") : "",
        baseProductNo: row.choice === "tailor" ? String(match?.productNo || "") : "",
        },
      };
    })
    .filter(Boolean);
}

function customInitial(row) {
  const photos = (Array.isArray(row.editImages) ? row.editImages : []).map((src) => String(src || "").trim()).filter(Boolean);
  return {
    name: row.editName || row.buyerName || "",
    description: row.editSpec ?? row.buyerSpec ?? "",
    qty: Math.max(1, Number(row.qty) || 1),
    image: photos[0] || "",
    images: photos.slice(1),
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
  };
}
function moqText(t, match) {
  if (!match) return "";
  const amount = `${match.moq}${match.unit ? ` ${match.unit}` : ""}`;
  return t("specMatchMoq", { n: amount });
}

function OfferPrice({ productId, promo, t, lang }) {
  const offer = findProductOffer(productId, promo);
  if (!offer) return null;
  return (
    <p className="mt-1 text-xs font-semibold text-amber-800">
      {formatPrice(offer.price)} · {t("offerEnds", { date: formatQuoteDate(offer.endsOn, lang) })}
    </p>
  );
}

function imageFileName(name, url) {
  const stem = String(name || "product")
    .replace(/[^\w\u4e00-\u9fff.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  const ext = String(url || "").match(/\.(png|jpe?g|webp|gif)(?:$|\?)/i)?.[1] || "jpg";
  return `${stem || "product"}.${ext.replace("jpeg", "jpg")}`;
}

export default function SpecMatchPage() {
  const { t, lang } = useLanguage();
  const { promo } = usePromo();
  const { catalogLoading, catalogEpoch } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const specFileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [fileName, setFileName] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unreadable, setUnreadable] = useState(false);
  const [oneFile, setOneFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [openSuggestions, setOpenSuggestions] = useState({});
  const [openNames, setOpenNames] = useState({});
  const [openDetails, setOpenDetails] = useState({});
  const [scrolled, setScrolled] = useState(false);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    const nav = document.getElementById("siteNav");
    if (!nav) return undefined;
    const apply = () => {
      document.documentElement.style.setProperty("--spec-thead-top", `${Math.ceil(nav.getBoundingClientRect().height)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--spec-thead-top");
    };
  }, []);

  useEffect(() => {
    let stop = false;
    fetch("/api/spec-match", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!stop) setStatus(data);
      })
      .catch(() => {
        if (!stop) setStatus({ open: false });
      });
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    const pending = takePendingSpecFile();
    if (pending) {
      runMatch(pending);
      return;
    }
    const saved = loadSpecMatch();
    if (saved?.rows?.length) {
      setFileName(saved.fileName || "");
      setSpecUrl(saved.specUrl || "");
      setRows(saved.rows);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !rows.length) return;
    try {
      saveSpecMatch({ fileName, specUrl, rows });
    } catch {
      /* keep the in-memory match if storage is full */
    }
  }, [ready, rows, fileName, specUrl]);

  useEffect(() => {
    if (catalogLoading) return;
    setRows((prev) => {
      if (!prev.length) return prev;
      const next = withLiveCatalog(prev);
      const same = next.every((row, index) => {
        const before = (prev[index]?.matches || []).map((match) => `${match.productId}:${match.moq}:${match.hits}:${match.confident ? 1 : 0}`).join(",");
        const after = (row.matches || []).map((match) => `${match.productId}:${match.moq}:${match.hits}:${match.confident ? 1 : 0}`).join(",");
        return before === after && row.shownId === prev[index]?.shownId && row.choice === prev[index]?.choice;
      });
      return same ? prev : next;
    });
  }, [catalogLoading, catalogEpoch]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 240);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!preview) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const closed = status != null && status.open === false;
  const limited = status?.member !== true && Number(status?.remaining) === 0;
  const decidedRows = rows.filter((row) => ["catalog", "mm", "tailor", "file"].includes(row.choice));
  const decided = decidedRows.length > 0;

  async function runMatch(file, extraCount = 0) {
    if (!file || closed || limited) return;
    specFileRef.current = file;
    setBusy(true);
    setError("");
    setUnreadable(false);
    setOneFile(extraCount > 0);
    setRows([]);
    try {
      const dataUrl = await readFile(file);
      const base64 = dataUrl.split(",")[1] || "";
      const res = await fetch("/api/spec-match", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, mime: file.type, dataUrl, base64 }),
      });
      const data = await res.json();
      if (data?.remaining != null) setStatus((prev) => ({ ...prev, remaining: data.remaining }));
      if (!data?.ok) {
        setError(data?.error === "limit" ? t("specMatchLimit") : data?.error === "closed" ? t("specMatchClosed") : t("specMatchUnreadable"));
        return;
      }
      if (data.unreadable || !Array.isArray(data.rows) || !data.rows.length) {
        clearSpecMatch();
        setFileName(file.name);
        setUnreadable(true);
        return;
      }
      let url = "";
      try {
        url = await uploadSpecFile(file);
      } catch {
        url = dataUrl;
      }
      const next = withLiveCatalog(toRows(data.rows));
      setFileName(file.name);
      setSpecUrl(url || dataUrl);
      setRows(next);
      setReady(true);
    } catch {
      setError(t("specMatchUnreadable"));
    } finally {
      setBusy(false);
    }
  }

  function takeFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    runMatch(files[0], Math.max(0, files.length - 1));
  }

  function trySample() {
    if (closed || limited || busy) return;
    specFileRef.current = null;
    setError("");
    setUnreadable(false);
    setOneFile(false);
    setFileName(SAMPLE_FILE_NAME);
    setSpecUrl("");
    setRows(withLiveCatalog(toRows(SAMPLE_LINES)));
    setReady(true);
  }

  function clearExtracted() {
    specFileRef.current = null;
    setFileName("");
    setSpecUrl("");
    setRows([]);
    setUnreadable(false);
    setOneFile(false);
    setError("");
    setOpenSuggestions({});
    setOpenNames({});
    setOpenDetails({});
    clearSpecMatch();
  }

  function patchRow(index, patch) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setChoice(index, choice) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const match = shownMatch(row);
        if (choice === "catalog") {
          if (!match) return row;
          return { ...row, choice, qty: Math.max(row.qty, match.moq || 1) };
        }
        if (choice === "tailor") {
          if (!match?.tailorMade) return row;
          if (row.choice === "tailor") return row;
          return {
            ...row,
            choice,
            editName: row.buyerName || "",
            editSpec: match.spec || "",
            editImages: match.image ? [match.image] : [],
          };
        }
        if (choice === "file") {
          if (row.choice === "file") return row;
          return {
            ...row,
            choice,
            editName: row.buyerName || "",
            editSpec: row.buyerSpec || "",
            editImages: [],
          };
        }
        return { ...row, choice: "" };
      })
    );
  }

  function openCustom(index, choice) {
    const key = rows[index]?.key;
    setChoice(index, choice);
    if (!key) return;
    setOpenDetails((prev) => ({ ...prev, [key]: true }));
    setOpenSuggestions((prev) => ({ ...prev, [key]: false }));
  }

  function saveCustom(index, payload) {
    const images = Array.isArray(payload?.images) ? payload.images.filter(Boolean) : [];
    patchRow(index, {
      editName: payload.name,
      editSpec: payload.description,
      qty: Math.max(1, Math.floor(Number(payload.qty)) || 1),
      editImages: images,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    });
    const key = rows[index]?.key;
    if (key) setOpenDetails((prev) => ({ ...prev, [key]: false }));
  }

  function chooseSuggestion(index, productId) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const match = (row.matches || []).find((item) => item.productId === productId);
        if (!match) return row;
        return {
          ...row,
          shownId: productId,
          switched: true,
          choice: "catalog",
          qty: Math.max(row.qty, match.moq || 1),
        };
      })
    );
  }

  function changeQty(index, value) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const n = Math.floor(Number(value));
        return { ...row, qty: Number.isFinite(n) && n > 0 ? n : 0 };
      })
    );
  }

  function catalogBelowMoq(row) {
    if (row.choice !== "catalog" && row.choice !== "mm") return null;
    const match = shownMatch(row);
    const minQty = Math.max(1, Number(match?.moq) || 1);
    if (Number(row.qty) >= minQty) return null;
    return { minQty, unit: match?.unit || "" };
  }

  async function openPreview(source) {
    const next = await buildPreview(source);
    setPreview(next);
  }

  async function commit(mode) {
    const picked = rows.filter((row) => ["catalog", "mm", "tailor", "file"].includes(row.choice));
    if (!picked.length) {
      setError(t("specMatchEmpty"));
      return;
    }
    const short = picked.map(catalogBelowMoq).find(Boolean);
    if (short) {
      setError(t("qtyUnderMin", { n: `${short.minQty}${short.unit ? ` ${short.unit}` : ""}` }));
      return;
    }
    if (mode === "quote") {
      if (picked.some((row) => (row.choice === "tailor" || row.choice === "file") && !isLoggedIn())) {
        requireBuyerAuth({ custom: true });
        return;
      }
      if (picked.some((row) => (row.choice === "tailor" || row.choice === "file") && !String(row.editName || row.buyerName || "").trim())) {
        setError(t("customNameRequired"));
        return;
      }
      const built = quoteLinesFromRows(picked);
      const lines = built.map((item) => item.line);
      if (!lines.length) {
        setError(t("specMatchEmpty"));
        return;
      }
      const bound = new Map(built.map((item) => [item.key, item.line.productId]));
      const next = rows.map((row) => (bound.has(row.key) ? { ...row, boundId: bound.get(row.key) || "" } : row));
      setRows(next);
      saveSpecMatch({ fileName, specUrl, rows: next });
      saveSpecQuoteDraft({
        lines,
        specFile: specUrl ? { name: fileName, url: specUrl } : null,
        note: "",
        responseDate: "",
        deliveryDate: "",
        deliveryMode: "one_time",
        deliveryLots: [],
        project: "",
        address: "",
        canonicalCategory: "",
        acceptSubstitutes: false,
      });
      setSpecConfirm(lines.map((line) => line.productId));
      navigate(withLocale(lang, "/rfq"));
      return;
    }
    setBusy(true);
    setError("");
    const result = commitSpecMatch({
      rows,
      mode,
      specFile: specUrl ? { name: fileName, url: specUrl } : null,
    });
    setBusy(false);
    if (!result?.ok) {
      if (result?.error === "not_logged_in") return;
      setError(result?.error === "name" ? t("customNameRequired") : t("specMatchEmpty"));
      return;
    }
    const bound = new Map((result.bindings || []).map((item) => [item.key, item.boundId]));
    const next = rows.map((row) => (bound.has(row.key) ? { ...row, boundId: bound.get(row.key) || "" } : row));
    setRows(next);
    saveSpecMatch({ fileName, specUrl, rows: next });
    const ids = next.map((row) => row.boundId).filter(Boolean);
    if (mode === "quote") {
      setSpecConfirm(ids);
      navigate(withLocale(lang, "/rfq"));
      return;
    }
    clearSpecConfirm();
    navigate(withLocale(lang, "/rfq"));
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Seo lang={lang} path={withLocale(lang, "/spec-match")} title={`${t("specMatchTitle")} | Mattex Marketplace`} description={t("specMatchHint")} noindex />
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-10 pb-28">
        <h1 id="spec-match-top" className="font-display text-3xl font-semibold text-brand-800">{t("specMatchTitle")}</h1>
        {status?.member !== true && status?.remaining != null ? (
          <p className="mt-2 text-sm text-ink">{t("specMatchRemaining", { n: status.remaining })}</p>
        ) : null}
        {closed ? <p className="mt-6 text-lg font-semibold text-ink">{t("specMatchClosed")}</p> : null}
        {limited && !closed ? <p className="mt-6 text-sm font-semibold text-ink">{t("specMatchLimit")}</p> : null}
        <div
          className={`mt-6 rounded-lg border border-dashed p-4 ${dragOver ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!closed && !limited) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            if (!closed && !limited) takeFiles(event.dataTransfer.files);
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-soft !px-4 !py-2"
              disabled={closed || limited || busy}
              onClick={() => fileRef.current?.click()}
            >
              {fileName ? t("specMatchChangeFile") : t("specMatchFile")}
            </button>
            {rows.length ? null : (
              <button type="button" className="btn-primary !px-4 !py-2" disabled={closed || limited || busy || catalogLoading} onClick={trySample}>
                {t("specMatchSample")}
              </button>
            )}
            {fileName ? (
              specUrl || specFileRef.current ? (
                <button type="button" className="text-sm font-semibold text-brand-700 underline" onClick={() => openPreview({ name: fileName === SAMPLE_FILE_NAME ? t("specMatchSampleName") : fileName, url: specUrl, file: specFileRef.current })}>
                  {fileName === SAMPLE_FILE_NAME ? t("specMatchSampleName") : fileName}
                </button>
              ) : (
                <span className="text-sm font-semibold text-ink">{fileName === SAMPLE_FILE_NAME ? t("specMatchSampleName") : fileName}</span>
              )
            ) : null}
            {fileName || rows.length ? (
              <button type="button" className="text-sm font-semibold text-mute" onClick={clearExtracted}>
                {t("specMatchClear")}
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-mute">{t("specMatchDrop")}</p>
          {oneFile ? <p className="mt-2 text-sm font-semibold text-ink">{t("specMatchOneFile")}</p> : null}
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept={ACCEPT}
            disabled={closed || limited || busy}
            onChange={(event) => {
              takeFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
        {busy ? <p className="mt-4 text-sm text-ink">{t("specMatchWorking")}</p> : null}
        {error ? <p className="mt-4 text-sm text-[#8a2b2b]">{error}</p> : null}
        {unreadable ? <p className="mt-4 text-sm font-semibold text-ink">{t("specMatchUnreadable")}</p> : null}
        {rows.length ? (
          <>
            <div className="mt-8 border border-line bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-[var(--spec-thead-top,108px)] z-30 bg-paper text-xs font-semibold uppercase tracking-wide text-brand-700 shadow-[0_1px_0_0_rgba(22,40,32,0.12)]">
                  <tr>
                    <th className="bg-paper px-3 py-2">{t("specMatchYourItem")}</th>
                    <th className="bg-paper px-3 py-2">{t("specMatchMarketplace")}</th>
                    <th className="w-80 bg-paper px-3 py-2 normal-case tracking-normal">{t("specMatchUseProduct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const match = shownMatch(row);
                    const others = otherMatches(row);
                    const choice = row.choice === "mm" ? "catalog" : row.choice || "";
                    const editing = choice === "tailor" || choice === "file";
                    const detailsOpen = Boolean(openDetails[row.key]);
                    const selected = choice === "catalog" || choice === "tailor" || choice === "file";
                    const rowTone = selected ? "bg-brand-50" : "bg-white";
                    return (
                      <Fragment key={row.key}>
                      {index > 0 ? (
                        <tr aria-hidden="true">
                          <td colSpan={3} className="h-3 border-0 bg-paper p-0" />
                        </tr>
                      ) : null}
                      <tr className={`border-t border-line align-top ${rowTone}`}>
                        <td className="px-3 py-3">
                          <p className="font-medium text-ink">{row.buyerName}</p>
                          {row.buyerSpec ? <p className="mt-1 text-mute">{row.buyerSpec}</p> : null}
                        </td>
                        <td className="px-3 py-3">
                          {match ? (
                            <div>
                              <div className="flex gap-3">
                                {match.image ? (
                                  <button type="button" onClick={() => openPreview({ name: imageFileName(match.name, match.image), url: match.image, type: "image/jpeg" })}>
                                    <img src={match.image} alt="" className="h-14 w-14 border border-line object-cover bg-paper" />
                                  </button>
                                ) : null}
                                <div className="min-w-0">
                                  <ProductTitle
                                    open={Boolean(openNames[`${row.key}:${match.productId}`])}
                                    onToggle={() => setOpenNames((prev) => ({ ...prev, [`${row.key}:${match.productId}`]: !prev[`${row.key}:${match.productId}`] }))}
                                    name={match.name}
                                  />
                                  <p className={`text-xs font-semibold ${match.confident ? "text-brand-700" : "text-mute"}`}>
                                    {match.confident ? t("specMatchCloseMatch") : t("specMatchCheck")}
                                  </p>
                                  {match.spec ? <p className="text-mute">{match.spec}</p> : null}
                                  <p className="mt-1 text-xs text-mute">{moqText(t, match)}</p>
                                  <OfferPrice productId={match.productId} promo={promo} t={t} lang={lang} />
                                </div>
                              </div>
                              {others.length ? (
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-brand-700"
                                    aria-expanded={Boolean(openSuggestions[row.key])}
                                    onClick={() => setOpenSuggestions((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
                                  >
                                    {openSuggestions[row.key] ? "▼" : "▶"} {t("specMatchOtherCount", { n: others.length })}
                                  </button>
                                  {openSuggestions[row.key] ? <ul className="mt-2 space-y-2">
                                    {others.map((item) => (
                                      <li key={item.productId} className="flex gap-2">
                                        {item.image ? (
                                          <button type="button" onClick={() => openPreview({ name: imageFileName(item.name, item.image), url: item.image, type: "image/jpeg" })}>
                                            <img src={item.image} alt="" className="h-10 w-10 border border-line object-cover bg-paper" />
                                          </button>
                                        ) : null}
                                        <div className="min-w-0">
                                          <ProductTitle
                                            open={Boolean(openNames[`${row.key}:${item.productId}`])}
                                            onToggle={() => setOpenNames((prev) => ({ ...prev, [`${row.key}:${item.productId}`]: !prev[`${row.key}:${item.productId}`] }))}
                                            name={item.name}
                                          />
                                          <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => chooseSuggestion(index, item.productId)}>
                                            {t("specMatchCatalog")}
                                          </button>
                                          {item.spec ? <p className="text-xs text-mute">{item.spec}</p> : null}
                                          <p className="text-xs text-mute">{moqText(t, item)}</p>
                                          <OfferPrice productId={item.productId} promo={promo} t={t} lang={lang} />
                                        </div>
                                      </li>
                                    ))}
                                  </ul> : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-mute">{t("specMatchNone")}</p>
                          )}
                        </td>
                        <td className="w-80 px-3 py-3">
                          {match ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                aria-pressed={choice === "catalog"}
                                className={decisionButton(choice === "catalog")}
                                onClick={() => {
                                  setChoice(index, "catalog");
                                  setOpenDetails((prev) => ({ ...prev, [row.key]: false }));
                                }}
                              >
                                {t("specMatchUseYes")}
                              </button>
                              <button type="button" aria-pressed={choice === "file"} className={decisionButton(choice === "file")} onClick={() => openCustom(index, "file")}>
                                {t("specMatchUseNo")}
                              </button>
                              {match.tailorMade ? (
                                <button type="button" aria-pressed={choice === "tailor"} className={decisionButton(choice === "tailor")} onClick={() => openCustom(index, "tailor")}>
                                  {t("specMatchTailorShort")}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <button type="button" aria-pressed={choice === "file"} className={decisionButton(choice === "file")} onClick={() => openCustom(index, "file")}>
                              {t("specMatchFileItem")}
                            </button>
                          )}
                          {choice === "catalog" ? (
                            <div className="mt-3 max-w-xs">
                              <QtyStepper
                                value={Math.max(0, Number(row.qty) || 0)}
                                min={Math.max(1, Number(match?.moq) || 1)}
                                unit={match?.unit || ""}
                                onChange={(next) => changeQty(index, next)}
                                size="card"
                                t={t}
                              />
                            </div>
                          ) : null}
                        </td>
                      </tr>
                      {editing ? (
                        <tr key={`${row.key}-edit`}>
                          <td colSpan={3} className="border-t border-brand-100 bg-paper px-3 py-3">
                            <div className="rounded-lg border border-line bg-white px-4 py-4 sm:px-5">
                            {detailsOpen ? (
                              <>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                                  {choice === "tailor" ? t("tailorMadeBadge") : t("customItem")}
                                </p>
                                <h3 className="font-display text-2xl font-semibold leading-tight text-brand-800">
                                  {choice === "tailor" ? t("tailorMadeTitle") : t("addCustomProduct")}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-mute">
                                  {choice === "tailor" && match ? t("tailorMadeHint", { name: match.name }) : t("customProductHint")}
                                </p>
                                <div className="mt-5">
                                  <CustomProductForm
                                    key={`${row.key}-${choice}`}
                                    compact
                                    mode="edit"
                                    submitLabel={t("specMatchSave")}
                                    initial={customInitial(row)}
                                    onSubmit={(payload) => saveCustom(index, payload)}
                                  />
                                </div>
                              </>
                            ) : (
                            <div className="flex items-center gap-3">
                              <p className="min-w-0 flex-1 truncate text-sm text-ink">
                                {choice === "tailor" && match?.productNo ? (
                                  <span className="font-semibold text-brand-700">{t("tailorMadeBasedOn", { sku: match.productNo })} · </span>
                                ) : null}
                                <span className="font-semibold">{row.editName || row.buyerName}</span>
                                {row.editSpec ? <span className="text-mute"> · {row.editSpec}</span> : null}
                                <span className="text-mute"> · {t("specMatchQty")} {row.qty}</span>
                              </p>
                              <button
                                type="button"
                                className="btn-soft shrink-0 !px-3 !py-1.5"
                                aria-expanded={false}
                                onClick={() => openCustom(index, choice)}
                              >
                                {t("edit")}
                              </button>
                            </div>
                            )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </main>
      <SiteFooter className="mt-auto pb-24" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          {rows.length ? (
            <>
              <p className="text-sm text-ink">{t("specMatchSelected", { n: decidedRows.length })}</p>
              <button type="button" className="btn-primary !px-4 !py-2" disabled={busy || !decided} onClick={() => commit("cart")}>
                {t("specMatchAddCart")}
              </button>
              <button type="button" className="btn-soft !px-4 !py-2" disabled={busy || !decided} onClick={() => commit("quote")}>
                {t("specMatchRequestQuote")}
              </button>
            </>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {scrolled ? (
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal text-white"
                aria-label={t("backToTop")}
                onClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white"
              aria-label={t("whatsapp")}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      {preview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
          <button type="button" className="absolute inset-0 bg-charcoal/50" aria-label={t("specMatchClose")} onClick={() => setPreview(null)} />
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col bg-white p-4 shadow-xl" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-ink">{preview.name}</h2>
              <div className="flex shrink-0 gap-2">
                {preview.url ? (
                  <button type="button" className="btn-soft !px-3 !py-1.5" onClick={() => downloadFile(preview.url, preview.name)}>
                    {t("download")}
                  </button>
                ) : null}
                <button type="button" className="btn-soft !px-3 !py-1.5" onClick={() => setPreview(null)}>
                  {t("specMatchClose")}
                </button>
              </div>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-auto">
              {preview.kind === "image" && preview.url ? <img src={preview.url} alt="" className="mx-auto max-h-[70vh] object-contain" /> : null}
              {preview.kind === "pdf" && preview.url ? <iframe title={preview.name} src={preview.url} className="h-[70vh] w-full border border-line" /> : null}
              {preview.kind === "word" && preview.readable ? (
                <div className="space-y-3 text-sm text-ink">
                  {preview.paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              ) : null}
              {preview.kind === "excel" && preview.readable ? <ExcelPreview sheets={preview.sheets} /> : null}
              {!preview.readable && preview.kind !== "image" && preview.kind !== "pdf" ? (
                <p className="text-sm text-ink">{t("specMatchNoPreview")}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function decisionButton(on) {
  return `border px-3 py-1.5 text-sm font-semibold ${on ? "border-brand-600 bg-white text-brand-800" : "border-line bg-white text-ink"}`;
}

function ProductTitle({ name, open, onToggle }) {
  return (
    <button type="button" className={`block w-full text-left font-semibold text-ink hover:text-brand-700 ${open ? "" : "line-clamp-2"}`} onClick={onToggle}>
      {name}
    </button>
  );
}

function ExcelPreview({ sheets }) {
  const [active, setActive] = useState(0);
  const sheet = sheets[active] || sheets[0];
  if (!sheet) return null;
  const width = Math.max(1, ...sheet.rows.map((row) => row.length));
  return (
    <div>
      {sheets.length > 1 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {sheets.map((item, index) => (
            <button key={item.name} type="button" className={index === active ? "btn-primary !px-2 !py-1" : "btn-soft !px-2 !py-1"} onClick={() => setActive(index)}>
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="overflow-auto">
        <table className="border-collapse text-xs">
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: width }, (_, cellIndex) => (
                  <td key={cellIndex} className="border border-line px-2 py-1 align-top">
                    {row[cellIndex] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
