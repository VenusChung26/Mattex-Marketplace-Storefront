import { useEffect, useState } from "react";
import { useRevealFormIssue } from "../lib/formFocus";
import { Link, Navigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import Seo from "../components/Seo";
import {
  AccountField,
  AccountFormCard,
  AccountFormHeader,
  AccountSection,
  PasswordChecklist,
  passwordChecks,
} from "../components/AccountForm";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { SHOW_RFQ } from "../lib/flags";
import {
  closeAuthModal,
  registerUser,
} from "../lib/store";
import ProjectListEditor from "../components/ProjectListEditor";
import { BuyerContactFields } from "../components/BuyerContactFields";
import { composePhone, contactPayload, normalizeRoles } from "../lib/phone";

const EMPTY_FORM = {
  email: "",
  password: "",
  confirmPassword: "",
  name: "",
  jobTitle: "",
  phone: "",
  phoneRegion: "852",
  phoneOtherCode: "",
  phoneNational: "",
  addPhone: false,
  phone2Region: "852",
  phone2OtherCode: "",
  phone2National: "",
  whatsappOn: "",
  wechatOn: "",
  wechatPhoneRegion: "852",
  wechatPhoneOtherCode: "",
  wechatPhoneNational: "",
  wechatId: "",
  roles: ["buyer"],
  companyName: "",
  companyReg: "",
  companyPhone: "",
  companyAddress: "",
  projects: [""],
};

export default function SignupPage() {
  const { user } = useStore();
  const { t, lang } = useLanguage();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const { formRef, revealIssue } = useRevealFormIssue();

  useEffect(() => {
    closeAuthModal();
  }, []);

  if (user && !submittedEmail) {
    return <Navigate to={withLocale(lang, "/login")} replace />;
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function collectSignupErrors(nextForm) {
    const pwd = passwordChecks(nextForm.password, nextForm.confirmPassword);
    const errors = {};
    const email = String(nextForm.email || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t("signupFixEmail");
    if (!String(nextForm.name || "").trim()) errors.name = t("signupFixRequired");
    if (!String(nextForm.jobTitle || "").trim()) errors.jobTitle = t("signupFixRequired");
    if (!composePhone(nextForm.phoneRegion, nextForm.phoneOtherCode, nextForm.phoneNational)) errors.phone = t("signupFixRequired");
    if (nextForm.addPhone && !composePhone(nextForm.phone2Region, nextForm.phone2OtherCode, nextForm.phone2National)) {
      errors.phone2 = t("signupFixRequired");
    }
    if (!normalizeRoles(nextForm.roles).length) errors.roles = t("signupFixRole");
    if (!pwd.length || !pwd.letter || !pwd.number) errors.password = t("signupFixPassword");
    if (!pwd.match) errors.confirmPassword = t("signupFixPasswordMatch");
    if (!String(nextForm.companyName || "").trim()) errors.companyName = t("signupFixRequired");
    if (!String(nextForm.companyReg || "").trim()) errors.companyReg = t("signupFixRequired");
    if (!String(nextForm.companyAddress || "").trim()) errors.companyAddress = t("signupFixRequired");
    return errors;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const errors = collectSignupErrors(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError(t("signupFixAlert"));
      revealIssue();
      return;
    }
    setBusy(true);
    const contact = contactPayload(form);
    const result = await registerUser({
      ...form,
      ...contact,
      roles: normalizeRoles(form.roles),
    });
    setBusy(false);
    if (!result.ok) {
      const fieldMap = {
        email: "email",
        name: "name",
        phone: "phone",
        roles: "roles",
        jobTitle: "jobTitle",
        companyName: "companyName",
        companyReg: "companyReg",
        companyAddress: "companyAddress",
        password: "password",
      };
      const messages = {
        exists: t("signupErrorExists"),
        pending: t("signupErrorExists"),
        staff: t("loginErrorStaff"),
        password: t("signupFixPassword"),
        roles: t("signupFixRole"),
        email: t("signupFixEmail"),
        name: t("signupFixRequired"),
        phone: t("signupFixRequired"),
        jobTitle: t("signupFixRequired"),
        companyName: t("signupFixRequired"),
        companyReg: t("signupFixRequired"),
        companyAddress: t("signupFixRequired"),
      };
      if (fieldMap[result.error]) {
        setFieldErrors({ [fieldMap[result.error]]: messages[result.error] || t("signupFixRequired") });
      } else if (result.error === "exists" || result.error === "staff" || result.error === "pending") {
        setFieldErrors({ email: messages[result.error] });
      } else {
        setFieldErrors({});
      }
      const fieldMessage = messages[result.error];
      setError(
        result.error === "exists" || result.error === "staff" || result.error === "pending"
          ? fieldMessage
          : fieldMessage
            ? t("signupFixAlert")
            : t("signupErrorGeneric")
      );
      revealIssue();
      return;
    }
    setSubmittedEmail(result.email || form.email);
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo lang={lang} path={withLocale(lang, "/signup")} title={`${t("createAccount")} | Mattex Marketplace`} description={t("createAccountHint")} noindex />
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-10">
        <AccountFormCard>
          {submittedEmail ? (
            <>
              <AccountFormHeader eyebrow={t("account")} title={t("signupReadyTitle")} />
              <p className="mt-3 text-sm font-medium text-ink break-all">{submittedEmail}</p>
              <p className="mt-2 text-sm text-mute leading-relaxed">{t("signupReadyBody")}</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Link to={withLocale(lang, "/")} className="btn-primary inline-flex w-full justify-center !py-3">
                  {t("signupReadyShop")}
                </Link>
                {SHOW_RFQ ? (
                  <Link to={withLocale(lang, "/rfqs")} className="btn-soft inline-flex w-full justify-center !py-3">
                    {t("signupReadyQuotes")}
                  </Link>
                ) : (
                  <Link to={withLocale(lang, "/login")} className="btn-soft inline-flex w-full justify-center !py-3">
                    {t("profile")}
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <AccountFormHeader
                eyebrow={t("account")}
                title={t("createAccountTitle")}
                hint={t("createAccountHint")}
                showRequired
              />

              <form ref={formRef} className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
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

                <AccountSection title={t("userInfo")} columns={1}>
                  <AccountField label={t("workEmail")} required error={fieldErrors.email}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="you@company.com"
                      className="field-input"
                      autoComplete="email"
                    />
                  </AccountField>
                  <AccountField label={t("fullName")} required error={fieldErrors.name}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder={t("phFullName")}
                      className="field-input"
                      autoComplete="name"
                    />
                  </AccountField>
                  <AccountField label={t("jobTitle")} required error={fieldErrors.jobTitle}>
                    <input
                      type="text"
                      value={form.jobTitle}
                      onChange={(e) => setField("jobTitle", e.target.value)}
                      placeholder={t("phJobTitle")}
                      className="field-input"
                      autoComplete="organization-title"
                    />
                  </AccountField>
                  <BuyerContactFields t={t} value={form} onChange={setField} errors={fieldErrors} />
                </AccountSection>

                <AccountSection title={t("password")} columns={1}>
                  <AccountField label={t("password")} required error={fieldErrors.password}>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      onInput={(e) => setField("password", e.currentTarget.value)}
                      placeholder="••••••••"
                      className="field-input"
                      autoComplete="new-password"
                      aria-describedby="signup-password-reqs"
                    />
                  </AccountField>
                  <AccountField label={t("confirmPassword")} required error={fieldErrors.confirmPassword}>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => setField("confirmPassword", e.target.value)}
                      onInput={(e) => setField("confirmPassword", e.currentTarget.value)}
                      placeholder="••••••••"
                      className="field-input"
                      autoComplete="new-password"
                    />
                  </AccountField>
                  <PasswordChecklist
                    id="signup-password-reqs"
                    password={form.password}
                    confirmPassword={form.confirmPassword}
                    hasError={Boolean(fieldErrors.password || fieldErrors.confirmPassword)}
                  />
                </AccountSection>

                <AccountSection title={t("companyDetails")} columns={1}>
                  <AccountField label={t("companyName")} required error={fieldErrors.companyName}>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => setField("companyName", e.target.value)}
                      placeholder={t("phCompanyName")}
                      className="field-input"
                      autoComplete="organization"
                    />
                  </AccountField>
                  <AccountField label={t("companyReg")} required error={fieldErrors.companyReg}>
                    <input
                      type="text"
                      value={form.companyReg}
                      onChange={(e) => setField("companyReg", e.target.value)}
                      placeholder={t("phCompanyReg")}
                      className="field-input"
                    />
                  </AccountField>
                  <AccountField label={t("companyPhone")}>
                    <input
                      type="tel"
                      value={form.companyPhone}
                      onChange={(e) => setField("companyPhone", e.target.value)}
                      placeholder={t("phCompanyPhone")}
                      className="field-input"
                    />
                  </AccountField>
                  <AccountField label={t("projectName")} hint={t("profileProjectHint")}>
                    <ProjectListEditor
                      idPrefix="signup-project"
                      projects={form.projects}
                      onChange={(projects) => setField("projects", projects)}
                    />
                  </AccountField>
                  <AccountField label={t("companyAddress")} required error={fieldErrors.companyAddress}>
                    <textarea
                      rows={2}
                      value={form.companyAddress}
                      onChange={(e) => setField("companyAddress", e.target.value)}
                      placeholder={t("phCompanyAddress")}
                      className="field-input resize-y"
                    />
                  </AccountField>
                </AccountSection>

                <button type="submit" disabled={busy} className="btn-primary w-full !py-3 disabled:opacity-60">
                  {t("createAccount")}
                </button>
              </form>

              <p className="mt-5 text-sm text-mute">
                {t("alreadyRegistered")}{" "}
                <Link to={withLocale(lang, "/login")} className="font-semibold text-brand-600 hover:underline">
                  {t("login")}
                </Link>
              </p>
            </>
          )}
        </AccountFormCard>
      </main>
    </div>
  );
}
