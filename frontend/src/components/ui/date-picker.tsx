import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEKDAYS = ["lu", "ma", "me", "je", "ve", "sa", "di"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

type DatePickerFieldProps = {
  name: string;
  required?: boolean;
  invalid?: boolean;
  defaultValue?: string; // ISO yyyy-mm-dd
  className?: string;
  /** When true, renders the trigger as a bare, unstyled button so it can be
   * dropped inside an existing styled input wrapper (icon + pill container). */
  bare?: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-first weekday index (0 = Monday ... 6 = Sunday)
function mondayIndex(year: number, month: number, day: number) {
  const jsDay = new Date(year, month, day).getDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

type MenuBox = { top: number; left: number };

export function DatePickerField({ name, required, invalid, defaultValue, className, bare }: DatePickerFieldProps) {
  const today = new Date();
  const initial = defaultValue ? new Date(defaultValue) : null;

  const [selected, setSelected] = useState<Date | null>(initial && !Number.isNaN(initial.getTime()) ? initial : null);
  const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear() - 18);
  const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<MenuBox | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const minYear = today.getFullYear() - 100;
  const maxYear = today.getFullYear();

  function updateBox() {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setBox({ top: rect.bottom + 8, left: rect.left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updateBox();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      updateBox();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const isoValue = selected ? toISO(selected.getFullYear(), selected.getMonth(), selected.getDate()) : "";
  const displayValue = selected ? `${pad(selected.getDate())}/${pad(selected.getMonth() + 1)}/${selected.getFullYear()}` : "";

  const totalDays = daysInMonth(viewYear, viewMonth);
  const leadingBlanks = mondayIndex(viewYear, viewMonth, 1);
  const cells: Array<number | null> = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ];

  function pickDay(day: number) {
    const date = new Date(viewYear, viewMonth, day);
    if (date > today) return;
    setSelected(date);
    setOpen(false);
  }

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  }

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <input type="hidden" name={name} value={isoValue} required={required} />
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className={
          bare
            ? "flex h-full w-full items-center bg-transparent text-left text-sm outline-none"
            : cn(
                "flex w-full items-center gap-2 rounded-xl border bg-white/90 px-3 py-2.5 text-left text-sm outline-none transition-all",
                open ? "border-brand shadow-[0_0_0_4px_rgba(109,40,217,0.12)]" : invalid ? "border-red-400" : "border-line hover:border-brand/50",
                selected ? "text-dark" : "text-muted"
              )
        }
      >
        {!bare && <CalendarDays className="h-4 w-4 shrink-0 text-brand" />}
        <span className="flex-1">{displayValue || "jj/mm/aaaa"}</span>
      </button>

      {open && box && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: box.top, left: box.left, zIndex: 9999 }}
          className="w-[280px] overflow-hidden rounded-2xl border border-violet-100 bg-white p-3 shadow-[0_18px_40px_rgba(76,29,149,0.18)]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-brand-light hover:text-brand transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-1 items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="flex-1 rounded-lg border border-line bg-slate-50 px-1.5 py-1 text-xs font-semibold outline-none focus:border-brand"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="w-[80px] rounded-lg border border-line bg-slate-50 px-1.5 py-1 text-xs font-semibold outline-none focus:border-brand"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-brand-light hover:text-brand transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-muted">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <span key={`b${i}`} />;
              const date = new Date(viewYear, viewMonth, day);
              const isFuture = date > today;
              const isSelected = selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isFuture}
                  onClick={() => pickDay(day)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg text-xs transition",
                    isSelected
                      ? "bg-brand text-white font-bold shadow"
                      : isFuture
                        ? "text-line cursor-not-allowed"
                        : "text-dark hover:bg-brand-light hover:text-brand"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
