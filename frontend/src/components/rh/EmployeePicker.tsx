import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Person = { id: string; prenom: string; nom: string };

function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function EmployeePicker<T extends Person>({
  people,
  selectedId,
  onSelect,
  hint
}: {
  people: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hint?: (person: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const selected = people.find((person) => person.id === selectedId) || null;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const matches = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return people;
    return people.filter((person) => fold(`${person.prenom} ${person.nom}`).includes(needle));
  }, [people, query]);

  const choose = (id: string) => {
    onSelect(id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={box} className="relative max-w-xl">
      <label className="text-xs font-bold text-mid">
        Employé
        <span className={cn("mt-1 flex items-center gap-2 rounded-2xl border bg-white px-3 shadow-sm", open ? "border-orange-400 ring-4 ring-orange-100" : "border-line")}>
          <Search className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
          <input
            value={open ? query : selected ? `${selected.prenom} ${selected.nom}` : ""}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher par nom"
            className="h-11 w-full bg-transparent text-sm font-semibold text-dark outline-none placeholder:font-medium placeholder:text-muted"
          />
          <button type="button" aria-label="Afficher la liste" onClick={() => setOpen((current) => !current)} className="rounded-full p-1 text-mid hover:bg-orange-50 hover:text-orange-700">
            <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
          </button>
        </span>
      </label>
      {open && (
        <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,.12)]">
          {matches.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => choose(person.id)}
                className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left", person.id === selectedId ? "bg-orange-50" : "hover:bg-orange-50/70")}
              >
                <span className="truncate text-sm font-bold text-dark">{person.prenom} {person.nom}</span>
                {hint && <span className="shrink-0 text-[11px] font-semibold text-muted">{hint(person)}</span>}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-3 py-4 text-sm text-muted">Aucun employé pour « {query.trim()} ».</li>}
        </ul>
      )}
    </div>
  );
}
