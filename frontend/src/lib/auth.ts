import type { PassportStatus } from "@/lib/passport";
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function mediaUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  return `${API_URL}${path}`;
}
const SESSION_KEY = "smtravel_session";

export type UserRole = "STUDENT" | "SALES" | "ADMIN" | "RDV";

export type AuthUser = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  dateNaissance: string;
  role: UserRole;
  roles: UserRole[];
  permissions?: string[];
  onboardingCompleted?: boolean;
  isActive?: boolean;
  emailVerified?: boolean;
  avatarUrl?: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  profile?: StudentProfile | null;
};

export type StudentProfile = {
  phone: string;
  nationality: string;
  residenceCountry: string;
  city: string;
  currentStudyLevel: string;
  lastDiploma: string;
  studyField: string;
  currentInstitution: string;
  diplomaYear: string | number;
  preferredCountries: string[];
  preferredCity: string;
  targetLevel: string;
  targetField: string;
  targetIntake: string;
  targetUniversity: string;
  annualBudget: string;
  fundingMode: string;
  languageLevel: string;
  languageLevelFrench: string;
  languageLevelEnglish: string;
  languageLevelGerman?: string;
  languageLevelItalian?: string;
  languageLevelSpanish?: string;
  languageTest: string;
  languageTestFrench: string;
  languageTestEnglish: string;
  languageTestFrenchOther: string;
  languageTestEnglishOther: string;
  languageTestsExtra?: Record<string, { test: string; other: string }>;
  hasPassport: boolean | null;
  passportNumber: string;
  passportExpiresOn: string;
  passportStatus: PassportStatus;
  visaAlreadyRequested: boolean | null;
  availableDocuments: string;
  onboardingCompleted: boolean;
  assignedSalesId: string | null;
  assignedSalesName?: string;
  lockedFields: string[];
  dossierStage: string;
};

export type RegisterPayload = {
  nom: string;
  prenom: string;
  email: string;
  dateNaissance: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  salesCode?: string;
};

export const DEMO_ACCOUNT = {
  email: "demo@smtravel.fr",
  password: "Demo2024!"
};

export function getSession(): AuthSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function postLoginPath(session: AuthSession) {
  if (session.user.emailVerified === false) return "/verify-email";
  if (session.user.role === "ADMIN") return "/admin";
  if (session.user.role === "SALES") return "/conseiller";
  if (session.user.role === "STUDENT" && !session.user.onboardingCompleted) {
    return "/onboarding";
  }
  return "/espace";
}

export type BoardStudent = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  onboardingCompleted: boolean;
  assignedSalesId: string | null;
  residenceCountry: string;
  preferredCountries: string[];
  targetField: string;
  phone: string;
  city: string;
  currentStudyLevel: string;
  avatarUrl?: string;
};

export type BoardSales = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  phone: string;
  jobTitle: string;
  isActive: boolean;
  studentCount: number;
  students: BoardStudent[];
};

export type AssignmentBoard = {
  autoAssignSales: boolean;
  unassigned: BoardStudent[];
  sales: BoardSales[];
};

export type DashboardKpi = { value: number; hint: string };

export type AdminDashboard = {
  filters: {
    period: string;
    salesId: string;
    destination: string;
    status: string;
    destinations: string[];
    sales: Array<{ id: string; prenom: string; nom: string; isActive: boolean }>;
  };
  kpis: {
    students: DashboardKpi;
    completed: DashboardKpi;
    newcomers: DashboardKpi;
    incomplete: DashboardKpi;
    activeSales: DashboardKpi;
    unassigned: DashboardKpi;
    visasObtainedMonth: DashboardKpi;
    stalledDossiers: DashboardKpi;
  };
  pipeline: Array<{ key: string; label: string; count: number }>;
  funnel: Array<{ key: string; label: string; count: number }>;
  monthlyGrowth: Array<{ month: string; current: number; previous: number }>;
  alerts: Array<{
    id: string;
    studentId: string | null;
    student: string;
    sales: string;
    problem: string;
    sinceDays: number;
    tone: "danger" | "warning" | "success";
    // Page où régler l'alerte et libellé du bouton d'action.
    link?: string;
    actionLabel?: string;
  }>;
  destinations: Array<{ name: string; count: number; percent: number }>;
  salesPerformance: Array<{
    id: string;
    prenom: string;
    nom: string;
    email: string;
    phone: string;
    isActive: boolean;
    students: number;
    completed: number;
    share: number;
  }>;
  rdvPerformance: Array<{
    id: string;
    prenom: string;
    nom: string;
    email: string;
    isActive: boolean;
    students: number;
    completed: number;
    share: number;
  }>;
  autoAssignSales: boolean;
};

export async function fetchAssignmentBoard() {
  return request<AssignmentBoard>("/api/admin/board");
}

export type PipelineStageKey =
  | "onboarding"
  | "ready_to_apply"
  | "applied"
  | "waiting_response"
  | "interview"
  | "accepted"
  | "visa_preparation"
  | "visa_submitted"
  | "completed"
  | "rejected"
  | "visa_rejected"
  | "postponed"
  | "visa_postponed"
  | "no_application";

export type PipelineStage = { key: PipelineStageKey; label: string };

export type StudentApplicationSummary = {
  id: string;
  countryName: string;
  universityName: string;
  status: string;
  visaStatus: string | null;
  updatedAt: string | null;
};

export type StudentOverview = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  dateNaissance: string;
  createdAt: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  assignedSalesId: string | null;
  assignedSalesName: string | null;
  avatarUrl: string;
  residenceCountry: string;
  targetField: string;
  phone: string;
  city: string;
  currentStudyLevel: string;
  preferredCountries: string[];
  // Liste admin : état et date seulement, jamais le numéro.
  passportStatus: PassportStatus;
  passportExpiresOn: string;
  passportMonthsLeft: number | null;
  isActive: boolean;
  dossierStage: string;
  stage: PipelineStageKey;
  applications: StudentApplicationSummary[];
};

export async function fetchStudentsOverview() {
  return request<{ stages: PipelineStage[]; students: StudentOverview[] }>("/api/admin/students-overview");
}

