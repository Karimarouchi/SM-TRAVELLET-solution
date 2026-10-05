import { submitStudentAvis } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { ChevronDown, ChevronUp, MessageSquareHeart, Send, Star } from "lucide-react";
import { useState } from "react";

// « Partagez votre expérience » : replié par défaut pour ne pas encombrer
// l'espace ; publié sur la vitrine après modération.
export default function ReviewCard() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [programme, setProgramme] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setStatus("loading");
    try {
      await submitStudentAvis({ rating, content, programme });
      setStatus("success");
      setContent("");
      setProgramme("");
      setRating(5);
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="rounded-[24px] border border-line bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6">
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <MessageSquareHeart className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-display text-base font-bold text-dark">{t("Partagez votre expérience", "Share your experience")}</span>
            <span className="block text-xs text-muted">{t("Votre avis aide d'autres étudiants. Publié sur notre site après modération.", "Your review helps other students. Published on our site after moderation.")}</span>
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted" />}
      </button>

      {open && (
        <div className="border-t border-line/70 px-5 pb-6 pt-5 sm:px-6">
          {status === "success" ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Star className="h-6 w-6 fill-current" />
              </div>
              <h3 className="text-lg font-bold text-emerald-800">{t("Merci pour votre avis !", "Thank you for your review!")}</h3>
              <p className="mt-1 text-sm text-emerald-600">{t("Il est en cours de modération et sera bientôt publié sur notre site.", "It is being moderated and will soon be published on our website.")}</p>
              <button onClick={() => setStatus("idle")} className="mt-4 text-sm font-bold text-brand hover:underline">
                {t("Soumettre un autre avis", "Submit another review")}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="max-w-2xl">
              <div className="mb-5 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">{t("Note globale", "Overall rating")}</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star}/5`} className="transition hover:scale-110 focus:outline-none">
                      <Star className={`h-8 w-8 ${star <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300 hover:text-amber-200"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-5 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">{t("Programme / Destination (optionnel)", "Program / Destination (optional)")}</label>
                <input
                  type="text"
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  placeholder={t("Ex: Master en Informatique à Malte", "E.g. Master in Computer Science in Malta")}
                  className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
              </div>
              <div className="mb-6 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">{t("Votre témoignage *", "Your testimonial *")}</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("Racontez-nous comment s'est passé votre accompagnement...", "Tell us how your support experience went...")}
                  rows={4}
                  className="resize-none rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
              </div>
              <div className="flex items-center justify-between">
                {status === "error" && <span className="text-sm font-bold text-red-500">{t("Une erreur est survenue. Veuillez réessayer.", "Something went wrong. Please try again.")}</span>}
                <div className="flex-1" />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:opacity-50"
                >
                  {status === "loading" ? t("Envoi en cours...", "Sending...") : <>{t("Envoyer mon avis", "Submit my review")} <Send className="h-4 w-4" /></>}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
