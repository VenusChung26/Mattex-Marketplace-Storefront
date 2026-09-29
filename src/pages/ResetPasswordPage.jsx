import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import Seo from "../components/Seo";
import {
  AccountField,
  AccountFormCard,
  AccountFormHeader,
  PasswordChecklist,
  PasswordInput,
  passwordChecks,
} from "../components/AccountForm";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { getBuyerReset, resetBuyerPassword } from "../lib/store";
import { useRevealFormIssue } from "../lib/formFocus";
import { useAsyncValue } from "../hooks/useAsyncValue";

export default function ResetPasswordPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = String(params.get("token") || "").trim();
  const { loading, value: reset } = useAsyncValue(getBuyerReset, token);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const pwd = passwordChecks(password, confirm);
  const { formRef, revealIssue } = useRevealFormIssue();

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!pwd.length || !pwd.letter || !pwd.number) {
      setError(t("signupFixPassword"));
      revealIssue();
      return;
    }
    if (!pwd.match) {
      setError(t("signupFixPasswordMatch"));
      revealIssue();
      return;
    }
    setBusy(true);
    const result = await resetBuyerPassword({ token, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "expired" ? t("resetLinkExpired") : t("resetLinkInvalid"));
      revealIssue();
      return;
    }
    navigate(withLocale(lang, "/login"), { replace: true, state: { resetOk: true } });
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo lang={lang} path={withLocale(lang, "/reset-password")} title={`${t("resetPasswordTitle")} | Mattex Marketplace`} noindex />
      <SiteHeader />
      <main className="max-w-md mx-auto px-4 py-8 sm:py-10">
        <AccountFormCard>
          <AccountFormHeader eyebrow={t("account")} title={t("resetPasswordTitle")} hint={t("resetPasswordHint")} />
          {loading ? (
            <p className="mt-6 text-sm text-mute">…</p>
          ) : !reset ? (
            <p className="mt-6 text-sm text-mute">{t("resetLinkInvalid")}</p>
          ) : reset.expired ? (
            <p className="mt-6 text-sm text-mute">{t("resetLinkExpired")}</p>
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
              <AccountField label={t("password")} required>
                <PasswordInput
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder={t("phPassword")}
                  autoComplete="new-password"
                />
              </AccountField>
              <AccountField label={t("confirmPassword")} required>
                <PasswordInput
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError("");
                  }}
                  placeholder={t("phPassword")}
                  autoComplete="new-password"
                />
              </AccountField>
              <PasswordChecklist password={password} confirmPassword={confirm} />
              <button type="submit" disabled={busy} className="btn-primary w-full !py-3 disabled:opacity-60">
                {t("resetPasswordSubmit")}
              </button>
            </form>
          )}
          <Link to={withLocale(lang, "/login")} className="mt-5 block text-center text-sm font-semibold text-brand-600 hover:underline">
            {t("backToLogin")}
          </Link>
        </AccountFormCard>
      </main>
    </div>
  );
}
