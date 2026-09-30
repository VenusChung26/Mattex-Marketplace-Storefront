import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Seo from "../components/Seo";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { uploadSpecFile } from "../lib/rfqBlob";
import { addSpecMatchLines } from "../lib/store";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg,image/webp,image/gif";

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file"));
    reader.readAsDataURL(file);
  });
}

export default function SpecMatchPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  const closed = status != null && status.open === false;
  const limited = status?.member !== true && Number(status?.remaining) === 0;

  async function onMatch(event) {
    event.preventDefault();
    if (!file || closed || limited) return;
    setBusy(true);
    setError("");
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
        setLines([]);
        setError(data?.error === "limit" ? t("specMatchLimit") : data?.error === "closed" ? t("specMatchClosed") : t("specMatchEmpty"));
        return;
      }
      setLines(Array.isArray(data.lines) ? data.lines : []);
    } catch {
      setError(t("specMatchEmpty"));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    const picked = lines.filter((line) => line.checked);
    if (!picked.length) {
      setError(t("specMatchEmpty"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const url = await uploadSpecFile(file);
      addSpecMatchLines({ lines: picked, specFile: { name: file.name, url } });
      navigate(withLocale(lang, "/rfq"));
    } catch {
      setError(t("specMatchEmpty"));
      setBusy(false);
    }
  }

  function patchLine(index, patch) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo lang={lang} path={withLocale(lang, "/spec-match")} title={`${t("specMatchTitle")} | Mattex Marketplace`} description={t("specMatchHint")} noindex />
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold text-brand-800">{t("specMatchTitle")}</h1>
        <p className="mt-2 text-sm text-mute max-w-2xl">{t("specMatchHint")}</p>
        {status?.member !== true && status?.remaining != null ? (
          <p className="mt-2 text-sm text-ink">{t("specMatchRemaining", { n: status.remaining })}</p>
        ) : null}
        {closed ? <p className="mt-6 text-lg font-semibold text-ink">{t("specMatchClosed")}</p> : null}
        {limited && !closed ? <p className="mt-6 text-sm font-semibold text-ink">{t("specMatchLimit")}</p> : null}
        <form className="mt-6 flex flex-wrap items-center gap-3" onSubmit={onMatch}>
          <label className="text-sm font-medium text-ink">
            {t("specMatchFile")}
            <input
              className="mt-1 block text-sm"
              type="file"
              accept={ACCEPT}
              disabled={closed || limited || busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setLines([]);
                setError("");
              }}
            />
          </label>
          <button type="submit" className="btn-primary !px-4 !py-2" disabled={!file || closed || limited || busy}>
            {t("specMatchRun")}
          </button>
        </form>
        {error ? <p className="mt-4 text-sm text-[#8a2b2b]">{error}</p> : null}
        {lines.length ? (
          <>
            <div className="mt-8 overflow-x-auto border border-line bg-white">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase tracking-wide text-mute">
                  <tr>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">{t("specMatchProduct")}</th>
                    <th className="px-3 py-2">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`${line.kind}-${line.productId}-${index}`} className="border-t border-line">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(line.checked)}
                          onChange={(event) => patchLine(index, { checked: event.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                          {line.kind === "suggest" ? t("specMatchSuggest") : line.kind === "tailor" ? t("specMatchTailor") : t("specMatchProduct")}
                        </p>
                        <p className="font-medium text-ink">{line.name}</p>
                        {line.spec ? <p className="text-mute">{line.spec}</p> : null}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-20 border border-line px-2 py-1"
                          type="number"
                          min="1"
                          value={line.qty}
                          onChange={(event) => patchLine(index, { qty: event.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn-primary mt-4 !px-4 !py-2" disabled={busy} onClick={onConfirm}>
              {t("specMatchConfirm")}
            </button>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
