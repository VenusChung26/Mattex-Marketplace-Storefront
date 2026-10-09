import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CategorySideNav from "../components/CategorySideNav";
import ProductCard, { FallbackImage, ProductCardSkeleton, ProductListRow } from "../components/ProductCard";
import SupplierLogo from "../components/SupplierLogo";
import CustomProductModal from "../components/CustomProductModal";
import CatalogViewToggle from "../components/CatalogViewToggle";
import SearchFieldsSelect from "../components/SearchFieldsSelect";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Seo, { breadcrumbJsonLd, orgJsonLd } from "../components/Seo";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { jumpToId } from "../lib/jumpTo";
import { siteOrigin, withLocale } from "../lib/locale";
import { landingBanners, OFFER_SECTION_HERO, sectionTitle, sentenceOf, usePromo } from "../lib/promo";
import { bannerProductOffers } from "../lib/offer";
import { collapseCatalog, catalogGroupIndex, useCatalogGroups } from "../lib/catalogGroups";
import { seoCopy } from "../lib/seoCopy";
import {
  addCustomLine,
  catalogPathForCategory,
  getCategoryByName,
  getCategoryBySlug,
  getCategoryDefs,
  getEffectivePrice,
  getProduct,
  getProductsByCategory,
  getGreenProducts,
  getSuppliers,
  getTopProducts,
  isHitProduct,
  requireBuyerAuth,
  addFromStorefront,
  searchProducts,
} from "../lib/store";
import CartToast from "../components/CartToast";
import { ProductSearchBox } from "../components/SearchSuggestions";

const CATEGORY_PREVIEW_COUNT = 8;
const SECTION_PREVIEW = 8;
const SUPPLIER_PREVIEW_COUNT = 9;
const CATALOG_BATCH = 24;
const CATALOG_VIEW_KEY = "subbie_catalog_view";

function fitColumns(count, width, minTile) {
  const n = Math.max(0, count);
  if (n <= 1) return 1;
  const gap = 16;
  return Math.max(1, Math.min(n, Math.floor((width + gap) / (minTile + gap))));
}

function pickFillColumns(count, width, { minTile, maxTile, target }) {
  const n = Math.max(0, count);
  if (n <= 1) return 1;
  const gap = 10;
  const maxCols = Math.max(1, Math.min(n, Math.floor((width + gap) / (minTile + gap))));
  const minCols = Math.max(1, Math.min(maxCols, Math.ceil((width + gap) / (maxTile + gap))));
  const good = [];
  for (let cols = maxCols; cols >= 1; cols -= 1) {
    const rem = n % cols;
    if (rem === 0 || rem > 2) good.push(cols);
  }
  const preferred = good.filter((cols) => cols >= minCols);
  const pool = preferred.length ? preferred : good;
  if (!pool.length) return 1;
  return pool.slice().sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || b - a)[0];
}

