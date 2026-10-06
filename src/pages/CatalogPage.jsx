import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import CategorySideNav from "../components/CategorySideNav";
import CopyLinkButton from "../components/CopyLinkButton";
import ProductCard, { ProductCardSkeleton, ProductListRow } from "../components/ProductCard";
import CatalogViewToggle from "../components/CatalogViewToggle";
import SearchFieldsSelect from "../components/SearchFieldsSelect";
import Seo, { breadcrumbJsonLd, orgJsonLd } from "../components/Seo";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { catalogGroupIndex, collapseCatalog, useCatalogGroups } from "../lib/catalogGroups";
import { allProductsTo, siteOrigin, withLocale } from "../lib/locale";
import { categoryOgPath } from "../lib/ogImage";
import { seoCopy } from "../lib/seoCopy";
import {
  getCategoryByName,
  getCategoryBySlug,
  getEffectivePrice,
  isHitProduct,
  recommendProducts,
  searchProducts,
  addFromStorefront,
} from "../lib/store";
import SearchSuggestions from "../components/SearchSuggestions";

const CATALOG_BATCH = 24;
const CATALOG_VIEW_KEY = "subbie_catalog_view";

function readCatalogView() {
  try {
    return sessionStorage.getItem(CATALOG_VIEW_KEY) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

export default function CatalogPage() {
  const { t, lang } = useLanguage();
  const { catalogEpoch, catalogLoading } = useStore();
  const groupEpoch = useCatalogGroups();
  const { slug } = useParams();
  const [params] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => params.get("q") || "");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const [searchFields, setSearchFields] = useState([]);
  const [priceFilter, setPriceFilter] = useState("all");
  const [greenOnly, setGreenOnly] = useState(false);
  const [catalogView, setCatalogView] = useState(readCatalogView);
  const [toast, setToast] = useState("");
  const [catalogShown, setCatalogShown] = useState(CATALOG_BATCH);
  const origin = siteOrigin();
  const copy = seoCopy(lang);
  const category = slug ? getCategoryBySlug(slug) : null;
  const catQuery = params.get("cat") || "";
  const catFromQuery = !slug && catQuery ? getCategoryByName(catQuery) : null;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CATALOG_VIEW_KEY, catalogView);
    } catch {
      /* ignore */
    }
  }, [catalogView]);

  const suggestions = useMemo(() => {
    const text = searchQuery.trim();
    if (!text || !category) return [];
    return recommendProducts(text, category.name);
  }, [searchQuery, category, catalogEpoch]);

  const products = useMemo(() => {
    if (!category) return [];
    let list = searchProducts(searchQuery, category.name, { fields: searchFields });
    if (greenOnly) list = list.filter((p) => p.green);
    if (priceFilter === "unpriced") list = list.filter((p) => getEffectivePrice(p).displayPrice == null);
    if (priceFilter === "hot") list = list.filter((p) => isHitProduct(p));
    return collapseCatalog(list, catalogGroupIndex());
  }, [searchQuery, category, searchFields, priceFilter, greenOnly, catalogEpoch, groupEpoch]);

  useEffect(() => {
    setCatalogShown(CATALOG_BATCH);
  }, [searchQuery, category?.id, searchFields, priceFilter, greenOnly]);

  if (!slug && catFromQuery) {
    return <Navigate to={withLocale(lang, `/catalog/${catFromQuery.id}`)} replace />;
  }
  if (!slug || !category) {
    return <Navigate to={allProductsTo(lang)} replace />;
  }

  const path = withLocale(lang, `/catalog/${category.id}`);
  const crumbs = [
    { name: "Mattex Marketplace", path: withLocale(lang, "/") },
    { name: category.name, path },
  ];
  const hasFilters =
    Boolean(searchQuery.trim()) || priceFilter !== "all" || greenOnly || searchFields.length > 0;

  function handleAdd(productId, intent = "quote", qty) {
    const result = addFromStorefront(productId, intent, qty, lang);
    if (!result?.ok || intent === "quote-now") return;
    const entry = products.find((row) => row.product.id === productId);
    setToast(
      t(intent === "buy" || intent === "buy-now" ? "addedBuyToRfq" : "addedQuoteToRfq", { name: entry?.product.name || "item" })
    );
  }

  function clearFilters() {
    setSearchQuery("");
    setSearchFields([]);
    setPriceFilter("all");
    setGreenOnly(false);
  }

  function setCatalogViewMode(next) {
    setCatalogView(next === "list" ? "list" : "card");
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo
        lang={lang}
        path={path}
        title={copy.categoryTitle(category.name)}
        description={copy.categoryDesc(category.name)}
        image={categoryOgPath(category.id)}
        jsonLd={[orgJsonLd(origin), breadcrumbJsonLd(origin, crumbs)]}
      />
      <SiteHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={(event, value) => {
          event?.preventDefault();
          setSearchQuery(value ?? "");
        }}
      />
      <main className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 xl:w-60 shrink-0">
            <CategorySideNav activeSlug={category.id} offsetTop={88} />
          </aside>
          <div className="min-w-0 flex-1">
            <p id="catalog-top" className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-2">
              <Link to={allProductsTo(lang)} className="hover:text-brand-600">
                {t("allProductsTitle")}
              </Link>
              <span className="mx-2 text-line">/</span>
              <span>{category.name}</span>
            </p>
            <div className="mb-4 flex items-center gap-3">
              <h1 className="min-w-0 font-display text-2xl sm:text-3xl font-semibold text-brand-800">{category.name}</h1>
              <CopyLinkButton path={path} />
            </div>

            <div className="bg-white border border-line rounded-xl p-3 sm:p-3.5 mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex flex-1 min-w-0 border border-line bg-white">
                  <input
                    id="catalog-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSuggestOpen(Boolean(e.target.value.trim()));
                      setSuggestIndex(-1);
                    }}
                    onFocus={() => setSuggestOpen(Boolean(searchQuery.trim()))}
                    onBlur={() => setSuggestOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSuggestOpen(true);
                        setSuggestIndex((index) => Math.min(index + 1, suggestions.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSuggestIndex((index) => Math.max(index - 1, 0));
                      } else if (e.key === "Enter" && suggestIndex >= 0 && suggestions[suggestIndex]) {
                        e.preventDefault();
                        setSearchQuery(suggestions[suggestIndex].name);
                        setSuggestOpen(false);
                      } else if (e.key === "Escape") {
                        setSuggestOpen(false);
                      }
                    }}
                    placeholder={t("searchPlaceholder")}
                    className="field-input flex-1 !rounded-none !border-0 !shadow-none"
                    autoComplete="off"
                    aria-label={t("catalog")}
                    role="combobox"
                    aria-expanded={suggestOpen && suggestions.length > 0}
                  />
                  {suggestOpen ? (
                    <SearchSuggestions
                      query={searchQuery}
                      suggestions={suggestions}
                      activeIndex={suggestIndex}
                      onPick={(product) => {
                        setSearchQuery(product.name);
                        setSuggestOpen(false);
                      }}
                    />
                  ) : null}
                  <span className="w-px self-stretch my-2 bg-line" aria-hidden />
                  <SearchFieldsSelect selected={searchFields} onChange={setSearchFields} compact />
                </div>
                <CatalogViewToggle
                  value={catalogView}
                  onChange={setCatalogViewMode}
                  tone="light"
                  compact
                />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {[
                  ["all", t("priceFilterAll")],
                  ["unpriced", t("priceFilterUnpriced")],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPriceFilter(id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border ${
                      priceFilter === id
                        ? "bg-brand-50 text-brand-800 border-brand-600/35"
                        : "bg-white border-line text-mute hover:border-brand-600/50 hover:text-brand-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <span className="mx-1 hidden h-4 w-px bg-line sm:inline-block" aria-hidden />
                <button
                  type="button"
                  onClick={() => setGreenOnly((prev) => !prev)}
                  aria-pressed={greenOnly}
                  className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border ${
                    greenOnly
                      ? "bg-brand-50 text-brand-800 border-brand-600/35"
                      : "bg-white border-line text-mute hover:border-brand-600/50 hover:text-brand-800"
                  }`}
                >
                  {t("filterGreen")}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceFilter((prev) => (prev === "hot" ? "all" : "hot"))}
                  aria-pressed={priceFilter === "hot"}
                  className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border ${
                    priceFilter === "hot"
                      ? "bg-brand-50 text-brand-800 border-brand-600/35"
                      : "bg-white border-line text-mute hover:border-brand-600/50 hover:text-brand-800"
                  }`}
                >
                  {t("priceFilterHot")}
                </button>
              </div>
            </div>

            <div id="catalog-results" className="mb-4 flex items-end justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-2xl font-semibold text-brand-800">
                  {catalogLoading && !products.length
                    ? t("loadingCatalog")
                    : products.length === 1
                      ? t("productLabelOne")
                      : t("productsLabel", { n: products.length })}
                </h2>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {t("clearAll")}
                  </button>
                ) : null}
              </div>
            </div>
            {catalogLoading && !products.length ? (
              <div
                className={catalogView === "list" ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}
                aria-busy="true"
                aria-live="polite"
              >
                <ProductCardSkeleton count={6} />
              </div>
            ) : products.length ? (
              <>
                <div className={catalogView === "list" ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
                  {products.slice(0, catalogShown).map((entry) =>
                    catalogView === "list" ? (
                      <ProductListRow
                        key={entry.product.id}
                        product={entry.product}
                        grouped={entry.grouped}
                        title={entry.groupName}
                        onAdd={handleAdd}
                      />
                    ) : (
                      <ProductCard
                        key={entry.product.id}
                        product={entry.product}
                        grouped={entry.grouped}
                        title={entry.groupName}
                        onAdd={handleAdd}
                      />
                    )
                  )}
                </div>
                {catalogShown < products.length ? (
                  <div className="mt-6 flex justify-center">
                    <button type="button" onClick={() => setCatalogShown((n) => n + CATALOG_BATCH)} className="btn-soft !px-5 !py-2.5">
                      {t("showMore")} ({products.length - catalogShown})
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="bg-white border border-line rounded-xl p-8 text-center">
                <p className="text-lg font-semibold text-brand-800">{t("noProducts")}</p>
                <p className="mt-2 text-sm text-mute">{t("noProductsHint")}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {hasFilters ? (
                    <button type="button" onClick={clearFilters} className="btn-soft">
                      {t("clearFilters")}
                    </button>
                  ) : null}
                  <Link to={allProductsTo(lang)} className="btn-primary">
                    {t("allProductsTitle")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
      {toast ? (
        <div
          className="fixed bottom-44 right-6 z-50 max-w-sm border border-brand-700 bg-charcoal text-white px-4 py-3 text-sm toast shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
