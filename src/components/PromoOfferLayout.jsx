import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n";
import { bannerHeroSrc, bannerName } from "../lib/promo";

const ZOOM_STEPS = [100, 125, 150];
const NORMAL_PX = 560;

function posterWidth(zoom) {
  return Math.round((NORMAL_PX * zoom) / 100);
}

function posterFile(src, name) {
  const ext = String(src || "").split(".").pop()?.split("?")[0] || "webp";
  const base = String(name || "poster").trim().replace(/\s+/g, "-") || "poster";
  return `${base}.${ext}`;
}

function PosterView({ src, name }) {
  const { t } = useLanguage();
  const boxRef = useRef(null);
  const [zoom, setZoom] = useState(100);
  const [columnWidth, setColumnWidth] = useState(0);
  const step = Math.max(0, ZOOM_STEPS.indexOf(zoom));
  const maxPx = posterWidth(zoom);
  const rendered = columnWidth > 0 ? Math.min(columnWidth, maxPx) : maxPx;
  const nextZoom = ZOOM_STEPS[step + 1];
  const nextRendered = nextZoom ? Math.min(columnWidth || posterWidth(nextZoom), posterWidth(nextZoom)) : rendered;

  useEffect(() => {
    const column = boxRef.current?.parentElement;
    if (!column || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => setColumnWidth(column.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="w-full" style={{ maxWidth: maxPx }}>
      <img src={src} alt={name} className="block h-auto w-full rounded-2xl border border-line bg-white" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("promoZoomOut")}
            disabled={step <= 0}
            onClick={() => setZoom(ZOOM_STEPS[step - 1])}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-base font-semibold text-brand-800 hover:bg-paper disabled:opacity-35"
          >
            −
          </button>
          <span className="w-12 text-center text-xs font-semibold tabular-nums text-mute">{zoom}%</span>
          <button
            type="button"
            aria-label={t("promoZoomIn")}
            disabled={!nextZoom || nextRendered <= rendered + 1}
            onClick={() => setZoom(nextZoom)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-base font-semibold text-brand-800 hover:bg-paper disabled:opacity-35"
          >
            +
          </button>
          {zoom !== 100 ? (
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="ml-1 inline-flex h-8 items-center px-2 text-sm font-semibold text-brand-800 hover:underline"
            >
              {t("promoZoomReset")}
            </button>
          ) : null}
        </div>
        <a
          href={src}
          download={posterFile(src, name)}
          className="inline-flex h-8 shrink-0 items-center px-2.5 text-sm font-semibold text-brand-800 hover:underline"
        >
          {t("promoDownload")}
        </a>
      </div>
    </div>
  );
}

export default function PromoOfferLayout({
  title,
  sentence,
  banners,
  activeId,
  onSelect,
  lang,
  listLabel,
  heading = "h2",
  children,
}) {
  const Title = heading;
  const total = banners.length;
  const index = Math.max(0, banners.findIndex((banner) => banner.id === activeId));
  const active = banners[index] || null;
  const name = bannerName(active, lang);
  const hero = bannerHeroSrc(active);

  return (
    <div>
      <section className="relative overflow-hidden bg-brand-800 text-white">
        {hero ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${hero}")` }}
            aria-hidden
          />
        ) : null}
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,#143528_0%,#143528_46%,rgba(20,53,40,0.2)_82%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <Title className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</Title>
          {sentence ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">{sentence}</p> : null}
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div className={total > 1 ? "lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-8" : ""}>
          {total > 1 ? (
            <aside className="lg:sticky lg:top-24">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">{listLabel}</h2>
                <span className="text-xs tabular-nums text-mute">{total}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-[calc(100vh-8rem)] lg:space-y-2 lg:overflow-y-auto lg:pb-0">
                {banners.map((banner) => {
                  const selected = banner.id === active?.id;
                  return (
                    <button
                      key={banner.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect?.(banner.id)}
                      className={`flex w-56 shrink-0 items-center gap-3 rounded-xl border p-2.5 text-left lg:w-full ${
                        selected ? "border-brand-700 bg-brand-50" : "border-line bg-white hover:border-brand-600"
                      }`}
                    >
                      <img src={banner.src} alt="" className="h-14 w-16 shrink-0 rounded-lg bg-paper object-cover object-top" />
                      <span className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug">
                        {bannerName(banner, lang) || (lang === "zh" ? "中文名" : "English name")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}
          <div className={total > 1 ? "mt-6 min-w-0 lg:mt-0" : "min-w-0"}>
            {active ? <PosterView key={active.src} src={active.src} name={name} /> : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
