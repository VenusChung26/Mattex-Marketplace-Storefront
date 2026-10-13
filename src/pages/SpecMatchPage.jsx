import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Seo from "../components/Seo";
import CustomProductForm from "../components/CustomProductForm";
import ProductPrice from "../components/ProductPrice";
import { QtyStepper } from "../components/ProductCard";
import AttachmentLinks, { PreviewThumb, linePhotoSrc } from "../components/AttachmentLinks";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { uploadSpecFile } from "../lib/rfqBlob";
import { clearSpecFiles, loadSpecFiles, saveSpecFile } from "../lib/specMatchFiles";
import { formatUnitPrice } from "../lib/productFields";
import { scrollNodeIntoView } from "../lib/scrollInto";
import { commitSpecMatch, displayLeadTime, formatQuoteDate, getEffectivePrice, getProduct, isLoggedIn, matchSpecToCatalog, productSkuId, requireBuyerAuth, specificationRows, stockStatusKey, WHATSAPP_HREF } from "../lib/store";
import { productImageList } from "../lib/compressImage";
import { findProductOffer } from "../lib/offer";
import { usePromo } from "../lib/promo";
import { buildPreview, downloadFile } from "../lib/filePreview";
import { getSpecMatchStatus, postSpecMatch } from "../lib/remote";
import {
  clearSpecConfirm,
  SAMPLE_SPEC_NAME,
  clearSpecMatch,
  loadSpecMatch,
  saveSpecMatch,
  saveSpecQuoteDraft,
  setSpecConfirm,
  takePendingSpecFile,
} from "../lib/specMatchSession";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.webp,image/png,image/jpeg,image/webp,image/gif";
const FILE_CAP = 8;
const SAMPLE_FILE_NAME = SAMPLE_SPEC_NAME;
const SAMPLE_LINES = [
  { buyerName: "Gypsum block", buyerSpec: "500 x 250 x 150 mm", qty: 20 },
  { buyerName: "Reinforcement mesh", buyerSpec: "", qty: 10 },
  { buyerName: "Bamboo scaffolding coupon", buyerSpec: "", qty: 1 },
];

function sourceKind(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/.test(name)) return "image";
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".doc") || name.endsWith(".docx") || type.includes("word")) return "word";
  if (name.endsWith(".xls") || name.endsWith(".xlsx") || type.includes("sheet") || type.includes("excel")) return "excel";
  return "";
}

function sourceLabel(name, kind, t) {
  const key = {
    image: "specMatchKindImage",
    pdf: "specMatchKindPdf",
    word: "specMatchKindWord",
    excel: "specMatchKindExcel",
  }[kind];
  const clean = String(name || "").trim();
  if (!clean) return "";
  return key ? `${clean} · ${t(key)}` : clean;
}

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
  const currentId = shownMatch(row)?.productId;
  return (row.matches || []).filter((item) => item.productId !== currentId).slice(0, 3);
}

function usingCatalog(row) {
  return row?.choice === "catalog" || row?.choice === "mm";
}

function savedCustom(row) {
  return row?.choice === "file" || row?.choice === "tailor";
}

function normalizeChoice(choice, match) {
  const value = choice === "mm" ? "catalog" : choice || "";
  if (value === "catalog" && !match) return "";
  if (value === "tailor" && !match?.tailorMade) return "";
  if (value === "no") return "file";
  if (value === "catalog" || value === "tailor" || value === "file") return value;
  return "";
}

