import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Seo from "../components/Seo";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { buildQuotePdf, downloadBlob } from "../lib/quotePdf";
import { formatPrice, getGuestQuoteSnapshot, pullQuoteSnapshots, snapshotQuotePdfItems } from "../lib/store";

export default function PublicQuotePage() {
  const { token } = useParams();
  const { t, lang } = useLanguage();
  useStore();
  const [ready, setReady] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const snapshot = getGuestQuoteSnapshot(decodeURIComponent(token || ""));

  useEffect(() => {
    let cancelled = false;
    pullQuoteSnapshots()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function downloadFrozenPdf() {
    if (!snapshot) return;
    setPdfBusy(true);
    try {
      const pdf = await buildQuotePdf({
        kind: snapshot.askKind === "buy" ? "buy" : "quote",
        items: snapshotQuotePdfItems(snapshot),
        refNo: snapshot.rfqId,
      });
      downloadBlob(pdf.blob, pdf.filename);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo
        lang={lang}
        path={withLocale(lang, `/quote/${encodeURIComponent(token || "")}`)}
        title={`${t("publicQuoteTitle")} | Mattex Marketplace`}
        description={t("publicQuoteHint")}
        noindex
      />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link to={withLocale(lang, "/")} className="inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-line bg-white">
              <img src="/assets/mattex-logo.webp" alt="Mattex" className="h-7 w-7 object-contain" />
            </span>
            <span className="text-sm font-semibold text-brand-800">Mattex Marketplace</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">
        {!ready && !snapshot ? (
          <p className="text-sm text-mute">{t("publicQuoteLoading")}</p>
        ) : !snapshot ? (
          <div className="rounded-xl border border-line bg-white p-5">
            <h1 className="text-lg font-bold text-brand-800">{t("publicQuoteMissing")}</h1>
            <p className="mt-2 text-sm text-mute">{t("publicQuoteMissingHint")}</p>
          </div>
        ) : (
          <article className="rounded-xl border border-line bg-white p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">{t("publicQuoteTitle")}</p>
            <h1 className="mt-1 text-2xl font-bold text-brand-800">{snapshot.rfqId}</h1>
            <p className="mt-1 text-sm text-mute">{t("publicQuoteHint")}</p>
            {snapshot.responseDate ? (
              <p className="mt-3 text-sm text-ink">
                <span className="text-mute">{t("quotationDeadlineLabel")}</span> {snapshot.responseDate}
              </p>
            ) : null}

            <ul className="mt-4 divide-y divide-line border-y border-line">
              {(snapshot.lines || []).map((line, index) => {
                const unit = line.noOffer ? null : line.quotedUnitPrice;
                return (
                  <li key={`${line.productId || index}`} className="flex items-start justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{line.name || "—"}</span>
                      {line.productNo ? <span className="mt-0.5 block text-xs text-mute">{line.productNo}</span> : null}
                      <span className="mt-0.5 block text-xs text-mute">
                        × {line.qty}
                        {line.unit ? ` ${line.unit}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {line.noOffer ? (
                        <span className="text-sm text-mute">{t("publicQuoteNoOffer")}</span>
                      ) : unit == null ? (
                        <span className="text-sm text-mute">{formatPrice(null)}</span>
                      ) : (
                        <>
                          <span className="block text-xs text-mute">{formatPrice(unit)}</span>
                          <span className="text-sm font-semibold tabular-nums text-brand-800">{formatPrice(line.lineTotal)}</span>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-sm text-mute">{t("quotedTotalLabel")}</p>
              <p className="text-lg font-bold tabular-nums text-brand-800">{formatPrice(snapshot.quotedSubtotal)}</p>
            </div>

            <button
              type="button"
              className="btn-primary mt-5 w-full !py-3 disabled:opacity-60"
              disabled={pdfBusy}
              onClick={downloadFrozenPdf}
            >
              {pdfBusy ? t("publicQuoteBuildingPdf") : t("downloadQuotePdf")}
            </button>
          </article>
        )}
      </main>
    </div>
  );
}
