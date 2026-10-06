import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import GoogleAnalytics from "./components/GoogleAnalytics";
import ScrollToTop from "./components/ScrollToTop";
import { LanguageProvider } from "./i18n.jsx";
import { SHOW_RFQ, SHOW_SPEC_MATCH } from "./lib/flags";
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import DetailsPage from "./pages/DetailsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RfqPage from "./pages/RfqPage";
import RfqsPage from "./pages/RfqsPage";
import WhatsappPage from "./pages/WhatsappPage";
import WhatsappChatPage from "./pages/WhatsappChatPage";
import SupplierPage from "./pages/SupplierPage";
import AdminPortal from "./pages/admin/AdminPortal";
import StaffSetPasswordPage from "./pages/admin/StaffSetPasswordPage";
import StaffForgotPasswordPage from "./pages/admin/StaffForgotPasswordPage";
import PublicQuotePage from "./pages/PublicQuotePage";
import SpecMatchPage from "./pages/SpecMatchPage";
import MidAutumnPage from "./pages/MidAutumnPage";
import CatalogUpdateBanner from "./components/CatalogUpdateBanner";
import FloatingActions from "./components/FloatingActions";
import { getCategoryByName, ensureBuyerSession } from "./lib/store";
import { adminOrigin, isAdminSurface } from "./lib/origins";
import { preferredLocale, withLocale } from "./lib/locale";
import { useStore } from "./hooks/useStore";

function BuyerSessionGuard() {
  const { user } = useStore();
  const navigate = useNavigate();
  const { lang } = useParams();
  useEffect(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem("subbie_disabled_kick") === "1";
    } catch {
      flagged = false;
    }
    if (!flagged || user) return;
    const locale = lang === "zh" ? "zh" : "en";
    const path = window.location.pathname || "";
    if (!path.includes("/login")) navigate(`/${locale}/login`, { replace: true });
  }, [user, lang, navigate]);
  return null;
}

function LangLayout() {
  const { lang } = useParams();
  if (lang !== "en" && lang !== "zh") {
    return <Navigate to={withLocale(preferredLocale(), "/")} replace />;
  }
  return (
    <>
      <BuyerSessionGuard />
      <CatalogUpdateBanner />
      <Outlet />
      <FloatingActions />
    </>
  );
}

function GreenFilterRedirect() {
  const { lang } = useParams();
  const locale = lang === "zh" ? "zh" : "en";
  return <Navigate to={{ pathname: `/${locale}`, search: "?green=1", hash: "products" }} replace />;
}

function QuoteLegacyRedirect() {
  const { token } = useParams();
  return <Navigate to={`/zh/quote/${token}`} replace />;
}

function PreferredRedirect({ to = "/" }) {
  return <Navigate to={withLocale(preferredLocale(), to)} replace />;
}

function LegacyParam({ prefix }) {
  const params = useParams();
  const id = params.id || params.slug || params.rfqId;
  return <Navigate to={withLocale(preferredLocale(), `/${prefix}/${id}`)} replace />;
}

function CatalogIndexRedirect() {
  const { lang } = useParams();
  const [params] = useSearchParams();
  const locale = lang === "zh" ? "zh" : "en";
  const found = getCategoryByName(params.get("cat") || "");
  if (found) return <Navigate to={`/${locale}/catalog/${found.id}`} replace />;
  return <Navigate to={{ pathname: `/${locale}`, hash: "products" }} replace />;
}

function RfqsRoute() {
  const { lang } = useParams();
  if (!SHOW_RFQ) return <Navigate to={`/${lang === "zh" ? "zh" : "en"}`} replace />;
  return <RfqsPage />;
}

function UnknownLangPath() {
  const { lang } = useParams();
  return <Navigate to={withLocale(preferredLocale(), "/")} replace />;
}

function AdminHostRedirect() {
  if (typeof window !== "undefined") {
    const next = `${adminOrigin()}/${window.location.search}${window.location.hash}`;
    window.location.replace(next);
  }
  return null;
}

