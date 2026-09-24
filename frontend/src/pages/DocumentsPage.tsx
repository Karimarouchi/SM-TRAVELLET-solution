import VisaDocumentsChecklist from "@/components/VisaDocumentsChecklist";
import { fetchMyDocuments, fetchMyVisaChecklist, uploadMyDocument, type StudentDocumentChecklistItem, type VisaDocumentChecklistItem } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Globe2,
  Plane,
  Upload,
  XCircle
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";

function statusMeta(t: (fr: string, en: string) => string): Record<StudentDocumentChecklistItem["status"], { label: string; color: string; icon: typeof Clock }> {
  return {
    PENDING: { label: t("À déposer", "To upload"), color: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock },
    SUBMITTED: { label: t("Envoyé · en vérification", "Sent · under review"), color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
    VALIDATED: { label: t("Validé", "Approved"), color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    REJECTED: { label: t("Refusé · à renvoyer", "Rejected · resend"), color: "bg-red-50 text-red-600 border-red-200", icon: XCircle }
  };
}

function acceptAttr(type: StudentDocumentChecklistItem["acceptedFileTypes"]) {
  if (type === "IMAGE") return "image/png,image/jpeg,image/webp";
  if (type === "PDF") return "application/pdf";
  return "image/png,image/jpeg,image/webp,application/pdf";
}

function typeLabel(type: StudentDocumentChecklistItem["acceptedFileTypes"], t: (fr: string, en: string) => string) {
  if (type === "IMAGE") return t("Image (PNG/JPG/WEBP)", "Image (PNG/JPG/WEBP)");
  if (type === "PDF") return "PDF";
  return t("Image ou PDF", "Image or PDF");
}

function DocumentRow({ doc, onUploaded }: { doc: StudentDocumentChecklistItem; onUploaded: (updated: StudentDocumentChecklistItem) => void }) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = statusMeta(t)[doc.status];
  const StatusIcon = meta.icon;

  const handleFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError(t("Le fichier dépasse 5 Mo.", "The file exceeds 5 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setUploading(true);
      setError("");
      try {
        const updated = await uploadMyDocument(doc.name, reader.result as string, file.name);
        onUploaded(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("Échec de l'envoi.", "Upload failed."));
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-bold text-dark">
              {doc.name}
              {doc.required && <span className="ml-1.5 text-red-500">*</span>}
            </p>
            {doc.description && <p className="mt-0.5 text-xs text-muted">{doc.description}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {doc.countries.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                  <Globe2 className="h-2.5 w-2.5" /> {c}
                </span>
              ))}
              <span className="text-[10px] text-muted">· {typeLabel(doc.acceptedFileTypes, t)}</span>
            </div>
          </div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.color)}>
          <StatusIcon className="h-3 w-3" /> {meta.label}
        </span>
      </div>

      {doc.status === "REJECTED" && doc.rejectionReason && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {doc.rejectionReason}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-2 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand/10 disabled:opacity-60"
        >
          {uploading ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {doc.fileUrl ? t("Remplacer le fichier", "Replace file") : t("Déposer le fichier", "Upload file")}
        </button>
        {doc.originalFilename && <span className="text-xs text-muted truncate max-w-[200px]">{doc.originalFilename}</span>}
        <input ref={inputRef} type="file" accept={acceptAttr(doc.acceptedFileTypes)} className="hidden" onChange={onChange} />
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function DocumentsPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<StudentDocumentChecklistItem[]>([]);
  const [visaDocuments, setVisaDocuments] = useState<VisaDocumentChecklistItem[]>([]);
  const [visaAvailable, setVisaAvailable] = useState(false);
  const [visaCountryName, setVisaCountryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"dossier" | "visa">(searchParams.get("tab") === "visa" ? "visa" : "dossier");

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchMyDocuments(),
      fetchMyVisaChecklist()
    ])
      .then(([dossierDocs, visaData]) => {
        setDocuments(dossierDocs);
        setVisaDocuments(visaData.checklist);
        setVisaAvailable(Boolean(visaData.application));
        setVisaCountryName(visaData.application?.countryName || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("Impossible de charger vos documents.", "Unable to load your documents.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUploaded = (updated: StudentDocumentChecklistItem) => {
    setDocuments((prev) => prev.map((d) => (d.name === updated.name ? updated : d)));
  };

  const handleVisaUploaded = (updated: VisaDocumentChecklistItem) => {
    setVisaDocuments((prev) => prev.map((d) => (d.requirementId === updated.requirementId ? updated : d)));
  };

  const switchTab = (next: "dossier" | "visa") => {
    setTab(next);
    setSearchParams(next === "visa" ? { tab: "visa" } : {}, { replace: true });
  };

  const total = documents.length;
  const done = documents.filter((d) => d.status === "SUBMITTED" || d.status === "VALIDATED").length;
  const visaTotal = visaDocuments.length;
  const visaDone = visaDocuments.filter((d) => d.status === "VALIDATED").length;
  const activeTotal = tab === "dossier" ? total : visaTotal;
  const activeDone = tab === "dossier" ? done : visaDone;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">{t("Espace étudiant", "Student area")}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">{t("Mes documents", "My documents")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          {tab === "dossier" ? (
            t(
              "Checklist des documents requis pour le(s) pays que vous avez choisis. Déposez chaque document une seule fois : s'il concerne plusieurs pays, il est automatiquement pris en compte pour tous.",
              "Checklist of documents required for the country/countries you chose. Upload each document once: if it applies to several countries, it is automatically taken into account for all of them."
            )
          ) : (
            t(
              `Documents requis pour votre demande de visa${visaCountryName ? ` · ${visaCountryName}` : ""}. Votre responsable dossier visa doit valider chaque document avant le dépôt du dossier.`,
              `Documents required for your visa application${visaCountryName ? ` · ${visaCountryName}` : ""}. Your visa officer must approve each document before the file can be submitted.`
            )
          )}
        </p>

        {visaAvailable && (
          <div className="relative mt-5 inline-flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur">
            <button
              type="button"
              onClick={() => switchTab("dossier")}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-bold transition",
                tab === "dossier" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              {t("Documents inscription", "Enrollment documents")}
            </button>
            <button
              type="button"
              onClick={() => switchTab("visa")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition",
                tab === "visa" ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <Plane className="h-3.5 w-3.5" /> {t("Documents visa", "Visa documents")}
            </button>
          </div>
        )}

        {activeTotal > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${(activeDone / activeTotal) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold text-white/90">
              {activeDone} / {activeTotal} {tab === "dossier" ? t("déposés", "uploaded") : t("validés", "approved")}
            </span>
          </div>
        )}
      </section>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="mt-16 flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
          <p className="text-sm text-muted">{t("Chargement de vos documents...", "Loading your documents...")}</p>
        </div>
      ) : tab === "dossier" ? (
        documents.length === 0 ? (
          <div className="mt-16 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-line" />
            <p className="mt-4 font-display text-lg font-bold text-dark">{t("Aucun document requis pour l'instant", "No documents required yet")}</p>
            <p className="text-sm text-muted">
              {t(
                "Choisissez au moins un pays préféré dans votre profil pour voir la liste des documents à fournir.",
                "Choose at least one preferred country in your profile to see the list of documents to provide."
              )}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {documents.map((doc) => (
              <DocumentRow key={doc.name} doc={doc} onUploaded={handleUploaded} />
            ))}
          </div>
        )
      ) : (
        <VisaDocumentsChecklist documents={visaDocuments} onUploaded={handleVisaUploaded} />
      )}
    </main>
  );
}
