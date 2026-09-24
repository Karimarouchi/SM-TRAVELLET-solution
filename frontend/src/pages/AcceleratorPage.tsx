import { fetchMe, getSession } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { CheckCircle2, Globe2, Rocket } from "lucide-react";
import { useEffect, useState } from "react";

export default function AcceleratorPage() {
  const { t } = useLanguage();
  const initial = getSession();
  const [preferredCountries, setPreferredCountries] = useState<string[]>(initial?.profile?.preferredCountries || []);

  useEffect(() => {
    fetchMe()
      .then((session) => setPreferredCountries(session.profile?.preferredCountries || []))
      .catch(() => undefined);
  }, []);

  const session = getSession();
  if (!session?.user) return null;

  const hasDestinations = preferredCountries.length > 0;

  const steps = [
    { title: t("Profil complété", "Profile completed"), text: t("Vos informations de base sont enregistrées.", "Your basic information is saved."), done: true },
    {
      title: t("Choix de destination", "Destination choice"),
      text: hasDestinations
        ? null
        : t("Choisissez au moins un pays dans votre profil pour passer à l'étape suivante.", "Choose at least one country in your profile to move to the next step."),
      done: hasDestinations
    },
    { title: t("Dossier académique", "Academic file"), text: t("Préparez vos relevés, passeport et lettres.", "Prepare your transcripts, passport and letters."), done: false },
    { title: t("Accompagnement visa", "Visa support"), text: t("SM Travel vous guide jusqu’à l’entretien.", "SM Travel guides you all the way to the interview."), done: false }
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <div className="flex items-center gap-3">
          <Rocket className="h-8 w-8" />
          <div>
            <p className="text-sm text-white/80">{t("Parcours guidé", "Guided journey")}</p>
            <h1 className="font-display text-3xl font-extrabold">{t("Accélérateur", "Accelerator")}</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85">
          {t(
            `Bonjour ${session.user.prenom}. Cet accélérateur vous aide à avancer plus vite, étape par étape, vers votre départ.`,
            `Hello ${session.user.prenom}. This accelerator helps you move faster, step by step, toward your departure.`
          )}
        </p>
      </section>

      <div className="mt-6 grid gap-4">
        {steps.map((step, index) => (
          <article key={step.title} className="flex items-start gap-4 rounded-[20px] border border-line bg-white p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-bold text-brand">
              {index + 1}
            </div>
            <div className="flex-1">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                {step.title}
                {step.done && <CheckCircle2 className="h-5 w-5 text-teal-600" />}
              </h2>
              {index === 1 && hasDestinations ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preferredCountries.map((country) => (
                    <span
                      key={country}
                      className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
                    >
                      <Globe2 className="h-3 w-3" /> {country}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted">{step.text}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
