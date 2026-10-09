import { formatPrice, formatQuoteDate, formatQuoteDateShort, getEffectivePrice } from "../lib/store";
import { findProductOffer } from "../lib/offer";
import { usePromo } from "../lib/promo";
import { useLanguage } from "../i18n";

function daysUntil(iso) {
  const end = new Date(`${iso}T23:59:59`);
  if (Number.isNaN(end.getTime())) return Infinity;
  return Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function quoteUrgency(validUntil) {
  const days = daysUntil(validUntil);
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "ok";
}

const URGENCY_CHIP = {
  ok: "text-brand-800 bg-brand-50 border-brand-200",
  soon: "text-amber-950 bg-amber-50 border-amber-300",
  urgent: "text-red-900 bg-red-50 border-red-300",
};

const URGENCY_SUB = {
  ok: "font-medium text-brand-700/80",
  soon: "font-medium text-amber-800/90",
  urgent: "font-medium text-red-800/90",
};

export default function ProductPrice({ product, size = "card", className = "", suppressOffer = false }) {
  const { t, lang } = useLanguage();
  const { promo } = usePromo();
  const offer = suppressOffer ? null : findProductOffer(product?.id, promo);
  const { displayPrice, status, quote } = getEffectivePrice(product);
  const shownPrice = offer ? offer.price : displayPrice;
  const large = size === "detail";
  const date = quote?.validUntil ? formatQuoteDate(quote.validUntil, lang) : "";
  const shortDate = quote?.validUntil ? formatQuoteDateShort(quote.validUntil, lang) : "";
  const urgency = status === "quoted" && quote?.validUntil ? quoteUrgency(quote.validUntil) : "ok";

  const showListStrike = status === "quoted" && quote?.listPrice != null && quote.listPrice !== displayPrice;
  const expired = status === "expired-list" || status === "expired-requote";
  const chip = large ? "mt-3 text-sm px-2 py-1" : "mt-2.5 text-[11px] px-1.5 py-1";

  return (
    <div className={`${large ? "mt-4" : "mt-3"} ${className}`.trim()}>
      <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${large ? "py-3.5" : "py-2.5"}`}>
        <p
          className={
            large
              ? "text-3xl font-bold text-brand-600 tracking-tight"
              : "text-2xl font-bold text-brand-700 tracking-tight"
          }
        >
          {formatPrice(shownPrice)}
        </p>
        {status === "quoted" ? (
          <span
            className={`${large ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0.5"} font-bold tracking-wide border ${URGENCY_CHIP[urgency]}`}
          >
            {t("quotedPriceLabel")}
          </span>
        ) : null}
      </div>
      {showListStrike ? (
        <p className={`${large ? "mt-2 text-sm" : "mt-1.5 text-xs"} text-mute`}>
          <span className="line-through">{formatPrice(quote.listPrice)}</span>
          <span className="ml-1.5">{t("quotedFromQuotation")}</span>
        </p>
      ) : null}
      {offer ? (
        <p className={`${chip} inline-block w-fit max-w-full leading-snug font-semibold border ${URGENCY_CHIP.soon}`}>
          {t("offerEnds", { date: formatQuoteDate(offer.endsOn, lang) })}
        </p>
      ) : status === "quoted" && (large ? date : shortDate) ? (
        <p
          className={`${chip} inline-block w-fit max-w-full leading-snug font-semibold border ${URGENCY_CHIP[urgency]}`}
        >
          {large ? (
            <>
              {t("quotedPriceValidUntil")}{" "}
              <span className="whitespace-nowrap">
                {date}
                <span className={`ml-2.5 ${URGENCY_SUB[urgency]}`}>
                  {t("quotedPriceMonths", { n: quote.months || 3 })}
                </span>
              </span>
            </>
          ) : (
            t("quotedPriceUntilShort", { date: shortDate })
          )}
        </p>
      ) : null}
      {expired ? (
        <p
          className={`${chip} inline-flex max-w-full leading-snug font-semibold text-amber-950 bg-amber-50 border border-amber-200`}
        >
          {status === "expired-list" ? t("quotedPriceExpiredList") : t("quotedPriceExpiredRequote")}
        </p>
      ) : null}
    </div>
  );
}
