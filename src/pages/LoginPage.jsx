import { useEffect, useState } from "react";
import { useRevealFormIssue } from "../lib/formFocus";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import Seo from "../components/Seo";
import { AccountField, AccountFormCard, AccountFormHeader, AccountSection, PasswordInput } from "../components/AccountForm";
import { useStore } from "../hooks/useStore";
import { useLanguage } from "../i18n";
import { withLocale } from "../lib/locale";
import { SHOW_RFQ } from "../lib/flags";
import { consumePendingAfterAuth, closeAuthModal, loginUser, logoutUser, takeDisabledKick, updateUserProfile } from "../lib/store";
import ProjectListEditor from "../components/ProjectListEditor";

function profileFromUser(user) {
  return {
    name: user?.name || "",
    phone: user?.phone || "",
    jobTitle: user?.jobTitle || "",
    companyName: user?.companyName || "",
    companyReg: user?.companyReg || "",
    companyPhone: user?.companyPhone || "",
    companyAddress: user?.companyAddress || "",
    projects: Array.isArray(user?.projects) && user.projects.length ? user.projects : user?.project ? [user.project] : [""],
  };
}

export default function LoginPage() {
  const { user } = useStore();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [saveMsg, setSaveMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { formRef, revealIssue } = useRevealFormIssue();

  useEffect(() => {
    closeAuthModal();
  }, []);

  useEffect(() => {
    if (user) return;
    if (takeDisabledKick()) setError(t("loginErrorDisabled"));
  }, [user, t]);

  useEffect(() => {
    if (!editing) setProfile(profileFromUser(user));
  }, [user, editing]);

  function setProfileField(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setError("");
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const nextErrors = {};
    if (!String(email || "").trim()) nextErrors.email = t("signupFixRequired");
    if (!String(password || "").trim()) nextErrors.password = t("signupFixRequired");
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError(t("signupFixAlert"));
      revealIssue();
      return;
    }
    setBusy(true);
    const result = await loginUser({ email, password });
    setBusy(false);
    if (!result.ok) {
      setFieldErrors({});
      setError(
        result.error === "password"
          ? t("loginErrorPassword")
          : result.error === "staff"
            ? t("loginErrorStaff")
            : result.error === "disabled"
              ? t("loginErrorDisabled")
              : result.error === "pending"
                ? t("loginErrorPending")
                : result.error === "rejected"
                  ? t("loginErrorRejected")
                  : result.error === "missing"
                    ? t("loginErrorMissing")
                    : t("loginErrorGeneric")
      );
      revealIssue();
      return;
    }
    navigate(withLocale(lang, consumePendingAfterAuth() || "/"));
  }

  function onSaveProfile(e) {
    e.preventDefault();
    const errors = {};
    if (!String(profile.companyAddress || "").trim()) errors.companyAddress = t("signupFixRequired");
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError(t("signupFixAlert"));
      revealIssue();
      return;
    }
    const result = updateUserProfile(profile);
    if (!result.ok) {
      const messages = {
        name: t("fullName"),
        companyName: t("companyName"),
        companyAddress: t("companyAddress"),
      };
      if (result.error === "companyAddress") {
        setFieldErrors({ companyAddress: t("signupFixRequired") });
      }
      setError(messages[result.error] ? `${messages[result.error]} *` : t("saveErrorGeneric"));
      revealIssue();
      return;
    }
    setError("");
    setFieldErrors({});
    setSaveMsg(t("profileSaved"));
    setEditing(false);
  }

  return (
    <div className="bg-paper min-h-screen">
      <Seo lang={lang} path={withLocale(lang, "/login")} title={`${t("login")} | Mattex Marketplace`} description={t("loginRequiredRfq")} noindex />
      <SiteHeader />
      <main className={`${user ? "max-w-2xl" : "max-w-md"} mx-auto px-4 py-8 sm:py-10`}>
        <AccountFormCard>
          <AccountFormHeader
            eyebrow={user ? t("profile") : t("account")}
            title={user ? t("profile") : t("login")}
            hint={user ? t("profileHint") : t("loginRequiredRfq")}
            showRequired={Boolean(user && editing)}
          />

          {user ? (
            <div className="mt-6 space-y-5">
              {editing ? (
                <form ref={formRef} className="space-y-5" onSubmit={onSaveProfile} noValidate>
                  <p className="rounded-lg border border-[#c5ccc8] bg-[#e6eae7] px-3 py-2 text-xs font-medium text-[#4a534e]">
                    {t("profileLockedHint")}
                  </p>
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

                  <AccountSection title={t("userInfo")}>
                    <AccountField label={t("email")} locked lockedHint={t("profileCannotEdit")}>
                      <input type="text" value={user.email} className="field-input" />
                    </AccountField>
                    <AccountField label={t("fullName")} locked lockedHint={t("profileCannotEdit")}>
                      <input type="text" value={profile.name} className="field-input" />
                    </AccountField>
                    <AccountField label={t("jobTitle")}>
                      <input
                        type="text"
                        value={profile.jobTitle}
                        onChange={(e) => setProfileField("jobTitle", e.target.value)}
                        placeholder={t("phJobTitle")}
                        className="field-input"
                        autoComplete="organization-title"
                      />
                    </AccountField>
                    <AccountField label={t("mobilePhone")}>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfileField("phone", e.target.value)}
                        placeholder={t("phMobilePhone")}
                        className="field-input"
                        autoComplete="tel"
                      />
                    </AccountField>
                  </AccountSection>

                  <AccountSection title={t("companyDetails")}>
                    <AccountField label={t("companyName")} locked lockedHint={t("profileCannotEdit")}>
                      <input type="text" value={profile.companyName} className="field-input" />
                    </AccountField>
                    <AccountField label={t("companyReg")} locked lockedHint={t("profileCannotEdit")}>
                      <input type="text" value={profile.companyReg} className="field-input" />
                    </AccountField>
                    <AccountField label={t("companyPhone")}>
                      <input
                        type="tel"
                        value={profile.companyPhone}
                        onChange={(e) => setProfileField("companyPhone", e.target.value)}
                        placeholder={t("phCompanyPhone")}
                        className="field-input"
                      />
                    </AccountField>
                    <AccountField className="sm:col-span-2" label={t("projectName")} hint={t("profileProjectHint")}>
                      <ProjectListEditor
                        idPrefix="profile-project"
                        projects={profile.projects}
                        onChange={(projects) => setProfileField("projects", projects)}
                      />
                    </AccountField>
                    <AccountField
                      className="sm:col-span-2"
                      label={t("companyAddress")}
                      required
                      error={fieldErrors.companyAddress}
                    >
                      <textarea
                        rows={2}
                        value={profile.companyAddress}
                        onChange={(e) => setProfileField("companyAddress", e.target.value)}
                        placeholder={t("phCompanyAddress")}
                        className="field-input resize-y"
                      />
                    </AccountField>
                  </AccountSection>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button type="submit" className="btn-primary !py-3">
                      {t("saveProfile")}
                    </button>
                    <button
                      type="button"
                      className="btn-soft !py-3"
                      onClick={() => {
                        setEditing(false);
                        setError("");
                        setFieldErrors({});
                        setProfile(profileFromUser(user));
                      }}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">{t("signedIn")}</p>
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                      onClick={() => {
                        setEditing(true);
                        setSaveMsg("");
                        setError("");
                        setFieldErrors({});
                      }}
                    >
                      {t("editProfile")}
                    </button>
                  </div>

                  {saveMsg ? (
                    <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
                      {saveMsg}
                    </p>
                  ) : null}

                  <AccountSection title={t("userInfo")}>
                    <ProfileValue label={t("email")} value={user.email} />
                    <ProfileValue label={t("fullName")} value={user.name} />
                    <ProfileValue label={t("jobTitle")} value={user.jobTitle} />
                    <ProfileValue label={t("mobilePhone")} value={user.phone} />
                  </AccountSection>

                  <AccountSection title={t("companyDetails")}>
                    <ProfileValue label={t("companyName")} value={user.companyName} />
                    <ProfileValue label={t("companyReg")} value={user.companyReg} />
                    <ProfileValue label={t("companyPhone")} value={user.companyPhone} />
                    <ProfileValue label={t("projectName")} value={user.project} />
                    <ProfileValue className="sm:col-span-2" label={t("companyAddress")} value={user.companyAddress} />
                  </AccountSection>

                  <div className="grid gap-2">
                    <Link to={withLocale(lang, "/rfq")} className="btn-primary !py-2.5">
                      {t("openRfqDraft")}
                    </Link>
                    {SHOW_RFQ ? (
                      <Link to={withLocale(lang, "/rfqs")} className="btn-soft !py-2.5 !border-brand-600 !text-brand-600">
                        {t("myRfqs")}
                      </Link>
                    ) : null}
                    <Link to={withLocale(lang, "/")} className="btn-soft !py-2.5">
                      {t("continueShopping")}
                    </Link>
                    <button type="button" onClick={() => logoutUser()} className="btn-soft !py-2.5">
                      {t("logout")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
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
                <AccountField label={t("email")} required error={fieldErrors.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                      setFieldErrors((prev) => {
                        if (!prev.email) return prev;
                        const next = { ...prev };
                        delete next.email;
                        return next;
                      });
                    }}
                    placeholder={t("phEmail")}
                    className="field-input"
                    autoComplete="email"
                  />
                </AccountField>
                <AccountField label={t("password")} required error={fieldErrors.password}>
                  <PasswordInput
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                      setFieldErrors((prev) => {
                        if (!prev.password) return prev;
                        const next = { ...prev };
                        delete next.password;
                        return next;
                      });
                    }}
                    placeholder={t("phPassword")}
                    autoComplete="current-password"
                  />
                </AccountField>
                <button type="submit" disabled={busy} className="btn-primary w-full !py-3 disabled:opacity-60">
                  {t("login")}
                </button>
              </form>
              <p className="mt-3 text-sm">
                <Link to={withLocale(lang, "/forgot-password")} className="font-semibold text-brand-600 hover:underline">
                  {t("forgotPassword")}
                </Link>
              </p>
              <p className="mt-5 text-sm text-mute">
                {t("noAccount")}{" "}
                <Link to={withLocale(lang, "/signup")} className="font-semibold text-brand-600 hover:underline">
                  {t("openMarketplaceAccount")}
                </Link>
              </p>
            </>
          )}
        </AccountFormCard>
      </main>
    </div>
  );
}

function ProfileValue({ label, value, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <p className="text-xs font-medium text-mute mb-1">{label}</p>
      <p className="text-sm font-medium text-ink break-all">{value || "—"}</p>
    </div>
  );
}
