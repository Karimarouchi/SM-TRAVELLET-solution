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
  languageTest: string;
  languageTestFrench: string;
  languageTestEnglish: string;
  languageTestFrenchOther: string;
  languageTestEnglishOther: string;
  hasPassport: boolean | null;
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

export async function setAutoAssign(enabled: boolean) {
  return request<{ autoAssignSales: boolean }>("/api/admin/auto-assign", {
    method: "PATCH",
    body: JSON.stringify({ enabled })
  });
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
  used: boolean;
  usedByStudentId: string | null;
  usedByName: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type SalesCodePayload = {
  countryId: string;
  prefillCurrentStudyLevel?: string;
  prefillTargetLevel?: string;
  prefillPhone?: string;
  expiresAt?: string;
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

export type ChatConversation = {
  id: string;
  studentId: string;
  salesId: string;
  studentName: string;
  salesName: string;
  studentAvatarUrl?: string;
  salesAvatarUrl?: string;
  lastBody: string;
  lastAt: string;
  unread: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  senderRole?: UserRole;
  senderAvatarUrl?: string;
  body: string;
  createdAt: string;
};

export async function fetchConversations() {
  return request<{ conversations: ChatConversation[] }>("/api/messages/conversations");
}

export async function fetchUnreadCount() {
  return request<{ unread: number }>("/api/messages/unread-count");
}

export async function fetchConversation(id: string) {
  return request<{
    conversation: ChatConversation & { canSend: boolean };
    messages: ChatMessage[];
  }>(`/api/messages/conversations/${id}`);
}

export async function sendChatMessage(conversationId: string, body: string) {
  return request<ChatMessage>(`/api/messages/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
}

export async function openChatWithStudent(studentId: string) {
  return request<{
    conversation: ChatConversation & { canSend: boolean };
    messages: ChatMessage[];
  }>(`/api/messages/with-student/${studentId}`, { method: "POST" });
}

async function request<T>(pathname: string, options?: RequestInit): Promise<T> {
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
export type CommissionStage = "CODE_CLAIMED" | "DOCUMENTS_VALIDATED" | "APPLIED" | "ACCEPTED" | "VISA_SUBMITTED" | "VISA_ACCEPTED";

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
  originalFilename?: string
): Promise<StudentDocumentChecklistItem> {
  return request<StudentDocumentChecklistItem>("/api/students/me/documents", {
    method: "POST",
    body: JSON.stringify({ name, file, originalFilename })
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
  | "CLOSED";

export type UniversityApplication = {
  id: string;
  studentId: string;
  countryId: string;
  countryName: string;
  universityId: string;
  universityName: string;
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
  payload: { universityId?: string; programmeId?: string; appliedAt: string; applicationReference?: string; notes?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/apply`, {
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
  payload: { universityId: string; programmeId?: string }
): Promise<UniversityApplication> {
  return request<UniversityApplication>(`/api/applications/${applicationId}/reapply`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
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

export type RdvMyApplication = UniversityApplication & { studentName: string; studentEmail: string };

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
  reason?: string
): Promise<StudentDocumentChecklistItem> {
  return request<StudentDocumentChecklistItem>(`/api/students/${studentId}/documents/review`, {
    method: "PATCH",
    body: JSON.stringify({ name, status, reason })
  });
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