export async function setStudentActive(studentId: string, isActive: boolean) {
  return request<{ id: string; isActive: boolean }>(`/api/admin/students/${studentId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  });
}

// Répartition automatique : équitable (par charge) ou par pourcentage.
export type AutoAssignMode = "balanced" | "percentage";
export type AutoAssignShare = {
  salesId: string;
  prenom: string;
  nom: string;
  email: string;
  isActive: boolean;
  percent: number;
  receivedStudents: number;
  receivedWhatsapp: number;
};
export type AutoAssignSettings = { mode: AutoAssignMode; shares: AutoAssignShare[]; totalPercent: number };

export async function fetchAutoAssignShares() {
  return request<AutoAssignSettings>("/api/admin/auto-assign-shares");
}

export async function saveAutoAssignShares(payload: { mode: AutoAssignMode; shares: { salesId: string; percent: number }[] }) {
  return request<AutoAssignSettings>("/api/admin/auto-assign-shares", { method: "PUT", body: JSON.stringify(payload) });
}

export type StudentDeletionPreview = {
  id: string;
  name: string;
  email: string;
  documents: number;
  applications: number;
  commissions: number;
  whatsappContacts: number;
  codesUsed: number;
  canDelete: boolean;
};

// Ce qui disparaîtra avec le compte (affiché dans la fenêtre de confirmation).
export async function fetchStudentDeletionPreview(studentId: string) {
  return request<StudentDeletionPreview>(`/api/admin/students/${studentId}/deletion-preview`);
}

export async function deleteStudent(studentId: string) {
  return request<{ id: string }>(`/api/admin/students/${studentId}`, { method: "DELETE" });
}

export type BackupStatus = { success: boolean | null; at: string | null; error?: string; triggeredBy?: string };

export async function fetchBackupStatus() {
  return request<BackupStatus>("/api/admin/backup/status");
}

export async function runBackupNow() {
  return request<BackupStatus>("/api/admin/backup/run", { method: "POST" });
}

export async function fetchRestoreStatus() {
  return request<BackupStatus>("/api/admin/backup/restore-status");
}

export async function runRestoreNow() {
  return request<BackupStatus>("/api/admin/backup/restore", { method: "POST" });
}

export type ArchivedEntry = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentNationality: string | null;
  studentResidenceCountry: string | null;
  studentPhone: string | null;
  studentAvatarUrl?: string | null;
  countryId: string;
  countryName: string;
  universityId: string;
  universityName: string;
  salesId: string | null;
  salesName: string | null;
  rdvId: string | null;
  rdvName: string | null;
  status: string;
  visaStatus: string | null;
  dossierStage: string | null;
  appliedAt: string | null;
  decisionAt: string | null;
  updatedAt: string;
};

export async function fetchArchive(params?: { salesId?: string; countryId?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.salesId) qs.set("salesId", params.salesId);
  if (params?.countryId) qs.set("countryId", params.countryId);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ entries: ArchivedEntry[]; total: number }>(`/api/archive${suffix}`);
}

export type ArchiveSettings = { enabled: boolean; days: number };

export async function fetchArchiveSettings() {
  return request<ArchiveSettings>("/api/archive/settings");
}

export async function updateArchiveSettings(data: ArchiveSettings) {
  return request<{ success: boolean }>("/api/archive/settings", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export async function purgeArchive() {
  return request<{ purgedStudents: number; purgedFiles: number }>("/api/archive/purge", {
    method: "POST"
  });
}

export type AdminInsights = {
  postponed: { total: number; due30: number; visa: number; application: number };
  acceptance: {
    accepted: number;
    rejected: number;
    decided: number;
    rate: number | null;
    byCountry: Array<{ country: string; accepted: number; rejected: number; decided: number; rate: number | null }>;
  };
  visa: { obtained: number; rejected: number; pending: number; rate: number | null };
  delays: { universityDays: number | null; visaDays: number | null };
  finances: {
    perCurrency: Array<{ currency: string; thisMonth: number; lastMonth: number; outstanding: number }>;
    visaBlocked: number;
  };
  commissions: { salesThisMonth: number; rdvThisMonth: number; totalThisMonth: number; totalLastMonth: number };
  newStudents: { thisWeek: number; lastWeek: number; thisMonth: number; lastMonth: number };
  withoutRdv: number;
};

export async function fetchAdminInsights(): Promise<AdminInsights> {
  return request<AdminInsights>("/api/admin/insights");
}

export async function fetchAdminDashboard(params: {
  period?: string;
  salesId?: string;
  destination?: string;
  status?: string;
}) {
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.salesId) query.set("salesId", params.salesId);
  if (params.destination) query.set("destination", params.destination);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminDashboard>(`/api/admin/dashboard${suffix}`);
}

export type StalledAlertFrequency = "once" | "daily" | "weekly";

export type AdminSettings = {
  autoAssignSales: boolean;
  stalledAlertDays: number;
  stalledAlertFrequency: StalledAlertFrequency;
  stalledAlertEmail: string;
  emailFromName: string;
  emailFromAddress: string;
  emailHasAppPassword: boolean;
  emailSmtpHost: string;
  emailSmtpPort: number | null;
  workDays: number[];
  workStart: string;
  workEnd: string;
  workTimezone: string;
};

export async function fetchAdminSettings() {
  return request<AdminSettings>("/api/admin/settings");
}

export async function updateAdminSettings(payload: Partial<AdminSettings> & { emailAppPassword?: string }) {
  return request<AdminSettings>("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

// ── Statistiques Admin (durées en heures ouvrées, cf. Paramètres) ─────────
export type PerformancePeriod = "7" | "30" | "90" | "all";
export type PerfDuration = { minutes: number | null; label: string; count: number };

export type WhatsAppFunnel = {
  conversations: number;
  answered: number;
  unanswered: number;
  codeSent: number;
  registered: number;
  converted: number;
  notConverted: number;
  conversionRate: number | null;
};

// Conversation qui attend une réponse (Dashboard) : à quel conseiller, depuis quand, où l'ouvrir.
export type PendingConversation = {
  contactId: string;
  name: string;
  phone: string;
  ownerId: string | null;
  ownerName: string;
  segment: "inscrits" | "prospects";
  since: string;
  waitingLabel: string;
  waitingMinutes: number;
};

export type PerfContactItem = { contactId: string; name: string; phone: string; lastMessageAt?: string | null; since?: string; waitingLabel?: string };
export type PerfDossierItem = { name: string; step: string; waitingLabel: string };

export type SalesPerformance = {
  whatsapp: WhatsAppFunnel & { firstReply: PerfDuration; reply: PerfDuration; pendingNow: number };
  students: number;
  handoff: PerfDuration;
  documentReview: PerfDuration;
  documentsValidated: number;
  documentsRejected: number;
  acceptedToVisaDocs: PerfDuration;
  halfwayDossiers: number;
  codes: { created: number; used: number; sentOnWhatsapp: number };
  lists?: { notConverted: PerfContactItem[]; unanswered: PerfContactItem[]; pending: PerfContactItem[]; halfway: PerfDossierItem[] };
};

export type RdvPerformance = {
  dossiers: number;
  readyToApplied: PerfDuration;
  appliedToDecision: PerfDuration;
  visaDocsToSubmit: PerfDuration;
  accepted: number;
  rejected: number;
  visaAccepted: number;
  visaRejected: number;
  acceptanceRate: number | null;
  visaAcceptanceRate: number | null;
  halfwayDossiers: number;
  lists?: { halfway: PerfDossierItem[] };
};

export type StaffPerformance = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  phone: string;
  isActive: boolean;
  roles: string[];
  sales: SalesPerformance | null;
  rdv: RdvPerformance | null;
};

export type PerfWorkHours = { days: number[]; start: string; end: string; timezone: string; halfwayMinutes: number };

export type TeamPerformance = {
  period: PerformancePeriod;
  workHours: PerfWorkHours;
  whatsapp: WhatsAppFunnel & {
    unassigned: number;
    firstReply: PerfDuration;
    reply: PerfDuration;
    pendingNow: number;
    pending: PendingConversation[];
  };
  staff: StaffPerformance[];
};

export async function fetchTeamPerformance(period: PerformancePeriod) {
  return request<TeamPerformance>(`/api/admin/performance?period=${period}`);
}

// Un cas mesuré (réponse, document, dossier) : dates de début et de fin, durée en heures de travail.
export type StaffEvent = { student: string; sub: string; from: string; to: string; minutes: number; outcome: string | null };
export type StaffDetail = Partial<Record<"reply" | "review" | "handoff" | "visaDocs" | "readyToApplied" | "appliedToDecision" | "visaDocsToSubmit" | "visaDecision", StaffEvent[]>>;

export async function fetchUserPerformance(userId: string, period: PerformancePeriod) {
  return request<{ period: PerformancePeriod; workHours: PerfWorkHours; user: StaffPerformance; detail: StaffDetail }>(
    `/api/admin/performance/users/${userId}?period=${period}`
  );
}

export async function createSalesAccount(payload: {
  prenom: string;
  nom: string;
  email: string;
  password: string;
  phone: string;
}) {
  return request("/api/admin/sales", { method: "POST", body: JSON.stringify(payload) });
}

export async function setSalesActive(salesId: string, isActive: boolean) {
  return request<{ id: string; isActive: boolean }>(`/api/admin/sales/${salesId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  });
}

