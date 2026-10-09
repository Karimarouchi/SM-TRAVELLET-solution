import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Date du jour (AAAA-MM-JJ) dans le fuseau de l'utilisateur, pour préremplir un champ date.
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Profil d'un étudiant selon le rôle : le Responsable Dossier a sa propre fiche (lecture seule).
export function studentProfilePath(role: string | undefined, studentId: string) {
  return role === "RDV" ? `/rdv/etudiants/${studentId}` : `/conseiller/etudiants/${studentId}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
