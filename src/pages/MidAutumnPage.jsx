import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import PromoOfferLayout from "../components/PromoOfferLayout";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Seo, { breadcrumbJsonLd } from "../components/Seo";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { bannerProductOffers } from "../lib/offer";
import { siteOrigin, withLocale } from "../lib/locale";
import { bannerName, bannerSentence, promoBanners, usePromo } from "../lib/promo";
import { addFromStorefront, getProduct } from "../lib/store";

export default function MidAutumnPage() {
  const { t, lang } = useLanguage();
  const { catalogEpoch } = useStore();
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
  const offerProducts = useMemo(() => {
    if (!active) return [];
    return bannerProductOffers(active)
      .map((row) => getProduct(row.productId))
      .filter(Boolean);
  }, [active, catalogEpoch]);

  function handleAdd(productId, intent = "quote", qty) {
    addFromStorefront(productId, intent, qty, lang);
  }

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
        title={`${bannerName(active, lang) || t("midAutumnTitle")} | Mattex Marketplace`}
        description={bannerSentence(active, promo, lang) || t("midAutumnLead")}
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
          title={bannerName(active, lang) || t("midAutumnTitle")}
          sentence={bannerSentence(active, promo, lang)}
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
      {offerProducts.length ? (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {offerProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={handleAdd} />
            ))}
          </div>
        </section>
      ) : null}
      <SiteFooter />
    </div>
  );
}
