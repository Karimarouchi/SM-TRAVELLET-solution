import VisaDocumentsPanel from "@/components/admin/VisaDocumentsPanel";
import { Plane } from "lucide-react";

// Page dédiée à la gestion des documents VISA par destination — accessible
// avec la seule permission MANAGE_VISA_DOCUMENTS, ou pour un RDV limité à
// ses pays configurés, sans donner accès aux pays/universités/documents du
// dossier universitaire (réservés à /admin/programmes).
export default function AdminVisaDocumentsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Plane className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm text-white/80">Documents visa</p>
            <h1 className="font-display text-2xl font-extrabold">Documents requis pour le visa, par destination</h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Ces documents sont demandés à l'étudiant une fois son dossier transféré au Responsable Dossier Visa — distincts des documents du dossier universitaire.
        </p>
      </section>

      <VisaDocumentsPanel />
    </main>
  );
}
