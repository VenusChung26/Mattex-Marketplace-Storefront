import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CopyLinkButton from "../components/CopyLinkButton";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import Seo, { breadcrumbJsonLd, orgJsonLd, productJsonLd } from "../components/Seo";
import ProductPrice from "../components/ProductPrice";
import ProductRating from "../components/ProductRating";
import { ProductActions, ProductBadges, ProductImage } from "../components/ProductCard";
import { productImageList } from "../lib/compressImage";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { bootProduct } from "../lib/bootPage";
import { allProductsTo, siteOrigin, withLocale } from "../lib/locale";
import { seoCopy } from "../lib/seoCopy";
import {
  addFromStorefront,
  canDirectBuy,
  catalogPathForCategory,
  displayLeadTime,
  getEffectivePrice,
  getProduct,
  isBuyerVisible,
  productSkuId,
  specificationRows,
  stockStatusKey,
  supplierDisplayName,
  supplierPath,
} from "../lib/store";

function BackToCatalog({ product }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useLanguage();
  return (
    <button
      type="button"
      className="btn-soft !px-5 !py-3"
      onClick={() => {
        if (location.key !== "default") {
          navigate(-1);
          return;
        }
        navigate(withLocale(lang, catalogPathForCategory(product.category)));
      }}
    >
      {t("backToCatalog")}
    </button>
  );
}

const STOCK_TONE = {
  in_stock: "bg-brand-50 text-brand-800",
  limited: "bg-[#fbf3e4] text-[#8a5a12]",
  made_to_order: "bg-paper text-ink",
  out_of_stock: "bg-[#f8e8e8] text-[#8a2b2b]",
};

