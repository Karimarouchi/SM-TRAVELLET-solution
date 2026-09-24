import type { Programme, ProgrammeDetail } from "@/lib/auth";

export const BADGES = [
  { value: "Disponible", label: "✓ Disponible", color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/40" },
  { value: "Prochainement disponible", label: "⏰ Prochainement", color: "bg-amber-500/20 text-amber-800 border-amber-500/40" }
];

export const GRADIENTS = [
  { label: "🌌 Nuit Violette", value: "linear-gradient(135deg,#0f172a 0%,#4c1d95 52%,#1d4ed8 100%)" },
  { label: "🌿 Émeraude", value: "linear-gradient(135deg,#111827 0%,#0f766e 52%,#1d4ed8 100%)" },
  { label: "💜 Pourpre", value: "linear-gradient(135deg,#312e81 0%,#7c3aed 52%,#2563eb 100%)" },
  { label: "🌊 Océan", value: "linear-gradient(135deg,#082f49 0%,#0f766e 50%,#16a34a 100%)" },
  { label: "🔥 Ardoise", value: "linear-gradient(135deg,#0f172a 0%,#334155 50%,#7c2d12 100%)" },
  { label: "🚀 Cosmique", value: "linear-gradient(135deg,#1f2937 0%,#1d4ed8 52%,#7c3aed 100%)" },
  { label: "🌅 Chaud", value: "linear-gradient(135deg,#7f1d1d 0%,#b91c1c 48%,#f59e0b 100%)" },
  { label: "☁️ Ciel", value: "linear-gradient(135deg,#0c4a6e 0%,#0369a1 48%,#0ea5e9 100%)" },
  { label: "🌱 Nature", value: "linear-gradient(135deg,#14532d 0%,#15803d 48%,#84cc16 100%)" }
];

export const PRESET_IMAGES = [
  { label: "Italie", path: "IMAGE/bled/italie.jpg" },
  { label: "Allemagne", path: "IMAGE/bled/Allemagne.jpg" },
  { label: "Hongrie", path: "IMAGE/bled/Hongrie.webp" },
  { label: "Lituanie", path: "IMAGE/bled/Lithuania.webp" },
  { label: "Pologne", path: "IMAGE/bled/Poland.jpg" },
  { label: "Slovaquie", path: "IMAGE/bled/Slovakia.jpg" },
  { label: "Roumanie", path: "IMAGE/bled/Romania.jpg" },
  { label: "Malte", path: "IMAGE/bled/Malte.jpg" },
  { label: "Bulgarie", path: "IMAGE/bled/bulgarie.jpg" }
];

export const EMPTY_DETAIL: ProgrammeDetail = {
  name: "",
  desc: "",
  lang: "",
  fees: "",
  dates: "",
  status: "Inscription ouverte",
  scholarship: ""
};

export type FormData = Omit<Programme, "id" | "createdAt" | "updatedAt">;

export const DEFAULT_FORM: FormData = {
  title: "",
  country: "",
  countryId: null,
  degrees: "Licence / Master",
  description: "",
  imageUrl: "IMAGE/bled/italie.jpg",
  badge: "Disponible",
  statusLabel: "Disponible",
  gradientStyle: "linear-gradient(135deg,#0f172a 0%,#4c1d95 52%,#1d4ed8 100%)",
  isFeatured: false,
  displayOrder: 1,
  details: []
};
