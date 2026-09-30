import { useEffect, useRef, useState } from "react";
import { compressImageFile } from "../../lib/compressImage";

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

export default function BannersPanel({ note }) {
  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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

  function patchBanner(id, patch) {
    setSaved(false);
    setForm((current) => ({
      ...current,
      banners: current.banners.map((banner) => (banner.id === id ? { ...banner, ...patch } : banner)),
    }));
  }

  function reorder(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setSaved(false);
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
      setSaved(false);
      setForm((current) => ({
        ...current,
        banners: [
          ...current.banners,
          ...images.map((image) => ({ id: newId(), nameZh: "", nameEn: "", src: "", image, preview: image })),
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
          image: banner.image || "",
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
            {saved ? <p className="text-sm font-semibold text-brand-800">Saved</p> : null}
          </div>
          <p className="text-sm text-mute">
            Row 1 is the homepage poster. Drag a row to the top to change it. Words printed on a poster change only when that image is replaced. Not on the marketplace until you Save.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={form.visible !== false}
              onChange={(event) => {
                setSaved(false);
                setForm((current) => ({ ...current, visible: event.target.checked }));
              }}
            />
            Show on marketplace
          </label>
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {form.visible === false ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">Hidden on marketplace</p>
      ) : null}

      <section className="mb-4 grid gap-4 lg:grid-cols-2">
        <p className="text-sm text-mute lg:col-span-2">These two sentences are what shoppers read on the homepage and the offer page.</p>
        <label className="block text-sm font-semibold text-ink">
          Sentence（中文）
          <textarea
            value={form.sentenceZh}
            onChange={(event) => {
              setSaved(false);
              setForm((current) => ({ ...current, sentenceZh: event.target.value }));
            }}
            rows={2}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Sentence (English)
          <textarea
            value={form.sentenceEn}
            onChange={(event) => {
              setSaved(false);
              setForm((current) => ({ ...current, sentenceEn: event.target.value }));
            }}
            rows={2}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal"
          />
        </label>
      </section>

      <div className="overflow-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[40rem] text-left text-[12px]">
          <thead className="bg-brand-50 text-[10px] font-semibold uppercase tracking-wide text-mute">
            <tr>
              <th className="w-12 px-3 py-2"> </th>
              <th className="w-28 px-3 py-2">Image</th>
              <th className="px-3 py-2">Tab name (中文)</th>
              <th className="px-3 py-2">Tab name (English)</th>
              <th className="w-28 px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {form.banners.map((banner, index) => {
              const preview = banner.preview || banner.src;
              return (
                <tr
                  key={banner.id}
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
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-mute">{index + 1}</span>
                      {index === 0 ? (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">Homepage</span>
                      ) : null}
                    </div>
                    <input
                      value={banner.nameZh || ""}
                      onChange={(event) => patchBanner(banner.id, { nameZh: event.target.value })}
                      placeholder="中文名"
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                    />
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
                          setSaved(false);
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
