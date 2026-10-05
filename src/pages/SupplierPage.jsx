import { useEffect, useId, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import SupplierLogo from "../components/SupplierLogo";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import Seo, { breadcrumbJsonLd, orgJsonLd } from "../components/Seo";
import { useLanguage } from "../i18n";
import { allProductsTo, siteOrigin, withLocale } from "../lib/locale";
import { seoCopy } from "../lib/seoCopy";
import { SHOW_RFQ } from "../lib/flags";
import {
  addFromStorefront,
  getEffectivePrice,
  getProductsBySupplier,
  getSupplier,
  getTopProductsForSupplier,
  isHitProduct,
  searchSupplierProducts,
} from "../lib/store";

export default function SupplierPage() {
  const { slug } = useParams();
  const supplier = getSupplier(slug);
  const { t, lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceFilter, setPriceFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [greenOnly, setGreenOnly] = useState(false);
  const [toast, setToast] = useState("");
  const [catalogShown, setCatalogShown] = useState(24);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSearchQuery("");
    setSelectedCategory("");
    setPriceFilter("all");
    setStockFilter("all");
    setGreenOnly(false);
    setCatalogShown(24);
  }, [slug]);

  useEffect(() => {
    setCatalogShown(24);
  }, [searchQuery, selectedCategory, priceFilter, stockFilter, greenOnly]);

  const top = useMemo(
    () => (supplier ? getTopProductsForSupplier(supplier.slug) : []),
    [supplier]
  );
  const catalog = useMemo(
    () => (supplier ? getProductsBySupplier(supplier.slug) : []),
    [supplier]
  );
  const categoryCounts = useMemo(() => {
    const map = new Map();
    catalog.forEach((p) => {
      if (!p.category) return;
      map.set(p.category, (map.get(p.category) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog]);
  const searched = useMemo(
    () => (supplier ? searchSupplierProducts(supplier.slug, searchQuery) : []),
    [supplier, searchQuery]
  );
  const products = useMemo(() => {
    let list = selectedCategory
      ? searched.filter((p) => p.category === selectedCategory)
      : searched;
    if (greenOnly) list = list.filter((p) => p.green);
    if (priceFilter === "unpriced") list = list.filter((p) => getEffectivePrice(p).displayPrice == null);
    if (priceFilter === "hot") list = list.filter((p) => isHitProduct(p));
    if (stockFilter !== "all") list = list.filter((p) => p.stockStatus === stockFilter);
    return list;
  }, [searched, selectedCategory, greenOnly, priceFilter, stockFilter]);

  if (!supplier) {
    return (
      <div className="bg-paper min-h-screen">
        <SiteHeader />
        <main className="max-w-7xl mx-auto px-4 py-10">
          <div className="bg-white border border-line rounded-xl p-8 text-center">
            <h1 className="reveal text-xl font-bold text-brand-800">{t("supplierNotFound")}</h1>
            <p className="mt-2 text-sm text-mute">{t("supplierNotFoundHint")}</p>
            <Link to={allProductsTo(lang)} className="btn-primary mt-5 inline-flex">
              {t("browseCatalog")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  function handleAdd(productId, intent = "quote", qty) {
    const result = addFromStorefront(productId, intent, qty, lang);
    if (!result?.ok || intent === "quote-now") return;
    const product =
      products.find((p) => p.id === productId) ||
      catalog.find((p) => p.id === productId) ||
      top.find((p) => p.id === productId);
    setToast(
      t(intent === "buy" || intent === "buy-now" ? "addedBuyToRfq" : "addedQuoteToRfq", { name: product?.name || "item" })
    );
  }

  const cats = `${supplier.categories.slice(0, 3).join(", ")}${
    supplier.categories.length > 3 ? t("andMore") : ""
  }`;

  return (
    <div className="bg-paper min-h-screen">
      <Seo
        lang={lang}
        path={withLocale(lang, `/supplier/${supplier.slug}`)}
        title={seoCopy(lang).supplierTitle(supplier.name)}
        description={seoCopy(lang).supplierDesc(supplier.name)}
        image="/og-default.webp"
        jsonLd={[
          orgJsonLd(siteOrigin()),
          breadcrumbJsonLd(siteOrigin(), [
            { name: "Mattex Marketplace", path: withLocale(lang, "/") },
            { name: supplier.name, path: withLocale(lang, `/supplier/${supplier.slug}`) },
          ]),
        ]}
      />
      <SiteHeader />

      <section className="relative overflow-hidden bg-charcoal text-white min-h-[42vh] flex items-end">
        <div
          className="absolute inset-0 opacity-40 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url(${supplier.image})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/88 to-charcoal/45" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 py-14 sm:py-20 w-full">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">
            {t("supplierLabel")}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <SupplierLogo name={supplier.name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg ring-1 ring-white/20" />
            <h1 className="reveal font-display text-4xl sm:text-5xl font-semibold leading-tight max-w-3xl">
              {supplier.name}
            </h1>
          </div>
          <p className="mt-4 text-sm sm:text-base text-white/70 max-w-xl leading-relaxed">
            {supplier.count === 1
              ? t("supplierHeroMetaOne", { cats })
              : t("supplierHeroMeta", { count: supplier.count, cats })}
          </p>
        </div>
      </section>

      <main>
        <section className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
          <SupplierMetrics metrics={supplier.metrics} t={t} />
        </section>

        {top.length ? (
        <section className="max-w-7xl mx-auto px-4 pt-10 sm:pt-12">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-2">
              {t("featured")}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-800">
              {t("topProducts")}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {top.map((p) => (
              <ProductCard key={p.id} product={p} compact rank={p.featuredRank} onAdd={handleAdd} />
            ))}
          </div>
        </section>
        ) : null}

        <section id="supplier-products" className="max-w-7xl mx-auto px-4 py-12 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mute mb-2">
                {t("catalog")}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-800">
                {t("productsFromSupplier", { name: supplier.name })}
              </h2>
              <p className="text-sm text-mute mt-2">{t("supplierSearchHint")}</p>
            </div>
            <p className="text-sm text-mute">
              {products.length === 1
                ? t("productLabelOne")
                : t("productsLabel", { n: products.length })}
            </p>
          </div>

          <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-8 lg:items-start">
            <SupplierCategoryMenu
              t={t}
              total={catalog.length}
              counts={categoryCounts}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />

            <div className="min-w-0 mt-6 lg:mt-0">
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 mb-6">
                <label className="relative block flex-1 min-w-0">
                  <span className="sr-only">{t("catalog")}</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("supplierSearchPlaceholder")}
                    className="field-input"
                    autoComplete="off"
                  />
                </label>
                <label className="relative sm:w-[11rem] shrink-0">
                  <span className="sr-only">{t("stockStatus")}</span>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="field-input"
                  >
                    <option value="all">{t("filterAllStock")}</option>
                    <option value="in_stock">{t("stockInStock")}</option>
                    <option value="limited">{t("stockLimited")}</option>
                    <option value="made_to_order">{t("stockMadeToOrder")}</option>
                    <option value="out_of_stock">{t("stockOutOfStock")}</option>
                  </select>
                </label>
                <label className="relative sm:w-[10.5rem] shrink-0">
                  <span className="sr-only">{t("priceFilterAll")}</span>
                  <select
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value)}
                    className="field-input"
                  >
                    <option value="all">{t("priceFilterAll")}</option>
                    <option value="unpriced">{t("priceFilterUnpriced")}</option>
                    <option value="hot">{t("priceFilterHot")}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setGreenOnly((v) => !v)}
                  aria-pressed={greenOnly}
                  className={`shrink-0 self-stretch px-4 text-sm font-semibold whitespace-nowrap border transition-colors ${
                    greenOnly
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-brand-800 border-line hover:border-brand-600/50"
                  }`}
                >
                  {t("filterGreen")}
                </button>
              </div>

              {products.length === 0 ? (
                <div className="border border-dashed border-line bg-white/60 rounded-xl px-6 py-10 text-center">
                  <p className="text-base font-semibold text-brand-800">{t("noSupplierMatches")}</p>
                  <p className="mt-2 text-sm text-mute">{t("noSupplierMatchesHint")}</p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCategory("");
                        setPriceFilter("all");
                        setStockFilter("all");
                        setGreenOnly(false);
                      }}
                      className="btn-soft !px-5"
                    >
                      {t("clearFilters")}
                    </button>
                    <Link to={allProductsTo(lang)} className="btn-primary !px-5">
                      {t("browseCatalog")}
                    </Link>
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>

      {toast ? (
        <div className="toast fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-charcoal text-white text-sm px-4 py-2.5 shadow-lg rounded-none">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SupplierCategoryMenu({ t, total, counts, selected, onSelect }) {
  const items = [{ name: "", label: t("allProducts"), count: total }, ...counts.map(([name, count]) => ({
    name,
    label: name,
    count,
  }))];

  return (
    <nav
      aria-label={t("categories")}
      className="lg:sticky lg:top-24 border border-line rounded-xl bg-white p-3 sm:p-4"
    >
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">
        {t("categories")}
      </p>
      <ul className="mt-3 flex gap-2 overflow-x-auto lg:block lg:overflow-visible lg:space-y-1">
        {items.map((item) => {
          const active = selected === item.name;
          return (
            <li key={item.name || "all"} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(item.name)}
                className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-ink hover:bg-brand-50"
                }`}
              >
                <span className="font-medium truncate">{item.label}</span>
                <span
                  className={`shrink-0 text-[11px] tabular-nums ${
                    active ? "text-white/80" : "text-mute"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function StarIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.6 14.7 8.4l6.4.7-4.8 4.3 1.3 6.3L12 16.7 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.6Z"
      />
    </svg>
  );
}

function Stars({ value, size = "h-5 w-5" }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.min(1, Math.max(0, value - (i - 1)));
        return (
          <span key={i} className={`relative ${size}`}>
            <StarIcon className="absolute inset-0 text-[#E2E8E4]" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <StarIcon className={`${size} text-[#4F8F6C]`} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function RateRing({ value }) {
  const uid = useId().replace(/:/g, "");
  const r = 36;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = c * (1 - clamped / 100);
  return (
    <div className="relative h-[6.25rem] w-[6.25rem]">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6BAF86" />
            <stop offset="100%" stopColor="#245A41" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={r} fill="#F3F8F5" />
        <circle cx="44" cy="44" r={r} fill="none" stroke="#E4EBE6" strokeWidth="6" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={`url(#ring-${uid})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="metric-ring"
          style={{ "--ring-circ": c }}
        />
      </svg>
      <p className="absolute inset-0 flex items-center justify-center font-display text-xl font-semibold text-ink">
        {value}%
      </p>
    </div>
  );
}

function formatCount(n) {
  const value = Number(n) || 0;
  if (value >= 1000) {
    const k = value / 1000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.2 16.2 21 21" strokeLinecap="round" />
    </svg>
  );
}

function FoundGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M4.5 19c.5-3 2.4-4.6 4.5-4.6S13 16 13.5 19" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M15.2 19c.4-2.3 1.8-3.5 3.3-3.5 1.2 0 2.2.7 2.7 2" strokeLinecap="round" />
    </svg>
  );
}

function RfqGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 3.5h7.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.6V8h4.4" />
      <path d="M8.5 12.5h7M8.5 16h5" strokeLinecap="round" />
    </svg>
  );
}

function CountStat({ value, label, icon, share }) {
  return (
    <div className="px-4 py-6 flex flex-col items-center text-center">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        {icon}
      </span>
      <p className="mt-3 font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-none tabular-nums text-ink">
        {formatCount(value)}
      </p>
      <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-mute">{label}</p>
      <div className="mt-3 h-1 w-16 overflow-hidden rounded-full bg-[#E8EEEA]">
        <div
          className="h-full rounded-full bg-[#4F8F6C]"
          style={{ width: `${Math.max(12, Math.round((share || 0) * 100))}%` }}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="h-px w-10 bg-line/90" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mute">{children}</p>
      <span className="h-px w-10 bg-line/90" />
    </div>
  );
}

function SupplierMetrics({ metrics, t }) {
  if (metrics?.empty) {
    return (
      <article className="relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-[0_18px_48px_rgba(16,21,19,0.18)]">
        <div className="relative px-6 py-10 text-center">
          <SectionLabel>{t("supplierScorecard")}</SectionLabel>
          <p className="mt-5 font-display text-3xl font-semibold text-ink">—</p>
          <p className="mt-2 text-sm text-mute">{t("noPerformanceData")}</p>
        </div>
      </article>
    );
  }
  const demandMax = Math.max(metrics.searchCount, metrics.foundCount, metrics.rfqCount, 1);
  return (
    <article className="relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-[0_18px_48px_rgba(16,21,19,0.18)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(720px_220px_at_50%_0%,rgba(36,90,65,0.08),transparent_58%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/80 to-transparent" />
      <div className="relative">
        <div className="pt-5 pb-1">
          <SectionLabel>{t("supplierScorecard")}</SectionLabel>
        </div>
        <div className="grid sm:grid-cols-3 px-2 pb-1">
          <div className="px-4 py-6 flex flex-col items-center text-center">
            <p className="flex items-baseline gap-1.5 font-display text-5xl font-semibold tracking-tight leading-none text-ink">
              {metrics.rating.toFixed(1)}
              <span className="font-sans text-sm font-medium tracking-normal text-mute">/5</span>
            </p>
            <div className="mt-3">
              <Stars value={metrics.rating} />
            </div>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-mute">
              {t("supplierRating")}
            </p>
          </div>
          <div className="px-4 py-6 flex flex-col items-center text-center sm:border-x sm:border-line/80">
            <RateRing value={metrics.completionRate} />
            <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-mute">
              {t("orderCompletionRate")}
            </p>
          </div>
          <div className="px-4 py-6 flex flex-col items-center text-center">
            <RateRing value={metrics.onTimeRate} />
            <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-mute">
              {t("onTimeCompletionRate")}
            </p>
          </div>
        </div>
        <div className="mx-4 border-t border-line/80">
          <div className="pt-4">
            <SectionLabel>{t("metricDemandHint")}</SectionLabel>
          </div>
          <div className={`grid ${SHOW_RFQ ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <CountStat
              value={metrics.searchCount}
              label={t("metricSearches")}
              icon={<SearchGlyph />}
              share={metrics.searchCount / demandMax}
            />
            <div className={SHOW_RFQ ? "sm:border-x sm:border-line/80" : "sm:border-l sm:border-line/80"}>
              <CountStat
                value={metrics.foundCount}
                label={t("metricFound")}
                icon={<FoundGlyph />}
                share={metrics.foundCount / demandMax}
              />
            </div>
            {SHOW_RFQ ? (
            <CountStat
              value={metrics.rfqCount}
              label={t("metricRfqsReceived")}
              icon={<RfqGlyph />}
              share={metrics.rfqCount / demandMax}
            />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
