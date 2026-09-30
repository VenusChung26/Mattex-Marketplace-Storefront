import { Link } from "react-router-dom";
import { bannerName } from "../lib/promo";

function AskLink({ href, className, children }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function BrowseLink({ to, className, children }) {
  if (!to) return <span className={className}>{children}</span>;
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

export default function PromoOfferLayout({
  title,
  sentence,
  banners,
  activeId,
  onSelect,
  lang,
  askLabel,
  browseLabel,
  askHref,
  browseTo,
  remaining,
  heading = "h2",
}) {
  const Title = heading;
  const total = banners.length;
  const index = Math.max(0, banners.findIndex((banner) => banner.id === activeId));
  const active = banners[index] || null;
  const name = bannerName(active, lang);

  return (
    <div>
      <section className="relative overflow-hidden bg-brand-800 text-white">
        {active?.src ? (
          <div
            className="absolute inset-0 bg-cover bg-top opacity-30"
            style={{ backgroundImage: `url("${active.src}")` }}
            aria-hidden
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-800 via-brand-800/92 to-brand-800/75" aria-hidden />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Title className="font-display text-3xl font-semibold leading-tight sm:text-5xl">{title}</Title>
            {sentence ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">{sentence}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
            <AskLink href={askHref} className="inline-flex items-center bg-white px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">
              {askLabel}
            </AskLink>
            <BrowseLink to={browseTo} className="inline-flex items-center border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
              {browseLabel}
            </BrowseLink>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12">
        {total > 1 ? (
          <div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {banners.map((banner) => {
                const selected = banner.id === active?.id;
                return (
                  <button
                    key={banner.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect?.(banner.id)}
                    className={`flex min-w-0 items-center gap-2 rounded-xl border bg-white p-2 text-left text-sm font-semibold ${
                      selected ? "border-brand-600 ring-2 ring-brand-600" : "border-line hover:border-brand-600"
                    }`}
                  >
                    <img src={banner.src} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover object-top" />
                    <span className="min-w-0 leading-snug">{bannerName(banner, lang) || (lang === "zh" ? "中文名" : "English name")}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-mute">
              <span className="font-semibold tabular-nums text-ink">
                {index + 1} / {total}
              </span>
              {remaining ? <span className="ml-2">{remaining}</span> : null}
            </p>
          </div>
        ) : null}
        {active ? (
          <div className={`${total > 1 ? "mt-6" : ""} mx-auto max-w-xl overflow-hidden rounded-2xl border border-line bg-white`}>
            <img key={active.src} src={active.src} alt={name} className="block h-auto w-full" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
