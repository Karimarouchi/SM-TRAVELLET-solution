import { FancySelect } from "@/components/ui/fancy-select";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_REFERENCE_LABELS,
  createSalesCode,
  fetchCountryPricing,
  fetchMySalesCodes,
  fetchPublicCountries,
  formatMoney,
  getSession,
  type Country,
  type CountryPricing,
  type PaymentMethod,
  type SalesCode
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fetchWhatsAppConversations, formatWhatsAppPhone, type WhatsAppConversation } from "@/lib/whatsapp";
import { AlertTriangle, Banknote, CheckCircle2, ClipboardCopy, Globe2, MessageCircle, Plus, Search, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FormData = {
  countryId: string;
  prefillCurrentStudyLevel: string;
  prefillTargetLevel: string;
  prefillPhone: string;
};

const EMPTY_FORM: FormData = { countryId: "", prefillCurrentStudyLevel: "", prefillTargetLevel: "", prefillPhone: "" };

function contactName(contact: WhatsAppConversation) {
  return contact.studentName || contact.profileName || formatWhatsAppPhone(contact.phone);
}

/* ─── Recherche d'un contact WhatsApp (nom ou numéro) ──────────────────── */
function WhatsAppContactPicker({
  selected,
  onSelect
}: {
  selected: WhatsAppConversation | null;
  onSelect: (contact: WhatsAppConversation | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WhatsAppConversation[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      fetchWhatsAppConversations(query)
        // Un code d'inscription n'a de sens que pour quelqu'un qui n'est pas encore inscrit.
        .then((list) => setResults(list.filter((contact) => !contact.studentId).slice(0, 8)))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (selected) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-dark">{contactName(selected)}</span>
            <span className="block text-[11px] text-muted">{formatWhatsAppPhone(selected.phone)}</span>
          </span>
          <button type="button" onClick={() => onSelect(null)} title="Retirer" className="rounded-full p-1.5 text-muted transition hover:bg-white hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        {selected.windowOpen ? (
          <p className="mt-1.5 text-[11px] text-emerald-700">Le code sera envoyé automatiquement dans cette conversation WhatsApp.</p>
        ) : (
          <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Dernier message de ce contact il y a plus de 24 h : WhatsApp bloquera l'envoi. Le code sera créé, transmettez-le autrement ou attendez qu'il vous réécrive.
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3 py-2.5 focus-within:border-emerald-500 focus-within:bg-white">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Nom ou numéro du contact WhatsApp"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-xl">
          {results.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => {
                onSelect(contact);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-dark">{contactName(contact)}</span>
                <span className="block text-[11px] text-muted">{formatWhatsAppPhone(contact.phone)}</span>
              </span>
              {!contact.windowOpen && <span className="shrink-0 text-[10px] font-semibold text-amber-600">+24 h</span>}
            </button>
          ))}
          {!results.length && <p className="px-3 py-4 text-center text-xs text-muted">Aucune de vos conversations WhatsApp ne correspond.</p>}
        </div>
      )}
    </div>
  );
}

const STUDY_LEVELS = ["Baccalauréat", "Licence", "Master", "Doctorat", "Autre"];
const TARGET_LEVELS = ["Licence", "Master", "Doctorat", "Prépa / Foundation", "Autre"];

