import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import GoogleAnalytics from "./components/GoogleAnalytics";
import ScrollToTop from "./components/ScrollToTop";
import { LanguageProvider } from "./i18n.jsx";
import { SHOW_RFQ } from "./lib/flags";
import HomePage from "./pages/HomePage";
import GreenPage from "./pages/GreenPage";
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
import { getCategoryByName, ensureBuyerSession } from "./lib/store";
import { adminOrigin, isAdminSurface } from "./lib/origins";
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
    return <Navigate to="/en" replace />;
  }
  return (
    <>
      <BuyerSessionGuard />
      <Outlet />
    </>
  );
}

function QuoteLegacyRedirect() {
  const { token } = useParams();
  return <Navigate to={`/zh/quote/${token}`} replace />;
}

function LegacyParam({ prefix }) {
  const params = useParams();
  const id = params.id || params.slug || params.rfqId;
  return <Navigate to={`/en/${prefix}/${id}`} replace />;
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
  return <Navigate to={`/${lang === "zh" ? "zh" : "en"}`} replace />;
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
          <Route path="/" element={<Navigate to="/en" replace />} />
          <Route path="/green" element={<Navigate to="/en/green" replace />} />
          <Route path="/sales" element={<Navigate to="/en" replace />} />
          <Route path="/admin" element={<AdminHostRedirect />} />
          <Route path="/admin/*" element={<AdminHostRedirect />} />
          <Route path="/catalog" element={<Navigate to={{ pathname: "/en", hash: "products" }} replace />} />
          <Route path="/catalog/:slug" element={<LegacyParam prefix="catalog" />} />
          <Route path="/login" element={<Navigate to="/en/login" replace />} />
          <Route path="/signup" element={<Navigate to="/en/signup" replace />} />
          <Route path="/forgot-password" element={<Navigate to="/en/forgot-password" replace />} />
          <Route path="/reset-password" element={<Navigate to="/en/reset-password" replace />} />
          <Route path="/rfq" element={<Navigate to="/en/rfq" replace />} />
          <Route path="/rfqs" element={<Navigate to={SHOW_RFQ ? "/en/rfqs" : "/en"} replace />} />
          <Route path="/whatsapp" element={<Navigate to="/en/whatsapp" replace />} />
          <Route path="/whatsapp-chat" element={<Navigate to="/en/whatsapp-chat" replace />} />
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
            <Route path="green" element={<GreenPage />} />
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