export async function transferSalesWork(salesId: string, toSalesId: string) {
  return request<{ id: string; isActive: boolean; transferred: number }>(`/api/admin/sales/${salesId}/transfer`, {
    method: "POST",
    body: JSON.stringify({ toSalesId })
  });
}

export async function deleteSales(salesId: string) {
  return request<{ id: string }>(`/api/admin/sales/${salesId}`, { method: "DELETE" });
}

export async function assignStudent(studentId: string, salesId: string | null) {
  return request<{ studentId: string; assignedSalesId: string | null }>(`/api/students/${studentId}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ salesId })
  });
}

export async function fetchMyStudents(params?: { page?: number; pageSize?: number; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ students: BoardStudent[]; total: number; page: number; pageSize: number }>(`/api/students${suffix}`);
}

// ==========================================
// SALES CODES
// ==========================================
export type SalesCode = {
  id: string;
  code: string;
  countryId: string;
  countryName: string | null;
  prefillCurrentStudyLevel: string | null;
  prefillTargetLevel: string | null;
  prefillPhone: string | null;
  whatsappContactId: string | null;
  whatsappContactLabel: string | null;
  whatsappSent?: boolean;
  whatsappError?: string;
  used: boolean;
  usedByStudentId: string | null;
  usedByName: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  /** Reçu automatique de la tranche 1 encaissée à la création du code. */
  paymentReceipt?: string | null;
};

export type SalesCodePayload = {
  countryId: string;
  prefillCurrentStudyLevel?: string;
  prefillTargetLevel?: string;
  prefillPhone?: string;
  expiresAt?: string;
  whatsappContactId?: string;
  /** Tranche 1 (inscription) encaissée : obligatoire quand le pays a un tarif. */
  payment?: { confirmed: boolean; method: PaymentMethod; reference?: string };
};

export async function fetchMySalesCodes(): Promise<SalesCode[]> {
  return request<SalesCode[]>("/api/sales/me/codes");
}

export async function createSalesCode(payload: SalesCodePayload): Promise<SalesCode> {
  return request<SalesCode>("/api/sales/me/codes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// Ouvre un document protégé (passeport, diplôme...) dans un nouvel onglet :
// le fichier est récupéré avec la session de l'utilisateur, jamais via un
// lien public. L'onglet est ouvert tout de suite (au clic) pour ne pas être
// bloqué par le navigateur, puis rempli une fois le fichier reçu.
export async function openProtectedFile(pathname: string) {
  const tab = window.open("", "_blank");
  try {
    const session = getSession();
    const response = await fetch(`${API_URL}${pathname}`, {
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {}
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Impossible d'ouvrir ce document.");
    }
    const url = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

export async function request<T>(pathname: string, options?: RequestInit): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined)
  };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  const response = await fetch(`${API_URL}${pathname}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }
  return data as T;
}

export async function login(email: string, password: string) {
  const data = await request<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setSession(data);
  return data;
}

// Mot de passe oublié : 1) un code est envoyé par email  2) on le vérifie
// (on reçoit un jeton à usage unique)  3) on choisit le nouveau mot de passe.
export async function forgotPassword(email: string) {
  return request<{ ok: boolean; message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function verifyResetCode(email: string, code: string) {
  return request<{ ok: boolean; resetToken: string }>("/api/auth/verify-reset-code", {
    method: "POST",
    body: JSON.stringify({ email, code })
  });
}

export async function resetPassword(token: string, password: string) {
  return request<{ ok: boolean }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password })
  });
}

export async function register(payload: RegisterPayload) {
  const data = await request<AuthSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  setSession(data);
  return data;
}

export async function fetchMe() {
  const data = await request<AuthSession>("/api/auth/me");
  const current = getSession();
  setSession({ ...data, token: current?.token || data.token });
  return data;
}

export async function verifyEmailCode(code: string) {
  const data = await request<AuthSession>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ code })
  });
  const current = getSession();
  setSession({ ...data, token: current?.token || data.token });
  return data;
}

export async function resendVerificationEmail() {
  return request<{ ok: boolean; alreadyVerified?: boolean }>("/api/auth/resend-verification", {
    method: "POST"
  });
}