export default function SalesCodesPage() {
  const { t } = useLanguage();
  const session = getSession();
  const [codes, setCodes] = useState<SalesCode[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [contact, setContact] = useState<WhatsAppConversation | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Tranche 1 (inscription) : le conseiller confirme l'avoir encaissée.
  const [pricing, setPricing] = useState<CountryPricing | null>(null);
  const [paid, setPaid] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod | "">("");
  const [payReference, setPayReference] = useState("");

  const load = () => {
    setLoading(true);
    fetchMySalesCodes()
      .then(setCodes)
      .catch((err) => setError(err instanceof Error ? err.message : t("Impossible de charger les codes.", "Unable to load codes.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchPublicCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    setPaid(false);
    setPayMethod("");
    setPayReference("");
    setPricing(null);
    if (form.countryId) fetchCountryPricing(form.countryId).then(setPricing).catch(() => setPricing(null));
  }, [form.countryId]);

  if (!session?.user) return null;

  const needsPayment = Boolean(pricing?.configured && (pricing.tranche1 || 0) > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.countryId) {
      setError(t("Choisissez un pays.", "Choose a country."));
      return;
    }
    if (needsPayment && (!paid || !payMethod)) {
      setError(t("Confirmez l'encaissement de la tranche 1 et choisissez le mode de paiement.", "Confirm the first instalment was collected and choose the payment method."));
      return;
    }
    if (needsPayment && payMethod && PAYMENT_REFERENCE_LABELS[payMethod] && !payReference.trim()) {
      setError(`${PAYMENT_REFERENCE_LABELS[payMethod]} ${t("obligatoire.", "required.")}`);
      return;
    }
    setSaving(true);
    setError("");
    setWarning("");
    try {
      const created = await createSalesCode({
        payment: needsPayment ? { confirmed: true, method: payMethod as PaymentMethod, reference: payReference.trim() || undefined } : undefined,
        countryId: form.countryId,
        prefillCurrentStudyLevel: form.prefillCurrentStudyLevel || undefined,
        prefillTargetLevel: form.prefillTargetLevel || undefined,
        prefillPhone: form.prefillPhone || undefined,
        whatsappContactId: contact?.id
      });
      setCodes((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setContact(null);
      if (created.whatsappContactId && created.whatsappSent === false) {
        setWarning(`Code ${created.code} généré, mais non envoyé sur WhatsApp : ${created.whatsappError || "erreur inconnue"}`);
      } else {
        setSuccess(
          created.whatsappSent
            ? `Code ${created.code} généré et envoyé sur WhatsApp à ${created.whatsappContactLabel} ✓${created.paymentReceipt ? ` · Reçu n° ${created.paymentReceipt}` : ""}`
            : t(`Code ${created.code} généré ✓${created.paymentReceipt ? ` · Reçu n° ${created.paymentReceipt}` : ""}`, `Code ${created.code} generated ✓${created.paymentReceipt ? ` · Receipt no. ${created.paymentReceipt}` : ""}`)
        );
        setTimeout(() => setSuccess(""), created.paymentReceipt ? 20000 : 6000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Erreur lors de la génération du code.", "Error while generating the code."));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const available = codes.filter((c) => !c.used);
  const used = codes.filter((c) => c.used);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 sm:p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">{t("Espace conseiller", "Advisor area")}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">{t("Codes étudiants", "Student codes")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          {t(
            "Générez un code à transmettre à un prospect. Il sera automatiquement rattaché à vous et au pays choisi dès qu'il l'utilisera lors de son inscription.",
            "Generate a code to give to a prospect. It will automatically be linked to you and the chosen country as soon as they use it when registering."
          )}
        </p>
      </section>

      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          <X className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}
      {warning && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{warning}</span>
          <button type="button" onClick={() => setWarning("")} className="text-amber-700 hover:text-amber-900"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Formulaire de création */}
      <section className="mt-6 rounded-[24px] border border-line bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
          <Sparkles className="h-5 w-5 text-brand" /> {t("Générer un nouveau code", "Generate a new code")}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <MessageCircle className="h-3 w-3 text-emerald-600" /> Envoyer à un contact WhatsApp (optionnel)
            </label>
            <WhatsAppContactPicker
              selected={contact}
              onSelect={(picked) => {
                setContact(picked);
                if (picked && !form.prefillPhone) {
                  setForm((prev) => ({ ...prev, prefillPhone: formatWhatsAppPhone(picked.phone) }));
                }
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              {t("Pays de destination", "Destination country")} <span className="text-red-500">*</span>
            </label>
            <FancySelect
              value={form.countryId}
              onChange={(id) => setForm((prev) => ({ ...prev, countryId: id }))}
              options={countries.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name }))}
              placeholder={t("Choisir un pays", "Choose a country")}
            />
          </div>
          {needsPayment && pricing && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:col-span-2">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <Banknote className="h-4 w-4" aria-hidden />
                {t("Paiement de l'inscription (tranche 1)", "Registration payment (instalment 1)")} : {formatMoney(pricing.tranche1 || 0, pricing.currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800">
                {t(`Prix total ${pricing.countryName} : ${formatMoney((pricing.tranche1 || 0) + (pricing.tranche2 || 0), pricing.currency)} · la tranche 2 (${formatMoney(pricing.tranche2 || 0, pricing.currency)}) sera à régler avant le dépôt du visa.`, `Total price ${pricing.countryName}: ${formatMoney((pricing.tranche1 || 0) + (pricing.tranche2 || 0), pricing.currency)} · instalment 2 (${formatMoney(pricing.tranche2 || 0, pricing.currency)}) is due before the visa filing.`)}
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-dark">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
                {t("J'ai encaissé la tranche 1 auprès du client", "I have collected instalment 1 from the client")}
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FancySelect
                  value={payMethod}
                  onChange={(v) => setPayMethod(v as PaymentMethod)}
                  options={(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
                  placeholder={t("Mode de paiement", "Payment method")}
                />
                {payMethod && PAYMENT_REFERENCE_LABELS[payMethod] ? (
                  <input
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    maxLength={40}
                    aria-label={PAYMENT_REFERENCE_LABELS[payMethod]}
                    placeholder={`${PAYMENT_REFERENCE_LABELS[payMethod]} *`}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                  />
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-amber-800">
                {t(
                  "Un numéro de reçu automatique (ex. 001-2026) est attribué à chaque encaissement, quel que soit le mode, et le reçu est envoyé par e-mail à l'étudiant à son inscription.",
                  "An automatic receipt number (e.g. 001-2026) is assigned to every payment, whatever the method, and the receipt is emailed to the student when they register."
                )}
              </p>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              {t("Téléphone (optionnel)", "Phone (optional)")}
            </label>
            <input
              type="text"
              placeholder="+216..."
              value={form.prefillPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, prefillPhone: e.target.value }))}
              className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              {t("Niveau d'études actuel (optionnel)", "Current study level (optional)")}
            </label>
            <FancySelect
              value={form.prefillCurrentStudyLevel}
              onChange={(v) => setForm((prev) => ({ ...prev, prefillCurrentStudyLevel: v }))}
              options={STUDY_LEVELS}
              placeholder={t("Non renseigné", "Not set")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              {t("Niveau recherché (optionnel)", "Target level (optional)")}
            </label>
            <FancySelect
              value={form.prefillTargetLevel}
              onChange={(v) => setForm((prev) => ({ ...prev, prefillTargetLevel: v }))}
              options={TARGET_LEVELS}
              placeholder={t("Non renseigné", "Not set")}
            />
          </div>
          <p className="text-[11px] text-muted sm:col-span-2">
            {t("Les champs renseignés ici seront pré-remplis", "Fields filled in here will be pre-filled")} <strong>{t("et verrouillés", "and locked")}</strong> {t("chez l'étudiant : il ne pourra pas les modifier lui-même. L'email et la date de naissance restent toujours saisis par l'étudiant.", "for the student: they won't be able to change them. Email and date of birth are always entered by the student.")}
          </p>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:opacity-90 transition disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> {saving ? t("Génération...", "Generating...") : t("Générer le code", "Generate code")}
            </button>
          </div>
        </form>
      </section>

      {/* Liste des codes */}
      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-dark">{t("Codes disponibles", "Available codes")} ({available.length})</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {available.map((c) => (
                <article key={c.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-dark">{c.code}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(c.code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-muted hover:border-brand hover:text-brand transition"
                    >
                      <ClipboardCopy className="h-3 w-3" /> {copied === c.code ? t("Copié !", "Copied!") : t("Copier", "Copy")}
                    </button>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                    <Globe2 className="h-3 w-3" /> {c.countryName}
                  </p>
                  {(c.prefillCurrentStudyLevel || c.prefillTargetLevel || c.prefillPhone) && (
                    <p className="mt-1 text-[11px] text-muted">
                      {[c.prefillCurrentStudyLevel, c.prefillTargetLevel, c.prefillPhone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {c.whatsappContactLabel && (
                    <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <MessageCircle className="h-3 w-3" /> WhatsApp : {c.whatsappContactLabel}
                    </p>
                  )}
                </article>
              ))}
              {!available.length && (
                <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted sm:col-span-2">
                  {t("Aucun code disponible. Générez-en un ci-dessus.", "No code available. Generate one above.")}
                </p>
              )}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-dark">{t("Codes utilisés", "Used codes")} ({used.length})</h2>
            <p className="mt-1 text-xs text-muted">{t("Un code utilisé reste affiché 24 h, puis il disparaît de cette liste.", "A used code stays listed for 24 h, then disappears from this list.")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {used.map((c) => (
                <article key={c.id} className="rounded-2xl border border-line bg-white p-4 opacity-80">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-muted line-through">{c.code}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold", "bg-slate-100 text-slate-600")}>
                      {t("Utilisé", "Used")}
                    </span>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                    <Globe2 className="h-3 w-3" /> {c.countryName}
                  </p>
                  <p className="mt-1 text-xs text-dark font-semibold">{c.usedByName}</p>
                </article>
              ))}
              {!used.length && (
                <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted sm:col-span-2">
                  {t("Aucun code utilisé pour l'instant.", "No code used yet.")}
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
