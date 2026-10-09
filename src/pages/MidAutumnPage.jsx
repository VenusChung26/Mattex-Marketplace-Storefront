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
import { bannerName, promoBanners, sectionTitle, sentenceOf, usePromo } from "../lib/promo";
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
        title={`${sectionTitle(promo, lang) || t("midAutumnTitle")} | Mattex Marketplace`}
        description={t("midAutumnLead")}
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
          title={sectionTitle(promo, lang) || t("midAutumnTitle")}
          sentence={sentenceOf(promo, lang)}
          banners={banners}
          activeId={active.id}
          onSelect={select}
          lang={lang}
          listLabel={t("promoPosterList")}
          heading="h1"
        >
          {offerProducts.length ? (
            <section className="mt-8 border-t border-line pt-6">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-semibold text-brand-800 sm:text-3xl">{t("promoProductsTitle")}</h2>
                  <p className="mt-1 truncate text-sm text-mute">{bannerName(active, lang)}</p>
                </div>
                <p className="shrink-0 text-sm text-mute">
                  {offerProducts.length === 1 ? t("productCountOne") : t("productsCount", { n: offerProducts.length })}
                </p>
              </div>
              <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {offerProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={handleAdd} />
                ))}
              </div>
            </section>
          ) : null}
        </PromoOfferLayout>
      ) : null}
      <SiteFooter />
    </div>
  );
}
