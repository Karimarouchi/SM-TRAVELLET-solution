import { API_URL, getSession, request } from "@/lib/auth";

export type HrContract = "CDI" | "CIVP" | "CDD";

export type HrEmployee = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  roles: string[];
  isActive: boolean;
  contractType: HrContract | null;
  hiredOn: string | null;
  contractEndsOn: string | null;
  cin: string;
  cnssNumber: string;
  rib: string;
  baseSalary: number | null;
  leaveDaysPerMonth: number | null;
  leaveDaysCustom: number | null;
};

export type HrHoliday = { id: string; day: string; label: string; paid: boolean };

export type HrSettings = { dayDivisor: number; certDelayHours: number; attendanceSince: string; leaveNoticeFactor: number; cddNoticeDays: number };

export type HrInbox = {
  leave: { id: string; userId: string; prenom: string; nom: string; startOn: string; endOn: string; days: number; reason?: string }[];
  absences: { userId: string; prenom: string; nom: string; day: string; status: "ABSENT" | "NO_REPLY" }[];
  lateCertificates: { userId: string; prenom: string; nom: string; day: string }[];
  contracts: { userId: string; prenom: string; nom: string; contractEndsOn: string; daysLeft: number }[];
  payrollDrafts: { userId: string; prenom: string; nom: string; net: number }[];
  documentRequests: { id: string; userId: string; prenom: string; nom: string; kind: "WORK" | "PAYSLIP"; month: string | null; hasFiche?: boolean; readyOn?: string | null }[];
  summary: {
    month: string;
    today: string;
    headcount: number;
    ready: number;
    incomplete: number;
    contracts: { CDI: number; CIVP: number; CDD: number; none: number };
    onLeave: { userId: string; prenom: string; nom: string; endOn: string }[];
    openYears: number;
    presenceMinutes: number;
    presenceCost: number;
    payroll: {
      drafts: number;
      issued: number;
      net: number;
      commissions: number;
      deductions: number;
      hasSignature: boolean;
      hasStamp: boolean;
    };
    nextHoliday: { day: string; label: string; paid: boolean } | null;
  };
};

export const fetchHrInbox = () => request<HrInbox>("/api/admin/hr/inbox");

export const fetchHrEmployees = () => request<HrEmployee[]>("/api/admin/hr/employees");

