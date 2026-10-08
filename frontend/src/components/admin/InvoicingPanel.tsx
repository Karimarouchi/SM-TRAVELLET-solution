import { alertDialog } from "@/components/ui/dialog-host";
import { UserAvatar } from "@/components/ui/user-avatar";
import { createInvoice, downloadInvoicePdf, fetchInvoicing, formatMoney, type Currency, type InvoicingPayment, type InvoicingStudent } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, Landmark, Receipt, Search, Users } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 5;
type Filter = "todo" | "done" | "all";

const frDate = (value: string) => {
  const [y, m, d] = value.split("-");
  return y ? `${d}/${m}/${y}` : "";
};

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: typeof Receipt; label: string; value: number; hint: string; tone: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold leading-none text-dark">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </motion.div>
  );
}

// Facturation : factures des étudiants qui ont payé par chèque ou par virement.
export default function InvoicingPanel() {
  const [students, setStudents] = useState<InvoicingStudent[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("todo");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Paiements cochés par étudiant (par défaut : tous ceux qui ne sont pas encore facturés).
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    fetchInvoicing()
      .then((data) => setStudents(data.students))
      .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const totals = useMemo(() => {
    const list = students || [];
    return {
      students: list.length,
      pending: list.reduce((sum, s) => sum + s.toInvoiceCount, 0),
      invoices: list.reduce((sum, s) => sum + s.invoices.length, 0)
    };
  }, [students]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students || []).filter((s) => {
      if (filter === "todo" && s.toInvoiceCount === 0) return false;
      if (filter === "done" && s.invoices.length === 0) return false;
      if (!q) return true;
      return [s.name, s.email, ...s.payments.flatMap((p) => [p.receiptNumber, p.reference, p.invoiceNumber])].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [students, filter, search]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedIds = (student: InvoicingStudent) => picked[student.studentId] ?? student.payments.filter((p) => !p.invoiceId).map((p) => p.id);

  const toggle = (student: InvoicingStudent, payment: InvoicingPayment) => {
    const current = new Set(selectedIds(student));
    if (current.has(payment.id)) current.delete(payment.id);
    else current.add(payment.id);
    setPicked((prev) => ({ ...prev, [student.studentId]: [...current] }));
  };

  async function generate(student: InvoicingStudent, currency: Currency) {
    const ids = student.payments.filter((p) => selectedIds(student).includes(p.id) && !p.invoiceId && p.currency === currency).map((p) => p.id);
    if (!ids.length) return;
    setBusy(`${student.studentId}:${currency}`);
    try {
      const invoice = await createInvoice(student.studentId, ids);
      await downloadInvoicePdf(invoice.id, invoice.number);
      setPicked((prev) => {
        const next = { ...prev };
        delete next[student.studentId];
        return next;
      });
      await load();
    } catch (err) {
      void alertDialog(err instanceof Error ? err.message : "Génération impossible.", { tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  async function download(id: string, number: string) {
    try {
      await downloadInvoicePdf(id, number);
    } catch (err) {
      void alertDialog(err instanceof Error ? err.message : "Téléchargement impossible.", { tone: "danger" });
    }
  }

  if (error) return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!students) return <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />;

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-[22px] border border-line bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark"><FileText className="h-5 w-5 text-brand" /> Facturation</h2>
        <p className="mt-1 text-xs text-muted">
          Générez la facture des étudiants qui ont payé par <strong>chèque</strong> ou par <strong>virement</strong>. La facture reprend le logo, les coordonnées de l'agence et le
          <strong> numéro de reçu</strong> de chaque paiement, puis se télécharge en PDF. Un paiement ne peut être facturé qu'une seule fois.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={Users} label="Étudiants concernés" value={totals.students} hint="ont payé par chèque ou virement" tone="bg-violet-100 text-brand" />
        <Kpi icon={Receipt} label="Paiements à facturer" value={totals.pending} hint="sans facture pour l'instant" tone="bg-amber-100 text-amber-600" />
        <Kpi icon={FileText} label="Factures émises" value={totals.invoices} hint="téléchargeables à tout moment" tone="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Étudiant, e-mail, n° de reçu, chèque, virement…" className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
        <div className="inline-flex rounded-full border border-line bg-white p-0.5 shadow-sm">
          {([["todo", "À facturer"], ["done", "Facturés"], ["all", "Tous"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold transition", filter === id ? "bg-brand text-white" : "text-mid hover:text-brand")}>{label}</button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          {students.length === 0 ? "Aucun paiement par chèque ou virement pour l'instant." : "Aucun étudiant ne correspond."}
        </p>
      ) : (
        <>
          <div className="space-y-4">
            {paged.map((student, index) => {
              const selected = selectedIds(student);
              const pending = student.payments.filter((p) => !p.invoiceId);
              const currencies = [...new Set(pending.filter((p) => selected.includes(p.id)).map((p) => p.currency))] as Currency[];
              return (
                <motion.article
                  key={student.studentId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  className="overflow-hidden rounded-[22px] border border-line bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/60 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={student.name} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-display text-base font-bold text-dark">{student.name}</p>
                        <p className="truncate text-xs text-muted">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                      {student.toInvoiceCount > 0 ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{student.toInvoiceCount} à facturer</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Tout est facturé</span>
                      )}
                      {student.invoices.length > 0 && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-brand">{student.invoices.length} facture{student.invoices.length > 1 ? "s" : ""}</span>}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-muted">
                          <th className="w-10 px-5 py-2.5" />
                          <th className="px-2 py-2.5">Reçu n°</th>
                          <th className="px-2 py-2.5">Paiement</th>
                          <th className="px-2 py-2.5">Mode</th>
                          <th className="px-2 py-2.5">Date</th>
                          <th className="px-2 py-2.5 text-right">Montant</th>
                          <th className="px-5 py-2.5 text-right">Facture</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {student.payments.map((p) => (
                          <tr key={p.id} className={cn("transition hover:bg-brand/5", p.invoiceId && "text-muted")}>
                            <td className="px-5 py-2.5">
                              {!p.invoiceId && (
                                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(student, p)} aria-label={`Facturer le paiement ${p.receiptNumber || ""}`} className="h-4 w-4 accent-violet-600" />
                              )}
                            </td>
                            <td className="px-2 py-2.5 font-bold text-dark">{p.receiptNumber || "—"}</td>
                            <td className="px-2 py-2.5">{p.tranche === 1 ? "Tranche 1 · inscription" : "Tranche 2 · visa"} — {p.countryName}</td>
                            <td className="px-2 py-2.5">
                              <span className="inline-flex items-center gap-1"><Landmark className="h-3 w-3" /> {p.methodLabel} {p.referenceLabel} {p.reference || "—"}</span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5">{frDate(p.paidAt)}</td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-right font-bold text-dark">{formatMoney(p.amount, p.currency)}</td>
                            <td className="px-5 py-2.5 text-right">
                              {p.invoiceId ? (
                                <button type="button" onClick={() => void download(p.invoiceId!, p.invoiceNumber || "")} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white">
                                  <Download className="h-3 w-3" /> {p.invoiceNumber}
                                </button>
                              ) : (
                                <span className="text-[11px] text-amber-600">À facturer</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(pending.length > 0 || student.invoices.length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {currencies.map((currency) => {
                          const chosen = pending.filter((p) => selected.includes(p.id) && p.currency === currency);
                          const total = chosen.reduce((sum, p) => sum + p.amount, 0);
                          const key = `${student.studentId}:${currency}`;
                          return (
                            <button
                              key={currency}
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void generate(student, currency)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {busy === key ? "Génération…" : `Générer la facture · ${chosen.length} paiement${chosen.length > 1 ? "s" : ""} · ${formatMoney(total, currency)}`}
                            </button>
                          );
                        })}
                        {pending.length > 0 && currencies.length === 0 && <span className="text-xs text-muted">Cochez au moins un paiement pour générer une facture.</span>}
                        {currencies.length > 1 && <span className="text-[11px] text-muted">Deux monnaies : une facture par monnaie.</span>}
                      </div>
                      {student.invoices.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {student.invoices.map((inv) => (
                            <button key={inv.id} type="button" onClick={() => void download(inv.id, inv.number)} title={`Émise le ${frDate(inv.issuedAt)}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-bold text-mid transition hover:border-brand hover:text-brand">
                              <Download className="h-3 w-3" /> {inv.number} · {formatMoney(inv.total, inv.currency)}
                              {inv.hasCancelled && <AlertTriangle className="h-3 w-3 text-amber-500" aria-label="Un paiement de cette facture a été annulé" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.article>
              );
            })}
          </div>

          {visible.length > PAGE_SIZE && (
            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination de la facturation">
              <p className="text-xs text-muted">
                Étudiants {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, visible.length)} sur {visible.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Précédent
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === currentPage ? "page" : undefined} className={cn("h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition", n === currentPage ? "bg-brand text-white shadow" : "border border-line bg-white text-mid hover:border-brand hover:text-brand")}>
                    {n}
                  </button>
                ))}
                <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
                  Suivant <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