export async function uploadAvatar(image: string) {
  const data = await request<{ user: AuthUser; profile?: StudentProfile }>("/api/students/me/avatar", {
    method: "POST",
    body: JSON.stringify({ image })
  });
  const session = getSession();
  if (session) {
    setSession({
      ...session,
      user: { ...session.user, ...data.user },
      profile: data.profile || session.profile
    });
  }
  return data;
}

export async function updateIdentity(payload: { prenom: string; nom: string; dateNaissance: string }) {
  const data = await request<{ user: AuthUser; profile?: StudentProfile }>("/api/students/me/identity", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  const session = getSession();
  if (session) {
    setSession({
      ...session,
      user: { ...session.user, ...data.user },
      profile: data.profile || session.profile
    });
  }
  return data;
}

export async function saveOnboarding(payload: Record<string, unknown>) {
  const data = await request<{ profile: StudentProfile; onboardingCompleted: boolean }>(
    "/api/students/me/onboarding",
    { method: "PUT", body: JSON.stringify(payload) }
  );
  const session = getSession();
  if (session) {
    setSession({
      ...session,
      user: { ...session.user, onboardingCompleted: true },
      profile: data.profile
    });
  }
  return data;
}

export async function logout() {
  const session = getSession();
  if (session?.token) {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
  }
  clearSession();
}

export type ProgrammeDetail = {
  name: string;       // ex: "Licence", "Master", "English Language Courses"
  desc: string;       // description longue du niveau
  lang: string;       // ex: "Français ou Anglais"
  fees: string;       // ex: "Sur demande"
  dates: string;      // ex: "Du 01/05 au 30/06"
  status: string;     // ex: "Inscription ouverte"
  scholarship: string;// bourses & avantages
};

export type Programme = {
  id: string;
  title: string;
  country: string;
  countryId: string | null;
  degrees: string;
  description: string;
  imageUrl: string;
  badge: string;
  statusLabel: string;
  gradientStyle: string;
  isFeatured: boolean;
  displayOrder: number;
  details: ProgrammeDetail[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProgrammePayload = Omit<Programme, "id" | "createdAt" | "updatedAt">;

export async function fetchPublicProgrammes(): Promise<Programme[]> {
  const res = await fetch(`${API_URL}/api/public/programmes`);
  if (!res.ok) throw new Error("Erreur de chargement des programmes");
  return res.json();
}

export async function fetchAdminProgrammes(): Promise<Programme[]> {
  return request<Programme[]>("/api/admin/programmes");
}

export async function createProgramme(payload: Partial<ProgrammePayload>): Promise<Programme> {
  return request<Programme>("/api/admin/programmes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateProgramme(id: string, payload: Partial<ProgrammePayload>): Promise<Programme> {
  return request<Programme>(`/api/admin/programmes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteProgramme(id: string): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>(`/api/admin/programmes/${id}`, {
    method: "DELETE"
  });
}

export async function uploadProgrammeImage(image: string): Promise<{ imageUrl: string }> {
  return request<{ imageUrl: string }>("/api/admin/programmes/upload-image", {
    method: "POST",
    body: JSON.stringify({ image })
  });
}

// ==========================================
// COUNTRIES & DOCUMENT REQUIREMENTS
// ==========================================
export type Country = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CountryPayload = {
  code?: string;
  name?: string;
  displayOrder?: number;
};

export type AcceptedFileType = "IMAGE" | "PDF" | "IMAGE_PDF";
export type DocumentCategory = "DOSSIER" | "VISA";

export type DocumentRequirement = {
  id: string;
  countryId: string;
  /** Renseigné pour un document propre à une université (sinon commun au pays). */
  universityId?: string | null;
  name: string;
  description: string | null;
  required: boolean;
  active: boolean;
  displayOrder: number;
  acceptedFileTypes: AcceptedFileType;
  category: DocumentCategory;
  createdAt?: string;
  updatedAt?: string;
};

export type DocumentRequirementPayload = {
  name?: string;
  description?: string | null;
  required?: boolean;
  displayOrder?: number;
  acceptedFileTypes?: AcceptedFileType;
  category?: DocumentCategory;
};

export async function fetchPublicCountries(): Promise<Country[]> {
  const res = await fetch(`${API_URL}/api/public/countries`);
  if (!res.ok) throw new Error("Erreur de chargement des pays");
  return res.json();
}

export async function fetchAdminCountries(): Promise<Country[]> {
  return request<Country[]>("/api/admin/countries");
}

// ==========================================
// COMMISSIONS (Sales / RDV)
// ==========================================
export type CommissionRole = "SALES" | "RDV";
export type CommissionStage = "CODE_CLAIMED" | "DOCUMENTS_VALIDATED" | "APPLIED" | "ACCEPTED" | "VISA_DOCUMENTS_VALIDATED" | "VISA_SUBMITTED" | "VISA_ACCEPTED";

export type CommissionRule = {
  id: string;
  countryId: string;
  countryName: string;
  role: CommissionRole;
  stage: CommissionStage;
  amountDinar: number;
  active: boolean;
};

export type CommissionEarning = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  studentId: string;
  studentName?: string;
  applicationId: string | null;
  countryId: string;
  countryName: string;
  role: CommissionRole;
  stage: CommissionStage;
  amountDinar: number;
  earnedAt: string;
};

export async function fetchCommissionRules(): Promise<CommissionRule[]> {
  return request<CommissionRule[]>("/api/admin/commission-rules");
}

export async function upsertCommissionRule(payload: { countryId: string; role: CommissionRole; stage: CommissionStage; amountDinar: number }): Promise<CommissionRule> {
  return request<CommissionRule>("/api/admin/commission-rules", { method: "POST", body: JSON.stringify(payload) });
}

export async function setCommissionRuleActive(id: string, active: boolean): Promise<CommissionRule> {
  return request<CommissionRule>(`/api/admin/commission-rules/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) });
}

export async function deleteCommissionRule(id: string): Promise<{ success: boolean; id: string }> {
  return request(`/api/admin/commission-rules/${id}`, { method: "DELETE" });
}

export async function fetchAllCommissionEarnings(): Promise<CommissionEarning[]> {
  return request<CommissionEarning[]>("/api/admin/commission-earnings");
}

export async function fetchMyCommissions(): Promise<{ earnings: CommissionEarning[]; total: number }> {
  return request("/api/me/commissions");
}

export async function createCountry(payload: CountryPayload): Promise<Country> {
  return request<Country>("/api/admin/countries", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateCountry(id: string, payload: CountryPayload): Promise<Country> {
  return request<Country>(`/api/admin/countries/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function setCountryActive(id: string, active: boolean): Promise<Country> {
  return request<Country>(`/api/admin/countries/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active })
  });
}

export async function fetchCountryDocuments(countryId: string): Promise<DocumentRequirement[]> {
  return request<DocumentRequirement[]>(`/api/admin/countries/${countryId}/documents`);
}

export async function createCountryDocument(
  countryId: string,
  payload: DocumentRequirementPayload
): Promise<DocumentRequirement> {
  return request<DocumentRequirement>(`/api/admin/countries/${countryId}/documents`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateCountryDocument(
  id: string,
  payload: DocumentRequirementPayload
): Promise<DocumentRequirement> {
  return request<DocumentRequirement>(`/api/admin/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function setDocumentActive(id: string, active: boolean): Promise<DocumentRequirement> {
  return request<DocumentRequirement>(`/api/admin/documents/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active })
  });
}

