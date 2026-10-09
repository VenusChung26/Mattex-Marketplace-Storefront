import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import { ProductSearchBox } from "../components/SearchSuggestions";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import CartToast from "../components/CartToast";
import Seo, { breadcrumbJsonLd, orgJsonLd } from "../components/Seo";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { catalogGroupIndex, collapseCatalog, useCatalogGroups } from "../lib/catalogGroups";
import { jumpToId } from "../lib/jumpTo";
import { allProductsTo, siteOrigin, withLocale } from "../lib/locale";
import { seoCopy } from "../lib/seoCopy";
import { addFromStorefront, getGreenProducts, searchProducts } from "../lib/store";

export default function GreenPage() {
  const { t, lang } = useLanguage();
  const { catalogEpoch, catalogLoading } = useStore();
  const groupEpoch = useCatalogGroups();
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [catalogShown, setCatalogShown] = useState(24);

  const suggestPool = useMemo(() => getGreenProducts(), [catalogEpoch]);
  const products = useMemo(() => {
    const q = searchQuery.trim();
    const list = q ? searchProducts(q).filter((p) => p.green) : getGreenProducts();
    return collapseCatalog(list, catalogGroupIndex());
  }, [searchQuery, catalogEpoch, groupEpoch]);

  useEffect(() => {
    setCatalogShown(24);
  }, [searchQuery]);

  function handleAdd(productId, intent = "quote", qty) {
    const result = addFromStorefront(productId, intent, qty, lang);
    if (!result?.ok || intent === "quote-now" || intent === "buy-now") return;
    setToast({
      message: t(intent === "buy" ? "addedBuyToRfq" : "addedQuoteToRfq"),
      href: withLocale(lang, "/rfq"),
    });
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo
        lang={lang}
        path={withLocale(lang, "/green")}
        title={seoCopy(lang).greenTitle}
        description={seoCopy(lang).greenDesc}
        jsonLd={[
          orgJsonLd(siteOrigin()),
          breadcrumbJsonLd(siteOrigin(), [
            { name: "Mattex Marketplace", path: withLocale(lang, "/") },
            { name: t("green"), path: withLocale(lang, "/green") },
          ]),
        ]}
      />
      <SiteHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={(event, value) => {
          event?.preventDefault();
          setSearchQuery(value ?? "");
          jumpToId("catalog-results");
        }}
        suggestProducts={suggestPool}
      />

      <section className="relative overflow-hidden bg-brand-800 text-white">
        <div
          className="absolute inset-0 opacity-25 bg-cover bg-center"
          style={{ backgroundImage: 'url("/assets/cat-timber.webp")' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-800 via-brand-800/92 to-brand-800/70" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">{t("greenPreferred")}</p>
          <h1 className="reveal mt-2 font-display text-3xl sm:text-5xl font-semibold leading-tight max-w-3xl">
            {t("greenHeadline")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/70 leading-relaxed">{t("greenSupport")}</p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-2">{t("catalog")}</p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-800">{t("greenProducts")}</h2>
            <p className="mt-2 text-sm text-mute">
              {catalogLoading && !products.length
                ? t("loadingCatalog")
                : products.length === 1
                  ? t("productLabelOne")
                  : t("productsLabel", { n: products.length })}
            </p>
          </div>
          <label className="relative block w-full max-w-md sm:w-80">
            <span className="sr-only">{t("search")}</span>
            <ProductSearchBox
              value={searchQuery}
              onValue={setSearchQuery}
              onTerm={(term) => {
                setSearchQuery(term);
                jumpToId("catalog-results");
              }}
              onProduct={(product) => {
                setSearchQuery(product.name);
                jumpToId("catalog-results");
              }}
              products={suggestPool}
              placeholder={t("navSearchPlaceholder")}
              ariaLabel={t("search")}
              inputClassName="field-input w-full"
            />
          </label>
        </div>

        <div id="catalog-results">
        {catalogLoading && !products.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4" aria-busy="true">
            <ProductCardSkeleton count={6} />
          </div>
        ) : products.length ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {products.slice(0, catalogShown).map((entry) => (
                <ProductCard
                  key={entry.product.id}
                  product={entry.product}
                  grouped={entry.grouped}
                  title={entry.groupName}
                  onAdd={handleAdd}
                />
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
            <p className="text-lg font-semibold text-brand-800">{t("greenNoMatches")}</p>
            <p className="mt-2 text-sm text-mute">{t("greenNoMatchesHint")}</p>
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
        </div>
      </main>

      <SiteFooter />
      <CartToast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
