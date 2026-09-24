import { cn } from "@/lib/utils";
import { fetchMyStudents, getSession, type BoardStudent } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MyCommissionsCard from "@/components/MyCommissionsCard";

const PAGE_SIZE = 25;

export default function SalesEspacePage() {
  const { t } = useLanguage();
  const session = getSession();
  const [students, setStudents] = useState<BoardStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  useEffect(() => {
    fetchMyStudents({ page, pageSize: PAGE_SIZE, search })
      .then((data) => {
        setStudents(data.students || []);
        setTotal(data.total || 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("Impossible de charger les étudiants.", "Unable to load students.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!session?.user) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">{t("Espace conseiller", "Advisor area")}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">{t("Bonjour", "Hello")}, {session.user.prenom}</h1>
        <p className="mt-3 text-sm text-white/85">
          {total} {t(`étudiant${total > 1 ? "s" : ""} actuellement à votre charge.`, `student${total > 1 ? "s" : ""} currently assigned to you.`)}
        </p>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <MyCommissionsCard />

      <Link
        to="/messages"
        className="mt-6 flex items-center justify-between rounded-[20px] border border-brand/20 bg-white px-6 py-5 transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <span>
          <span className="block font-display text-lg font-bold">{t("Messagerie", "Messages")}</span>
          <span className="mt-1 block text-sm text-muted">
            {t("Vos étudiants à gauche, la discussion Messenger à droite.", "Your students on the left, the chat on the right.")}
          </span>
        </span>
        <span className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-white">{t("Ouvrir", "Open")}</span>
      </Link>

      {/* Recherche + bascule d'affichage */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("Rechercher un étudiant...", "Search a student...")}
            className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              viewMode === "table" ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
            )}
          >
            <List className="h-3.5 w-3.5" /> {t("Tableau", "Table")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              viewMode === "cards" ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> {t("Cartes", "Cards")}
          </button>
        </div>
      </div>

      {!students.length && !error && (
        <p className="mt-4 rounded-[20px] border border-dashed border-line bg-white p-8 text-sm text-muted">
          {t("Aucun étudiant ne vous est encore affecté.", "No student has been assigned to you yet.")}
        </p>
      )}

      {students.length > 0 && viewMode === "table" && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">{t("Étudiant", "Student")}</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden sm:table-cell">{t("Destination", "Destination")}</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden md:table-cell">{t("Formation", "Program")}</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden lg:table-cell">{t("Téléphone", "Phone")}</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">{t("Actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {students.map((student) => (
                <tr key={student.id} className="transition hover:bg-brand/5">
                  <td className="px-4 py-3">
                    <p className="font-bold text-dark text-xs">{student.prenom} {student.nom}</p>
                    <p className="text-[11px] text-muted">{student.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-mid">
                    {student.preferredCountries.length ? student.preferredCountries.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-brand">
                    {student.targetField || "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted">
                    {student.phone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        to={`/conseiller/etudiants/${student.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white"
                      >
                        <UserRound className="h-3 w-3" /> {t("Profil", "Profile")}
                      </Link>
                      <Link
                        to={`/messages?student=${student.id}`}
                        className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-dark transition hover:bg-slate-200"
                      >
                        {t("Écrire", "Message")}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {students.length > 0 && viewMode === "cards" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {students.map((student) => (
            <article key={student.id} className="rounded-[20px] border border-line bg-white p-5">
              <h2 className="font-display text-lg font-bold">
                {student.prenom} {student.nom}
              </h2>
              <p className="mt-1 text-sm text-muted">{student.email}</p>
              <p className="mt-3 text-sm text-mid">{student.preferredCountries.length ? student.preferredCountries.join(", ") : t("Destination non renseignée", "Destination not set")}</p>
              <p className="mt-1 text-sm text-brand">{student.targetField || t("Formation non renseignée", "Program not set")}</p>
              <p className="mt-2 text-xs text-muted">{student.phone || t("Téléphone non renseigné", "Phone not set")}</p>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  to={`/conseiller/etudiants/${student.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-4 py-2 text-xs font-bold text-brand hover:bg-brand hover:text-white transition"
                >
                  <UserRound className="h-3.5 w-3.5" /> {t("Voir le profil", "View profile")}
                </Link>
                <Link
                  to={`/messages?student=${student.id}`}
                  className="inline-flex rounded-full bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark"
                >
                  {t("Écrire", "Message")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted">
            {t(`Page ${page} sur ${totalPages}`, `Page ${page} of ${totalPages}`)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-dark disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> {t("Précédent", "Previous")}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-dark disabled:opacity-40"
            >
              {t("Suivant", "Next")} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