export async function deleteCountryDocument(id: string): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>(`/api/admin/documents/${id}`, {
    method: "DELETE"
  });
}

// ==========================================
// COUNTRY UNIVERSITIES
// ==========================================
export type CountryUniversity = {
  id: string;
  countryId: string;
  name: string;
  active: boolean;
  /** true = université conventionnée (documents définis par l'admin). */
  partner?: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicUniversity = {
  id: string;
  countryId: string;
  countryName: string;
  name: string;
};

export type CountryUniversityPayload = {
  name?: string;
  displayOrder?: number;
};

export async function fetchPublicUniversities(countryIds: string[]): Promise<PublicUniversity[]> {
  if (!countryIds.length) return [];
  const res = await fetch(`${API_URL}/api/public/universities?countryIds=${countryIds.join(",")}`);
  if (!res.ok) throw new Error("Erreur de chargement des universités");
  return res.json();
}

export async function fetchCountryUniversities(countryId: string): Promise<CountryUniversity[]> {
  return request<CountryUniversity[]>(`/api/admin/countries/${countryId}/universities`);
}

export async function createCountryUniversity(
  countryId: string,
  payload: CountryUniversityPayload
): Promise<CountryUniversity> {
  return request<CountryUniversity>(`/api/admin/countries/${countryId}/universities`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateCountryUniversity(
  id: string,
  payload: CountryUniversityPayload
): Promise<CountryUniversity> {
  return request<CountryUniversity>(`/api/admin/universities/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function setUniversityActive(id: string, active: boolean): Promise<CountryUniversity> {
  return request<CountryUniversity>(`/api/admin/universities/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active })
  });
}

export async function deleteCountryUniversity(id: string): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>(`/api/admin/universities/${id}`, {
    method: "DELETE"
  });
}

// ==========================================
// STUDENT DOCUMENTS (checklist du pays choisi)
// ==========================================
export type StudentDocumentStatus = "PENDING" | "SUBMITTED" | "VALIDATED" | "REJECTED";