function toRows(raw, source) {
  return (Array.isArray(raw) ? raw : []).map((row, index) => {
    const matches = Array.isArray(row.matches) ? row.matches : [];
    const id = source?.id || "line";
    return {
      key: row.key || `${id}-${index}-${row.buyerName || "item"}`,
      buyerName: row.buyerName || "",
      buyerSpec: row.buyerSpec || "",
      qty: row.qty == null || row.qty === "" ? null : Math.max(1, Math.floor(Number(row.qty)) || 1),
      matches,
      shownId: row.shownId || matches[0]?.productId || "",
      choice: row.choice || "",
      switched: Boolean(row.switched),
      boundId: row.boundId || "",
      editName: row.editName || "",
      editSpec: row.editSpec || "",
      editImages: Array.isArray(row.editImages) ? row.editImages : [],
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      sourceName: row.sourceName || source?.name || "",
      sourceKind: row.sourceKind || source?.kind || "",
      sourceId: row.sourceId || source?.id || "",
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

function customInitial(row, kind) {
  const photos = (Array.isArray(row.editImages) ? row.editImages : []).map((src) => String(src || "").trim()).filter(Boolean);
  const saved = String(row.editName || "").trim() || String(row.editSpec || "").trim() || photos.length || (row.attachments || []).length;
  if (saved) {
    return {
      name: row.editName || row.buyerName || "",
      description: row.editSpec ?? "",
      qty: Math.max(1, Number(row.qty) || 1),
      image: photos[0] || "",
      images: photos.slice(1),
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
    };
  }
  const match = shownMatch(row);
  if (kind === "tailor" && match) {
    return {
      name: row.buyerName || "",
      description: match.spec || "",
      qty: Math.max(1, Number(row.qty) || match.moq || 1),
      image: match.image || "",
      images: [],
      attachments: [],
    };
  }
  return {
    name: row.buyerName || "",
    description: row.buyerSpec || "",
    qty: Math.max(1, Number(row.qty) || 1),
    image: "",
    images: [],
    attachments: [],
  };
}
function moqText(t, match) {
  if (!match) return "";
  const amount = `${match.moq}${match.unit ? ` ${match.unit}` : ""}`;
  return t("specMatchMoq", { n: amount });
}

function OfferPrice({ productId, promo, t, lang }) {
  const product = getProduct(productId);
  const offer = findProductOffer(productId, promo);
  const list = product ? getEffectivePrice(product).displayPrice : null;
  const shown = offer ? offer.price : list;
  return (
    <span className="mt-1 block text-sm font-semibold leading-5 text-ink">
      {formatUnitPrice(shown, lang)}
      {offer ? <span className="ml-2 font-medium text-amber-800">{t("offerEnds", { date: formatQuoteDate(offer.endsOn, lang) })}</span> : null}
    </span>
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
  const { catalogLoading, catalogEpoch, user } = useStore();
  const owner = String(user?.email || "").trim().toLowerCase();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const specFilesRef = useRef(new Map());
  const previewBlobRef = useRef("");
  const pickModeRef = useRef("start");
  const [status, setStatus] = useState(null);
  const [fileName, setFileName] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [sources, setSources] = useState([]);
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failedNames, setFailedNames] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [queuedFile, setQueuedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [headTop, setHeadTop] = useState(65);
  const [openKeys, setOpenKeys] = useState(null);
  const [jumpKey, setJumpKey] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [fileEpoch, setFileEpoch] = useState(0);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    getSpecMatchStatus()
      .then(({ data }) => {
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
      setQueuedFile(pending);
      setReady(true);
      return;
    }
    const saved = loadSpecMatch();
    if (saved?.rows?.length) {
      const savedSources = Array.isArray(saved.sources) ? saved.sources.filter((source) => source?.name) : [];
      setFileName(saved.fileName || savedSources[0]?.name || "");
      setSpecUrl(saved.specUrl || savedSources[0]?.url || "");
      setSources(savedSources);
      setRows(saved.rows);
      setFailedNames([]);
      setError("");
    } else {
      setFileName("");
      setSpecUrl("");
      setSources([]);
      setRows([]);
    }
    setReady(true);
  }, [owner]);

  const sourceIds = sources.map((source) => source.id).filter(Boolean).join("|");

  useEffect(() => {
    if (!ready || !sourceIds) return undefined;
    let stop = false;
    loadSpecFiles(owner, sourceIds.split("|"))
      .then((found) => {
        if (stop || !found.size) return;
        let added = false;
        found.forEach((file, id) => {
          if (specFilesRef.current.has(id)) return;
          specFilesRef.current.set(id, file);
          added = true;
        });
        if (added) setFileEpoch((value) => value + 1);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [ready, owner, sourceIds]);

  useEffect(() => {
    if (!ready || !rows.length || (fileName === SAMPLE_SPEC_NAME && !sources.length)) return;
    try {
      saveSpecMatch({ fileName: sources[0]?.name || fileName, specUrl: sources[0]?.url || specUrl, sources, rows });
    } catch {
      /* keep the in-memory match if storage is full */
    }
  }, [ready, rows, fileName, specUrl, sources, owner]);

  useEffect(() => {
    if (catalogLoading) return;
    setRows((prev) => {
      if (!prev.length) return prev;
      const next = withLiveCatalog(prev);
      const same = next.every((row, index) => {
        const before = (prev[index]?.matches || []).map((match) => `${match.productId}:${match.moq}:${match.hits}:${match.spec || ""}:${match.confident ? 1 : 0}`).join(",");
        const after = (row.matches || []).map((match) => `${match.productId}:${match.moq}:${match.hits}:${match.spec || ""}:${match.confident ? 1 : 0}`).join(",");
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
    function measure() {
      const nav = document.getElementById("siteNav");
      setHeadTop(nav ? Math.ceil(nav.getBoundingClientRect().height) : 0);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!jumpKey) return undefined;
    const node = document.getElementById(`spec-row-${jumpKey}`);
    const head = document.querySelector(".spec-match-head");
    const extra = head ? Math.ceil(head.getBoundingClientRect().height) : 0;
    scrollNodeIntoView(node, { block: "start", clearHeader: true, extra });
    setJumpKey("");
    return undefined;
  }, [jumpKey]);

  useEffect(() => {
    if (!preview && !dialog) return undefined;
    function onKey(event) {
      if (event.key !== "Escape") return;
      if (dialog?.type === "custom") cancelCustom();
      else {
        closePreview();
        setDialog(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, dialog]);

  const closed = status != null && status.open === false;
  const limited = status?.member !== true && Number(status?.remaining) === 0;
  const decidedRows = rows.filter((row) => ["catalog", "mm", "tailor", "file"].includes(row.choice));
  const decided = decidedRows.length > 0;

  async function matchOne(file) {
    const dataUrl = await readFile(file);
    const base64 = dataUrl.split(",")[1] || "";
    const res = await postSpecMatch({ name: file.name, mime: file.type, dataUrl, base64 });
    const data = res.data || {};
    if (data?.remaining != null) setStatus((prev) => ({ ...prev, remaining: data.remaining }));
    if (!data?.ok) return { ok: false, error: data?.error || "file" };
    if (data.unreadable || !Array.isArray(data.rows) || !data.rows.length) return { ok: true, unreadable: true };
    let url = "";
    try {
      url = await uploadSpecFile(file);
    } catch {
      url = "";
    }
    return { ok: true, rows: data.rows, url };
  }

  async function runFiles(fileList, mode) {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (!incoming.length || closed || limited) return;
    const replacing = mode === "replace" || mode === "start" || !rows.length;
    const keptSources = replacing ? [] : sources.slice();
    const keptRows = replacing ? [] : rows.slice();
    const room = FILE_CAP - keptSources.length;
    const batch = incoming.slice(0, Math.max(0, room));
    const skipped = incoming.length - batch.length;
    if (!batch.length) {
      setError(t("specMatchFileCap"));
      return;
    }
    if (replacing) {
      specFilesRef.current = new Map();
      try {
        await clearSpecFiles(owner);
      } catch {
        /* the new files still preview in this tab */
      }
    }
    setBusy(true);
    setError("");
    setFailedNames([]);
    const failed = [];
    const nextSources = keptSources.slice();
    const nextRows = keptRows.slice();
    try {
      for (const file of batch) {
        try {
          const result = await matchOne(file);
          if (!result.ok) {
            setError(result.error === "limit" ? t("specMatchLimit") : result.error === "closed" ? t("specMatchClosed") : t("specMatchUnreadable"));
            break;
          }
          if (result.unreadable) {
            failed.push(file.name);
            continue;
          }
          const source = { id: `src-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: file.name, kind: sourceKind(file), url: result.url || "" };
          specFilesRef.current.set(source.id, file);
          try {
            await saveSpecFile(owner, source.id, file);
          } catch {
            /* this tab can still preview the file */
          }
          nextSources.push(source);
          nextRows.push(...toRows(result.rows, source));
        } catch {
          failed.push(file.name);
        }
      }
      setSources(nextSources);
      setRows(withLiveCatalog(nextRows));
      setFileName(nextSources[0]?.name || "");
      setSpecUrl(nextSources[0]?.url || "");
      setFailedNames(failed);
      if (skipped) setError(t("specMatchFileCap"));
      setReady(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!queuedFile) return;
    const file = queuedFile;
    setQueuedFile(null);
    runFiles([file], "start");
  }, [queuedFile]);

  function openPicker(mode) {
    pickModeRef.current = mode;
    fileRef.current?.click();
  }

  function takeDroppedFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length || closed || limited || busy) return;
    if (rows.length && fileName !== SAMPLE_FILE_NAME) {
      setPreview(null);
      setDialog({ type: "files", files });
      return;
    }
    runFiles(files, "start");
  }

  function trySample() {
    if (closed || limited || busy) return;
    specFilesRef.current = new Map();
    clearSpecFiles(owner).catch(() => {});
    clearSpecMatch();
    setError("");
    setFailedNames([]);
    setFileName(SAMPLE_FILE_NAME);
    setSpecUrl("");
    setSources([]);
    setRows(withLiveCatalog(toRows(SAMPLE_LINES)));
    setReady(true);
  }

  function clearExtracted() {
    specFilesRef.current = new Map();
    clearSpecFiles(owner).catch(() => {});
    setFileName("");
    setSpecUrl("");
    setSources([]);
    setRows([]);
    setFailedNames([]);
    setError("");
    setDialog(null);
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
        return { ...row, choice: "" };
      })
    );
  }

  function openCustom(index, kind) {
    if (!rows[index]) return;
    setPreview(null);
    const choice = rows[index].choice === "mm" ? "catalog" : rows[index].choice || "";
    setDialog({ type: "custom", index, kind, editing: choice === "file" || choice === "tailor" });
  }

  function cancelCustom() {
    setDialog((current) => {
      if (current?.type === "custom" && !current.editing) {
        const index = current.index;
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, choice: "" } : row)));
      }
      return null;
    });
  }

  function saveCustom(index, kind, payload) {
    const images = Array.isArray(payload?.images) ? payload.images.filter(Boolean) : [];
    patchRow(index, {
      choice: kind,
      editName: payload.name,
      editSpec: payload.description,
      qty: Math.max(1, Math.floor(Number(payload.qty)) || 1),
      editImages: images,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    });
    setDialog(null);
  }

  function rowDetailsOpen(key) {
    return openKeys == null || openKeys.has(key);
  }

  function collapseAll() {
    setOpenKeys(new Set());
  }

  function expandAll() {
    setOpenKeys(null);
  }

  function toggleRow(key) {
    setOpenKeys((current) => {
      const next = new Set(current == null ? rows.map((row) => row.key) : current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === rows.length ? null : next;
    });
  }

  function requestDeleteRow(index) {
    const row = rows[index];
    if (!row) return;
    closePreview();
    setDialog({ type: "delete-row", key: row.key });
  }

  function confirmDeleteRow(key) {
    setRows((prev) => prev.filter((row) => row.key !== key));
    setOpenKeys((current) => {
      if (current == null) return null;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setDialog(null);
  }

  function sourceForRow(row) {
    if (row?.sourceId) {
      const byId = sources.find((source) => source.id === row.sourceId);
      if (byId) return byId;
    }
    return sources.find((source) => source.name && source.name === row?.sourceName) || null;
  }

  function closePreview() {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = "";
    }
    setPreview(null);
  }

  function returnToCatalog(index) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const match = shownMatch(row);
        if (!match) return { ...row, choice: "" };
        return { ...row, choice: "catalog", qty: Math.max(Number(row.qty) || 0, match.moq || 1) };
      })
    );
  }

  function openDetail(match) {
    if (!match?.productId) return;
    closePreview();
    setDialog({ type: "detail", productId: match.productId, match });
  }

  function openSpecPreview(source) {
    if (dialog?.type === "custom") cancelCustom();
    else setDialog(null);
    openPreview(source);
  }

  function chooseSuggestion(index, productId) {
    const key = rows[index]?.key || "";
    let picked = false;
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const match = (row.matches || []).find((item) => item.productId === productId);
        if (!match) return row;
        picked = true;
        return {
          ...row,
          shownId: productId,
          switched: true,
          choice: "catalog",
          qty: Math.max(Number(row.qty) || 0, match.moq || 1),
        };
      })
    );
    if (picked && key) setJumpKey(key);
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
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = "";
    }
    let url = String(source?.url || "");
    if (!url && source?.file) {
      url = URL.createObjectURL(source.file);
      previewBlobRef.current = url;
    }
    const next = await buildPreview({ ...source, url });
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
      saveSpecMatch({ fileName: sources[0]?.name || fileName, specUrl: sources[0]?.url || specUrl, sources, rows: next });
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
    saveSpecMatch({ fileName: sources[0]?.name || fileName, specUrl: sources[0]?.url || specUrl, sources, rows: next });
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
            if (!closed && !limited) takeDroppedFiles(event.dataTransfer.files);
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-soft !px-4 !py-2"
              disabled={closed || limited || busy}
              onClick={() => openPicker(rows.length ? "replace" : "start")}
            >
              {rows.length ? t("specMatchChangeFile") : t("specMatchFile")}
            </button>
            {rows.length && fileName !== SAMPLE_FILE_NAME ? (
              <button type="button" className="btn-soft !px-4 !py-2" disabled={closed || limited || busy || sources.length >= FILE_CAP} onClick={() => openPicker("append")}>
                {t("specMatchAddFile")}
              </button>
            ) : rows.length ? null : (
              <button type="button" className="btn-primary !px-4 !py-2" disabled={closed || limited || busy || catalogLoading} onClick={trySample}>
                {t("specMatchSample")}
              </button>
            )}
            {sources.length ? sources.map((source) => {
              const file = specFilesRef.current.get(source.id) || null;
              const label = sourceLabel(source.name, source.kind, t);
              return file || source.url ? (
                <button key={source.id} type="button" className="text-sm font-semibold text-brand-700 underline" onClick={() => openSpecPreview({ name: source.name, url: source.url, file })}>
                  {label}
                </button>
              ) : (
                <span key={source.id} className="text-sm font-semibold text-ink">{label}</span>
              );
            }) : fileName ? (
              <span className="text-sm font-semibold text-ink">{fileName === SAMPLE_FILE_NAME ? t("specMatchSampleName") : fileName}</span>
            ) : null}
            {fileName || rows.length ? (
              <button type="button" className="text-sm font-semibold text-mute" onClick={clearExtracted}>
                {t("specMatchClear")}
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-mute">{t("specMatchDrop")}</p>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept={ACCEPT}
            multiple
            disabled={closed || limited || busy}
            onChange={(event) => {
              runFiles(event.target.files, pickModeRef.current);
              event.target.value = "";
            }}
          />
        </div>
        {busy ? <p className="mt-4 text-sm text-ink">{t("specMatchWorking")}</p> : null}
        {error ? <p className="mt-4 text-sm text-[#8a2b2b]">{error}</p> : null}
        {failedNames.length ? <p className="mt-4 text-sm font-semibold text-ink">{t("specMatchFailed", { name: failedNames.join("、") })}</p> : null}
        {rows.length ? (
          <div className="mt-8">
              <div className="mb-3 flex justify-end gap-2">
                <button type="button" className={decisionButton(openKeys != null && openKeys.size === 0)} onClick={collapseAll}>
                  {t("specMatchCollapseAll")}
                </button>
                <button type="button" className={decisionButton(openKeys == null)} onClick={expandAll}>
                  {t("specMatchExpandAll")}
                </button>
              </div>
              <div className="border border-line bg-white">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-mute">
                      <th className="spec-match-head sticky z-20 w-12 border-b border-line bg-white px-3 py-2 font-semibold" style={{ top: headTop }}>#</th>
                      <th className="spec-match-head sticky z-20 border-b border-line bg-white px-3 py-2 font-semibold" style={{ top: headTop }}>{t("specMatchColItem")}</th>
                      <th className="spec-match-head sticky z-20 border-b border-line bg-white px-3 py-2 font-semibold" style={{ top: headTop }}>{t("specMatchColProduct")}</th>
                      <th className="spec-match-head sticky z-20 w-20 border-b border-line bg-white px-3 py-2 font-semibold" style={{ top: headTop }}>{t("specMatchQty")}</th>
                      <th className="spec-match-head sticky z-20 w-52 border-b border-line bg-white px-3 py-2 font-semibold" style={{ top: headTop }}>{t("specMatchColPrice")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const open = rowDetailsOpen(row.key);
                      const rule = index < rows.length - 1 ? "border-b border-line" : "";
                      const source = sourceForRow(row);
                      const sourceFile = source && fileEpoch >= 0 ? specFilesRef.current.get(source.id) || null : null;
                      const canPreview = Boolean(sourceFile || source?.url);
                      return (
                        <Fragment key={row.key}>
                          <tr
                            id={`spec-row-${row.key}`}
                            className="cursor-pointer bg-white"
                            onClick={() => toggleRow(row.key)}
                          >
                            <td className={`${open ? "" : rule} px-3 py-3 align-top font-semibold tabular-nums text-brand-700`}>#{index + 1}</td>
                            <td className={`${open ? "" : rule} max-w-[16rem] px-3 py-3 align-top`}>
                              <span className="block truncate font-semibold text-ink">{row.buyerName}</span>
                              {row.buyerSpec ? <span className="mt-0.5 block truncate text-xs leading-5 text-mute">{row.buyerSpec}</span> : null}
                              {row.sourceName ? (
                                canPreview ? (
                                  <button
                                    type="button"
                                    className="mt-0.5 block max-w-full truncate text-left text-xs font-semibold leading-5 text-brand-700 underline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openSpecPreview({ name: source.name, url: source.url, file: sourceFile });
                                    }}
                                  >
                                    {sourceLabel(row.sourceName, row.sourceKind, t)}
                                  </button>
                                ) : (
                                  <span className="mt-0.5 block truncate text-xs leading-5 text-mute">{sourceLabel(row.sourceName, row.sourceKind, t)}</span>
                                )
                              ) : null}
                            </td>
                            <td className={`${open ? "" : rule} max-w-[16rem] px-3 py-3 align-top text-ink`}>
                              <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
                                <span className="truncate">{listSubject(row, t)}</span>
                                <StatusTag row={row} t={t} />
                                {usingCatalog(row) ? (
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-brand-700"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setChoice(index, "");
                                    }}
                                  >
                                    {t("specMatchClearChoice")}
                                  </button>
                                ) : null}
                              </span>
                              {listSpec(row) ? <span className="mt-0.5 block truncate text-xs leading-5 text-mute">{listSpec(row)}</span> : null}
                            </td>
                            <td className={`${open ? "" : rule} px-3 py-3 align-top tabular-nums text-ink`}>{row.qty || "—"}</td>
                            <td className={`${open ? "" : rule} px-3 py-3 align-top text-ink`}>
                              <div className="flex items-start justify-between gap-2">
                                <span>{listPrice(row, promo, lang)}</span>
                                <button
                                  type="button"
                                  className="shrink-0 rounded-none border border-[#E7C1C1] bg-[#F8E8E8] px-2 py-1 text-xs font-semibold text-[#8a2b2b]"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    requestDeleteRow(index);
                                  }}
                                >
                                  {t("specMatchDeleteCustom")}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {open ? (
                          <tr className="bg-white">
                            <td className={rule} />
                            <td className={rule} />
                            <td colSpan={3} className={`${rule} px-3 pb-3 align-top`}>
                              <SpecRowEditor
                                row={row}
                                index={index}
                                t={t}
                                promo={promo}
                                lang={lang}
                                setChoice={setChoice}
                                openDetail={openDetail}
                                changeQty={changeQty}
                                chooseSuggestion={chooseSuggestion}
                                openCustom={openCustom}
                                returnToCatalog={returnToCatalog}
                                deleteCustom={requestDeleteRow}
                              />
                            </td>
                          </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          </div>
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
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
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
      {dialog?.type === "delete-row" ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
          <button type="button" className="absolute inset-0 bg-charcoal/50" aria-label={t("specMatchClose")} onClick={() => setDialog(null)} />
          <div className="relative w-full max-w-md bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
            <p className="text-sm font-semibold leading-6 text-ink">{t("specMatchDeleteRowAsk")}</p>
            <p className="mt-1 text-sm text-mute">{rows.find((row) => row.key === dialog.key)?.buyerName || ""}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-none border border-[#E7C1C1] bg-[#F8E8E8] px-4 py-2 text-sm font-semibold text-[#8a2b2b]" onClick={() => confirmDeleteRow(dialog.key)}>{t("specMatchDeleteCustom")}</button>
              <button type="button" className="btn-soft !px-4 !py-2" onClick={() => setDialog(null)}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}
      {dialog?.type === "files" ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
          <button type="button" className="absolute inset-0 bg-charcoal/50" aria-label={t("specMatchClose")} onClick={() => setDialog(null)} />
          <div className="relative w-full max-w-md bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
            <p className="text-sm leading-6 text-ink">{t("specMatchDropAsk")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-primary !px-4 !py-2" onClick={() => { const files = dialog.files; setDialog(null); runFiles(files, "append"); }}>{t("specMatchAddFile")}</button>
              <button type="button" className="btn-soft !px-4 !py-2" onClick={() => { const files = dialog.files; setDialog(null); runFiles(files, "replace"); }}>{t("specMatchChangeFile")}</button>
            </div>
          </div>
        </div>
      ) : null}
      {dialog?.type === "detail" ? (
        <ProductDetailDialog
          key={dialog.productId}
          productId={dialog.productId}
          match={dialog.match}
          t={t}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.type === "custom" && rows[dialog.index] ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
          <button type="button" className="absolute inset-0 bg-charcoal/50" aria-label={t("specMatchClose")} onClick={cancelCustom} />
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-auto bg-white p-4 shadow-xl sm:p-8" role="dialog" aria-modal="true">
            <h2 className="font-display text-2xl font-semibold text-brand-800">
              {dialog.kind === "tailor" ? t("tailorMadeTitle") : t("specMatchFileOnly")}
            </h2>
            <p className="mt-2 text-sm text-mute">
              {dialog.kind === "tailor" && shownMatch(rows[dialog.index])
                ? t("tailorMadeHint", { name: shownMatch(rows[dialog.index]).name })
                : t("customProductHint")}
            </p>
            <div className="mt-5">
              <CustomProductForm
                key={`${rows[dialog.index].key}-${dialog.kind}`}
                compact
                mode="edit"
                submitLabel={t("specMatchSave")}
                initial={customInitial(rows[dialog.index], dialog.kind)}
                onSubmit={(payload) => saveCustom(dialog.index, dialog.kind, payload)}
                onCancel={cancelCustom}
              />
            </div>
          </div>
        </div>
      ) : null}
      {preview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
          <button type="button" className="absolute inset-0 bg-charcoal/50" aria-label={t("specMatchClose")} onClick={closePreview} />
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col bg-white p-4 shadow-xl" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-ink">{preview.name}</h2>
              <div className="flex shrink-0 gap-2">
                {preview.url ? (
                  <button type="button" className="btn-soft !px-3 !py-1.5" onClick={() => downloadFile(preview.url, preview.name)}>
                    {t("download")}
                  </button>
                ) : null}
                <button type="button" className="btn-soft !px-3 !py-1.5" onClick={closePreview}>
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

function CustomThumb({ row, t }) {
  const photos = (Array.isArray(row.editImages) ? row.editImages : []).map((src) => String(src || "").trim()).filter(Boolean);
  const src = linePhotoSrc({ image: photos[0] || "", images: photos, attachments: row.attachments });
  const name = row.editName || row.buyerName || "";
  return (
    <span className="h-12 w-12 shrink-0 overflow-hidden border border-line bg-paper">
      {src ? (
        <PreviewThumb src={src} name={name} className="!h-full !w-full !rounded-none !border-0" />
      ) : (
        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-bold uppercase leading-tight text-brand-700">
          {t("customItem")}
        </span>
      )}
    </span>
  );
}

function listPrice(row, promo, lang) {
  if (savedCustom(row)) return formatUnitPrice(null, lang);
  const match = shownMatch(row);
  if (!match) return "—";
  const offer = findProductOffer(match.productId, promo);
  const list = getEffectivePrice(getProduct(match.productId)).displayPrice;
  return formatUnitPrice(offer ? offer.price : list, lang);
}

function SpecRowEditor({ row, index, t, promo, lang, setChoice, openDetail, changeQty, chooseSuggestion, openCustom, returnToCatalog, deleteCustom }) {
  const match = shownMatch(row);
  const others = otherMatches(row);
  const choice = row.choice === "mm" ? "catalog" : row.choice || "";
  const custom = savedCustom(row);
  return (
    <>
      {custom ? (
        <div className="mt-3">
          <div className="border border-brand-600 bg-white px-3 py-3">
            <div className="flex items-start gap-3">
              <CustomThumb row={row} t={t} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-ink">{row.editName || row.buyerName}</p>
                    {choice === "tailor" && match?.productNo ? (
                      <p className="mt-0.5 text-[11px] leading-snug text-mute">{t("tailorMadeBasedOn", { sku: match.productNo })}</p>
                    ) : null}
                    {row.editSpec ? (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] text-mute">
                        <span className="font-medium text-ink/80">{t("customProductDesc")}: </span>
                        {row.editSpec}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className="btn-soft shrink-0 !rounded-none !px-3 !py-1.5" onClick={() => openCustom(index, choice)}>{t("edit")}</button>
                    <button type="button" className="shrink-0 rounded-none border border-[#E7C1C1] bg-[#F8E8E8] px-3 py-1.5 text-sm font-semibold text-[#8a2b2b]" onClick={() => deleteCustom(index)}>{t("specMatchDeleteCustom")}</button>
                  </div>
                </div>
                <AttachmentLinks files={row.attachments} />
                <div className="mt-3 max-w-xs">
                  <QtyStepper
                    value={Math.max(1, Number(row.qty) || 1)}
                    min={1}
                    unit={match?.unit || ""}
                    onChange={(next) => changeQty(index, next)}
                    size="card"
                    t={t}
                  />
                </div>
                {match ? (
                  <button type="button" className="btn-soft mt-3 !rounded-none !px-3 !py-1.5 text-left leading-5" onClick={() => returnToCatalog(index)}>{t("specMatchBack", { name: match.name })}</button>
                ) : null}
              </div>
            </div>
          </div>
          {others.length ? (
            <div className="mt-3">
              <p className="text-sm font-semibold leading-5 text-ink">{t("specMatchOther")}</p>
              <p className="mt-0.5 text-sm leading-5 text-mute">{t("specMatchOtherPick")}</p>
              <ul className="mt-2 divide-y divide-line border border-line bg-white">
                {others.map((item) => (
                  <li key={item.productId}>
                    <SuggestionLine
                      match={item}
                      t={t}
                      onPick={() => chooseSuggestion(index, item.productId)}
                      onOpen={() => openDetail(item)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : match ? (
        <div className="mt-3">
          <MatchFace
            match={match}
            current
            selected={choice === "catalog"}
            t={t}
            promo={promo}
            lang={lang}
            onPick={() => setChoice(index, "catalog")}
            onClear={() => setChoice(index, "")}
            onOpen={() => openDetail(match)}
            qty={choice === "catalog" ? (
              <QtyStepper
                value={Math.max(0, Number(row.qty) || 0)}
                min={Math.max(1, Number(match.moq) || 1)}
                unit={match.unit || ""}
                onChange={(next) => changeQty(index, next)}
                size="card"
                t={t}
              />
            ) : null}
          />
          <button type="button" className="mt-3 w-full border border-line bg-white px-3 py-2.5 text-left text-sm font-semibold text-ink hover:border-brand-600 hover:bg-brand-50" onClick={() => openCustom(index, "file")}>
            {t("specMatchFileInstead")}
          </button>
          {match.tailorMade ? (
            <button type="button" className="mt-2 text-sm font-semibold text-brand-700 hover:underline" onClick={() => openCustom(index, "tailor")}>
              {t("specMatchTailorShort")}
            </button>
          ) : null}
          {others.length ? (
            <div className="mt-3">
              <p className="text-sm font-semibold leading-5 text-ink">{t("specMatchOther")}</p>
              <p className="mt-0.5 text-sm leading-5 text-mute">{t("specMatchOtherPick")}</p>
              <ul className="mt-2 divide-y divide-line border border-line bg-white">
                {others.map((item) => (
                  <li key={item.productId}>
                    <SuggestionLine
                      match={item}
                      t={t}
                      onPick={() => chooseSuggestion(index, item.productId)}
                      onOpen={() => openDetail(item)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <button type="button" className={`${decisionButton(false)} mt-4`} onClick={() => openCustom(index, "file")}>
          {t("specMatchFileOnly")}
        </button>
      )}
    </>
  );
}

function matchSpecLine(match) {
  return String(match?.spec || "").replace(/\s+/g, " ").trim();
}

function listSubject(row, t) {
  if (savedCustom(row)) return row.editName || row.buyerName;
  return shownMatch(row)?.name || t("specMatchNone");
}

function listSpec(row) {
  if (savedCustom(row)) return String(row.editSpec || "").replace(/\s+/g, " ").trim();
  return matchSpecLine(shownMatch(row));
}

function listStatus(row, t) {
  if (usingCatalog(row)) return t("specMatchStatusUsed");
  if (row.choice === "file") return t("specMatchStatusFile");
  if (row.choice === "tailor") return t("specMatchStatusTailor");
  return t("specMatchStatusNone");
}

function StatusTag({ row, t }) {
  const tone = usingCatalog(row)
    ? "bg-brand-100 text-brand-800"
    : row.choice === "file"
      ? "bg-[#F3E6C8] text-[#6B4E16]"
      : row.choice === "tailor"
        ? "bg-[#E4EAF3] text-[#1E3A5F]"
        : "border border-line bg-paper text-mute";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>{listStatus(row, t)}</span>;
}

function SuggestionLine({ match, t, onPick, onOpen }) {
  const spec = matchSpecLine(match);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onPick}>
        {match.image ? (
          <img src={match.image} alt="" className="h-10 w-10 shrink-0 border border-line bg-paper object-cover" />
        ) : null}
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold leading-5 text-ink">{match.name}</span>
          </span>
          {spec ? <span className="mt-0.5 block truncate text-xs leading-5 text-mute">{spec}</span> : null}
        </span>
      </button>
      <button type="button" className="btn-soft shrink-0 !px-3 !py-1.5" onClick={onOpen}>
        {t("specMatchSpecs")}
      </button>
    </div>
  );
}

function MatchFace({ match, current = false, selected = false, t, promo, lang, onPick, onClear, onOpen, qty = null }) {
  const spec = matchSpecLine(match);
  return (
    <div className="flex items-start gap-3 border border-line bg-white p-3">
      {match.image ? (
        <img src={match.image} alt="" className="h-12 w-12 shrink-0 border border-line bg-paper object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <button type="button" className="min-w-0 flex-1 text-left" aria-pressed={selected} onClick={onPick}>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-semibold leading-6 text-ink">{match.name}</span>
            </span>
            {spec ? <span className="mt-1 block text-sm leading-5 text-mute">{spec}</span> : null}
            {!selected && current ? <span className="mt-1 block text-sm font-semibold leading-5 text-brand-700">{t("specMatchPick")}</span> : null}
            <span className="mt-1 block text-sm leading-5 text-mute">{moqText(t, match)}</span>
            <OfferPrice productId={match.productId} promo={promo} t={t} lang={lang} />
          </button>
          <button type="button" className="btn-soft shrink-0 !px-3 !py-1.5" onClick={onOpen}>
            {t("specMatchSpecs")}
          </button>
        </div>
        {selected ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-block rounded bg-brand-100 px-2 py-0.5 text-xs font-semibold leading-5 text-brand-800">{t("specMatchStatusUsed")}</span>
            <button type="button" className="text-xs font-semibold text-brand-700" onClick={onClear}>{t("specMatchClearChoice")}</button>
          </div>
        ) : null}
        {qty ? <div className="mt-3 max-w-xs">{qty}</div> : null}
      </div>
    </div>
  );
}

function ProductDetailDialog({ productId, match, t, onClose }) {
  const product = getProduct(productId);
  const gallery = product ? productImageList(product) : match?.image ? [match.image] : [];
  const [active, setActive] = useState(gallery[0] || "");
  const name = product?.name || match?.name || "";
  const sku = product ? productSkuId(product) : match?.productNo || "";
  const specs = product ? specificationRows(product) : [];
  const description = String(product?.description || product?.primarySpec || match?.spec || "").trim();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-charcoal/50" aria-label={t("specMatchClose")} onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-auto bg-white p-4 shadow-xl sm:p-6" role="dialog" aria-modal="true" aria-label={name}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-brand-800">{name}</h2>
          <button type="button" className="btn-soft shrink-0 !px-3 !py-1.5" onClick={onClose}>{t("specMatchClose")}</button>
        </div>
        {description ? <p className="mt-3 text-sm leading-6 text-mute">{description}</p> : null}
        {active ? <img src={active} alt="" className="mt-4 max-h-72 w-full border border-line object-contain bg-paper" /> : null}
        {gallery.length > 1 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {gallery.map((src) => (
              <button key={src} type="button" className={`h-14 w-14 shrink-0 border ${src === active ? "border-brand-600" : "border-line"}`} onClick={() => setActive(src)}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
          {sku ? <div className="flex justify-between gap-4 py-2"><dt className="text-mute">{t("productNo")}</dt><dd className="font-medium text-ink">{sku}</dd></div> : null}
          {product ? <div className="flex justify-between gap-4 py-2"><dt className="text-mute">{t("moq")}</dt><dd className="font-medium text-ink">{product.moq} {product.unit}</dd></div> : null}
          {product ? <div className="flex justify-between gap-4 py-2"><dt className="text-mute">{t("stockStatus")}</dt><dd className="font-medium text-ink">{product.discontinued ? t("discontinued") : t(stockStatusKey(product.stockStatus))}</dd></div> : null}
          {product && displayLeadTime(product) ? <div className="flex justify-between gap-4 py-2"><dt className="text-mute">{t("leadTime")}</dt><dd className="font-medium text-ink">{displayLeadTime(product)}</dd></div> : null}
        </dl>
        {product ? <div className="mt-4"><ProductPrice product={product} size="detail" /></div> : null}
        {specs.length ? (
          <>
            <h3 className="mt-6 text-sm font-semibold text-ink">{t("specifications")}</h3>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {specs.map((row) => (
                <li key={row.kind === "cert" ? "cert" : row.text} className="py-2 text-sm text-mute">
                  {row.kind === "cert" ? row.lines.join(" ") : row.text}
                </li>
              ))}
            </ul>
          </>
        ) : match?.spec ? <p className="mt-4 text-sm text-mute">{match.spec}</p> : null}
      </div>
    </div>
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
