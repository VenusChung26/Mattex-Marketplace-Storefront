import { useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import Seo from "../components/Seo";
import { AccountField, AccountFormCard, AccountFormHeader } from "../components/AccountForm";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { requestBuyerPasswordReset } from "../lib/store";
import { useRevealFormIssue } from "../lib/formFocus";

export default function ForgotPasswordPage() {
  const { t, lang } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { formRef, revealIssue } = useRevealFormIssue();

  async function onSubmit(e) {
    e.preventDefault();
    if (!String(email || "").trim()) {
      setError(t("signupFixRequired"));
      revealIssue();
      return;
    }
    const result = await requestBuyerPasswordReset(email);
    if (!result.ok) {
      setError(t("signupFixEmail"));
      revealIssue();
      return;
    }
    setError("");
    setSent(true);
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo lang={lang} path={withLocale(lang, "/forgot-password")} title={`${t("forgotPasswordTitle")} | Mattex Marketplace`} noindex />
      <SiteHeader />
      <main className="max-w-md mx-auto px-4 py-8 sm:py-10">
        <AccountFormCard>
          <AccountFormHeader eyebrow={t("account")} title={t("forgotPasswordTitle")} hint={t("forgotPasswordHint")} />
          {sent ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
                {t("forgotPasswordSent")}
              </p>
              <Link to={withLocale(lang, "/login")} className="btn-primary block text-center !py-3">
                {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <form ref={formRef} className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
              {error ? (
                <div
                  role="alert"
                  tabIndex={-1}
                  data-form-alert
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 outline-none"
                >
                  {error}
                </div>
              ) : null}
              <AccountField label={t("email")} required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder={t("phEmail")}
                  className="field-input"
                  autoComplete="email"
                />
              </AccountField>
              <button type="submit" className="btn-primary w-full !py-3">
                {t("forgotPasswordSubmit")}
              </button>
              <Link to={withLocale(lang, "/login")} className="block text-center text-sm font-semibold text-brand-600 hover:underline">
                {t("backToLogin")}
              </Link>
            </form>
          )}
        </AccountFormCard>
      </main>
    </div>
  );
}