export type StudentDocumentChecklistItem = {
  name: string;
  /** Document propre à une université (absent = commun au pays). */
  universityId?: string | null;
  universityName?: string | null;
  description: string | null;
  required: boolean;
  acceptedFileTypes: AcceptedFileType;
  countries: string[];
  status: StudentDocumentStatus;
  fileUrl: string | null;
  originalFilename: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

export async function fetchMyDocuments(): Promise<StudentDocumentChecklistItem[]> {
  return request<StudentDocumentChecklistItem[]>("/api/students/me/documents");
}

export async function uploadMyDocument(
  name: string,
  file: string,
  originalFilename?: string,
  universityId?: string | null
): Promise<StudentDocumentChecklistItem> {
  return request<StudentDocumentChecklistItem>("/api/students/me/documents", {
    method: "POST",
    body: JSON.stringify({ name, file, originalFilename, universityId: universityId || undefined })
  });
}

// ==========================================
// VISA DOCUMENTS (checklist scopée à la candidature visa en cours)
// ==========================================
export type VisaDocumentChecklistItem = {
  requirementId: string;
  name: string;
  description: string | null;
  required: boolean;
  acceptedFileTypes: AcceptedFileType;
  status: StudentDocumentStatus;
  fileUrl: string | null;
  originalFilename: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

export type MyVisaChecklist = {
  application: { id: string; countryName: string; visaStatus: string } | null;
  checklist: VisaDocumentChecklistItem[];
};

export async function fetchMyVisaChecklist(): Promise<MyVisaChecklist> {
  return request<MyVisaChecklist>("/api/students/me/visa-documents");
}

export async function uploadMyVisaDocument(
  requirementId: string,
  file: string,
  originalFilename?: string
): Promise<VisaDocumentChecklistItem> {
  return request<VisaDocumentChecklistItem>("/api/students/me/visa-documents", {
    method: "POST",
    body: JSON.stringify({ requirementId, file, originalFilename })
  });
}

export async function fetchApplicationVisaDocuments(applicationId: string): Promise<VisaDocumentChecklistItem[]> {
  return request<VisaDocumentChecklistItem[]>(`/api/applications/${applicationId}/visa-documents`);
}

export async function reviewApplicationVisaDocument(
  applicationId: string,
  requirementId: string,
  status: "VALIDATED" | "REJECTED",
  reason?: string
): Promise<VisaDocumentChecklistItem> {
  return request<VisaDocumentChecklistItem>(`/api/applications/${applicationId}/visa-documents/review`, {
    method: "PATCH",
    body: JSON.stringify({ requirementId, status, reason })
  });
}

// ==========================================
// UNIVERSITY APPLICATIONS (candidatures)
// ==========================================
export type ApplicationStatus =
  | "READY_TO_APPLY"
  | "APPLIED"
  | "WAITING_UNIVERSITY_RESPONSE"
  | "INTERVIEW_REQUIRED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "ACCEPTED"
  | "REJECTED"
  | "CLOSED"
  | "POSTPONED";

export type UniversityApplication = {
  id: string;
  studentId: string;
  countryId: string;
  countryName: string;
  universityId: string;
  universityName: string;
  choiceId?: string | null;
  fieldOfStudy?: string;
  programmeId: string | null;
  programmeTitle: string | null;
  salesId: string | null;
  assignedRdvId: string | null;
  status: ApplicationStatus;
  appliedAt: string | null;
  applicationReference: string | null;
  notes: string | null;
  interviewDate: string | null;
  interviewType: "ONLINE" | "IN_PERSON" | null;
  interviewLink: string | null;
  interviewInstructions: string | null;
  decisionAt: string | null;
  decisionReason: string | null;
  acceptanceReference: string | null;
  visaStatus: "PREPARATION" | "SUBMITTED" | "ACCEPTED" | "REJECTED" | null;
  visaSubmittedAt: string | null;
  visaDecisionAt: string | null;
  visaDecisionReason: string | null;
  visaPrepMeetingAt: string | null;
  visaPrepMeetingType: "ONLINE" | "IN_PERSON" | null;
  visaPrepMeetingLocation: string | null;
  visaPrepMeetingInstructions: string | null;
  visaEmbassyAppointmentAt: string | null;
  staffMeetAt: string | null;
  staffMeetLink: string | null;
  staffMeetInstructions: string | null;
  visaDocsValidatedAt: string | null;
  postponedKind?: "APPLICATION" | "VISA" | null;
  postponedAt?: string | null;
  retryOn?: string | null;
  retryIntake?: string;
  postponedNote?: string;
  retryOfId?: string | null;
  attemptNumber?: number;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationHistoryEntry = {
  id: string;
  application_id: string | null;
  student_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_by_prenom: string | null;
  changed_by_nom: string | null;
  changed_at: string;
  comment: string | null;
};

export async function fetchMyApplications(): Promise<UniversityApplication[]> {
  return request<UniversityApplication[]>("/api/students/me/applications");
}

export async function fetchStudentApplications(studentId: string): Promise<UniversityApplication[]> {
  return request<UniversityApplication[]>(`/api/students/${studentId}/applications`);
}

export async function fetchStudentApplicationHistory(studentId: string): Promise<ApplicationHistoryEntry[]> {
  return request<ApplicationHistoryEntry[]>(`/api/students/${studentId}/applications/history`);
}

export async function markApplicationApplied(
  applicationId: string,
  payload: { universityId?: string; universityName?: string; programmeId?: string; appliedAt: string; applicationReference?: string; notes?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/apply`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function scheduleStaffMeet(
  applicationId: string,
  payload: { date: string; link: string; instructions?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/staff-meet`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function scheduleApplicationInterview(
  applicationId: string,
  payload: { interviewDate: string; interviewType: "ONLINE" | "IN_PERSON"; interviewLink?: string; instructions?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/interview`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function completeApplicationInterview(applicationId: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/interview-completed`, { method: "PATCH" });
}

export async function acceptApplication(
  applicationId: string,
  payload: { reference?: string; comment?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/accept`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function rejectApplication(applicationId: string, reason: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason })
  });
}

export async function closeApplication(applicationId: string, comment?: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/close`, {
    method: "PATCH",
    body: JSON.stringify({ comment })
  });
}

export async function reapplyApplication(
  applicationId: string,
  payload: { universityId?: string; universityName?: string; programmeId?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/reapply`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// Refus à retenter plus tard : le dossier sort du pipeline actif jusqu'à la date.
export async function postponeApplication(
  applicationId: string,
  payload: { retryOn: string; intake?: string; note?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/postpone`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function retryPostponedApplication(applicationId: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/retry`, { method: "POST" });
}

export type RdvSuggestion = { rdvUserId: string | null; rdvName: string | null; fallback: boolean };

export async function fetchRdvSuggestion(applicationId: string): Promise<RdvSuggestion> {
  return request<RdvSuggestion>(`/api/applications/${applicationId}/rdv-suggestion`);
}

export async function assignApplicationRdv(applicationId: string, rdvUserId?: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/assign-rdv`, {
    method: "PATCH",
    body: JSON.stringify({ rdvUserId })
  });
}

export async function submitVisaFile(applicationId: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/visa-submit`, { method: "PATCH" });
}

export async function acceptVisa(applicationId: string, comment?: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/visa-accept`, {
    method: "PATCH",
    body: JSON.stringify({ comment })
  });
}

export async function rejectVisa(applicationId: string, reason: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/visa-reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason })
  });
}

export async function scheduleVisaPrepMeeting(
  applicationId: string,
  payload: { date: string; type: "ONLINE" | "IN_PERSON"; location: string; instructions?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/visa-prep-meeting`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function scheduleVisaEmbassyAppointment(applicationId: string, date: string): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/visa-embassy-appointment`, {
    method: "PATCH",
    body: JSON.stringify({ date })
  });
}

/** Tranche visa encore due : le dépôt du visa est bloqué tant qu'elle n'est pas payée. */
export type VisaPaymentDue = { remaining: number; currency: Currency };

export type RdvMyApplication = UniversityApplication & { studentName: string; studentEmail: string; visaPaymentDue?: VisaPaymentDue | null };

export async function fetchMyRdvApplications(): Promise<RdvMyApplication[]> {
  return request<RdvMyApplication[]>("/api/rdv/me/applications");
}

// ==========================================
// ADMIN: RÔLES MULTIPLES & RDV
// ==========================================
export type RdvUser = { id: string; prenom: string; nom: string; email: string; isActive: boolean };
export type RdvAssignment = { rdvUserId: string; countryId: string; rdvName: string; countryName: string };

export type UserAccess = { id: string; baseRole: string; roles: string[]; permissions: string[] };

export async function fetchUserAccess(userId: string): Promise<UserAccess> {
  return request<UserAccess>(`/api/admin/users/${userId}/access`);
}

export async function setUserRoles(userId: string, roles: string[]): Promise<{ id: string; baseRole: string; roles: string[] }> {
  return request(`/api/admin/users/${userId}/roles`, { method: "PATCH", body: JSON.stringify({ roles }) });
}

export async function setUserPermissions(userId: string, permissions: string[]): Promise<{ id: string; permissions: string[] }> {
  return request(`/api/admin/users/${userId}/permissions`, { method: "PATCH", body: JSON.stringify({ permissions }) });
}

export async function createRdvAccount(payload: { prenom: string; nom: string; email: string; password: string }): Promise<RdvUser> {
  return request<RdvUser>("/api/admin/rdv", { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchRdvUsers(): Promise<RdvUser[]> {
  return request<RdvUser[]>("/api/admin/rdv");
}

export async function fetchRdvAssignments(): Promise<RdvAssignment[]> {
  return request<RdvAssignment[]>("/api/admin/rdv-assignments");
}

export async function setRdvCountries(rdvUserId: string, countryIds: string[]): Promise<{ rdvUserId: string; countryIds: string[] }> {
  return request(`/api/admin/rdv-assignments/${rdvUserId}`, { method: "PUT", body: JSON.stringify({ countryIds }) });
}

export type RdvStudent = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  countryId: string;
  countryName: string;
  universityId: string;
  universityName: string;
  programmeTitle: string | null;
  status: string;
  updatedAt: string;
};

export async function fetchRdvStudents(rdvUserId: string): Promise<RdvStudent[]> {
  return request<RdvStudent[]>(`/api/admin/rdv/${rdvUserId}/students`);
}

export type UnassignedVisaApplication = {
  id: string;
  studentId: string;
  studentName: string;
  countryName: string;
  universityName: string;
  decisionAt: string | null;
};

export async function fetchUnassignedVisaApplications(): Promise<UnassignedVisaApplication[]> {
  return request<UnassignedVisaApplication[]>("/api/admin/rdv-unassigned-applications");
}

// ==========================================
// STUDENT DETAIL + DOCUMENT REVIEW (Sales/Admin)
// ==========================================
export async function fetchStudentDetail(studentId: string): Promise<{ user: AuthUser; profile: StudentProfile }> {
  return request<{ user: AuthUser; profile: StudentProfile }>(`/api/students/${studentId}`);
}

export async function fetchStudentDocuments(studentId: string): Promise<StudentDocumentChecklistItem[]> {
  return request<StudentDocumentChecklistItem[]>(`/api/students/${studentId}/documents`);
}

export async function reviewStudentDocument(
  studentId: string,
  name: string,
  status: "VALIDATED" | "REJECTED",
  reason?: string,
  universityId?: string | null
): Promise<StudentDocumentChecklistItem> {
  return request<StudentDocumentChecklistItem>(`/api/students/${studentId}/documents/review`, {
    method: "PATCH",
    body: JSON.stringify({ name, status, reason, universityId: universityId || undefined })
  });
}

// ==========================================
// CANDIDATURES MULTIPLES (jusqu'à 3 en même temps)
// ==========================================
export type UniversityChoice = {
  id: string;
  studentId: string;
  countryId: string;
  countryName: string;
  universityId: string;
  universityName: string;
  /** Université conventionnée (documents définis par l'admin). */
  partner: boolean;
  fieldOfStudy: string;
  addedByRole: string;
  applicationId: string | null;
  applicationStatus: string | null;
  specificDocsCount: number;
};

export type UniversityChoicesSummary = { limit: number; used: number; choices: UniversityChoice[] };

export type UniversityPickerItem = { id: string; countryId: string; name: string; partner: boolean };

export type UniversityChoicePayload = {
  countryId: string;
  universityId?: string;
  universityName?: string;
  fieldOfStudy: string;
};

export async function fetchMyUniversityChoices(): Promise<UniversityChoicesSummary> {
  return request<UniversityChoicesSummary>("/api/students/me/university-choices");
}

export async function addMyUniversityChoice(payload: UniversityChoicePayload): Promise<UniversityChoicesSummary> {
  return request<UniversityChoicesSummary>("/api/students/me/university-choices", { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchStudentUniversityChoices(studentId: string): Promise<UniversityChoicesSummary> {
  return request<UniversityChoicesSummary>(`/api/students/${studentId}/university-choices`);
}

export async function addStudentUniversityChoice(studentId: string, payload: UniversityChoicePayload): Promise<UniversityChoicesSummary> {
  return request<UniversityChoicesSummary>(`/api/students/${studentId}/university-choices`, { method: "POST", body: JSON.stringify(payload) });
}

export async function removeUniversityChoice(choiceId: string): Promise<UniversityChoicesSummary> {
  return request<UniversityChoicesSummary>(`/api/university-choices/${choiceId}`, { method: "DELETE" });
}

export async function fetchUniversityPicker(countryId: string): Promise<UniversityPickerItem[]> {
  return request<UniversityPickerItem[]>(`/api/countries/${countryId}/university-picker`);
}

// Documents propres à une université (admin : toutes ; conseiller : hors conventions).
export async function fetchUniversityDocuments(universityId: string): Promise<DocumentRequirement[]> {
  return request<DocumentRequirement[]>(`/api/universities/${universityId}/documents`);
}

export async function createUniversityDocument(universityId: string, payload: DocumentRequirementPayload): Promise<DocumentRequirement> {
  return request<DocumentRequirement>(`/api/universities/${universityId}/documents`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateUniversityDocument(id: string, payload: DocumentRequirementPayload): Promise<DocumentRequirement> {
  return request<DocumentRequirement>(`/api/university-documents/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function setUniversityDocumentActive(id: string, active: boolean): Promise<DocumentRequirement> {
  return request<DocumentRequirement>(`/api/university-documents/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) });
}

export async function deleteUniversityDocument(id: string): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>(`/api/university-documents/${id}`, { method: "DELETE" });
}

export async function setUniversityPartner(id: string, partner: boolean): Promise<CountryUniversity> {
  return request<CountryUniversity>(`/api/admin/universities/${id}/partner`, { method: "PATCH", body: JSON.stringify({ partner }) });
}

// ==========================================
// AVIS (Témoignages)
// ==========================================
export type AvisStatus = "pending" | "approved" | "rejected";
export type AvisSource = "manual" | "student";

export type Avis = {
  id: string;
  author_name: string;
  author_country?: string;
  author_photo?: string;
  programme?: string;
  rating: number;
  content: string;
  source: AvisSource;
  student_id?: string;
  status: AvisStatus;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type AvisPayload = Partial<Omit<Avis, "id" | "created_at" | "updated_at">>;

export async function fetchPublicAvis(): Promise<Avis[]> {
  const res = await fetch(`${API_URL}/api/public/avis`);
  if (!res.ok) throw new Error("Erreur de chargement des avis");
  return res.json();
}

export async function fetchAdminAvis(status?: AvisStatus): Promise<Avis[]> {
  const query = status ? `?status=${status}` : "";
  return request<Avis[]>(`/api/admin/avis${query}`);
}

export async function createManualAvis(payload: AvisPayload): Promise<Avis> {
  return request<Avis>("/api/admin/avis", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateAvis(id: string, payload: AvisPayload): Promise<Avis> {
  return request<Avis>(`/api/admin/avis/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function patchAvisStatus(id: string, status: AvisStatus): Promise<Avis> {
  return request<Avis>(`/api/admin/avis/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export async function deleteAvis(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/admin/avis/${id}`, {
    method: "DELETE"
  });
}

export async function submitStudentAvis(payload: { rating: number; content: string; programme?: string }): Promise<{ message: string; avis: Avis }> {
  return request<{ message: string; avis: Avis }>("/api/students/avis", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// ==========================================
// FINANCE : tarifs par pays, plans de paiement (2 tranches), paiements
// ==========================================
export type Currency = "TND" | "EUR";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "CHEQUE";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  TRANSFER: "Virement",
  CARD: "Carte",
  CHEQUE: "Chèque"
};

export function formatMoney(amount: number, currency: Currency | string): string {
  const symbol = currency === "EUR" ? "€" : "DT";
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${symbol}`;
}

export type CountryPricing = {
  countryId: string;
  countryName: string;
  code: string;
  configured: boolean;
  currency: Currency;
  tranche1: number | null;
  tranche2: number | null;
};

export type TrancheState = { due: number; paid: number; remaining: number; complete: boolean };

export type PaymentPlan = {
  id: string;
  studentId: string;
  studentName: string;
  countryId: string;
  countryName: string;
  currency: Currency;
  salesId: string | null;
  salesName: string | null;
  dossierStage: string | null;
  tranche1: TrancheState;
  tranche2: TrancheState;
  total: number;
  paidTotal: number;
  remainingTotal: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  late: boolean;
};

export type StudentPayment = {
  id: string;
  planId: string;
  countryName: string;
  tranche: 1 | 2;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  methodLabel: string;
  paidAt: string;
  /** Reçu automatique (001-2026). */
  receiptNumber: string | null;
  /** Numéro du chèque ou code du virement (absent pour espèces et carte). */
  reference: string | null;
  referenceLabel: string | null;
  studentId?: string;
  studentName?: string;
  recordedByName: string | null;
  recordedByRole: string;
  status: "ACTIVE" | "CANCELLED";
  cancelReason: string | null;
  createdAt: string;
};

/** Mode de paiement qui demande un numéro à saisir, avec son libellé. */
export const PAYMENT_REFERENCE_LABELS: Partial<Record<PaymentMethod, string>> = {
  CHEQUE: "Numéro du chèque",
  TRANSFER: "Code du virement"
};

export type StudentPaymentsSummary = { plans: PaymentPlan[]; payments: StudentPayment[]; canCancel: boolean };

export type RecordPaymentPayload = {
  countryId: string;
  tranche: 1 | 2;
  amount?: number;
  method: PaymentMethod;
  paidAt?: string;
  reference?: string;
};

type CurrencyBucket = { collected: number; remaining: number };
export type FinanceOverview = {
  collected: Partial<Record<Currency, { total: number; month: number }>>;
  remaining: Partial<Record<Currency, number>>;
  lateCount: number;
  planCount: number;
  byCountry: Array<{ name: string; byCurrency: Partial<Record<Currency, CurrencyBucket>> }>;
  bySales: Array<{ name: string; byCurrency: Partial<Record<Currency, CurrencyBucket>> }>;
};

export type FinanceStats = {
  months: Array<{
    month: string;
    currency: Currency;
    collected: number;
    count: number;
    tranche1: number;
    tranche2: number;
    methods: Record<PaymentMethod, number>;
    cancelledCount: number;
    cancelledAmount: number;
  }>;
  byCountry: Array<{ month: string; currency: Currency; name: string; collected: number }>;
  bySales: Array<{ month: string; currency: Currency; name: string; collected: number }>;
  billed: Array<{ month: string; currency: Currency; plans: number; due: number }>;
};

export async function fetchFinanceStats(): Promise<FinanceStats> {
  return request<FinanceStats>("/api/admin/finance/stats");
}

export async function fetchFinanceOverview(): Promise<FinanceOverview> {
  return request<FinanceOverview>("/api/admin/finance/overview");
}

export async function fetchFinancePlans(filters: { status?: string; countryId?: string; salesId?: string; q?: string } = {}): Promise<PaymentPlan[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  return request<PaymentPlan[]>(`/api/admin/finance/plans?${params.toString()}`);
}

export async function fetchFinancePricing(): Promise<CountryPricing[]> {
  return request<CountryPricing[]>("/api/admin/finance/pricing");
}

export async function saveFinancePricing(countryId: string, payload: { currency: Currency; tranche1: number; tranche2: number }): Promise<CountryPricing> {
  return request<CountryPricing>(`/api/admin/finance/pricing/${countryId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function removeFinancePricing(countryId: string): Promise<CountryPricing> {
  return request<CountryPricing>(`/api/admin/finance/pricing/${countryId}`, { method: "DELETE" });
}

// Tarif d'un pays (conseiller : pour confirmer la tranche 1 à la création d'un code).
export async function fetchCountryPricing(countryId: string): Promise<CountryPricing> {
  return request<CountryPricing>(`/api/finance/pricing/${countryId}`);
}

export async function fetchStudentPayments(studentId: string): Promise<StudentPaymentsSummary> {
  return request<StudentPaymentsSummary>(`/api/students/${studentId}/payments`);
}

// Paiements de l'étudiant connecté (lecture seule).
export async function fetchMyPayments(): Promise<StudentPaymentsSummary> {
  return request<StudentPaymentsSummary>("/api/students/me/payments");
}

export async function recordStudentPayment(studentId: string, payload: RecordPaymentPayload): Promise<StudentPaymentsSummary> {
  return request<StudentPaymentsSummary>(`/api/students/${studentId}/payments`, { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchPaymentJournal(filters: { q?: string; method?: string; status?: string } = {}): Promise<StudentPayment[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  return request<StudentPayment[]>(`/api/admin/finance/payments?${params.toString()}`);
}

export async function cancelStudentPayment(paymentId: string, reason: string): Promise<StudentPaymentsSummary> {
  return request<StudentPaymentsSummary>(`/api/payments/${paymentId}/cancel`, { method: "PATCH", body: JSON.stringify({ reason }) });
}

// ==========================================
// ESPACE CONSEILLER : vue d'ensemble de ses étudiants
// ==========================================
export type SalesAttentionItem = { key: string; tone: "danger" | "warning" | "info"; weight: number; text: string };

export type SalesOverviewStudent = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  phone: string;
  city: string;
  avatarUrl: string;
  isActive: boolean;
  createdAt: string | null;
  preferredCountries: string[];
  targetField: string;
  onboardingCompleted: boolean;
  stage: PipelineStageKey;
  docs: { toReview: number; rejected: number; validated: number };
  passport: { status: PassportStatus; expiresOn: string; monthsLeft: number | null };
  payment: { late: boolean; status: "PAID" | "PARTIAL" | "UNPAID"; remaining: Array<{ currency: Currency; amount: number }> } | null;
  choices: number;
  application: { id: string; status: string; visaStatus: string | null; universityName: string; fieldOfStudy: string; countryName: string } | null;
  nextInterviewAt: string | null;
  attention: SalesAttentionItem[];
  score: number;
};

export type SalesOverview = {
  stages: Array<{ key: string; label: string }>;
  stageCounts: Record<string, number>;
  kpis: { students: number; needAttention: number; docsToReview: number; paymentsLate: number; inProgress: number; visasObtained: number };
  students: SalesOverviewStudent[];
};

export async function fetchSalesOverview(): Promise<SalesOverview> {
  return request<SalesOverview>("/api/sales/me/overview");
}
