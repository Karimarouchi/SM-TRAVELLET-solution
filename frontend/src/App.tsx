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
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import AdminPage from "@/pages/AdminPage";
import AdminSalesPage from "@/pages/AdminSalesPage";
import { DialogHost } from "@/components/ui/dialog-host";
import AdminFinancePage from "@/pages/AdminFinancePage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AdminSettingsPage from "@/pages/AdminSettingsPage";
import AdminStaffStatsPage from "@/pages/AdminStaffStatsPage";
import AdminPipelineStagePage from "@/pages/AdminPipelineStagePage";
import AdminProgrammesPage from "@/pages/AdminProgrammesPage";
import AdminVisaDocumentsPage from "@/pages/AdminVisaDocumentsPage";
import AdminAvisPage from "@/pages/AdminAvisPage";
import RhHomePage from "@/pages/rh/RhHomePage";
import RhEmployeesPage from "@/pages/rh/RhEmployeesPage";
import RhSettingsPage from "@/pages/rh/RhSettingsPage";
import RhLeavePage from "@/pages/rh/RhLeavePage";
import RhAttendancePage from "@/pages/rh/RhAttendancePage";
import RhPayrollPage from "@/pages/rh/RhPayrollPage";
import RhAbsencesPage from "@/pages/rh/RhAbsencesPage";
import MyRhPage from "@/pages/rh/MyRhPage";
import SalesEspacePage from "@/pages/SalesEspacePage";
import SalesCodesPage from "@/pages/SalesCodesPage";
import StudentDetailPage from "@/pages/StudentDetailPage";
import RdvDossiersPage, { RdvVisasPage } from "@/pages/RdvDossiersPage";
import WhatsAppPage from "@/pages/WhatsAppPage";
import MailPage from "@/pages/MailPage";
import StudentMailsPage from "@/pages/StudentMailsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import ArchivePage from "@/pages/ArchivePage";

export default function App() {
  return (
    <LanguageProvider>
    <HashRouter>
      <DialogHost />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthSwitch defaultMode="login" />} />
        <Route path="/register" element={<AuthSwitch defaultMode="register" />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route element={<AppLayout />}>
          <Route path="/espace" element={<EspacePage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/accelerateur" element={<AcceleratorPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/sales" element={<AdminSalesPage />} />
          <Route path="/admin/finance" element={<AdminFinancePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/equipe/:id" element={<AdminStaffStatsPage />} />
          <Route path="/admin/pipeline/:stage" element={<AdminPipelineStagePage />} />
          <Route path="/admin/programmes" element={<AdminProgrammesPage />} />
          <Route path="/admin/visa-documents" element={<AdminVisaDocumentsPage />} />
          <Route path="/admin/avis" element={<AdminAvisPage />} />
          <Route path="/admin/rh" element={<RhHomePage />} />
          <Route path="/admin/rh/employes" element={<RhEmployeesPage />} />
          <Route path="/admin/rh/conges" element={<RhLeavePage />} />
          <Route path="/admin/rh/presences" element={<RhAttendancePage />} />
          <Route path="/admin/rh/paie" element={<RhPayrollPage />} />
          <Route path="/admin/rh/absences" element={<RhAbsencesPage />} />
          <Route path="/admin/rh/parametres" element={<RhSettingsPage />} />
          <Route path="/rh" element={<MyRhPage />} />
          <Route path="/conseiller" element={<SalesEspacePage />} />
          <Route path="/conseiller/codes" element={<SalesCodesPage />} />
          <Route path="/conseiller/etudiants/:id" element={<StudentDetailPage />} />
          <Route path="/rdv" element={<RdvDossiersPage />} />
          <Route path="/rdv/etudiants/:id" element={<StudentDetailPage />} />
          <Route path="/rdv/visas" element={<RdvVisasPage />} />
          {/* /whatsapp seul (anciens liens, notifications) ouvre la messagerie des non inscrits. */}
          <Route path="/whatsapp" element={<Navigate to="/whatsapp/prospects" replace />} />
          <Route path="/whatsapp/:segment" element={<WhatsAppPage />} />
          <Route path="/mail" element={<MailPage />} />
          <Route path="/mes-mails" element={<StudentMailsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/archive" element={<ArchivePage />} />
        </Route>
      </Routes>
    </HashRouter>
    </LanguageProvider>
  );
}
