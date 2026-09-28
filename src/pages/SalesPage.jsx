import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Seo, { breadcrumbJsonLd, orgJsonLd } from "../components/Seo";
import { useLanguage } from "../i18n";
import { allProductsTo, siteOrigin, withLocale } from "../lib/locale";
import { seoCopy } from "../lib/seoCopy";
import { addFromStorefront, getSalesProducts, searchProducts } from "../lib/store";

export default function SalesPage() {
  const { t, lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [catalogShown, setCatalogShown] = useState(24);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const products = useMemo(() => {
    const q = searchQuery.trim();
    const list = q ? searchProducts(q).filter((p) => p.sales) : getSalesProducts();
    return list;
  }, [searchQuery]);

  useEffect(() => {
    setCatalogShown(24);
  }, [searchQuery]);

  function handleAdd(productId, intent = "quote", qty) {
    const result = addFromStorefront(productId, intent, qty, lang);
    if (!result?.ok || intent === "quote-now") return;
    const product = products.find((p) => p.id === productId);
    setToast(
      t(intent === "buy" || intent === "buy-now" ? "addedBuyToRfq" : "addedQuoteToRfq", { name: product?.name || "item" })
    );
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo
        lang={lang}
        path={withLocale(lang, "/sales")}
        title={seoCopy(lang).salesTitle}
        description={seoCopy(lang).salesDesc}
        jsonLd={[
          orgJsonLd(siteOrigin()),
          breadcrumbJsonLd(siteOrigin(), [
            { name: "Mattex Marketplace", path: withLocale(lang, "/") },
            { name: t("sales"), path: withLocale(lang, "/sales") },
          ]),
        ]}
      />
      <SiteHeader />

      <section className="relative overflow-hidden bg-brand-800 text-white">
        <div
          className="absolute inset-0 opacity-25 bg-cover bg-center"
          style={{ backgroundImage: 'url("/assets/prod-mesh.webp")' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-800 via-brand-800/92 to-brand-800/70" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">{t("salesPreferred")}</p>
          <h1 className="reveal mt-2 font-display text-3xl sm:text-5xl font-semibold leading-tight max-w-3xl">
            {t("salesHeadline")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/70 leading-relaxed">{t("salesSupport")}</p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-2">{t("sales")}</p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-800">{t("salesProducts")}</h2>
            <p className="mt-2 text-sm text-mute">
              {products.length === 1 ? t("productLabelOne") : t("productsLabel", { n: products.length })}
            </p>
          </div>
          <label className="relative max-w-md w-full sm:w-80 block">
            <span className="sr-only">{t("search")}</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("navSearchPlaceholder")}
              className="field-input"
              autoComplete="off"
            />
          </label>
        </div>

        {products.length ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.slice(0, catalogShown).map((p) => (
                <ProductCard key={p.id} product={p} onAdd={handleAdd} />
              ))}
            </div>
            {catalogShown < products.length ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setCatalogShown((n) => n + 24)}
                  className="btn-soft !px-5 !py-2.5"
                >
                  {t("showMore")} ({products.length - catalogShown})
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="bg-white border border-line rounded-xl p-8 text-center">
            <p className="text-lg font-semibold text-brand-800">{t("salesNoMatches")}</p>
            <p className="mt-2 text-sm text-mute">{t("salesNoMatchesHint")}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-soft" onClick={() => setSearchQuery("")}>
                {t("clearFilters")}
              </button>
              <Link to={allProductsTo(lang)} className="btn-primary">
                {t("browseCatalog")}
              </Link>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
      {toast ? (
        <div
          className="fixed bottom-24 right-6 z-50 max-w-sm border border-brand-700 bg-charcoal text-white px-4 py-3 text-sm toast shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
