import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Boîtes de dialogue du site, à la place de celles du navigateur
// (« www.smtravel.fr indique… »). Utilisables de partout, sans contexte :
//
//   if (!(await confirmDialog("Supprimer « X » ?", { tone: "danger", confirmLabel: "Supprimer" }))) return;
//   await alertDialog("Le nom est obligatoire.", { tone: "warning" });
//
// <DialogHost /> est monté une seule fois dans App.tsx.

export type DialogTone = "danger" | "warning" | "info" | "success";

type DialogOptions = {
  title?: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Request = {
  kind: "confirm" | "alert";
  message: string;
  options: DialogOptions;
  resolve: (value: boolean) => void;
};

let listener: ((request: Request) => void) | null = null;
const waiting: Request[] = [];

function push(request: Request) {
  if (listener) listener(request);
  else waiting.push(request);
}

export function confirmDialog(message: string, options: DialogOptions = {}): Promise<boolean> {
  return new Promise((resolve) => push({ kind: "confirm", message, options, resolve }));
}

export function alertDialog(message: string, options: DialogOptions = {}): Promise<void> {
  return new Promise((resolve) => push({ kind: "alert", message, options, resolve: () => resolve() }));
}

const TONES: Record<DialogTone, { icon: typeof Info; ring: string; badge: string; button: string }> = {
  danger: { icon: Trash2, ring: "ring-red-100", badge: "bg-red-100 text-red-600", button: "bg-red-600 hover:bg-red-700 focus-visible:outline-red-600" },
  warning: { icon: AlertTriangle, ring: "ring-amber-100", badge: "bg-amber-100 text-amber-600", button: "bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600" },
  info: { icon: Info, ring: "ring-violet-100", badge: "bg-violet-100 text-brand", button: "bg-brand hover:bg-brand-hover focus-visible:outline-brand" },
  success: { icon: CheckCircle2, ring: "ring-emerald-100", badge: "bg-emerald-100 text-emerald-600", button: "bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600" }
};

export function DialogHost() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState<Request | null>(null);
  const queue = useRef<Request[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  // Une seule boîte à la fois : les suivantes attendent leur tour.
  const showNext = () => setCurrent(queue.current.shift() || null);

  useEffect(() => {
    listener = (request) => {
      queue.current.push(request);
      setCurrent((open) => (open ? open : queue.current.shift() || null));
    };
    while (waiting.length) queue.current.push(waiting.shift()!);
    setCurrent((open) => (open ? open : queue.current.shift() || null));
    return () => {
      listener = null;
    };
  }, []);

  const close = (value: boolean) => {
    current?.resolve(value);
    showNext();
  };

  useEffect(() => {
    if (!current) return;
    // Suppression : le focus est sur « Annuler » (une frappe par erreur ne supprime rien).
    const target = current.kind === "confirm" && current.options.tone === "danger" ? cancelRef.current : okRef.current;
    target?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const tone = current?.options.tone || (current?.kind === "alert" ? "info" : "warning");
  const style = TONES[tone];
  const Icon = style.icon;
  const defaultTitle =
    current?.kind === "confirm"
      ? t("Confirmation", "Confirmation")
      : tone === "danger"
        ? t("Une erreur est survenue", "Something went wrong")
        : tone === "warning"
          ? t("Attention", "Attention")
          : tone === "success"
            ? t("Terminé", "Done")
            : t("Information", "Information");

  return createPortal(
    <AnimatePresence>
      {current && (
        <motion.div
          key="dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(false);
          }}
        >
          <motion.div
            role={current.kind === "confirm" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="sm-dialog-title"
            aria-describedby="sm-dialog-message"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={cn("w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,.25)] ring-4", style.ring)}
          >
            <div className="flex items-start gap-4">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", style.badge)}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="sm-dialog-title" className="font-display text-lg font-extrabold text-dark">
                  {current.options.title || defaultTitle}
                </h2>
                <p id="sm-dialog-message" className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-mid">
                  {current.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {current.kind === "confirm" && (
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => close(false)}
                  className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-mid transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {current.options.cancelLabel || t("Annuler", "Cancel")}
                </button>
              )}
              <button
                ref={okRef}
                type="button"
                onClick={() => close(true)}
                className={cn("rounded-xl px-5 py-2.5 text-sm font-bold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2", style.button)}
              >
                {current.options.confirmLabel || (current.kind === "confirm" ? t("Confirmer", "Confirm") : "OK")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
