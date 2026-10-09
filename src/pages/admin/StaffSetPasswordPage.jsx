import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { acceptStaffPasswordLink, getStaffPasswordLink } from "../../lib/store";
import { useRevealFormIssue } from "../../lib/formFocus";
import { PasswordChecklist, PasswordInput, passwordChecks } from "../../components/AccountForm";
import { useAsyncValue } from "../../hooks/useAsyncValue";
import { adminText } from "../../lib/adminCopy";
import { useLanguage } from "../../i18n";

export default function StaffSetPasswordPage() {
  const { lang } = useLanguage();
  const pt = (value) => adminText(lang, value);
  const [params] = useSearchParams();
  const token = String(params.get("token") || "").trim();
  const { loading, value: invite } = useAsyncValue(getStaffPasswordLink, token);
  const reset = invite?.kind === "reset";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pwd = passwordChecks(password, confirm);
  const { formRef, revealIssue } = useRevealFormIssue();

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!pwd.length || !pwd.letter || !pwd.number) {
      setError(pt("Password needs 8+ characters, a letter, and a number."));
      revealIssue();
      return;
    }
    if (!pwd.match) {
      setError(pt("Passwords do not match."));
      revealIssue();
      return;
    }
    setBusy(true);
    const result = await acceptStaffPasswordLink({ token, password });
    setBusy(false);
    if (!result.ok) {
      setError(
        result.error === "expired"
          ? "This link has expired. Request a new reset email."
          : result.error === "password"
            ? pt("Password needs 8+ characters, a letter, and a number.")
            : pt("This link is not valid.")
      );
      revealIssue();
      return;
    }
    window.location.assign("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-ink shadow-[0_24px_60px_rgba(16,21,19,0.25)]">
        <div className="flex items-center gap-2.5">
          <img src="/assets/mattex-logo.webp" alt="" className="h-8 w-auto shrink-0" />
          <span className="text-[15px] sm:text-lg font-semibold leading-tight tracking-tight text-brand-900">
            {pt("Mattex Marketplace Admin Portal")}
          </span>
        </div>
        <h1 className="mt-5 font-display text-2xl text-brand-900">{reset ? pt("Reset your password") : pt("Set your password")}</h1>
        {loading ? (
          <p className="mt-3 text-sm text-mute">{pt("Checking link…")}</p>
        ) : !invite ? (
          <p className="mt-3 text-sm text-mute">{pt("This link is not valid. Ask a teammate to send a new invite or reset email.")}</p>
        ) : invite.expired ? (
          <p className="mt-3 text-sm text-mute">{pt("This link has expired. Request a new reset email from the sign-in page.")}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-mute">
              {invite.name ? `${invite.name} · ` : ""}
              {invite.email}
            </p>
            <form ref={formRef} className="mt-5 space-y-3" onSubmit={onSubmit}>
              <label className="block text-sm font-medium">
                {pt("New password")}
                <PasswordInput
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Password"
                  autoComplete="new-password"
                  aria-invalid={error && (!pwd.length || !pwd.letter || !pwd.number) ? true : undefined}
                />
              </label>
              <label className="block text-sm font-medium">
                {pt("Confirm password")}
                <PasswordInput
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError("");
                  }}
                  placeholder="Password"
                  autoComplete="new-password"
                  aria-invalid={error && !pwd.match ? true : undefined}
                />
              </label>
              <PasswordChecklist password={password} confirmPassword={confirm} hasError={Boolean(error)} />
              {error ? (
                <p role="alert" tabIndex={-1} data-form-alert className="text-sm font-medium text-red-700 outline-none">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {pt("Save password and enter portal")}
              </button>
            </form>
          </>
        )}
        <p className="mt-4 text-xs text-mute">
          {pt("Already set a password?")} <Link to="/" className="font-semibold text-brand-700 hover:underline">{pt("Sign in")}</Link>
        </p>
      </div>
    </div>
  );
}
