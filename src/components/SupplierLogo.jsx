import { isMattexSupplier, supplierBrand } from "../lib/store";

export default function SupplierLogo({ name, className = "h-12 w-12" }) {
  if (isMattexSupplier(name)) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ${className}`} aria-hidden>
        <img src="/assets/mattex-logo.webp" alt="" className="h-full w-full object-contain p-0.5" />
      </span>
    );
  }

  const { initials, variant, bg, fg, accent } = supplierBrand(name);
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-md ${className}`} aria-hidden>
      <svg viewBox="0 0 48 48" className="h-full w-full block" role="img">
        <title>{name}</title>
        <rect width="48" height="48" rx="6" fill={bg} />
        {variant === 1 ? (
          <>
            <rect x="0" y="34" width="48" height="14" fill={accent} />
            <circle cx="38" cy="10" r="5" fill={accent} />
          </>
        ) : null}
        {variant === 2 ? (
          <>
            <polygon points="24,4 44,24 24,44 4,24" fill={accent} opacity="0.28" />
            <rect x="18" y="4" width="12" height="40" fill={accent} opacity="0.55" />
          </>
        ) : null}
        {variant === 3 ? (
          <>
            <circle cx="24" cy="24" r="18" fill="none" stroke={accent} strokeWidth="2.4" />
            <rect x="6" y="22" width="36" height="4" fill={accent} />
          </>
        ) : null}
        {variant === 4 ? (
          <>
            <rect x="0" y="0" width="16" height="48" fill={accent} opacity="0.85" />
            <rect x="0" y="0" width="48" height="8" fill={fg} opacity="0.12" />
          </>
        ) : null}
        {variant === 0 ? (
          <rect x="6" y="38" width="20" height="4" fill={accent} />
        ) : null}
        <text
          x="24"
          y="29"
          textAnchor="middle"
          fill={fg}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="16"
          fontWeight="700"
          letterSpacing="0.5"
        >
          {initials}
        </text>
      </svg>
    </span>
  );
}
