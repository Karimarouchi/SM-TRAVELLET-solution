import { markApplicationCelebrated, type UniversityApplication } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { GraduationCap, Plane } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Kind = "university" | "visa";
type Moment = { key: string; kind: Kind; application: UniversityApplication };

const COLORS = ["#7c3aed", "#a78bfa", "#f59e0b", "#fbbf24", "#10b981", "#ec4899", "#38bdf8"];

function momentsOf(applications: UniversityApplication[]): Moment[] {
  const moments: Moment[] = [];
  for (const application of applications) {
    if (application.visaStatus === "ACCEPTED" && !application.visaCelebratedAt) {
      moments.push({ key: `${application.id}:visa`, kind: "visa", application });
    } else if (application.status === "ACCEPTED" && !application.universityCelebratedAt) {
      moments.push({ key: `${application.id}:university`, kind: "university", application });
    }
  }
  return moments.sort((a, b) => Number(b.kind === "visa") - Number(a.kind === "visa"));
}

function Confetti({ count }: { count: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 1.8,
        duration: 2.6 + Math.random() * 2.4,
        drift: (Math.random() - 0.5) * 180,
        spin: 360 + Math.random() * 720,
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.65,
        color: COLORS[index % COLORS.length]
      })),
    [count]
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute top-0 block"
          style={{ left: `${piece.left}%`, width: piece.size, height: piece.round ? piece.size : piece.size * 1.6, backgroundColor: piece.color, borderRadius: piece.round ? "9999px" : "2px" }}
          initial={{ y: "-10vh", x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", x: piece.drift, rotate: piece.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

function VisaScene({ moment, firstName, reduced, onClose }: { moment: Moment; firstName: string; reduced: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10002] flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-dark via-brand to-violet-500 px-6 text-center text-white"
    >
      {!reduced && <Confetti count={150} />}
      {!reduced && (
        <motion.span
          className="pointer-events-none absolute left-0 top-[18%] text-amber-300"
          initial={{ x: "-15vw", y: 60, rotate: 0 }}
          animate={{ x: "115vw", y: -60, rotate: -8 }}
          transition={{ duration: 4.5, delay: 0.4, ease: "easeInOut" }}
          aria-hidden
        >
          <Plane className="h-14 w-14 rotate-45" />
        </motion.span>
      )}
      <div className="relative max-w-xl">
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
          {!reduced && [0, 0.7].map((delay) => (
            <motion.span
              key={delay}
              className="absolute inset-0 rounded-full border-2 border-amber-300"
              initial={{ scale: 0.7, opacity: 0.9 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1.9, delay, repeat: Infinity, ease: "easeOut" }}
              aria-hidden
            />
          ))}
          <motion.span
            initial={reduced ? false : { scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
            className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-brand-dark shadow-[0_0_60px_rgba(251,191,36,.6)]"
          >
            <Plane className="h-14 w-14" aria-hidden />
          </motion.span>
        </div>
        <motion.div initial={reduced ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}>
          <p className="mt-8 text-sm font-bold uppercase tracking-[0.25em] text-amber-300">{t("Félicitations", "Congratulations")} {firstName}</p>
          <h1 id="celebration-title" className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-6xl">{t("Votre visa est accepté !", "Your visa is approved!")}</h1>
          <p className="mx-auto mt-4 max-w-md text-base text-white/85 sm:text-lg">
            {t(`Direction ${moment.application.countryName} : votre nouvelle aventure commence ici.`, `Next stop ${moment.application.countryName}: your new adventure starts here.`)}
          </p>
          <button type="button" autoFocus onClick={onClose} className="mt-8 rounded-full bg-white px-8 py-3 text-sm font-bold text-brand shadow-xl transition hover:scale-105">
            {t("Voir mon espace", "Open my space")}
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function UniversityScene({ moment, firstName, reduced, onClose }: { moment: Moment; firstName: string; reduced: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10002] flex items-center justify-center overflow-hidden bg-dark/60 px-4 backdrop-blur-sm"
    >
      {!reduced && <Confetti count={60} />}
      <motion.div
        initial={reduced ? false : { scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="relative w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-2xl"
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-light text-brand">
          <GraduationCap className="h-8 w-8" aria-hidden />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-brand">{t("Félicitations", "Congratulations")} {firstName}</p>
        <h1 id="celebration-title" className="mt-2 font-display text-2xl font-extrabold text-dark">{t("Vous êtes accepté(e) !", "You are accepted!")}</h1>
        <p className="mt-2 text-sm text-muted">
          {t(`${moment.application.universityName} a accepté votre candidature. Prochaine étape : votre dossier visa.`, `${moment.application.universityName} accepted your application. Next step: your visa file.`)}
        </p>
        <button type="button" autoFocus onClick={onClose} className="mt-6 rounded-full bg-brand px-7 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
          {t("Continuer", "Continue")}
        </button>
      </motion.div>
    </motion.div>
  );
}

// Une seule fois par acceptation : à la première ouverture de l'espace, le serveur retient qu'elle a été vue.
export default function AcceptanceCelebration({ applications, firstName }: { applications: UniversityApplication[]; firstName: string }) {
  const reduced = Boolean(useReducedMotion());
  const [closed, setClosed] = useState<string[]>([]);
  const marked = useRef(new Set<string>());
  const current = useMemo(() => momentsOf(applications).find((moment) => !closed.includes(moment.key)) || null, [applications, closed]);

  useEffect(() => {
    if (!current || marked.current.has(current.key)) return;
    marked.current.add(current.key);
    markApplicationCelebrated(current.application.id, current.kind).catch(() => undefined);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClosed((keys) => [...keys, current.key]);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [current]);

  if (!current) return null;
  const onClose = () => setClosed((keys) => [...keys, current.key]);
  const Scene = current.kind === "visa" ? VisaScene : UniversityScene;
  return createPortal(<Scene key={current.key} moment={current} firstName={firstName} reduced={reduced} onClose={onClose} />, document.body);
}
