import { cn } from "@/lib/utils";
import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Briques d'animation partagées par les tableaux de bord admin.

// Compteur qui monte jusqu'à sa valeur quand il apparaît à l'écran.
export function CountUp({ value, decimals = 0, suffix = "", className }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: 1.1, ease: "easeOut", onUpdate: (v) => setShown(v) });
    return () => controls.stop();
  }, [inView, value]);

  return <span ref={ref} className={className}>{shown.toFixed(decimals)}{suffix}</span>;
}

// Anneau de progression dont le trait se dessine à l'apparition.
export function Ring({
  percent,
  color,
  size = 92,
  stroke = 9,
  track = "text-slate-100",
  children
}: {
  percent: number | null;
  color: string;
  size?: number;
  stroke?: number;
  track?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className={track} />
        <motion.circle
          key={`${value}-${color}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference * (1 - value / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center")}>{children}</div>
    </div>
  );
}