function useContentWidth() {
  const [viewport, setViewport] = useState(() => (typeof window === "undefined" ? 390 : window.innerWidth));
  useEffect(() => {
    const read = () => setViewport(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return Math.min(1280, Math.max(280, viewport)) - 32;
}

function PitchIcon({ name }) {
  const common = "h-4 w-4 shrink-0 text-brand-600";
  if (name === "spec") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h5M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      </svg>
    );
  }
  if (name === "cart") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h2l2.2 9.2a1 1 0 0 0 1 .8h7.6a1 1 0 0 0 1-.7L20 8H7" />
        <circle cx="10" cy="19" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="17" cy="19" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.14-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function readCatalogView() {
  try {
    return sessionStorage.getItem(CATALOG_VIEW_KEY) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

/**
 * Subbie storefront landing.
 */
export default function HomePage() {
  const { user, cartCount, catalogEpoch, catalogLoading } = useStore();
  const { t, lang } = useLanguage();
  const groupEpoch = useCatalogGroups();
  const { promo, live } = usePromo();
  const slides = useMemo(() => landingBanners(promo), [promo]);
  const offerBanner = slides[0] || null;
  const offerProducts = useMemo(() => {
    if (!offerBanner) return [];
    return bannerProductOffers(offerBanner)
      .map((row) => getProduct(row.productId))
      .filter(Boolean);
  }, [offerBanner, catalogEpoch]);
  const offerCards = offerProducts.slice(0, 4);
  const offerRest = Math.max(0, offerProducts.length - offerCards.length);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [customOpen, setCustomOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [navQuery, setNavQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState("all");
  const [catalogView, setCatalogView] = useState(readCatalogView);
  const [searchFields, setSearchFields] = useState([]);
  const [greenOnly, setGreenOnly] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [suppliersExpanded, setSuppliersExpanded] = useState(false);
  const [catalogShown, setCatalogShown] = useState(CATALOG_BATCH);
  const [catalogStuck, setCatalogStuck] = useState(false);
  const [catalogPinned, setCatalogPinned] = useState(false);
  const [navHeight, setNavHeight] = useState(64);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const holdCatalogPinRef = useRef(false);
  const jumpToResultsRef = useRef(false);
  const searchStuck = catalogStuck || catalogPinned;
  const origin = siteOrigin();
  const copy = seoCopy(lang);
  const homePath = withLocale(lang, "/");

  useEffect(() => {
    setNavQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CATALOG_VIEW_KEY, catalogView);
    } catch {
      /* ignore */
    }
  }, [catalogView]);

  useEffect(() => {
    const measureNav = () => {
      const nav = document.getElementById("siteNav");
      if (!nav) return;
      setNavHeight(Math.round(nav.getBoundingClientRect().height));
    };
    measureNav();
    window.addEventListener("resize", measureNav);
    return () => window.removeEventListener("resize", measureNav);
  }, [user, cartCount]);

  useEffect(() => {
    const bar = document.getElementById("catalog-toolbar");
    if (!bar || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => setToolbarHeight(Math.round(bar.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [searchStuck, catalogPinned]);

  useEffect(() => {
    const onScroll = () => {
      const section = document.getElementById("products");
      const nav = document.getElementById("siteNav");
      const bar = document.getElementById("catalog-toolbar");
      if (!section || !bar) return;
      const navH = nav ? Math.round(nav.getBoundingClientRect().height) : navHeight;
      if (navH !== navHeight) setNavHeight(navH);
      const rect = section.getBoundingClientRect();
      const barTop = bar.getBoundingClientRect().top;
      if (holdCatalogPinRef.current) {
        setCatalogStuck(true);
        if (barTop <= navH + 2) holdCatalogPinRef.current = false;
        return;
      }
      const stuck = barTop <= navH + 1 && rect.bottom > navH + 80;
      setCatalogStuck(stuck);
      if (rect.top > navH + 8) setCatalogPinned(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [navHeight]);

  const categories = useMemo(() => getCategoryDefs(), [catalogEpoch]);
  const visibleCategories = categoriesExpanded
    ? categories
    : categories.slice(0, CATEGORY_PREVIEW_COUNT);
  const top = useMemo(
    () => collapseCatalog(getTopProducts(), catalogGroupIndex()).slice(0, SECTION_PREVIEW),
    [catalogEpoch, groupEpoch]
  );
  const greens = useMemo(
    () => collapseCatalog(getGreenProducts(), catalogGroupIndex()).slice(0, SECTION_PREVIEW),
    [catalogEpoch, groupEpoch]
  );
  const suppliers = useMemo(() => getSuppliers(), [catalogEpoch]);
  const visibleSuppliers = suppliersExpanded
    ? suppliers
    : suppliers.slice(0, SUPPLIER_PREVIEW_COUNT);
  const hiddenSupplierCount = Math.max(suppliers.length - SUPPLIER_PREVIEW_COUNT, 0);
  const contentWidth = useContentWidth();
  const phone = contentWidth < 720;
  const categoryCols = phone
    ? 1
    : pickFillColumns(visibleCategories.length, contentWidth, { minTile: 132, maxTile: 210, target: 8 });
  const greenCols = phone ? 1 : fitColumns(greens.length, contentWidth, 260);
  const topCols = phone ? 1 : fitColumns(top.length, contentWidth, 260);

  const products = useMemo(() => {
    let list = searchProducts(searchQuery, selectedCategories, { fields: searchFields });
    if (greenOnly) list = list.filter((p) => p.green);
    if (priceFilter === "unpriced") list = list.filter((p) => getEffectivePrice(p).displayPrice == null);
    if (priceFilter === "hot") list = list.filter((p) => isHitProduct(p));
    return collapseCatalog(list, catalogGroupIndex());
  }, [searchQuery, selectedCategories, greenOnly, priceFilter, searchFields, catalogEpoch, groupEpoch]);

  useEffect(() => {
    setCatalogShown(CATALOG_BATCH);
  }, [searchQuery, selectedCategories, greenOnly, priceFilter, searchFields]);

  useEffect(() => {
    if (!jumpToResultsRef.current) return;
    jumpToResultsRef.current = false;
    jumpToId("catalog-results");
  }, [selectedCategories, navHeight, toolbarHeight]);

  const visibleCatalog = products.slice(0, catalogShown);

  const hasFilters =
    greenOnly ||
    selectedCategories.length > 0 ||
    Boolean(searchQuery.trim()) ||
    priceFilter !== "all" ||
    searchFields.length > 0;

  useEffect(() => {
    if (params.get("custom") !== "1") return;
    setCustomOpen(true);
    const next = new URLSearchParams(params);
    next.delete("custom");
    const qs = next.toString();
    navigate({ pathname: withLocale(lang, "/"), search: qs ? `?${qs}` : "", hash: "products" }, { replace: true });
  }, [params, navigate]);

  function showToast(message) {
    setToast(message);
  }

  function openCustomProduct() {
    if (!requireBuyerAuth({ custom: true })) return;
    setCustomOpen(true);
  }

  function handleAddCustom(payload) {
    const result = addCustomLine(payload);
    if (!result.ok) return;
    showToast(t("addedCustomToRfq"));
  }

  function scrollToCatalog() {
    holdCatalogPinRef.current = true;
    setCatalogPinned(true);
    jumpToId("catalog-toolbar");
  }

  function openFilteredCatalog(kind) {
    setSelectedCategories([]);
    setSearchQuery("");
    setSearchFields([]);
    if (kind === "hot") {
      setGreenOnly(false);
      setPriceFilter("hot");
    } else {
      setPriceFilter("all");
      setGreenOnly(true);
    }
    scrollToCatalog();
  }

  const urlQ = params.get("q");
  const urlCat = params.get("cat");
  const urlFilter = params.get("filter");
  const urlGreen = params.get("green");
  useEffect(() => {
    if (urlCat) {
      const dest = catalogPathForCategory(urlCat);
      if (dest !== "/") {
        navigate(withLocale(lang, dest), { replace: true });
        return undefined;
      }
    }
    if (urlFilter) {
      const found = getCategoryBySlug(urlFilter) || getCategoryByName(urlFilter);
      if (found) setSelectedCategories([found.name]);
    }
    if (urlGreen === "1") {
      setGreenOnly(true);
      setPriceFilter("all");
      setSelectedCategories([]);
      setSearchQuery("");
      setSearchFields([]);
      const next = new URLSearchParams(params);
      next.delete("green");
      const qs = next.toString();
      navigate({ pathname: withLocale(lang, "/"), search: qs ? `?${qs}` : "", hash: "products" }, { replace: true });
      const timer = window.setTimeout(() => scrollToCatalog(), 80);
      return () => window.clearTimeout(timer);
    }
    if (!urlQ) return undefined;
    setSearchQuery(urlQ);
    setNavQuery(urlQ);
    setGreenOnly(/\bgreen\b/i.test(urlQ));
    holdCatalogPinRef.current = true;
    setCatalogPinned(true);
    const timer = window.setTimeout(() => jumpToId("catalog-results"), 80);
    return () => window.clearTimeout(timer);
  }, [urlQ, urlCat, urlFilter, urlGreen, lang, navigate, params]);

  function handleAdd(productId, intent = "quote", qty) {
    const result = addFromStorefront(productId, intent, qty, lang);
    if (!result?.ok || intent === "quote-now" || intent === "buy-now") return;
    showToast({
      message: t(intent === "buy" ? "addedBuyToRfq" : "addedQuoteToRfq"),
      href: withLocale(lang, "/rfq"),
    });
  }

  function clearFilters() {
    setGreenOnly(false);
    setSearchQuery("");
    setSelectedCategories([]);
    setPriceFilter("all");
    setSearchFields([]);
  }

  function selectCategory(name, { scroll } = {}) {
    setSelectedCategories([name]);
    if (scroll ?? !catalogStuck) scrollToCatalog();
  }

  function onCartClick() {
    navigate(withLocale(lang, "/rfq"));
  }

  function setCatalogViewMode(next) {
    setCatalogView(next === "list" ? "list" : "card");
  }

  const suggestionsPool = useMemo(
    () => getProductsByCategory(selectedCategories),
    [selectedCategories, catalogEpoch]
  );

  function scrollToResults() {
    holdCatalogPinRef.current = true;
    setCatalogPinned(true);
    jumpToId("catalog-results");
  }

  function onCatalogQueryChange(value) {
    setSearchQuery(value);
    setGreenOnly(/\bgreen\b/i.test(value));
  }

  function runCatalogSearch(value) {
    onCatalogQueryChange(value);
    scrollToResults();
  }

  function openProduct(product) {
    runCatalogSearch(product.name);
  }

  function submitNavSearch(event, value) {
    event?.preventDefault();
    const next = value ?? navQuery;
    setSearchQuery(next);
    setNavQuery(next);
    setGreenOnly(/\bgreen\b/i.test(next));
    scrollToResults();
  }

  return (
    <>
      <Seo
        lang={lang}
        path={homePath}
        title={copy.homeTitle}
        description={copy.homeDesc}
        jsonLd={[
          orgJsonLd(origin),
          breadcrumbJsonLd(origin, [{ name: "Mattex Marketplace", path: homePath }]),
        ]}
      />
      <SiteHeader
        overlay
        searchValue={navQuery}
        onSearchChange={setNavQuery}
        onSearchSubmit={submitNavSearch}
        selectedCategories={selectedCategories}
        onSelectCategory={selectCategory}
        onClearFilters={() => {
          clearFilters();
          scrollToCatalog();
        }}
        onCatalogClick={scrollToCatalog}
        onDraftClick={onCartClick}
        suggestProducts={suggestionsPool}
      />

      <div className="hero-shell flex flex-col">
        <section className="flex-1 flex items-end">
          <div className="max-w-7xl mx-auto w-full px-4 pb-24 pt-32 sm:pb-28 sm:pt-36">
            <p className="reveal font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-none">
              {t("brandName")}
            </p>
            <h1 className="reveal reveal-delay mt-5 text-xl sm:text-2xl lg:text-[1.75rem] font-medium text-white/90 max-w-xl leading-snug">
              {t("heroHeadline")}
            </h1>
            <p className="reveal reveal-delay-2 mt-4 text-base sm:text-lg text-white/65 max-w-lg leading-relaxed">
              {t("heroSupport")}
            </p>
            <div className="reveal reveal-delay-2 mt-8 flex flex-wrap gap-3">
              <a
                href="#products"
                className="btn-primary !px-6 !py-3.5"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToCatalog();
                }}
              >
                {t("browseCatalog")}
              </a>
              <button type="button" className="btn-ghost !px-6 !py-3.5" onClick={openCustomProduct}>
                {t("customPitchCta")}
              </button>
              <Link to={withLocale(lang, "/rfq")} className="btn-ghost !px-6 !py-3.5">
                {t("openRfqDraft")}
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="sheet relative z-10">
        {live && offerBanner ? (
          <section className="max-w-7xl mx-auto px-4 pt-8 sm:pt-10">
            <div
              className="relative overflow-hidden border border-line bg-brand-800 max-sm:min-h-[200px]"
            >
              <Link
                to={`${withLocale(lang, "/promo")}?banner=${encodeURIComponent(offerBanner.id)}`}
                aria-label={sectionTitle(promo, lang) || t("midAutumnTitle")}
                className="absolute inset-0"
              >
                <img src={OFFER_SECTION_HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#143528_0%,#143528_58%,rgba(20,53,40,0)_84%)] sm:bg-[linear-gradient(90deg,#143528_0%,#143528_40%,rgba(20,53,40,0)_68%)]"
                  aria-hidden
                />
              </Link>
              <div className="pointer-events-none relative z-10 flex w-[62%] flex-col justify-center px-4 py-6 sm:w-[46%] sm:px-10 sm:py-8">
                <h2 className="font-display text-xl font-semibold leading-[1.12] tracking-tight text-white sm:text-3xl">
                  {sectionTitle(promo, lang) || t("midAutumnTitle")}
                </h2>
                {sentenceOf(promo, lang) ? (
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">{sentenceOf(promo, lang)}</p>
                ) : null}
              </div>
            </div>
            {offerCards.length ? (
              <div className="mt-6">
                <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {offerCards.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={handleAdd} />
                  ))}
                </div>
                {offerRest > 0 ? (
                  <Link
                    to={`${withLocale(lang, "/promo")}?banner=${encodeURIComponent(offerBanner.id)}`}
                    className="mt-3 flex items-center justify-center gap-2 border border-line bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:border-brand-700"
                  >
                    <span>{t("offerRemaining", { n: offerRest })}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
        <section id="categories" className="max-w-7xl mx-auto px-4 pt-9 sm:pt-11" style={{ scrollMarginTop: navHeight }}>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-1">{t("browse")}</p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-800">{t("materialCategories")}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setCategoriesExpanded((v) => !v)}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                {categoriesExpanded
                  ? t("showLess")
                  : `${t("showMore")} (${Math.max(categories.length - CATEGORY_PREVIEW_COUNT, 0)})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  scrollToCatalog();
                }}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                {t("allProducts")}
              </button>
            </div>
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${categoryCols}, minmax(0, 1fr))` }}>
            {visibleCategories.map((c) => (
              <Link
                key={c.id}
                to={withLocale(lang, catalogPathForCategory(c.name))}
                title={c.name}
                className="cat-tile group"
              >
                <FallbackImage src={c.image} fallback={c.imageFallback} alt="" loading="lazy" />
                <span className="cat-tile-body">
                  <span className="min-w-0 text-left text-[11px] sm:text-xs font-semibold text-white leading-snug line-clamp-2">
                    {c.name}
                  </span>
                  <span className="shrink-0 inline-flex h-5 min-w-[1.2rem] items-center justify-center bg-white/95 text-brand-800 text-[10px] font-bold px-1.5">
                    {catalogLoading ? "…" : c.count}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="green" className="max-w-7xl mx-auto px-4 pt-14 sm:pt-16" style={{ scrollMarginTop: navHeight }}>
          <div className="relative overflow-hidden bg-brand-800 text-white px-6 py-8 sm:px-9 sm:py-10 mb-7">
            <div
              className="absolute inset-0 opacity-25 bg-cover bg-center"
              style={{ backgroundImage: 'url("/assets/cat-timber.webp")' }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-800 via-brand-800/92 to-brand-800/70" aria-hidden />
            <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">{t("greenPreferred")}</p>
                <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold leading-tight">
                  {t("greenHeadline")}
                </h2>
                <p className="mt-3 text-sm sm:text-base text-white/70 leading-relaxed">
                  {t("greenSupport")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openFilteredCatalog("green")}
                className="inline-flex shrink-0 items-center bg-brand-400 px-5 py-3 text-sm font-semibold text-charcoal hover:bg-brand-200 transition-colors"
              >
                {t("shopAllGreen")}
              </button>
            </div>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${greenCols}, minmax(0, 1fr))` }}>
            {catalogLoading && !greens.length ? (
              <ProductCardSkeleton compact count={4} />
            ) : (
              greens.map((entry) => (
                <ProductCard
                  key={entry.product.id}
                  product={entry.product}
                  compact
                  grouped={entry.grouped}
                  title={entry.groupName}
                  onAdd={handleAdd}
                />
              ))
            )}
          </div>
        </section>

        <section id="top" className="max-w-7xl mx-auto px-4 pt-14 sm:pt-16" style={{ scrollMarginTop: navHeight }}>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-2">{t("featured")}</p>
              <h2 className="font-display text-3xl font-semibold text-brand-800">{t("topProducts")}</h2>
              <p className="mt-2 text-sm text-mute">{t("topLabelHint")}</p>
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              onClick={() => openFilteredCatalog("hot")}
            >
              {t("allHitProducts")} →
            </button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${topCols}, minmax(0, 1fr))` }}>
            {catalogLoading && !top.length ? (
              <ProductCardSkeleton compact count={4} />
            ) : (
              top.map((entry) => (
                <ProductCard
                  key={entry.product.id}
                  product={entry.product}
                  compact
                  rank={entry.product.featuredRank}
                  grouped={entry.grouped}
                  title={entry.groupName}
                  onAdd={handleAdd}
                />
              ))
            )}
          </div>
        </section>

        <section id="suppliers" className="max-w-7xl mx-auto px-4 pt-14 sm:pt-16" style={{ scrollMarginTop: navHeight }}>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-2">{t("partners")}</p>
              <h2 className="font-display text-3xl font-semibold text-brand-800">{t("supplierCompanies")}</h2>
              <p className="text-sm text-mute mt-2">{t("supplierSupport")}</p>
            </div>
            {hiddenSupplierCount > 0 ? (
              <button
                type="button"
                onClick={() => setSuppliersExpanded((v) => !v)}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700 shrink-0"
              >
                {suppliersExpanded ? t("showLess") : `${t("showMore")} (${hiddenSupplierCount})`}
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-1">
            {visibleSuppliers.map((s) => (
              <Link
                key={s.slug}
                to={withLocale(lang, `/supplier/${s.slug}`)}
                className="supplier-row group flex items-center gap-3 py-2.5 border-b border-line"
              >
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-brand-50">
                  <SupplierLogo name={s.name} className="h-12 w-12" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink group-hover:text-brand-600 truncate transition-colors">
                    {s.name}
                  </span>
                  <span className="block text-xs text-mute">
                    {s.count === 1 ? t("productCountOne") : t("productsCount", { n: s.count })}
                  </span>
                </span>
                <span className="text-brand-600 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </Link>
            ))}
          </div>
          {hiddenSupplierCount > 0 ? (
            <div className="mt-5 flex justify-center sm:hidden">
              <button
                type="button"
                onClick={() => setSuppliersExpanded((v) => !v)}
                className="btn-soft !px-5 !py-2.5"
              >
                {suppliersExpanded ? t("showLess") : `${t("showMore")} (${hiddenSupplierCount})`}
              </button>
            </div>
          ) : null}
        </section>

        <section id="support" className="mt-14 sm:mt-16 border-y border-line bg-white/70" style={{ scrollMarginTop: navHeight }}>
          <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
            <div className="mb-6 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-2">{t("howItWorks")}</p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-800">
                {t("howHeadline")}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              <div>
                <span className="step-num">1</span>
                <p className="mt-3 font-semibold text-ink">{t("step1Title")}</p>
                <p className="mt-1.5 text-sm text-mute leading-relaxed">
                  {t("step1Body")}
                </p>
              </div>
              <div>
                <span className="step-num">2</span>
                <p className="mt-3 font-semibold text-ink">{t("step2Title")}</p>
                <p className="mt-1.5 text-sm text-mute leading-relaxed">
                  {t("step2Body")}
                </p>
              </div>
              <div>
                <span className="step-num">3</span>
                <p className="mt-3 font-semibold text-ink">{t("step3Title")}</p>
                <p className="mt-1.5 text-sm text-mute leading-relaxed">
                  {t("step3Body")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="custom" className="max-w-7xl mx-auto px-4 pt-14 sm:pt-16" style={{ scrollMarginTop: navHeight }}>
          <div className="grid overflow-hidden border border-line bg-white lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
            <div className="relative flex flex-col justify-center bg-brand-50/70 px-6 py-10 sm:px-10 sm:py-12">
              <div className="absolute left-0 top-0 h-full w-1.5 bg-brand-400" aria-hidden />
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden />
                {t("customPitchEyebrow")}
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-brand-800 sm:text-4xl lg:whitespace-nowrap lg:text-[2.35rem]">
                {t("customPitchTitle")}
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-mute">
                {t("customPitchBody")}
              </p>
              <ul className="mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {[
                  ["spec", t("customPitchPoint1")],
                  ["cart", t("customPitchPoint2")],
                  ["wa", t("customPitchPoint3")],
                ].map(([icon, point]) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm font-medium text-ink">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-brand-100 bg-white">
                      <PitchIcon name={icon} />
                    </span>
                    <span className="leading-snug">{point}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-8 inline-flex self-start items-center justify-center gap-2 bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(36,90,65,0.22)] transition-colors hover:bg-brand-700"
                onClick={openCustomProduct}
              >
                {t("customPitchCta")}
                <span aria-hidden>→</span>
              </button>
            </div>
            <div
              className="min-h-[18rem] bg-cover bg-center bg-no-repeat lg:min-h-0"
              style={{ backgroundImage: 'url("/assets/prod-custom-rail.webp?v=2")' }}
              aria-hidden
            />
          </div>
        </section>

        {/* Catalog desk — sticky under header while browsing products */}
        <section
          id="products"
          className="pt-14 sm:pt-16"
          style={{ scrollMarginTop: navHeight }}
        >
          <div className="bg-charcoal text-white">
            <div className="max-w-7xl mx-auto px-4 pt-10 pb-5 sm:pt-12 sm:pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                {t("fullCatalog")}
              </p>
              <h2 className="mt-2 font-display text-4xl sm:text-5xl font-semibold tracking-tight">
                {t("allProductsTitle")}
              </h2>
              <p className="mt-2 text-white/65 max-w-xl text-sm sm:text-base">
                {t("searchHint")}
              </p>
            </div>
          </div>
          <div
            id="catalog-toolbar"
            className={`bg-charcoal text-white sticky z-30 ${
              searchStuck ? "shadow-[0_8px_20px_rgba(0,0,0,0.28)]" : ""
            }`}
            style={{ top: navHeight }}
          >
            <div className="max-w-7xl mx-auto px-4 py-2">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="relative flex min-w-[min(100%,18rem)] flex-1 bg-white">
                    <ProductSearchBox
                      id="catalog-search"
                      value={searchQuery}
                      onValue={onCatalogQueryChange}
                      onTerm={runCatalogSearch}
                      onSubmit={runCatalogSearch}
                      onProduct={openProduct}
                      products={suggestionsPool}
                      placeholder={t("searchPlaceholder")}
                      ariaLabel={t("catalog")}
                      className="min-w-0 flex-1"
                      inputClassName="field-input w-full flex-1 !rounded-none !border-0 !bg-transparent !py-2 !text-ink"
                    />
                  </div>
                  <SearchFieldsSelect
                    selected={searchFields}
                    onChange={(fields) => {
                      setSearchFields(fields);
                    }}
                    compact
                    className="w-max max-w-full shrink-0"
                  />
                  <CatalogViewToggle
                    value={catalogView}
                    onChange={setCatalogViewMode}
                    tone="dark"
                    compact
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    ["all", t("priceFilterAll")],
                    ["unpriced", t("priceFilterUnpriced")],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPriceFilter(id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border rounded-full ${
                        priceFilter === id
                          ? "bg-white text-charcoal border-white"
                          : "border-white/30 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="mx-1 hidden h-4 w-px bg-white/25 sm:inline-block" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setGreenOnly((prev) => !prev)}
                    aria-pressed={greenOnly}
                    className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border rounded-full ${
                      greenOnly
                        ? "bg-white text-charcoal border-white"
                        : "border-white/30 text-white/75 hover:bg-white/10"
                    }`}
                  >
                    {t("filterGreen")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceFilter((prev) => (prev === "hot" ? "all" : "hot"))}
                    aria-pressed={priceFilter === "hot"}
                    className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border rounded-full ${
                      priceFilter === "hot"
                        ? "bg-white text-charcoal border-white"
                        : "border-white/30 text-white/75 hover:bg-white/10"
                    }`}
                  >
                    {t("priceFilterHot")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex min-w-0 flex-col gap-8 lg:flex-row">
              <aside className="w-full min-w-0 max-w-full lg:w-56 lg:shrink-0 xl:w-60">
                <CategorySideNav
                  activeSlug={
                    selectedCategories.length === 1
                      ? getCategoryByName(selectedCategories[0])?.id || ""
                      : ""
                  }
                  offsetTop={navHeight + toolbarHeight}
                  filterMode
                  onSelectAll={() => {
                    jumpToResultsRef.current = true;
                    setCatalogPinned(true);
                    holdCatalogPinRef.current = true;
                    setSelectedCategories([]);
                  }}
                  onSelectCategory={(category) => {
                    jumpToResultsRef.current = true;
                    setCatalogPinned(true);
                    holdCatalogPinRef.current = true;
                    setSearchQuery("");
                    setNavQuery("");
                    setSelectedCategories([category.name]);
                  }}
                />
              </aside>
              <div className="min-w-0 flex-1">
            <div id="catalog-results" className="mb-4 flex items-end justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div>
                  {searchQuery.trim() ? (
                    <p className="mb-1 text-sm font-semibold text-brand-700">{t("searchFor", { q: searchQuery.trim() })}</p>
                  ) : null}
                  <h3 className="font-display text-2xl font-semibold text-brand-800">
                    {catalogLoading && !products.length
                      ? t("loadingCatalog")
                      : products.length === 1
                        ? t("productLabelOne")
                        : t("productsLabel", { n: products.length })}
                  </h3>
                </div>
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
              <Link to={withLocale(lang, "/rfq")} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                {t("openRfqDraft")} →
              </Link>
            </div>
            {catalogLoading && !products.length ? (
              <div
                className={catalogView === "list" ? "min-w-0 space-y-2" : "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"}
                aria-busy="true"
                aria-live="polite"
              >
                <ProductCardSkeleton count={6} />
              </div>
            ) : products.length === 0 ? (
              <div className="border border-dashed border-line bg-white/60 px-6 py-12 text-center">
                <p className="text-base font-semibold text-brand-800">{t("noProducts")}</p>
                <p className="mt-2 text-sm text-mute">{t("noProductsHint")}</p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={openCustomProduct} className="btn-primary !px-5">
                      + {t("noProductsCustomCta")}
                    </button>
                  <button type="button" onClick={clearFilters} className="btn-soft !px-5">
                    {t("clearFilters")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={catalogView === "list" ? "min-w-0 space-y-2" : "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"}>
                  {visibleCatalog.map((entry) =>
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
                    <button
                      type="button"
                      onClick={() => setCatalogShown((n) => n + CATALOG_BATCH)}
                      className="btn-soft !px-5 !py-2.5"
                    >
                      {t("showMore")} ({products.length - catalogShown})
                    </button>
                  </div>
                ) : null}
              </>
            )}
              </div>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>

      <CustomProductModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onSubmit={handleAddCustom}
      />
      <CartToast toast={toast} onDone={() => setToast(null)} />
    </>
  );
}
