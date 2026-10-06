import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { compressImageFile } from "../../lib/compressImage";
import { useStore } from "../../hooks/useStore";
import { listAdminProducts } from "../../lib/store";

const EMPTY = {
  visible: true,
  sentenceZh: "",
  sentenceEn: "",
  banners: [],
};

const BANNER_MAX_SIDE = 2400;
const BANNER_MAX_BYTES = 4 * 1024 * 1024;

function newId() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function imageError(error) {
  if (error?.message === "too_large") return "Image is still too large after WebP.";
  if (error?.message === "bad_image") return "Use a JPG, PNG, or WebP.";
  return error?.message || "Could not read that image.";
}

function asBannerFile(file) {
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const ext = String(file.name || "").toLowerCase();
  const type = ext.endsWith(".png") ? "image/png" : ext.endsWith(".webp") ? "image/webp" : /\.jpe?g$/.test(ext) ? "image/jpeg" : "";
  return type ? new File([file], file.name, { type }) : null;
}

async function filesToWebp(fileList) {
  const files = Array.from(fileList || []).map(asBannerFile).filter(Boolean);
  if (!files.length) throw new Error("Use a JPG, PNG, or WebP.");
  const images = [];
  for (const file of files) {
    const dataUrl = await compressImageFile(file, { maxSide: BANNER_MAX_SIDE, maxBytes: BANNER_MAX_BYTES });
    if (!String(dataUrl).startsWith("data:image/webp")) throw new Error("Banner image must be WebP.");
    images.push(dataUrl);
  }
  return images;
}

const DEMO_COPY = {
  zh: { title: "限時優惠", cta: "限時優惠", ask: "WhatsApp 查詢", browse: "瀏覽目錄" },
  en: { title: "Limited offer", cta: "Limited offer", ask: "Ask on WhatsApp", browse: "Browse catalog" },
};

