import { request } from "@/lib/auth";

export type StudentNote = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string | null;
  authorName: string;
  authorRole: string;
  canDelete: boolean;
};

export const fetchStudentNotes = (studentId: string) => request<StudentNote[]>(`/api/students/${studentId}/notes`);
export const addStudentNote = (studentId: string, body: string) =>
  request<StudentNote>(`/api/students/${studentId}/notes`, { method: "POST", body: JSON.stringify({ body }) });
export const deleteStudentNote = (noteId: string) => request<{ id: string }>(`/api/student-notes/${noteId}`, { method: "DELETE" });
