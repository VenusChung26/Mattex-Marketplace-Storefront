import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";
import { allProductsTo, withLocale } from "../lib/locale";
import { MATTEX_SITE_URL, WHATSAPP_DISPLAY, WHATSAPP_HREF } from "../lib/store";
import { SHOW_RFQ } from "../lib/flags";

export default function SiteFooter() {
  const { t, lang } = useLanguage();
  const lp = (path) => withLocale(lang, path);
  return (
    <footer id="contact" className="bg-charcoal text-white">
      <div className={`max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 gap-8 ${SHOW_RFQ ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <div className="col-span-2 md:col-span-1">
          <a
            href={MATTEX_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 text-white hover:opacity-90"
            title={t("footerMattexSite")}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
              <img src="/assets/mattex-logo.webp" alt="Mattex" className="h-10 w-10 object-contain" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-tight">Mattex</span>
              <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-brand-300">
                {t("footerMattexProduct")}
              </span>
            </span>
          </a>
          <p className="mt-3 text-sm font-semibold text-white">{t("brandName")}</p>
          <p className="mt-1.5 text-sm text-white/55 leading-relaxed max-w-[16rem]">{t("footerTagline")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40 mb-3">{t("footerCatalog")}</p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link to={{ pathname: lp("/"), search: "?green=1", hash: "products" }} className="hover:text-white">
                {t("greenProducts")}
              </Link>
            </li>
            <li>
              <Link to={lp("/#top")} className="hover:text-white">
                {t("top5")}
              </Link>
            </li>
            <li>
              <Link to={lp("/#suppliers")} className="hover:text-white">
                {t("suppliers")}
              </Link>
            </li>
            <li>
              <Link to={allProductsTo(lang)} className="hover:text-white">
                {t("allProducts")}
              </Link>
            </li>
            {SHOW_RFQ ? null : (
              <li>
                <Link to={lp("/rfq")} className="hover:text-white">
                  {t("rfqDraft")}
                </Link>
              </li>
            )}
          </ul>
        </div>
        {SHOW_RFQ ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40 mb-3">{t("footerQuotes")}</p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link to={lp("/rfq")} className="hover:text-white">
                {t("rfqDraft")}
              </Link>
            </li>
            <li>
              <Link to={lp("/rfqs")} className="hover:text-white">
                {t("myRfqs")}
              </Link>
            </li>
          </ul>
        </div>
        ) : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40 mb-3">{t("footerContact")}</p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>sales@mattex.com.hk</li>
            <li>
              <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {t("whatsapp")} {WHATSAPP_DISPLAY}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-white/40">
          <p>© 2026 Mattex Marketplace</p>
          <p>React · Supabase catalog &amp; cart</p>
        </div>
      </div>
    </footer>
  );
}