function MarketplaceSentenceDemo({ form }) {
  const [lang, setLang] = useState("zh");
  const copy = DEMO_COPY[lang];
  const poster = (form.banners || []).find((banner) => (banner.products || []).length > 0) || form.banners?.[0];
  const shared = String((lang === "zh" ? form.sentenceZh : form.sentenceEn) || "").trim();
  const own = String((lang === "zh" ? poster?.sentenceZh : poster?.sentenceEn) || "").trim();
  const sentence = own || shared;
  const title = String((lang === "zh" ? poster?.nameZh : poster?.nameEn) || "").trim() || (lang === "zh" ? "中文名" : "English name");
  const src = poster?.heroSrc || poster?.preview || poster?.src || "";

  return (
    <section className="mb-4 rounded-xl border border-dashed border-brand-300 bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Demo preview</p>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Display only. This is not the live marketplace page. Shoppers see these words after you Save.
          </p>
        </div>
        <div className="flex rounded-lg border border-line bg-white p-0.5 text-sm font-semibold">
          {[
            ["zh", "中文"],
            ["en", "English"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={lang === id}
              className={`rounded-md px-3 py-1 ${lang === id ? "bg-brand-800 text-white" : "text-ink"}`}
              onClick={() => setLang(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-mute">Homepage</p>
      <div className="relative mt-2 h-36 overflow-hidden border border-line bg-brand-800">
        {src ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-center" /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#143528_0%,#143528_40%,rgba(20,53,40,0)_68%)]" aria-hidden />
        <div className="relative flex h-full w-[46%] flex-col justify-center px-4">
          <p className="font-display text-lg font-semibold leading-tight text-white">{title}</p>
          <p className={`mt-1 text-xs leading-relaxed ${sentence ? "text-white/85" : "text-white/50 italic"}`}>
            {sentence || "The sentence you type above appears here."}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-mute">Offer page</p>
      <div className="relative mt-2 overflow-hidden bg-brand-800 text-white">
        {src ? (
          <div className="absolute inset-0 bg-cover bg-top opacity-30" style={{ backgroundImage: `url("${src}")` }} aria-hidden />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-800 via-brand-800/92 to-brand-800/75" aria-hidden />
        <div className="relative flex flex-col gap-4 px-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold leading-tight">{title}</p>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${sentence ? "text-white/75" : "text-white/50 italic"}`}>
              {sentence || "The sentence you type above appears here."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <span className="inline-flex items-center bg-white px-4 py-2 text-sm font-semibold text-brand-800">{copy.ask}</span>
            <span className="inline-flex items-center border border-white/40 px-4 py-2 text-sm font-semibold text-white">{copy.browse}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {" *"}
    </span>
  );
}

export default function BannersPanel({ note }) {
  const { catalogEpoch } = useStore();
  const catalog = useMemo(() => listAdminProducts().filter((product) => !product.deleted), [catalogEpoch]);
  const [productQuery, setProductQuery] = useState({});
  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pendingDelete, setPendingDelete] = useState("");
  const [dragId, setDragId] = useState("");
  const [overId, setOverId] = useState("");
  const [thumbOver, setThumbOver] = useState("");
  const [zoneOver, setZoneOver] = useState(false);
  const replaceInputRef = useRef(null);
  const replaceIdRef = useRef("");

  useEffect(() => {
    let cancel = false;
    fetch("/api/promo", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancel || !data) return;
        setForm({
          visible: data.visible !== false,
          sentenceZh: data.sentenceZh || "",
          sentenceEn: data.sentenceEn || "",
          banners: Array.isArray(data.banners) ? data.banners : [],
        });
        setLoaded(true);
      })
      .catch(() => {
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    function onLeave(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function markDirty() {
    setSaved(false);
    setDirty(true);
  }

  function heldBanner(productId, bannerId) {
    return form.banners.find(
      (banner) => banner.id !== bannerId && (banner.products || []).some((row) => row.productId === productId)
    );
  }

  function addOfferProduct(bannerId, product) {
    const other = heldBanner(product.id, bannerId);
    if (other) {
      note?.({ ok: false, error: `Already on ${other.nameEn || other.nameZh || "another banner"}.` });
      return;
    }
    const banner = form.banners.find((row) => row.id === bannerId);
    if ((banner?.products || []).some((row) => row.productId === product.id)) return;
    patchBanner(bannerId, {
      products: [...(banner?.products || []), { productId: product.id, price: "", endsOn: "" }],
    });
    setProductQuery((current) => ({ ...current, [bannerId]: "" }));
  }

  function patchBanner(id, patch) {
    markDirty();
    setForm((current) => ({
      ...current,
      banners: current.banners.map((banner) => (banner.id === id ? { ...banner, ...patch } : banner)),
    }));
  }

  function reorder(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    markDirty();
    setForm((current) => {
      const banners = current.banners.slice();
      const from = banners.findIndex((banner) => banner.id === fromId);
      const to = banners.findIndex((banner) => banner.id === toId);
      if (from < 0 || to < 0) return current;
      const [row] = banners.splice(from, 1);
      banners.splice(to, 0, row);
      return { ...current, banners };
    });
  }

  async function addFiles(fileList) {
    try {
      const images = await filesToWebp(fileList);
      markDirty();
      setForm((current) => ({
        ...current,
        banners: [
          ...current.banners,
          ...images.map((image) => ({ id: newId(), nameZh: "", nameEn: "", src: "", image, preview: image, products: [] })),
        ],
      }));
    } catch (error) {
      note?.({ ok: false, error: imageError(error) });
    }
  }

  async function replaceFile(id, fileList) {
    try {
      const images = await filesToWebp(fileList);
      if (images[0]) patchBanner(id, { image: images[0], preview: images[0] });
    } catch (error) {
      note?.({ ok: false, error: imageError(error) });
    }
  }

  async function save() {
    const incomplete = form.banners.some((banner) =>
      (banner.products || []).some((row) => !(Number(row.price) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.endsOn || "")))
    );
    if (incomplete) {
      note?.({ ok: false, error: "Each offer product needs a price and an end date." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        visible: form.visible !== false,
        sentenceZh: form.sentenceZh,
        sentenceEn: form.sentenceEn,
        banners: form.banners.map((banner) => ({
          id: banner.id,
          nameZh: banner.nameZh,
          nameEn: banner.nameEn,
          src: banner.src || "",
          heroSrc: banner.heroSrc || "",
          image: banner.image || "",
          sentenceZh: banner.sentenceZh || "",
          sentenceEn: banner.sentenceEn || "",
          products: (banner.products || []).map((row) => ({
            productId: row.productId,
            price: Number(row.price),
            endsOn: row.endsOn,
          })),
        })),
      };
      const response = await fetch("/api/promo", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({ ok: false, error: "Unable to save" }));
      if (!response.ok || !result.ok) {
        note?.({ ok: false, error: result.error || "Unable to save" });
        return;
      }
      setForm({
        visible: result.promo.visible !== false,
        sentenceZh: result.promo.sentenceZh || "",
        sentenceEn: result.promo.sentenceEn || "",
        banners: result.promo.banners || [],
      });
      setPendingDelete("");
      setSaved(true);
      setDirty(false);
      note?.({ ok: true }, "Saved");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-sm text-mute">Loading banners…</p>;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-brand-900">Banners</h1>
            {dirty ? <p className="text-sm font-semibold text-amber-800">Unsaved changes</p> : null}
            {saved && !dirty ? <p className="text-sm font-semibold text-brand-800">Saved</p> : null}
          </div>
          <p className="text-sm text-mute">
            Banners with at least one product rotate on the homepage, in this order. A banner with no products stays off the homepage. Not on the marketplace until you Save.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={form.visible !== false}
              onChange={(event) => {
                markDirty();
                setForm((current) => ({ ...current, visible: event.target.checked }));
              }}
            />
            Show on marketplace
          </label>
          <button
            type="button"
            className={`rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${dirty ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
            disabled={saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {dirty ? (
        <div className="sticky top-0 z-30 -mx-6 mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-amber-200 bg-amber-50 px-6 py-2.5 shadow-sm">
          <p className="text-sm font-semibold text-amber-950">Unsaved changes. Not on the marketplace until you Save.</p>
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      ) : null}
      {form.visible === false ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">Hidden on marketplace</p>
      ) : null}

      <section className="mb-4 grid gap-4 lg:grid-cols-2">
        <p className="text-sm text-mute lg:col-span-2">Shared sentence. A banner uses this when its own sentence is empty.</p>
        <label className="block text-sm font-semibold text-ink">
          Sentence（中文）<RequiredMark />
          <textarea
            value={form.sentenceZh}
            onChange={(event) => {
              markDirty();
              setForm((current) => ({ ...current, sentenceZh: event.target.value }));
            }}
            rows={2}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Sentence (English)<RequiredMark />
          <textarea
            value={form.sentenceEn}
            onChange={(event) => {
              markDirty();
              setForm((current) => ({ ...current, sentenceEn: event.target.value }));
            }}
            rows={2}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal"
          />
        </label>
      </section>

      <MarketplaceSentenceDemo form={form} />

      <div className="overflow-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[40rem] text-left text-[12px]">
          <thead className="bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
            <tr>
              <th className="w-12 px-3 py-2"> </th>
              <th className="w-28 px-3 py-2">Image<RequiredMark /></th>
              <th className="px-3 py-2">Tab name (中文)<RequiredMark /></th>
              <th className="px-3 py-2">Tab name (English)<RequiredMark /></th>
              <th className="w-28 px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {form.banners.map((banner, index) => {
              const preview = banner.preview || banner.src;
              const products = banner.products || [];
              const q = String(productQuery[banner.id] || "").trim().toLowerCase();
              const matches = q
                ? catalog
                    .filter((product) => {
                      const hay = `${product.name || ""} ${product.productNo || ""} ${product.id || ""}`.toLowerCase();
                      return hay.includes(q);
                    })
                    .slice(0, 6)
                : [];
              return (
                <Fragment key={banner.id}>
                <tr
                  className={`border-t border-line/80 ${overId === banner.id ? "bg-brand-50" : ""}`}
                  onDragOver={(event) => {
                    if (!dragId || event.dataTransfer.types?.includes("Files")) return;
                    event.preventDefault();
                    setOverId(banner.id);
                  }}
                  onDrop={(event) => {
                    if (event.dataTransfer.files?.length) return;
                    event.preventDefault();
                    reorder(dragId || event.dataTransfer.getData("text/plain"), banner.id);
                    setDragId("");
                    setOverId("");
                  }}
                >
                  <td className="px-3 py-3 align-middle">
                    <button
                      type="button"
                      draggable
                      aria-label={`Drag to reorder row ${index + 1}`}
                      onDragStart={(event) => {
                        setDragId(banner.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", banner.id);
                      }}
                      onDragEnd={() => {
                        setDragId("");
                        setOverId("");
                      }}
                      className="cursor-grab px-1 text-lg leading-none text-mute active:cursor-grabbing"
                    >
                      ⋮⋮
                    </button>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <button
                      type="button"
                      onClick={() => {
                        replaceIdRef.current = banner.id;
                        replaceInputRef.current?.click();
                      }}
                      onDragOver={(event) => {
                        if (!event.dataTransfer.types?.includes("Files")) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setThumbOver(banner.id);
                      }}
                      onDragLeave={() => setThumbOver((current) => (current === banner.id ? "" : current))}
                      onDrop={(event) => {
                        if (!event.dataTransfer.files?.length) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setThumbOver("");
                        replaceFile(banner.id, event.dataTransfer.files);
                      }}
                      className={`block h-16 w-24 overflow-hidden rounded-lg border bg-paper ${
                        thumbOver === banner.id ? "border-brand-600 bg-brand-50" : "border-line"
                      }`}
                      aria-label={`Replace image for row ${index + 1}`}
                    >
                      {preview ? <img src={preview} alt="" className="h-full w-full object-cover object-top" /> : null}
                    </button>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs font-semibold text-mute">{index + 1}</span>
                      {products.length > 0 ? (
                        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">Homepage</span>
                      ) : null}
                      <input
                        value={banner.nameZh || ""}
                        onChange={(event) => patchBanner(banner.id, { nameZh: event.target.value })}
                        placeholder="中文名"
                        className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <input
                      value={banner.nameEn || ""}
                      onChange={(event) => patchBanner(banner.id, { nameEn: event.target.value })}
                      placeholder="English name"
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-3 py-3 align-middle text-right">
                    {pendingDelete === banner.id ? (
                      <button
                        type="button"
                        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
                        onClick={() => {
                          markDirty();
                          setForm((current) => ({
                            ...current,
                            banners: current.banners.filter((row) => row.id !== banner.id),
                          }));
                          setPendingDelete("");
                        }}
                      >
                        Confirm delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700"
                        onClick={() => setPendingDelete(banner.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
                <tr className="border-b border-line/80">
                  <td colSpan={5} className="px-3 pb-4">
                    <p className="text-xs font-semibold text-ink">Products on this banner</p>
                    <p className="mt-0.5 text-xs text-mute">No limit. Each product needs a promo price and an end date, and can belong to only one banner.</p>
                    <ul className="mt-2 space-y-2">
                      {products.map((row) => {
                        const product = catalog.find((item) => item.id === row.productId);
                        return (
                          <li key={row.productId} className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">{product?.name || row.productId}</span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={row.price}
                              placeholder="Price"
                              aria-label="Promo price"
                              className="w-28 rounded-lg border border-line px-2 py-1.5 text-sm"
                              onChange={(event) =>
                                patchBanner(banner.id, {
                                  products: products.map((item) =>
                                    item.productId === row.productId ? { ...item, price: event.target.value } : item
                                  ),
                                })
                              }
                            />
                            <input
                              type="date"
                              value={row.endsOn || ""}
                              aria-label="Offer end date"
                              className="rounded-lg border border-line px-2 py-1.5 text-sm"
                              onChange={(event) =>
                                patchBanner(banner.id, {
                                  products: products.map((item) =>
                                    item.productId === row.productId ? { ...item, endsOn: event.target.value } : item
                                  ),
                                })
                              }
                            />
                            <button
                              type="button"
                              className="text-xs font-semibold text-mute"
                              onClick={() =>
                                patchBanner(banner.id, {
                                  products: products.filter((item) => item.productId !== row.productId),
                                })
                              }
                            >
                              Remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <input
                      value={productQuery[banner.id] || ""}
                      onChange={(event) => setProductQuery((current) => ({ ...current, [banner.id]: event.target.value }))}
                      placeholder="Search product name or SKU"
                      className="mt-2 w-full max-w-md rounded-lg border border-line px-3 py-2 text-sm"
                    />
                    {matches.length ? (
                      <ul className="mt-1 max-w-md rounded-lg border border-line bg-white">
                        {matches.map((product) => (
                          <li key={product.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                              onClick={() => addOfferProduct(banner.id, product)}
                            >
                              {product.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <label className="block text-sm font-semibold text-ink">
                        Sentence（中文）
                        <textarea
                          value={banner.sentenceZh || ""}
                          onChange={(event) => patchBanner(banner.id, { sentenceZh: event.target.value })}
                          rows={2}
                          placeholder="Leave blank to use the shared sentence"
                          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-ink">
                        Sentence (English)
                        <textarea
                          value={banner.sentenceEn || ""}
                          onChange={(event) => patchBanner(banner.id, { sentenceEn: event.target.value })}
                          rows={2}
                          placeholder="Leave blank to use the shared sentence"
                          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal"
                        />
                      </label>
                    </div>
                  </td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        className={`relative mt-3 flex flex-col items-center rounded-xl border border-dashed px-4 py-8 text-center ${
          zoneOver ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-mute"
        }`}
        onDragOver={(event) => {
          if (![...event.dataTransfer.types].includes("Files")) return;
          event.preventDefault();
          setZoneOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setZoneOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setZoneOver(false);
          const files = Array.from(event.dataTransfer.files || []);
          if (files.length) addFiles(files);
        }}
      >
        <span className="pointer-events-none text-2xl font-light leading-none text-ink">{zoneOver ? "Drop to add" : "+"}</span>
        <span className="pointer-events-none mt-2 text-sm font-semibold text-ink">{zoneOver ? "Release to add" : "Add banner"}</span>
        <span className="pointer-events-none mt-1 text-xs">Drop a JPG, PNG, or WebP here, or click to choose files. Saved as WebP, longest side 2,400px.</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          aria-label="Add banner"
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) addFiles(files);
          }}
        />
      </div>
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          const id = replaceIdRef.current;
          event.target.value = "";
          if (files?.length && id) replaceFile(id, files);
        }}
      />
    </div>
  );
}
