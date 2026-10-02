import { useState } from "react";
import { useLanguage } from "../i18n";
import { openUrlForAttachment } from "../lib/extractSpec";

export function isImageFile(file) {
  const type = String(file?.type || "");
  const url = String(file?.url || "");
  const name = String(file?.name || "");
  return file?.kind === "image" || type.startsWith("image/") || url.startsWith("data:image/") || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url) || /\.(png|jpe?g|gif|webp)$/i.test(name);
}

function isPdfFile(file) {
  const type = String(file?.type || "");
  const name = String(file?.name || "");
  const url = String(file?.url || "");
  return type.includes("pdf") || /\.pdf(\?|$)/i.test(url) || /\.pdf$/i.test(name);
}

export function linePhotoSrc(line) {
  const direct = String(line?.image || "").trim();
  if (direct) return direct;
  const extra = (Array.isArray(line?.images) ? line.images : []).map((src) => String(src || "").trim()).find(Boolean);
  if (extra) return extra;
  const file = (Array.isArray(line?.attachments) ? line.attachments : []).find((item) => isImageFile(item) && item?.url);
  return file?.url || "";
}

export function FilePreviewOverlay({ src, name, file, onClose }) {
  const href = openUrlForAttachment(file || { url: src, name: name || "file" });
  const image = isImageFile(file || { url: src, name });
  const pdf = !image && isPdfFile(file || { url: src, name });
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative max-h-[90vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg leading-none text-ink shadow"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {image ? (
          <img src={src} alt={name || ""} className="mx-auto max-h-[85vh] max-w-full rounded-lg bg-white object-contain" />
        ) : pdf && href ? (
          <iframe title={name || "Attachment"} src={href} className="h-[80vh] w-full rounded-lg bg-white" />
        ) : (
          <div className="rounded-lg bg-white px-6 py-8 text-center">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-800 underline">
                {name || "Open file"}
              </a>
            ) : (
              <p className="text-sm text-mute">{name || "Attachment"}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PreviewThumb({ src, name, className = "h-10 w-10" }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <button
        type="button"
        className={`${className} shrink-0 overflow-hidden rounded-md border border-line bg-paper`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        aria-label={name || "Preview"}
      >
        <img src={src} alt="" className="h-full w-full object-cover" />
      </button>
      {open ? <FilePreviewOverlay src={src} name={name} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export default function AttachmentLinks({ files, className = "mt-0.5 text-xs text-brand-700", label }) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState(null);
  if (!files?.length) return null;

  return (
    <div className={className}>
      <p>{label || t("uploadSpecForItem")}</p>
      <div className="mt-1 flex flex-col gap-1.5">
        {files.map((file, i) => {
          const href = openUrlForAttachment(file);
          const image = isImageFile(file) && file.url;
          return (
            <div key={`${file.name}-${i}`} className="flex min-w-0 items-center gap-2">
              {image ? (
                <button
                  type="button"
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-line bg-paper"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setPreview(file);
                  }}
                  aria-label={file.name || "Preview"}
                >
                  <img src={file.url} alt="" className="h-full w-full object-cover" />
                </button>
              ) : null}
              {href && !image ? (
                <button
                  type="button"
                  className="min-w-0 truncate text-left underline underline-offset-2 hover:text-brand-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setPreview(file);
                  }}
                >
                  {file.name}
                </button>
              ) : image ? (
                <button
                  type="button"
                  className="min-w-0 truncate text-left underline underline-offset-2 hover:text-brand-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setPreview(file);
                  }}
                >
                  {file.name}
                </button>
              ) : (
                <span className="min-w-0 truncate">{file.name}</span>
              )}
            </div>
          );
        })}
      </div>
      {preview ? (
        <FilePreviewOverlay src={preview.url} name={preview.name} file={preview} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  );
}