function BootGate() {
  const { catalogBootReady } = useStore();
  useEffect(() => {
    if (!catalogBootReady) return undefined;
    const boot = document.querySelector("[data-boot='mattex']");
    if (!boot) return undefined;
    const frame = requestAnimationFrame(() => {
      boot.hidden = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [catalogBootReady]);
  return null;
}

export default function App() {
  if (isAdminSurface()) {
    return (
      <BrowserRouter>
        <LanguageProvider>
          <BootGate />
          <ScrollToTop />
          <Routes>
            <Route path="/set-password" element={<StaffSetPasswordPage />} />
            <Route path="/forgot-password" element={<StaffForgotPasswordPage />} />
            <Route path="*" element={<AdminPortal />} />
          </Routes>
        </LanguageProvider>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <LanguageProvider>
        <BootGate />
        <ScrollToTop />
        <GoogleAnalytics />
        <Routes>
          <Route path="/" element={<PreferredRedirect />} />
          <Route path="/green" element={<PreferredRedirect to={{ pathname: "/", search: "?green=1", hash: "products" }} />} />
          <Route path="/sales" element={<PreferredRedirect />} />
          <Route path="/admin" element={<AdminHostRedirect />} />
          <Route path="/admin/*" element={<AdminHostRedirect />} />
          <Route path="/catalog" element={<PreferredRedirect to={{ pathname: "/", hash: "products" }} />} />
          <Route path="/catalog/:slug" element={<LegacyParam prefix="catalog" />} />
          <Route path="/login" element={<PreferredRedirect to="/login" />} />
          <Route path="/signup" element={<PreferredRedirect to="/signup" />} />
          <Route path="/forgot-password" element={<PreferredRedirect to="/forgot-password" />} />
          <Route path="/reset-password" element={<PreferredRedirect to="/reset-password" />} />
          <Route path="/rfq" element={<PreferredRedirect to="/rfq" />} />
          <Route path="/mid-autumn" element={<Navigate to="/zh/promo" replace />} />
          <Route path="/promo" element={<Navigate to="/zh/promo" replace />} />
          <Route path="/spec-match" element={<PreferredRedirect to={SHOW_SPEC_MATCH ? "/spec-match" : "/"} />} />
          <Route path="/rfqs" element={<PreferredRedirect to={SHOW_RFQ ? "/rfqs" : "/"} />} />
          <Route path="/whatsapp" element={<PreferredRedirect to="/whatsapp" />} />
          <Route path="/whatsapp-chat" element={<PreferredRedirect to="/whatsapp-chat" />} />
          <Route path="/details/:id" element={<LegacyParam prefix="details" />} />
          <Route path="/supplier/:slug" element={<LegacyParam prefix="supplier" />} />
          <Route path="/whatsapp/:id" element={<LegacyParam prefix="whatsapp" />} />
          <Route path="/whatsapp-chat/:rfqId" element={<LegacyParam prefix="whatsapp-chat" />} />
          <Route path="/email-sent/:rfqId" element={<Navigate to="/zh/rfqs" replace />} />
          <Route path="/quote/:token" element={<QuoteLegacyRedirect />} />
          <Route path="/emails" element={<Navigate to="/zh" replace />} />
          <Route path="/emails/:id" element={<Navigate to="/zh" replace />} />

          <Route path="/:lang" element={<LangLayout />}>
            <Route index element={<HomePage />} />
            <Route path="green" element={<GreenFilterRedirect />} />
            <Route path="mid-autumn" element={<Navigate to="../promo" replace />} />
            <Route path="promo" element={<MidAutumnPage />} />
            <Route path="sales" element={<Navigate to=".." replace />} />
            <Route path="catalog" element={<CatalogIndexRedirect />} />
            <Route path="catalog/:slug" element={<CatalogPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="details/:id" element={<DetailsPage />} />
            <Route path="supplier/:slug" element={<SupplierPage />} />
            <Route path="rfq" element={<RfqPage />} />
            <Route path="spec-match" element={SHOW_SPEC_MATCH ? <SpecMatchPage /> : <Navigate to=".." replace />} />
            <Route path="rfqs" element={<RfqsRoute />} />
            <Route path="whatsapp" element={<WhatsappPage />} />
            <Route path="whatsapp/:id" element={<WhatsappPage />} />
            <Route path="whatsapp-chat" element={<WhatsappChatPage />} />
            <Route path="whatsapp-chat/:rfqId" element={<WhatsappChatPage />} />
            <Route path="email-sent/:rfqId" element={<Navigate to="../rfqs" replace />} />
            <Route path="quote/:token" element={<PublicQuotePage />} />
            <Route path="*" element={<UnknownLangPath />} />
          </Route>
        </Routes>
      </LanguageProvider>
    </BrowserRouter>
  );
}
