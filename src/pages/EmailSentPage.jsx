import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import Seo from "../components/Seo";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { SHOW_RFQ } from "../lib/flags";
import { formatPrice, getRfq, getUser, saveRfq, supplierSlug } from "../lib/store";

function demoSupplierEmail(name) {
  const slug = supplierSlug(name) || "sales";
  return `quotes@${slug}.com`;
}

export default function EmailSentPage() {
  const { rfqId } = useParams();
  const { t, lang } = useLanguage();
  const stored = rfqId ? getRfq(decodeURIComponent(rfqId)) : null;
  const [rfq, setRfq] = useState(stored);
  const [remark, setRemark] = useState(stored?.emailRemark || stored?.note || "");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setRfq(stored);
    setRemark(stored?.emailRemark || stored?.note || "");
    setSent(false);
  }, [stored?.id]);

  const user = getUser();
  const fromEmail = user?.email || t("emailGuestFrom");
  const fromName = user?.name || user?.companyName || "";

  const suppliers = useMemo(() => {
    const names = (rfq?.lines || []).map((line) => line.supplier).filter(Boolean);
    return [...new Set(names)];
  }, [rfq?.lines]);

  const toEmails = suppliers.length
    ? suppliers.map(demoSupplierEmail).join(", ")
    : "quotes@subbie.partners";
  const greetingName = suppliers.length === 1 ? suppliers[0] : "";
  const isBuy = rfq?.askKind === "buy";

  if (!rfq) {
    return (
      <div className="bg-paper min-h-screen">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-white border border-line rounded-xl p-8 text-center">
            <h1 className="text-xl font-bold text-brand-800">{t("productNotFound")}</h1>
            <Link to={withLocale(lang, "/rfq")} className="btn-primary mt-5 inline-flex">
              {t("backToOrder")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  function sendDemo() {
    const next = { ...rfq, emailRemark: remark, note: remark };
    const result = saveRfq(next);
    if (result.ok) setRfq(result.rfq);
    setSent(true);
  }

  return (
    <div className="bg-[#e8eaed] min-h-screen">
      <Seo lang={lang} path={withLocale(lang, `/email-sent/${encodeURIComponent(rfq.id)}`)} title={`${t("emailComposeTitle")} | Mattex Marketplace`} description={t("emailComposeDemo")} noindex />
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
        <p className="text-xs font-semibold tracking-wide text-brand-600">{t("emailComposeDemo")}</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-brand-800">{t("emailComposeTitle")}</h1>
        <p className="mt-1 text-sm text-mute">{rfq.id}</p>

        <section className="mt-5 bg-white border border-[#dadce0] shadow-[0_1px_3px_rgba(60,64,67,0.2),0_4px_8px_3px_rgba(60,64,67,0.08)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#404040] text-white">
            <p className="text-sm font-medium">{t("emailComposeTitle")}</p>
            {sent ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#81c995]">{t("emailSentOk")}</span>
            ) : (
              <span className="text-[11px] text-white/55">{t("emailSavedInSubbie")}</span>
            )}
          </div>

          <div className="divide-y divide-[#e8eaed] text-sm">
            <div className="flex gap-3 px-4 py-2.5">
              <span className="w-16 shrink-0 pt-0.5 text-mute">{t("emailFrom")}</span>
              <span className="min-w-0 text-ink">
                {fromName ? `${fromName} <${fromEmail}>` : fromEmail}
              </span>
            </div>
            <div className="flex gap-3 px-4 py-2.5">
              <span className="w-16 shrink-0 pt-0.5 text-mute">{t("emailTo")}</span>
              <span className="min-w-0 text-ink break-all">{toEmails}</span>
            </div>
            <div className="flex gap-3 px-4 py-2.5">
              <span className="w-16 shrink-0 pt-0.5 text-mute">{t("emailSubject")}</span>
              <span className="min-w-0 font-semibold text-ink">
                {t(isBuy ? "emailSubjectBuy" : "emailSubjectQuote", { id: rfq.id })}
              </span>
            </div>
          </div>

          <div className="px-4 sm:px-5 py-5 text-[15px] leading-relaxed text-[#202124]">
            <p>
              {greetingName ? t("emailGreeting", { name: greetingName }) : t("emailGreetingAll")}
            </p>
            <p className="mt-4">{isBuy ? t("emailBodyBuy") : t("emailBodyQuote")}</p>

            <div className="mt-4 border border-[#dadce0] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#f8f9fa] text-[11px] uppercase tracking-wide text-mute">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">{t("emailColProduct")}</th>
                    <th className="text-left font-semibold px-3 py-2 hidden sm:table-cell">{t("sku")}</th>
                    <th className="text-right font-semibold px-3 py-2">{t("qty")}</th>
                    <th className="text-right font-semibold px-3 py-2">{t("setPartUnit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(rfq.lines || []).map((line) => (
                    <tr key={line.productId} className="border-t border-[#eceff1] align-top">
                      <td className="px-3 py-2.5">
                        <div className="flex gap-2.5 min-w-0">
                          {line.image ? (
                            <img src={line.image} alt="" className="h-11 w-11 shrink-0 object-cover bg-[#f1f3f4]" />
                          ) : null}
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{line.name}</span>
                            <span className="sm:hidden block text-xs text-mute mt-0.5">
                              {line.productNo || line.productId}
                            </span>
                            {line.custom ? (
                              <span className="block text-xs text-mute mt-0.5">{t("customItem")}</span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-mute hidden sm:table-cell whitespace-nowrap">
                        {line.productNo || line.productId}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{line.qty}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{line.custom && line.quotedUnitPrice == null ? formatPrice(null) : formatPrice(line.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="mt-5 block">
              <span className="block text-sm font-semibold text-ink">{t("emailSentRemark")}</span>
              <textarea
                value={remark}
                onChange={(e) => {
                  setRemark(e.target.value);
                  setSent(false);
                }}
                rows={3}
                placeholder={t("emailSentRemarkHint")}
                className="mt-1.5 w-full resize-y border border-[#dadce0] px-3 py-2 text-sm text-ink placeholder:text-mute/70 focus:outline-none focus:border-brand-600"
              />
            </label>

            <p className="mt-6">{t("emailSignOff")}</p>
            <p className="mt-1 font-medium">{fromName || fromEmail}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[#e8eaed] bg-[#f8f9fa]">
            <button
              type="button"
              className="btn-primary !px-5 !py-2"
              onClick={sendDemo}
              disabled={sent}
            >
              {sent ? t("emailSentOk") : t("emailSend")}
            </button>
            <Link to={withLocale(lang, "/rfq")} className="btn-soft !px-4 !py-2">
              {t("backToOrder")}
            </Link>
            {SHOW_RFQ ? (
            <Link to={withLocale(lang, "/rfqs")} className="text-sm font-semibold text-brand-700 hover:text-brand-800 px-2">
              {t("myRfqs")}
            </Link>
            ) : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
