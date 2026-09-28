/**
 * PROTOTYPE — Subbie landing website UI variants on /?variant=
 * Question: What should the storefront website look like for construction buyers?
 * A Editorial story · B Catalog desk · C Supplier market
 */
import { Link } from "react-router-dom";
import ProductCard from "../../components/ProductCard";
import SupplierLogo from "../../components/SupplierLogo";
import SiteFooter from "../../components/SiteFooter";
import CategoryMultiSelect, { SelectedCategoryChips } from "../../components/CategoryMultiSelect";
import { getGreenProducts, supplierPath } from "../../lib/store";

export const HOME_PROTOTYPE_VARIANTS = [
  { key: "A", name: "Editorial story" },
  { key: "B", name: "Catalog desk" },
  { key: "C", name: "Supplier market" },
];

/** Variant B — search & catalog first (procurement tool) */
export function HomeVariantB({
  categories,
  products,
  top,
  searchQuery,
  setSearchQuery,
  selectedCategories,
  setSelectedCategories,
  greenOnly,
  setGreenOnly,
  clearFilters,
  hasFilters,
  handleAdd,
  selectCategory,
}) {
  return (
    <div className="pt-[7.25rem] min-h-screen bg-paper pb-24">
      <section className="bg-charcoal text-white">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
          <p className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">Subbie</p>
          <p className="mt-2 text-white/65 max-w-xl text-sm sm:text-base">
            Spec search first. Build an RFQ from matching SKUs.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <input
              id="catalog-search"
              type="search"
              value={searchQuery}
              onChange={(e) => {
                const v = e.target.value;
                setSearchQuery(v);
                setGreenOnly(/\bgreen\b/i.test(v));
              }}
              placeholder="Search SKU, material, spec…"
              className="field-input flex-1 !bg-white !text-ink"
              autoComplete="off"
            />
            <CategoryMultiSelect
              categories={categories}
              selected={selectedCategories}
              onChange={(names) => {
                setGreenOnly(false);
                setSelectedCategories(names);
              }}
            />
          </div>
          {selectedCategories.length ? (
            <div className="mt-3">
              <SelectedCategoryChips
                selected={selectedCategories}
                onChange={(names) => {
                  setGreenOnly(false);
                  setSelectedCategories(names);
                }}
                tone="dark"
              />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.slice(0, 8).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCategory(c.name)}
                className={`text-xs font-semibold px-3 py-1.5 border transition-colors ${
                  selectedCategories.includes(c.name)
                    ? "bg-brand-400 text-charcoal border-brand-400"
                    : "border-white/25 text-white/80 hover:bg-white/10"
                }`}
              >
                {c.name.split(",")[0]}
              </button>
            ))}
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="text-xs font-semibold text-brand-200 hover:text-white px-2">
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section id="products" className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-end justify-between gap-3 mb-4">
          <h2 className="font-display text-2xl font-semibold text-brand-800">
            {products.length} result{products.length === 1 ? "" : "s"}
          </h2>
          <Link to="/rfq" className="text-sm font-semibold text-brand-600">
            Open RFQ Draft →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-mute py-10">No matches. Clear filters to see the full catalog.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={handleAdd} />
            ))}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-12">
        <h2 className="font-display text-xl font-semibold text-brand-800 mb-4">Quick picks</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {top.map((p) => (
            <ProductCard key={p.id} product={p} compact rank={p.featuredRank} onAdd={handleAdd} />
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

/** Variant C — supplier companies as the primary browse surface */
export function HomeVariantC({
  suppliers,
  suppliersExpanded,
  setSuppliersExpanded,
  visibleSuppliers,
  hiddenSupplierCount,
  greens,
  products,
  handleAdd,
  searchQuery,
  setSearchQuery,
}) {
  const preview = products.slice(0, 6);
  return (
    <div className="pt-[7.25rem] min-h-screen bg-paper pb-24">
      <section className="relative overflow-hidden bg-brand-800 text-white">
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{ backgroundImage: 'url("/assets/cat-steel.webp")' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-800/90 to-brand-800/50" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 py-14 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">Marketplace</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold max-w-2xl leading-tight">
            Subbie
          </h1>
          <p className="mt-4 text-white/70 max-w-lg">
            Start with the supplier company. Open their catalog, then RFQ the lines you need.
          </p>
        </div>
      </section>

      <section id="suppliers" className="max-w-7xl mx-auto px-4 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-3xl font-semibold text-brand-800">Supplier companies</h2>
            <p className="text-sm text-mute mt-1">{suppliers.length} partners on Subbie</p>
          </div>
          {hiddenSupplierCount > 0 ? (
            <button
              type="button"
              onClick={() => setSuppliersExpanded((v) => !v)}
              className="text-sm font-semibold text-brand-600"
            >
              {suppliersExpanded ? "Show less" : `Show more (${hiddenSupplierCount})`}
            </button>
          ) : null}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleSuppliers.map((s) => (
            <Link
              key={s.slug}
              to={supplierPath(s.name)}
              className="group relative overflow-hidden border border-line bg-white rounded-xl min-h-[9rem] p-4 flex flex-col"
            >
              <SupplierLogo name={s.name} className="h-12 w-12" />
              <span className="mt-auto pt-6">
                <span className="block font-semibold text-base leading-snug text-ink group-hover:text-brand-600 transition-colors">
                  {s.name}
                </span>
                <span className="block text-xs text-mute mt-1">
                  {s.count} products · {s.categories[0]}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section id="green" className="max-w-7xl mx-auto px-4 pt-12">
        <h2 className="font-display text-2xl font-semibold text-brand-800 mb-4">Green preferred</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {greens.map((p) => (
            <ProductCard key={p.id} product={p} compact onAdd={handleAdd} />
          ))}
        </div>
        <p className="mt-3 text-xs text-mute">
          Showing {greens.length} of {getGreenProducts().length} green SKUs
        </p>
      </section>

      <section id="products" className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between mb-5">
          <h2 className="font-display text-2xl font-semibold text-brand-800">Sample catalog</h2>
          <input
            id="catalog-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter sample…"
            className="field-input max-w-xs"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {preview.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={handleAdd} />
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