export default function DetailsPage() {
  const { id } = useParams();
  const [params, setSearchParams] = useSearchParams();
  useStore();
  const product = getProduct(id) || bootProduct(id);
  const { t, lang } = useLanguage();
  const [qty, setQty] = useState(1);
  const autoOpenTailor = params.get("tailor") === "1";
  const gallery = productImageList(product);
  const [activeImage, setActiveImage] = useState(gallery[0] || product?.image || "");

  useEffect(() => {
    setQty(product?.moq || 1);
    const next = productImageList(product);
    setActiveImage(next[0] || product?.image || "");
  }, [product?.id, product?.moq, product?.image, product?.images]);

  useEffect(() => {
    if (params.get("tailor") !== "1") return;
    const next = new URLSearchParams(params);
    next.delete("tailor");
    setSearchParams(next, { replace: true });
  }, [params, setSearchParams]);

  if (!product || !isBuyerVisible(product)) {
    return (
      <div className="bg-paper min-h-screen">
        <SiteHeader />
        <main className="max-w-7xl mx-auto px-4 py-10">
          <div className="bg-white border border-line rounded-xl p-8 text-center">
            <h1 className="reveal text-xl font-bold text-brand-800">{t("productNotFound")}</h1>
            <p className="mt-2 text-sm text-mute">{t("productNotFoundHint")}</p>
            <Link to={allProductsTo(lang)} className="btn-primary mt-5 inline-flex">
              {t("browseCatalog")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const discontinued = Boolean(product.discontinued);
  const priced = !discontinued && canDirectBuy(product);
  const priceStatus = getEffectivePrice(product).status;
  const priceHint =
    priceStatus === "quoted"
      ? `${t("quotedBuyHint")} ${t("requestQuoteHint")}`
      : priceStatus === "expired-requote"
        ? t("quotedPriceExpiredRequote")
        : priced
          ? `${t("buyNowHint")} ${t("requestQuoteHint")}`
          : t("requestQuoteOnlyHint");
  const minQty = Math.max(1, Number(product.moq) || 1);
  const leadTime = displayLeadTime(product) || "—";
  const facts = [
    { label: t("productNo"), value: productSkuId(product) || product.id.toUpperCase() },
    {
      label: t("stockStatus"),
      value: discontinued ? t("discontinued") : t(stockStatusKey(product.stockStatus)),
      pill: true,
      tone: discontinued ? "bg-[#f8e8e8] text-[#8a2b2b]" : STOCK_TONE[product.stockStatus] || STOCK_TONE.in_stock,
    },
    { label: t("moq"), value: `${product.moq} ${product.unit}` },
    { label: t("leadTime"), value: leadTime },
    { label: t("standard"), value: product.standard },
  ];

  const purposes = (product.purposes || [])
    .map((term) => String(term).trim())
    .filter((term) => term && !/^\d+\.\s/.test(term));
  const remark = String(product.remark || "").trim();

  function goToRfq(intent, nextQty = qty) {
    const sendQty = Math.max(minQty, Math.floor(Number(nextQty)) || minQty);
    addFromStorefront(product.id, intent, sendQty, lang);
  }

  const origin = siteOrigin();
  const copy = seoCopy(lang);
  const path = withLocale(lang, `/details/${product.id}`);

  return (
    <div className="bg-paper min-h-screen pb-28 lg:pb-0">
      <Seo
        lang={lang}
        path={path}
        title={copy.productTitle(product.name)}
        description={copy.productDesc(product)}
        image={product.image || "/og-default.webp"}
        ogType="product"
        jsonLd={[
          orgJsonLd(origin),
          productJsonLd(origin, product, lang),
          breadcrumbJsonLd(origin, [
            { name: "Mattex Marketplace", path: withLocale(lang, "/") },
            { name: t("catalog"), path: withLocale(lang, "/") },
            { name: product.name, path },
          ]),
        ]}
      />
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
        <nav className="mb-5 text-sm text-mute">
          <Link to={allProductsTo(lang)} className="hover:text-brand-600">
            {t("catalog")}
          </Link>
          <span className="mx-2 text-line">/</span>
          <Link to={withLocale(lang, catalogPathForCategory(product.category))} className="hover:text-brand-600">
            {product.category}
          </Link>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="relative overflow-hidden bg-brand-50 border border-line rounded-xl self-start w-full">
            <ProductBadges product={product} />
            <ProductImage
              src={activeImage || product.image}
              fallback={activeImage === product.image ? product.imageFallback : ""}
              alt={product.name}
              className="block w-full"
              imgClassName="block w-full h-auto"
            />
            {gallery.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto bg-white border-t border-line px-3 py-2">
                {gallery.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={`h-14 w-14 shrink-0 overflow-hidden border ${
                      src === activeImage ? "border-brand-600" : "border-line"
                    }`}
                    onClick={() => setActiveImage(src)}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
            <p className="px-3 py-2 text-[11px] leading-snug text-mute bg-white border-t border-line">
              {t("specSubjectToQuote")}
            </p>
          </div>

          <div className="reveal">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
                <Link to={withLocale(lang, catalogPathForCategory(product.category))} className="hover:underline">
                  {product.category}
                </Link>
              </p>
              <CopyLinkButton path={path} />
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-brand-800 leading-tight">
              {product.name}
            </h1>
            <p className="mt-3 text-sm text-mute">
              {t("supplierLabel")}:{" "}
              {product.supplier ? (
                <Link
                  to={withLocale(lang, supplierPath(product.supplier))}
                  className="text-brand-600 hover:underline font-medium"
                >
                  {supplierDisplayName(product.supplier)}
                </Link>
              ) : (
                t("subbiePartner")
              )}
            </p>
            <ProductRating product={product} size="lg" className="mt-2" />
            <ProductPrice product={product} size="detail" />
            <p className="mt-5 text-sm text-mute leading-relaxed max-w-prose">{product.description}</p>

            <dl className="mt-6 divide-y divide-line border-y border-line">
              {facts.map((row) => (
                <div key={row.label} className="py-2.5 flex items-start justify-between gap-4">
                  <dt className="text-sm text-mute shrink-0">{row.label}</dt>
                  <dd className="text-sm font-medium text-ink text-right">
                    {row.pill ? (
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold ${row.tone}`}>
                        {row.value}
                      </span>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 hidden lg:block">
              {discontinued ? (
                <span className="inline-flex items-center bg-[#f8e8e8] text-[#8a2b2b] text-xs font-bold uppercase tracking-wide px-3 py-2">
                  {t("discontinued")}
                </span>
              ) : (
                <ProductActions
                  product={product}
                  qty={qty}
                  onQtyChange={setQty}
                  onAdd={(_, intent, nextQty) => goToRfq(intent, nextQty)}
                  size="detail"
                  autoOpenTailor={autoOpenTailor}
                />
              )}
            </div>

            <p className="mt-5 text-xs text-mute leading-relaxed max-w-prose">
              {discontinued ? t("discontinuedHint") : priceHint}
            </p>

            <div className="mt-4 hidden lg:block">
              <BackToCatalog product={product} />
            </div>

            <h2 className="mt-8 text-sm font-semibold text-ink">{t("specifications")}</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {specificationRows(product).map((row) =>
                row.kind === "cert" ? (
                  <li key="cert" className="py-2.5 text-sm text-mute">
                    <p className="text-xs font-medium text-ink">Cert</p>
                    <ul className="mt-1.5 space-y-1">
                      {row.lines.map((line) => (
                        <li key={line} className="leading-relaxed">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li key={row.text} className="py-2.5 text-sm text-mute">
                    {row.text}
                  </li>
                )
              )}
            </ul>

            {purposes.length ? (
              <>
                <h2 className="mt-8 text-sm font-semibold text-ink">{t("productPurposes")}</h2>
                <p className="mt-1 text-xs text-mute leading-relaxed">{t("productPurposesHint")}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {purposes.map((term) => (
                    <li key={term}>
                      <Link
                        to={withLocale(lang, {
                          pathname: "/",
                          search: `?q=${encodeURIComponent(term)}`,
                          hash: "#products",
                        })}
                        className="inline-flex border border-line bg-paper px-2 py-1 text-xs text-ink hover:border-brand-600 hover:text-brand-700"
                      >
                        {term}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {remark ? (
              <>
                <h2 className="mt-8 text-sm font-semibold text-ink">{t("productRemark")}</h2>
                <p className="mt-3 whitespace-pre-line text-sm text-mute leading-relaxed max-w-prose">{remark}</p>
              </>
            ) : null}
          </div>
        </div>
      </main>

      <div className="hidden lg:block">
        <SiteFooter />
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white/95 backdrop-blur p-3">
        {discontinued ? (
          <p className="max-w-7xl mx-auto text-center text-xs font-semibold text-[#8a2b2b]">{t("discontinuedUnavailable")}</p>
        ) : (
          <div className="max-w-7xl mx-auto">
            <ProductActions
              product={product}
              qty={qty}
              onQtyChange={setQty}
              onAdd={(_, intent, nextQty) => goToRfq(intent, nextQty)}
              size="bar"
            />
          </div>
        )}
      </div>
    </div>
  );
}
