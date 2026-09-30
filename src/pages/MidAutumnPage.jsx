import { Navigate, useSearchParams } from "react-router-dom";
import PromoOfferLayout from "../components/PromoOfferLayout";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Seo, { breadcrumbJsonLd } from "../components/Seo";
import { useLanguage } from "../i18n";
import { siteOrigin, withLocale } from "../lib/locale";
import { promoBanners, sentenceOf, usePromo } from "../lib/promo";

export default function MidAutumnPage() {
  const { t, lang } = useLanguage();
  const { promo, ready, live } = usePromo();
  const [params, setParams] = useSearchParams();
  const path = withLocale(lang, "/promo");
  const banners = promoBanners(promo);
  const requested = params.get("banner") || "";
  const found = banners.findIndex((banner) => banner.id === requested);
  const index = found >= 0 ? found : 0;
  const active = banners[index] || null;
  const total = banners.length;
  const ask = `https://wa.me/85256013989?text=${encodeURIComponent(t("midAutumnTitle"))}`;

  function select(id) {
    const next = new URLSearchParams(params);
    next.set("banner", id);
    setParams(next, { replace: true });
  }

  if (ready && !live) return <Navigate to={withLocale(lang, "/")} replace />;

  return (
    <div className="bg-paper min-h-screen text-ink">
      <Seo
        lang={lang}
        path={path}
        title={`${t("midAutumnTitle")} | Mattex Marketplace`}
        description={sentenceOf(promo, lang) || t("midAutumnLead")}
        jsonLd={[
          breadcrumbJsonLd(siteOrigin(), [
            { name: "Mattex Marketplace", path: withLocale(lang, "/") },
            { name: t("midAutumnTitle"), path },
          ]),
        ]}
      />
      <SiteHeader />
      {active ? (
        <PromoOfferLayout
          title={t("midAutumnTitle")}
          sentence={sentenceOf(promo, lang)}
          banners={banners}
          activeId={active.id}
          onSelect={select}
          lang={lang}
          askLabel={t("midAutumnAsk")}
          browseLabel={t("browseCatalog")}
          askHref={ask}
          browseTo={withLocale(lang, "/")}
          remaining={total > 1 ? t("promoRemaining", { n: total - index - 1 }) : ""}
          heading="h1"
        />
      ) : null}
      <SiteFooter />
    </div>
  );
}