export const saveHrEmployee = (id: string, body: Record<string, unknown>) =>
  request<HrEmployee>(`/api/admin/hr/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const fetchHrSettings = () => request<HrSettings>("/api/admin/hr/settings");

export const saveHrSettings = (body: HrSettings) =>
  request<HrSettings>("/api/admin/hr/settings", { method: "PUT", body: JSON.stringify(body) });

export const fetchHrHolidays = () => request<HrHoliday[]>("/api/admin/hr/holidays");

export const addHrHoliday = (day: string, label: string, paid: boolean) =>
  request<HrHoliday>("/api/admin/hr/holidays", { method: "POST", body: JSON.stringify({ day, label, paid }) });

export const removeHrHoliday = (id: string) => request<{ ok: boolean }>(`/api/admin/hr/holidays/${id}`, { method: "DELETE" });

export const setHrHolidayPaid = (id: string, paid: boolean) =>
  request<HrHoliday>(`/api/admin/hr/holidays/${id}`, { method: "PATCH", body: JSON.stringify({ paid }) });

export type HrLeaveBalance = { carry: number; accrued: number; manual: number; used: number; remaining: number };

export type HrLeaveRequest = {
  id: string;
  userId: string;
  startOn: string;
  endOn: string;
  days: number;
  coversAbsence: boolean;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  cover?: HrLeaveCoverSubstitute[];
};

// ── Remplacement pendant un congé (conseiller / Responsable Dossier) ──
export type HrCoverScope = "SALES" | "RDV";
export type HrLeaveCoverSubstitute = { scope: HrCoverScope; id: string; name: string; percent: number };
export type HrCoverPlan = Partial<Record<HrCoverScope, { substitutes: { id: string; percent: number }[]; overrides: Record<string, string> }>>;
export type HrCoverOptions = {
  needed: boolean;
  scopes: {
    scope: HrCoverScope;
    label: string;
    candidates: { id: string; name: string; unavailable: string | null }[];
    items: { id: string; kind: "student" | "contact"; name: string; bucket: number }[];
    current: { substitutes: { id: string; name: string; percent: number }[]; overrides: Record<string, string> } | null;
  }[];
};
export type MyLeaveCover = {
  absence: { leaveId: string; startOn: string; endOn: string; substitutes: { id: string; name: string; percent: number; scope: HrCoverScope }[] } | null;
  covering: { leaveId: string; ownerId: string; ownerName: string; scope: HrCoverScope; endOn: string; percent: number }[];
};

export const fetchLeaveCoverOptions = (userId: string, startOn: string, endOn: string, leaveId?: string | null) =>
  request<HrCoverOptions>(`/api/admin/hr/leave/cover-options?user=${encodeURIComponent(userId)}&start=${startOn}&end=${endOn}${leaveId ? `&leave=${leaveId}` : ""}`);

export const updateLeaveCover = (leaveId: string, cover: HrCoverPlan) =>
  request<HrLeaveCoverSubstitute[]>(`/api/admin/hr/leave/${leaveId}/cover`, { method: "PUT", body: JSON.stringify({ cover }) });

export const fetchMyLeaveCover = () => request<MyLeaveCover>("/api/hr/me/leave-cover");

export type HrLeaveEmployee = {
  id: string;
  prenom: string;
  nom: string;
  contractType: HrContract | null;
  contractEndsOn: string | null;
  baseSalary: number | null;
  monthlyLeave: number | null;
  dayValue: number | null;
  year: number;
  balance: HrLeaveBalance | null;
  openYears: Array<{ year: number } & HrLeaveBalance>;
  requests: HrLeaveRequest[];
  leaveNoticeFactor: number;
};

export const fetchHrLeave = () => request<HrLeaveEmployee[]>("/api/admin/hr/leave");

export const createHrLeave = (body: Record<string, unknown>) =>
  request<HrLeaveRequest>("/api/admin/hr/leave", { method: "POST", body: JSON.stringify(body) });

export const decideHrLeave = (id: string, status: "APPROVED" | "REJECTED", cover?: HrCoverPlan) =>
  request<HrLeaveRequest>(`/api/admin/hr/leave/${id}`, { method: "PATCH", body: JSON.stringify({ status, cover }) });

export const settleHrLeave = (body: Record<string, unknown>) =>
  request<{ year: number; action: string; days: number; amount: number | null }>("/api/admin/hr/leave/settle", { method: "POST", body: JSON.stringify(body) });

export const setHrLeaveBalance = (userId: string, days: string) =>
  request<{ year: number; remaining: number; manual: number }>("/api/admin/hr/leave/balance", { method: "POST", body: JSON.stringify({ userId, days }) });

export type HrAbsenceToCover = { day: string; status: "ABSENT" | "NO_REPLY"; confirmed: boolean };

export const fetchLeaveAbsences = (userId: string) =>
  request<HrAbsenceToCover[]>(`/api/admin/hr/leave/absences?user=${userId}`);

export const coverHrAbsences = (userId: string, days: string[], reason: string) =>
  request<HrLeaveRequest[]>("/api/admin/hr/leave/absences", { method: "POST", body: JSON.stringify({ userId, days, reason }) });

export const fetchMyLeave = () => request<HrLeaveEmployee>("/api/hr/me");

export const fetchMyHolidays = () => request<HrHoliday[]>("/api/hr/me/holidays");

export type HrLeavePreview = {
  working: number;
  extra: number;
  total: number;
  weekendAfterFriday: boolean;
  coveredEnd: string;
  factor: number;
  noticeDays: number;
  earliestStart: string | null;
  noticeOk: boolean;
  remaining: number;
  enough: boolean;
};

export const previewMyLeave = (startOn: string, endOn: string) =>
  request<HrLeavePreview>("/api/hr/me/leave/preview", { method: "POST", body: JSON.stringify({ startOn, endOn }) });

export const requestMyLeave = (startOn: string, endOn: string, reason: string) =>
  request<HrLeaveRequest>("/api/hr/me/leave", { method: "POST", body: JSON.stringify({ startOn, endOn, reason }) });

export type HrAttendanceDay = {
  day: string;
  status: "PRESENT" | "ABSENT" | "NO_REPLY" | "WAIVED" | "UNPAID_HOLIDAY";
  lateMinutes: number;
  earlyMinutes: number;
  totalMinutes: number;
  arrival: string | null;
  departure: string | null;
  arrivalFrom: string | null;
  departureFrom: string | null;
  waived: boolean;
  confirmed: boolean;
  note: string;
  corrected: boolean;
};

export type HrAttendanceEmployee = {
  id: string;
  prenom: string;
  nom: string;
  roles: string[];
  mode: "sales" | "desk";
  baseSalary: number | null;
  days: HrAttendanceDay[];
  leaveDays: number;
  holidayDays: number;
  totalMinutes: number;
  minuteValue: number | null;
  computedAmount: number | null;
  monthAmount: number | null;
  amount: number | null;
};

export type HrAttendanceMonth = {
  month: string;
  workStart: string;
  workEnd: string;
  dayDivisor: number;
  employees: HrAttendanceEmployee[];
};

export const fetchHrAttendance = (month: string) => request<HrAttendanceMonth>(`/api/admin/hr/attendance?month=${month}`);

export const saveHrAttendanceDay = (body: Record<string, unknown>) =>
  request<{ ok: boolean }>("/api/admin/hr/attendance/day", { method: "PUT", body: JSON.stringify(body) });

export const saveHrAttendanceAmount = (userId: string, month: string, amount: string | null) =>
  request<{ ok: boolean }>("/api/admin/hr/attendance/month", { method: "PUT", body: JSON.stringify({ userId, month, amount }) });

export const confirmHrAbsences = (userId: string, days: string[], absent: boolean) =>
  request<{ ok: boolean }>("/api/admin/hr/attendance/absences", { method: "POST", body: JSON.stringify({ userId, days, absent }) });

export type HrPayslipLines = {
  baseSalary: number;
  commissions: number;
  includedCommissions: number;
  unpaidCommissions?: number;
  bonus: number;
  paidLeave: number;
  absenceDeduction: number;
  latenessDeduction: number;
  presenceAdjustment: number | null;
  advance: number;
  unpaidHolidayDeduction: number;
  net: number;
  advanceGranted: number;
  advanceCarried: number;
  advanceBalance: number | null;
};

export type HrPayrollEntry = { id: string; kind: "BONUS" | "ADVANCE" | "RECOVERY"; label: string; amount: number };

export type HrEmployeeDocument = { id: string; label: string; originalFilename: string; createdAt: string };

export type HrPayrollEmployee = {
  id: string;
  prenom: string;
  nom: string;
  roles: string[];
  contractType: HrContract | null;
  hiredOn: string | null;
  contractEndsOn: string | null;
  cin: string;
  cnssNumber: string;
  absenceDays: number;
  latenessMinutes: number;
  lines: HrPayslipLines;
  paidCommissions: { id: string; student: string; stage: string; amount: number; paidAt: string; paidThisMonth: boolean; included: boolean; includedMonth: string | null }[];
  entries: HrPayrollEntry[];
  note: string;
  issued: boolean;
  issuedAt: string | null;
  official: HrOfficialPayslip | null;
  officialMonths: string[];
  documents: HrEmployeeDocument[];
};

export type HrPayrollMonth = {
  month: string;
  hasSignature: boolean;
  hasStamp: boolean;
  employees: HrPayrollEmployee[];
};

export type HrOfficialPayslip = {
  id: string;
  month: string;
  employeeName: string;
  matricule: string;
  cnss: string;
  baseSalary: number;
  presenceDays: number;
  presenceAmount: number;
  leaveDays: number;
  leaveAmount: number;
  transport: number;
  presenceBonus: number;
  functionAllowance: number;
  responsibilityBonus: number;
  gross: number;
  cnssDeduction: number;
  taxable: number;
  irpp: number;
  css: number;
  net: number;
  netToPay: number;
};

export type HrPayslipDraft = HrOfficialPayslip & {
  page: number;
  suggestedUserId: string | null;
};

export type HrPayslipImport = {
  fileId: string;
  employees: { id: string; prenom: string; nom: string; cnss: string }[];
  slips: HrPayslipDraft[];
};

export type HrMyPayslip = {
  month: string;
  net: number;
  issuedAt: string;
  official: boolean;
  bulletin: HrOfficialPayslip | null;
};

export const fetchHrPayroll = (month: string) => request<HrPayrollMonth>(`/api/admin/hr/payroll?month=${month}`);

export const previewHrPayslipImport = (filename: string, file: string) =>
  request<HrPayslipImport>("/api/admin/hr/payroll/import", { method: "POST", body: JSON.stringify({ filename, file }) });

export const confirmHrPayslipImport = (body: { fileId: string; filename: string; slips: Array<HrPayslipDraft & { userId: string }> }) =>
  request<{ saved: { userId: string; month: string }[] }>("/api/admin/hr/payroll/import/confirm", { method: "POST", body: JSON.stringify(body) });

export const removeHrOfficialPayslip = (userId: string, month: string) =>
  request<{ ok: boolean }>("/api/admin/hr/payroll/bulletin", { method: "DELETE", body: JSON.stringify({ userId, month }) });

export const setHrPayrollCommission = (userId: string, month: string, earningId: string, include: boolean) =>
  request<{ ok: boolean }>("/api/admin/hr/payroll/commissions", { method: "PUT", body: JSON.stringify({ userId, month, earningId, include }) });

export const saveHrPayrollNote = (userId: string, month: string, note: string) =>
  request<{ ok: boolean }>("/api/admin/hr/payroll/adjustment", { method: "PUT", body: JSON.stringify({ userId, month, note }) });

export const addHrPayrollEntry = (body: { userId: string; month: string; kind: string; label: string; amount: string }) =>
  request<HrPayrollEntry>("/api/admin/hr/payroll/entries", { method: "POST", body: JSON.stringify(body) });

export const removeHrPayrollEntry = (id: string) => request<{ ok: boolean }>(`/api/admin/hr/payroll/entries/${id}`, { method: "DELETE" });

export const issueHrPayslip = (userId: string, month: string) =>
  request<{ ok: boolean }>("/api/admin/hr/payroll/issue", { method: "POST", body: JSON.stringify({ userId, month }) });

export const reopenHrPayslip = (userId: string, month: string) =>
  request<{ ok: boolean }>(`/api/admin/hr/payroll/issue?userId=${userId}&month=${month}`, { method: "DELETE" });

export const addHrEmployeeDocument = (userId: string, label: string, filename: string, file: string, kind?: "CIN" | "CONTRACT") =>
  request<HrEmployeeDocument>(`/api/admin/hr/employees/${userId}/documents`, { method: "POST", body: JSON.stringify({ label, filename, file, kind }) });

export type HrIdentityFile = { id: string; label: string; originalFilename: string; createdAt: string; kind: "CIN" | "CONTRACT" };

export type HrEmployeeDossier = {
  ready: boolean;
  cin: HrIdentityFile | null;
  contract: HrIdentityFile | null;
  leave?: {
    year: number;
    monthlyLeave: number | null;
    dayValue: number | null;
    balance: HrLeaveBalance | null;
    openYears: { year: number; remaining: number }[];
    settlements: { year: number; action: "CARRY" | "PAY"; days: number; amount: number | null }[];
    requests: { id: string; startOn: string; endOn: string; days: number; status: string; reason: string }[];
  };
  payslips?: {
    month: string;
    baseSalary: number;
    commissions: number;
    bonus: number;
    paidLeave: number;
    absenceDeduction: number;
    latenessDeduction: number;
    unpaidHolidayDeduction: number;
    advance: number;
    net: number;
    issuedAt: string;
    official?: boolean;
  }[];
  commissions?: {
    total: number;
    paid: number;
    pending: number;
    rows: { id: string; earnedAt: string; student: string; country: string; stage: string; amount: number; paid: boolean }[];
  };
};

export const fetchHrEmployeeDossier = (userId: string) => request<HrEmployeeDossier>(`/api/admin/hr/employees/${userId}/dossier`);

export const removeHrEmployeeDocument = (id: string) => request<{ ok: boolean }>(`/api/admin/hr/documents/${id}`, { method: "DELETE" });

export const fetchHrBranding = () => request<{ hasSignature: boolean; hasStamp: boolean }>("/api/admin/hr/branding");

export const saveHrBrandFile = (kind: "signature" | "stamp", file: string) =>
  request<{ hasSignature: boolean; hasStamp: boolean }>(`/api/admin/hr/branding/${kind}`, { method: "PUT", body: JSON.stringify({ file }) });

export const fetchMyPayslips = () => request<HrMyPayslip[]>("/api/hr/me/payslips");

export type HrDocumentRequest = { id: string; kind: "WORK" | "PAYSLIP"; month: string | null; status: "PENDING" | "APPROVED" | "REJECTED"; readyOn: string | null };

export const fetchMyDocumentRequests = () => request<HrDocumentRequest[]>("/api/hr/me/document-requests");

export const requestHrDocument = (body: { kind: "WORK" | "PAYSLIP"; month?: string; months?: string[] }) =>
  request<HrDocumentRequest | HrDocumentRequest[]>("/api/hr/me/document-requests", { method: "POST", body: JSON.stringify(body) });

export type HrPendingDocument = { id: string; userId: string; prenom: string; nom: string; kind: "WORK" | "PAYSLIP"; month: string | null; hasFiche: boolean; readyOn: string | null };

export const fetchHrDocumentRequests = () => request<HrPendingDocument[]>("/api/admin/hr/document-requests");

export const decideHrDocumentRequest = (id: string, status: "APPROVED" | "REJECTED") =>
  request<{ id: string; status: string }>(`/api/admin/hr/document-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });

