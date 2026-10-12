import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";

// Montants floutés par défaut sur une page (comme les indicateurs de l'accueil
// admin). Hors d'un HiddenAmountsProvider, rien n'est flouté.
type HiddenAmounts = { hidden: boolean; toggle: () => void };

const HiddenAmountsContext = createContext<HiddenAmounts | null>(null);

export function HiddenAmountsProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true);
  return <HiddenAmountsContext.Provider value={{ hidden, toggle: () => setHidden((v) => !v) }}>{children}</HiddenAmountsContext.Provider>;
}

export function useAmountsHidden(): boolean {
  return Boolean(useContext(HiddenAmountsContext)?.hidden);
}

/** Classes à ajouter à un élément qui affiche un chiffre. */
export function useAmountBlur(): string {
  return useAmountsHidden() ? "select-none blur-[8px] transition" : "transition";
}

export function Amount({ children, className }: { children: ReactNode; className?: string }) {
  const blur = useAmountBlur();
  return <span className={cn(blur, className)}>{children}</span>;
}

export function RevealAmountsButton({ className }: { className?: string }) {
  const ctx = useContext(HiddenAmountsContext);
  if (!ctx) return null;
  const label = ctx.hidden ? "Afficher les montants" : "Masquer les montants";
  return (
    <button
      type="button"
      onClick={ctx.toggle}
      aria-label={label}
      title={label}
      aria-pressed={!ctx.hidden}
      className={cn("inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition", className)}
    >
      {ctx.hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
      {label}
    </button>
  );
}
