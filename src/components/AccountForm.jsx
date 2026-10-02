import { Children, cloneElement, isValidElement, useState } from "react";
import { useLanguage } from "../i18n";

export function passwordChecks(password, confirmPassword) {
  const value = String(password || "");
  const confirm = String(confirmPassword || "");
  return {
    length: value.length >= 8,
    letter: /[A-Za-z]/.test(value),
    number: /\d/.test(value),
    match: confirm.length > 0 && value === confirm,
  };
}

export function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden>
      *
    </span>
  );
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  autoComplete = "current-password",
  className = "field-input",
  id,
  name,
  disabled,
  readOnly,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${className} pr-11`.trim()}
        autoComplete={autoComplete}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
      />
      <button
        type="button"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-mute hover:bg-paper hover:text-ink"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        title={visible ? t("hidePassword") : t("showPassword")}
        tabIndex={-1}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3l18 18" strokeLinecap="round" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
            <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c5 0 9.3 3.1 11 7.5a12 12 0 0 1-4.2 5.1" strokeLinecap="round" />
            <path d="M6.7 6.7A11.9 11.9 0 0 0 1 12.5C2.7 16.9 7 20 12 20c1.4 0 2.7-.2 4-.7" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12.5C3.7 8.1 8 5 13 5s9.3 3.1 11 7.5C22.3 16.9 18 20 13 20S3.7 16.9 2 12.5Z" />
            <circle cx="13" cy="12.5" r="2.6" />
          </svg>
        )}
      </button>
    </div>
  );
}

function decorateControl(child, { error, locked }) {
  if (!isValidElement(child) || child.type === "datalist") return child;
  const extra = [
    child.props.className || "field-input",
    error ? "!border-red-500 ring-2 ring-red-200 bg-red-50" : "",
    locked ? "cursor-not-allowed border-[#c5ccc8] bg-[#e6eae7] text-mute opacity-100" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return cloneElement(child, {
    className: extra,
    "aria-invalid": error ? true : undefined,
    disabled: locked || child.props.disabled,
    readOnly: locked || child.props.readOnly,
  });
}

export function AccountField({
  label,
  required,
  hint,
  error,
  locked = false,
  lockedHint,
  className = "",
  asLabel = true,
  children,
}) {
  const content = Children.map(children, (child) => decorateControl(child, { error, locked }));
  const Tag = asLabel ? "label" : "div";
  return (
    <Tag className={`block min-w-0 ${className}`.trim()}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`text-sm font-medium ${error ? "text-red-700" : locked ? "text-mute" : "text-ink"}`}>
          {label}
          {required ? (
            <>
              {" "}
              <RequiredMark />
            </>
          ) : null}
        </span>
        {locked && lockedHint ? (
          <span className="rounded bg-[#d8ddd9] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4a534e]">
            {lockedHint}
          </span>
        ) : null}
      </span>
      {content}
      {error ? <span className="mt-1.5 block text-xs font-medium text-red-700">{error}</span> : null}
      {!error && hint ? <span className="mt-1.5 block text-xs text-mute leading-relaxed">{hint}</span> : null}
    </Tag>
  );
}

export function AccountSection({ title, description, children, columns = 2 }) {
  return (
    <section className="rounded-xl border border-line bg-paper/40 p-4 sm:p-5">
      <header className="mb-4 border-b border-line pb-3">
        <h2 className="text-base font-semibold text-brand-800">{title}</h2>
        {description ? <p className="mt-1 text-xs text-mute leading-relaxed">{description}</p> : null}
      </header>
      <div className={columns === 1 ? "grid grid-cols-1 gap-4" : "grid gap-4 sm:grid-cols-2"}>{children}</div>
    </section>
  );
}

function CheckItem({ ok, label, metLabel, unmetLabel }) {
  return (
    <li
      className={`flex items-start gap-2.5 text-sm leading-snug pointer-events-none select-none ${
        ok ? "font-semibold text-[#127a3a]" : "text-mute"
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? "text-[#127a3a]" : "text-[#c5ccc8]"}`}
        fill="none"
        aria-hidden
      >
        <circle cx="8" cy="8" r="6.25" fill={ok ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.8 8.2 7 10.3 11.3 5.8" stroke={ok ? "#fff" : "currentColor"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        <span className="sr-only">{ok ? metLabel : unmetLabel}: </span>
        {label}
      </span>
    </li>
  );
}

export function PasswordChecklist({ password, confirmPassword, hasError, id }) {
  const { t } = useLanguage();
  const pwd = passwordChecks(password, confirmPassword);
  const lengthLabel =
    password && !pwd.length ? `${t("passwordReqLength")} · ${String(password).length}/8` : t("passwordReqLength");

  return (
    <div
      id={id}
      className={`rounded-lg border px-3.5 py-3 ${
        hasError ? "border-red-300 bg-red-50" : "border-line bg-white"
      }`}
      role="status"
      aria-live="polite"
    >
      <p className="text-xs font-semibold text-ink">{t("passwordRequirements")}</p>
      <p className="mt-0.5 text-[11px] text-mute">{t("passwordLiveHint")}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        <CheckItem ok={pwd.length} label={lengthLabel} metLabel={t("passwordReqMet")} unmetLabel={t("passwordReqUnmet")} />
        <CheckItem ok={pwd.letter} label={t("passwordReqLetter")} metLabel={t("passwordReqMet")} unmetLabel={t("passwordReqUnmet")} />
        <CheckItem ok={pwd.number} label={t("passwordReqNumber")} metLabel={t("passwordReqMet")} unmetLabel={t("passwordReqUnmet")} />
        <CheckItem ok={pwd.match} label={t("passwordReqMatch")} metLabel={t("passwordReqMet")} unmetLabel={t("passwordReqUnmet")} />
      </ul>
    </div>
  );
}

export function AccountFormCard({ children }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5 sm:p-8 shadow-[0_12px_40px_rgba(16,21,19,0.06)]">
      {children}
    </div>
  );
}

export function AccountFormHeader({ eyebrow, title, hint, showRequired }) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600 mb-2">{eyebrow}</p>
          ) : null}
          <h1 className="reveal text-2xl sm:text-3xl font-bold text-brand-800 leading-tight">{title}</h1>
        </div>
        {showRequired ? (
          <p className="shrink-0 text-xs text-mute pt-1">
            <RequiredMark /> {t("requiredLegend")}
          </p>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-sm text-mute leading-relaxed">{hint}</p> : null}
    </div>
  );
}
