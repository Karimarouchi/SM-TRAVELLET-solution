import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "@/lib/i18n";
import { AuthSwitch } from "@/components/ui/auth-switch";
import AppLayout from "@/pages/AppLayout";
import EspacePage from "@/pages/EspacePage";
import ProfilePage from "@/pages/ProfilePage";
import AcceleratorPage from "@/pages/AcceleratorPage";
import DocumentsPage from "@/pages/DocumentsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import AdminPage from "@/pages/AdminPage";
import AdminSalesPage from "@/pages/AdminSalesPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AdminSettingsPage from "@/pages/AdminSettingsPage";
import AdminProgrammesPage from "@/pages/AdminProgrammesPage";
import AdminVisaDocumentsPage from "@/pages/AdminVisaDocumentsPage";
import AdminAvisPage from "@/pages/AdminAvisPage";
import SalesEspacePage from "@/pages/SalesEspacePage";
import SalesCodesPage from "@/pages/SalesCodesPage";
import StudentDetailPage from "@/pages/StudentDetailPage";
import RdvDossiersPage from "@/pages/RdvDossiersPage";
import MessagesPage from "@/pages/MessagesPage";
import ArchivePage from "@/pages/ArchivePage";

export default function App() {
  return (
    <LanguageProvider>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthSwitch defaultMode="login" />} />
        <Route path="/register" element={<AuthSwitch defaultMode="register" />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route element={<AppLayout />}>
          <Route path="/espace" element={<EspacePage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/accelerateur" element={<AcceleratorPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/sales" element={<AdminSalesPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/programmes" element={<AdminProgrammesPage />} />
          <Route path="/admin/visa-documents" element={<AdminVisaDocumentsPage />} />
          <Route path="/admin/avis" element={<AdminAvisPage />} />
          <Route path="/conseiller" element={<SalesEspacePage />} />
          <Route path="/conseiller/codes" element={<SalesCodesPage />} />
          <Route path="/conseiller/etudiants/:id" element={<StudentDetailPage />} />
          <Route path="/rdv" element={<RdvDossiersPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/archive" element={<ArchivePage />} />
        </Route>
      </Routes>
    </HashRouter>
    </LanguageProvider>
  );
}