export const scheduleHrDocumentRequest = (id: string, readyOn: string) =>
  request<{ id: string; status: string; readyOn: string }>(`/api/admin/hr/document-requests/${id}`, { method: "PATCH", body: JSON.stringify({ readyOn }) });

export const fetchMyDocuments = () => request<HrEmployeeDocument[]>("/api/hr/me/documents");

export type HrAbsenceDay = {
  day: string;
  status: "ABSENT" | "NO_REPLY" | "PRESENT" | "WAIVED";
  lateMinutes: number;
  earlyMinutes: number;
  deadline: string;
  open: boolean;
  submitted: boolean;
  accepted: boolean;
  filename: string;
};

export type HrAbsenceEmployee = { id: string; prenom: string; nom: string; days: HrAbsenceDay[] };

export type HrAbsenceMonth = { month: string; certDelayHours: number; employees: HrAbsenceEmployee[] };

export const fetchHrAbsences = (month: string) => request<HrAbsenceMonth>(`/api/admin/hr/absences?month=${month}`);

export const submitHrAbsence = (userId: string, day: string, filename: string, file: string) =>
  request<{ ok: boolean; accepted: boolean; late: boolean }>("/api/admin/hr/absences", { method: "POST", body: JSON.stringify({ userId, day, filename, file }) });

export const acceptHrAbsence = (userId: string, day: string) =>
  request<{ ok: boolean }>("/api/admin/hr/absences/accept", { method: "POST", body: JSON.stringify({ userId, day }) });

export const fetchMyAbsences = (month: string) => request<{ month: string; certDelayHours: number; days: HrAbsenceDay[] }>(`/api/hr/me/absences?month=${month}`);

export const submitMyAbsence = (day: string, filename: string, file: string) =>
  request<{ ok: boolean; accepted: boolean; late: boolean }>("/api/hr/me/absences", { method: "POST", body: JSON.stringify({ day, filename, file }) });

export async function downloadHrPdf(path: string, filename: string) {
  const session = getSession();
  const response = await fetch(`${API_URL}${path}`, { headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Téléchargement impossible.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
