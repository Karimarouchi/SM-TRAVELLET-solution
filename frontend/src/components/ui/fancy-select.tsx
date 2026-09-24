import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FancyOption = { value: string; label: string };

type FancySelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Array<string | FancyOption>;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
};

function normalize(options: Array<string | FancyOption>): FancyOption[] {
  return options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );
}

type MenuBox = { top: number; left: number; width: number; maxHeight: number };

export function FancySelect({
  value,
  onChange,
  options,
  placeholder = "Choisir",
  className,
  invalid
}: FancySelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<MenuBox | null>(null);
  const items = normalize(options);
  const selected = items.find((item) => item.value === value);

  function updateBox() {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(320, Math.max(160, preferBelow ? spaceBelow : spaceAbove));
    setBox({
      top: preferBelow ? rect.bottom + 8 : rect.top - 8 - maxHeight,
      left: rect.left,
      width: rect.width,
      maxHeight
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updateBox();
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
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

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border bg-white/90 px-3 py-2.5 text-left text-sm outline-none transition-all",
          open
            ? "border-brand shadow-[0_0_0_4px_rgba(109,40,217,0.12)]"
            : invalid
              ? "border-red-400 shadow-[0_0_0_4px_rgba(239,68,68,0.1)]"
              : "border-line hover:border-brand/50",
          selected ? "text-dark" : "text-muted"
        )}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && box && (
            <motion.ul
              ref={listRef}
              id={`${id}-list`}
              role="listbox"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                top: box.top,
                left: box.left,
                width: box.width,
                maxHeight: box.maxHeight,
                zIndex: 9999
              }}
              className="overflow-auto rounded-2xl border border-violet-100 bg-white p-1.5 shadow-[0_18px_40px_rgba(76,29,149,0.18)]"
            >
              {items.map((item) => {
                const active = item.value === value;
                return (
                  <li key={item.value} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(item.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-brand text-white"
                          : "text-dark hover:bg-brand-light hover:text-brand"
                      )}
                    >
                      <span>{item.label}</span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
