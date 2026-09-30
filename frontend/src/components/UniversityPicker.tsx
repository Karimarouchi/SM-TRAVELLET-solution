import { cn } from "@/lib/utils";
import { useId } from "react";

export default function UniversityPicker({
  value,
  onChange,
  options,
  invalid,
  placeholder,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  invalid?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  return (
    <div>
      <input
        list={listId}
        maxLength={200}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Choisir ou taper le nom de l'université"}
        className={cn(
          "w-full rounded-xl border bg-white/90 px-3 py-2.5 text-sm outline-none",
          invalid ? "border-red-400" : "border-line focus:border-brand",
          className
        )}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value} label={option.label} />
        ))}
      </datalist>
      <p className="mt-1 text-[11px] text-muted">Vous pouvez choisir une université de la liste ou taper un autre nom si elle n’y figure pas.</p>
    </div>
  );
}
