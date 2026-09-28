import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AccountMenu from "./AccountMenu";
import AuthModal from "./AuthModal";
import LangToggle from "./LangToggle";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { stripLocale, withLocale } from "../lib/locale";
import { SHOW_RFQ } from "../lib/flags";
import { closeAuthModal, getCategoryByName, getCategoryDefs, logoutUser } from "../lib/store";

function CartIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h9.4a1.5 1.5 0 0 0 1.5-1.2L21.5 8H7" />
    </svg>
  );
}

function RfqsIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 4h7.5L20 8.5V20a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V5.5A1.5 1.5 0 0 1 8 4Z" />
      <path d="M15 4v5h5" />
      <path d="M10 13h6M10 16.5h4" />
    </svg>
  );
}

export default function SiteHeader({
  overlay = false,
  fluid = false,
  wide = false,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  selectedCategories = [],
  onSelectCategory,
  onClearFilters,
  onCatalogClick,
  onDraftClick,
} = {}) {
  const { user, cartCount, authModalOpen, catalogEpoch } = useStore();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const categories = useMemo(() => getCategoryDefs(), [catalogEpoch]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [navSolid, setNavSolid] = useState(!overlay);
  const [query, setQuery] = useState(searchValue || "");
  const isHome = stripLocale(location.pathname) === "/";
  const lp = (path) => withLocale(lang, path);

  useEffect(() => {
    if (searchValue != null) setQuery(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (!overlay) {
      setNavSolid(true);
      return undefined;
    }
    const onScroll = () => setNavSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const width = fluid ? "w-full max-w-none" : wide ? "max-w-[100rem]" : "max-w-7xl";
  const navLinks = [
    { to: lp("/green"), label: t("green") },
    { hash: "top", label: t("topProducts") },
    { hash: "suppliers", label: t("suppliers") },
    { hash: "support", label: t("howItWorks") },
    { to: { pathname: lp("/"), hash: "products" }, label: t("catalog"), allProducts: true },
  ];

  function closeMenu() {
    setMenuOpen(false);
  }

  function homeTo(hash = "", extra = {}) {
    const next = new URLSearchParams();
    if (isHome) {
      const variant = new URLSearchParams(location.search).get("variant");
      if (variant) next.set("variant", variant);
    }
    if (extra.q) next.set("q", extra.q);
    if (extra.cat) next.set("cat", extra.cat);
    const search = next.toString();
    return {
      pathname: lp("/"),
      search: search ? `?${search}` : "",
      hash,
    };
  }

  function catalogTo(extra = {}) {
    const cat = extra.cat ? getCategoryByName(extra.cat) : null;
    const next = new URLSearchParams();
    if (extra.q) next.set("q", extra.q);
    const search = next.toString();
    if (cat) {
      return {
        pathname: lp(`/catalog/${cat.id}`),
        search: search ? `?${search}` : "",
      };
    }
    return {
      pathname: lp("/"),
      search: search ? `?${search}` : "",
      hash: search ? "" : "products",
    };
  }

  function setSearch(value) {
    setQuery(value);
    onSearchChange?.(value);
  }

  function goCatalog(extra = {}) {
    closeMenu();
    if (isHome && extra.q && onSearchSubmit) {
      onSearchSubmit(null, extra.q);
      return;
    }
    if (isHome && extra.cat) {
      navigate(catalogTo(extra));
      return;
    }
    if (isHome && onCatalogClick && !extra.cat && !extra.q) {
      onCatalogClick();
      return;
    }
    navigate(catalogTo(extra));
  }

  function submitSearch(event) {
    event?.preventDefault();
    const next = String(query || "").trim();
    closeMenu();
    if (onSearchSubmit) {
      onSearchSubmit(event, next);
      return;
    }
    goCatalog({ q: next });
  }

  function pickCategory(name) {
    closeMenu();
    navigate(catalogTo({ cat: name }));
  }

  function clearAll() {
    closeMenu();
    if (isHome && onClearFilters) {
      onClearFilters();
      return;
    }
    navigate(catalogTo());
  }

  function onRfqClick() {
    closeMenu();
    if (onDraftClick) {
      onDraftClick();
      return;
    }
    navigate(lp("/rfq"));
  }

  function onRfqsClick() {
    closeMenu();
    navigate(lp("/rfqs"));
  }

  function sectionTo(hash) {
    if (isHome) return `#${hash}`;
    return homeTo(hash);
  }

  function onSectionClick(event, link) {
    if (!link?.allProducts) return;
    if (isHome && onCatalogClick) {
      event.preventDefault();
      closeMenu();
      onCatalogClick();
    }
  }

  return (
    <header
      id="siteNav"
      className={`nav-glass ${overlay ? "fixed" : "sticky"} top-0 left-0 right-0 z-40 ${navSolid ? "is-solid" : ""}`}
    >
      <div className={`${width} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="flex items-center gap-4 py-3">
          <Link to={lp("/")} className="shrink-0 flex items-center gap-2.5 text-white min-w-0">
            <img
              src="/assets/mattex-logo.webp"
              alt=""
              className="h-9 w-auto shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
            />
            <div className="leading-tight min-w-0">
              <span className="block text-[15px] sm:text-lg font-semibold tracking-tight truncate">
                {t("brandName")}
              </span>
            </div>
          </Link>

          <form className="hidden md:block flex-1 min-w-0 max-w-xl" onSubmit={submitSearch}>
            <input
              type="search"
              value={query}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("navSearchPlaceholder")}
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/45 px-3.5 py-2 text-sm"
              autoComplete="off"
              aria-label={t("search")}
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center border border-white/20 text-white hover:bg-white/10"
              aria-label={t("search")}
              onClick={() => goCatalog()}
            >
              ⌕
            </button>
            <button
              type="button"
              onClick={onRfqClick}
              className="relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/85 hover:text-white hover:bg-white/10 transition-colors"
              aria-label={`${t("rfqDraft")}, ${t("cartCountAria", { n: cartCount })}`}
            >
              <CartIcon />
              <span className="hidden xl:inline">{t("rfqDraft")}</span>
              {cartCount > 0 ? (
                <span className="absolute -top-1.5 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 bg-brand-400 text-charcoal text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              ) : null}
            </button>
            {SHOW_RFQ ? (
              <button
                type="button"
                onClick={onRfqsClick}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium hover:text-white hover:bg-white/10 transition-colors ${
                  stripLocale(location.pathname) === "/rfqs" ? "text-white" : "text-white/85"
                }`}
                aria-label={t("myRfqs")}
              >
                <RfqsIcon />
                <span className="hidden xl:inline">{t("myRfqs")}</span>
              </button>
            ) : null}
            <AccountMenu user={user} light />
            <LangToggle light />
            <button
              type="button"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center border border-white/20 text-white hover:bg-white/10"
              aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="text-lg leading-none">{menuOpen ? "×" : "☰"}</span>
            </button>
          </div>
        </div>

        <nav className="hidden lg:flex flex-wrap items-center gap-1 border-t border-white/10 py-1.5 text-sm font-medium text-white/70">
          <div
            className="nav-dropdown"
            onMouseEnter={() => setCatsOpen(true)}
            onFocus={() => setCatsOpen(true)}
          >
            <Link
              to={isHome ? "#categories" : homeTo("categories")}
              className="inline-flex items-center gap-1.5 hover:text-white hover:bg-white/10 transition-colors px-3 py-2"
            >
              {t("categories")}
              <span className="text-[10px] opacity-70" aria-hidden>
                ▾
              </span>
            </Link>
            <div className="nav-dropdown-panel" role="menu" aria-label="Categories">
              <div className="nav-cat-grid">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="menuitem"
                    title={c.name}
                    onClick={() => pickCategory(c.name)}
                    className={`nav-cat-item text-left ${selectedCategories.includes(c.name) ? "!bg-brand-600/40 !text-white" : ""}`}
                  >
                    {catsOpen ? <img src={c.image} alt="" loading="lazy" decoding="async" /> : <span className="nav-cat-ph" aria-hidden />}
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold leading-snug line-clamp-2">{c.name}</span>
                      <span className="block text-[10px] text-white/45 mt-0.5">{c.count} items</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 flex justify-between gap-3 px-1">
                <Link to={isHome ? "#categories" : homeTo("categories")} className="text-xs font-semibold text-brand-200 hover:text-white">
                  {t("viewAllCategories")}
                </Link>
                <button type="button" onClick={clearAll} className="text-xs font-semibold text-brand-200 hover:text-white">
                  {t("allProducts")}
                </button>
              </div>
            </div>
          </div>
          {navLinks.map((l) => (
            <Link
              key={l.to || l.hash}
              to={l.to || sectionTo(l.hash)}
              className={`hover:text-white hover:bg-white/10 transition-colors px-3 py-2 ${
                l.allProducts
                  ? isHome || stripLocale(location.pathname).startsWith("/catalog/")
                    ? "text-white"
                    : ""
                  : l.to &&
                      typeof l.to === "string" &&
                      stripLocale(location.pathname).startsWith(stripLocale(l.to) || "—")
                    ? "text-white"
                    : ""
              }`}
              onClick={(e) => onSectionClick(e, l)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      {menuOpen ? (
        <div className="lg:hidden border-t border-white/10 bg-charcoal/98 px-4 py-4 max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col gap-1 text-sm font-medium text-white/80">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 pt-1 pb-1">{t("categories")}</p>
            <div className="grid grid-cols-1 gap-1 mb-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCategory(c.name)}
                  className="nav-cat-item text-left"
                >
                  <img src={c.image} alt="" loading="lazy" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-snug">{c.name}</span>
                    <span className="block text-[11px] text-white/45">{c.count} items</span>
                  </span>
                </button>
              ))}
            </div>
            <form onSubmit={submitSearch}>
              <input
                type="search"
                value={query}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("navSearchPlaceholder")}
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/45 px-3 py-2 text-sm mb-2"
                autoComplete="off"
                aria-label={t("search")}
              />
            </form>
            {navLinks.map((l) => (
              <Link
                key={l.to || l.hash}
                to={l.to || sectionTo(l.hash)}
                className="py-2.5 hover:text-white"
                onClick={(e) => {
                  closeMenu();
                  onSectionClick(e, l);
                }}
              >
                {l.label}
              </Link>
            ))}
            <button type="button" className="py-2.5 hover:text-white inline-flex items-center gap-2 text-left" onClick={onRfqClick}>
              <CartIcon />
              {t("rfqDraft")}
            </button>
            {SHOW_RFQ ? (
              <button type="button" className="py-2.5 hover:text-white inline-flex items-center gap-2 text-left" onClick={onRfqsClick}>
                <RfqsIcon />
                {t("myRfqs")}
              </button>
            ) : null}
            {user ? (
              <>
                <p className="mt-2 pt-2 border-t border-white/15 text-xs text-white/60">{user.name}</p>
                <Link to={lp("/login")} className="py-2.5 hover:text-white" onClick={closeMenu}>
                  {t("profile")}
                </Link>
                <button
                  type="button"
                  className="py-2.5 text-left hover:text-white"
                  onClick={() => {
                    closeMenu();
                    logoutUser();
                    navigate(lp("/"));
                  }}
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <Link to={lp("/login")} className="py-2.5 hover:text-white" onClick={closeMenu}>
                  {t("login")}
                </Link>
              </>
            )}
            <div className="py-2">
              <LangToggle light />
            </div>
          </div>
        </div>
      ) : null}
      <AuthModal open={Boolean(authModalOpen)} onClose={closeAuthModal} />
    </header>
  );
}
