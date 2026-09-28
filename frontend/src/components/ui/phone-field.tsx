import { DEFAULT_DIAL_ISO, DIAL_COUNTRIES, type DialCountry } from "@/lib/dial-codes";
import { cn } from "@/lib/utils";
import { ChevronDown, Phone, Search } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PhoneValue = { iso: string; number: string };

export const EMPTY_PHONE: PhoneValue = { iso: DEFAULT_DIAL_ISO, number: "" };

export function dialCountry(iso: string): DialCountry {
  return DIAL_COUNTRIES.find((c) => c.iso === iso) || DIAL_COUNTRIES[0];
}

const DIALS_LONGEST_FIRST = [...DIAL_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

// L'utilisateur tape lui-même l'indicatif (+33 6..., 0033 6...) : le pays
// est détecté et l'indicatif retiré du numéro. Pour un indicatif partagé
// (+1, +7), le pays déjà choisi est conservé s'il correspond.
function applyTypedDial(raw: string, current: PhoneValue): PhoneValue {
  const cleaned = raw.replace(/[^\d\s+]/g, "");
  const compact = cleaned.replace(/\s/g, "").replace(/^00/, "+");
  if (!compact.startsWith("+")) return { ...current, number: cleaned.slice(0, 18) };

  const currentCountry = dialCountry(current.iso);
  const match = compact.startsWith(currentCountry.dial)
    ? currentCountry
    : DIALS_LONGEST_FIRST.find((c) => compact.startsWith(c.dial));
  if (!match) return { ...current, number: compact.slice(0, 18) };
  return { iso: match.iso, number: compact.slice(match.dial.length).slice(0, 18) };
}

// Numéro international : indicatif + numéro national sans le 0 initial
// (ex. France 06 12 34 56 78 → +33612345678).
export function toInternational(value: PhoneValue) {
  const digits = value.number.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `${dialCountry(value.iso).dial}${digits}` : "";
}

// Numéro déjà enregistré (+21655480282, ou ancien format "55480282") →
// pays + numéro national, pour l'afficher dans le champ.
export function parsePhone(stored: string | null | undefined): PhoneValue {
  const raw = String(stored || "").trim();
  if (!raw) return EMPTY_PHONE;
  const compact = raw.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (!compact.startsWith("+")) return { iso: DEFAULT_DIAL_ISO, number: compact };
  const match = DIALS_LONGEST_FIRST.find((c) => compact.startsWith(c.dial));
  return match ? { iso: match.iso, number: compact.slice(match.dial.length) } : { iso: DEFAULT_DIAL_ISO, number: compact };
}

export function isValidInternational(phone: string) {
  return /^\+\d{8,15}$/.test(phone);
}

export function PhoneField({
  value,
  onChange,
  placeholder,
  variant = "auth",
  invalid = false
}: {
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  placeholder: string;
  variant?: "auth" | "form";
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = dialCountry(value.iso);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 290;
    setPosition({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    // La liste est positionnée par rapport au bouton : on la ferme si la
    // page défile, mais jamais quand on fait défiler la liste elle-même.
    function onScroll(event: Event) {
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const search = query.trim().toLowerCase();
  const filtered = search
    ? DIAL_COUNTRIES.filter(
        (c) => c.name.toLowerCase().includes(search) || c.dial.includes(search.replace(/^\+?/, "+")) || c.iso.toLowerCase() === search
      )
    : DIAL_COUNTRIES;

  const toggle = () => {
    setQuery("");
    setOpen((v) => !v);
  };
  const numberInput = (className?: string) => (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder={placeholder}
      value={value.number}
      onChange={(e) => onChange(applyTypedDial(e.target.value, value))}
      required
      className={className}
    />
  );

  return (
    <div
      className={
        variant === "auth"
          ? "as-input-field"
          : cn(
              "flex w-full items-center gap-2 rounded-xl border bg-white px-2 py-1.5 transition-all",
              invalid
                ? "border-red-400 focus-within:border-red-500 focus-within:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
                : "border-line focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgba(109,40,217,0.12)]"
            )
      }
    >
      {variant === "auth" ? (
        <>
          <span className="as-icon"><Phone size={18} /></span>
          <div className="as-phone-inner">
            <button ref={buttonRef} type="button" className="as-dial-btn" onClick={toggle} aria-label="Choisir l'indicatif du pays">
              <span className="as-dial-iso">{selected.iso}</span> {selected.dial}
              <ChevronDown size={14} />
            </button>
            {numberInput()}
          </div>
        </>
      ) : (
        <>
          <button
            ref={buttonRef}
            type="button"
            onClick={toggle}
            aria-label="Choisir l'indicatif du pays"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-slate-50 px-2 py-1 text-sm font-bold text-dark transition hover:border-brand hover:text-brand"
          >
            <span className="text-[10px] text-muted">{selected.iso}</span> {selected.dial}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {numberInput("min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-slate-400")}
        </>
      )}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: position.top, left: position.left, width: 290 }}
            className="fixed z-[20000] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
          >
            <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pays ou indicatif"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.map((c) => (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => {
                    onChange({ ...value, iso: c.iso });
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-violet-50",
                    c.iso === value.iso && "bg-violet-50 font-semibold text-violet-700"
                  )}
                >
                  <span className="w-7 shrink-0 text-[11px] font-bold text-slate-400">{c.iso}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 font-semibold text-slate-500">{c.dial}</span>
                </button>
              ))}
              {!filtered.length && <p className="px-3 py-4 text-center text-xs text-slate-400">Aucun pays trouvé.</p>}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
