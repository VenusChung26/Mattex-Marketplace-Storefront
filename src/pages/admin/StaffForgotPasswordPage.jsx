import { useState } from "react";
import { Link } from "react-router-dom";
import { requestStaffPasswordReset } from "../../lib/store";
import { useRevealFormIssue } from "../../lib/formFocus";
import { marketplaceHomeHref } from "../../lib/origins";

export default function StaffForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { formRef, revealIssue } = useRevealFormIssue();

  function onSubmit(e) {
    e.preventDefault();
    if (!String(email || "").trim()) {
      setError("Enter your work email.");
      revealIssue();
      return;
    }
    const result = requestStaffPasswordReset(email);
    if (!result.ok) {
      setError("Enter a valid email.");
      revealIssue();
      return;
    }
    setError("");
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-charcoal text-white font-sans">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/assets/mattex-logo.webp" alt="" className="h-8 w-auto shrink-0 brightness-0 invert" />
          <span className="block text-[15px] sm:text-lg font-semibold tracking-tight leading-tight">
            Mattex Marketplace Admin Portal
          </span>
        </div>
        <a href={marketplaceHomeHref("en")} className="shrink-0 text-xs text-white/60 hover:text-white">
          Marketplace
        </a>
      </header>
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">Staff only</p>
        <h1 className="mt-2 font-display text-3xl">Forgot password</h1>
        <p className="mt-2 text-sm text-white/60">Enter your portal email. If the account exists, we will send a reset link.</p>
        <div className="mt-8 rounded-2xl bg-white p-6 text-ink">
          {sent ? (
            <div className="space-y-4">
              <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
                If this email has a portal account, a reset link is on the way. Check your inbox.
              </p>
              <Link to="/" className="btn-primary block text-center !py-2.5">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form ref={formRef} className="space-y-4" onSubmit={onSubmit} noValidate>
              <label className="block text-sm font-medium">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="sales@mattex.com.hk"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                  autoComplete="email"
                />
              </label>
              {error ? (
                <p role="alert" tabIndex={-1} data-form-alert className="text-sm font-medium text-red-700 outline-none">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white">
                Send reset link
              </button>
              <Link to="/" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
