import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// Squelettes de chargement : la forme de la page, avant ses données. L'apparition est
// retardée en CSS, donc une réponse rapide n'affiche rien et l'écran ne clignote pas.

export function Skeleton({ className, light }: { className?: string; light?: boolean }) {
  return <span aria-hidden className={cn("skeleton block rounded-lg", light && "skeleton-light", className)} />;
}

export function SkeletonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="Chargement" className={cn("skeleton-group", className)}>
      {children}
    </div>
  );
}

export function SkeletonLines({ lines = 3, className, light }: { lines?: number; className?: string; light?: boolean }) {
  return (
    <SkeletonGroup className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} light={light} className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </SkeletonGroup>
  );
}

export function SkeletonStats({ count = 4, className, light }: { count?: number; className?: string; light?: boolean }) {
  return (
    <SkeletonGroup className={cn("grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn("min-w-0 rounded-[20px] border p-4 sm:p-5", light ? "border-white/20 bg-white/10" : "border-line bg-white")}>
          <Skeleton light={light} className="h-9 w-9 rounded-full" />
          <Skeleton light={light} className="mt-3 h-7 w-16" />
          <Skeleton light={light} className="mt-2 h-3 w-3/4" />
          <Skeleton light={light} className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

// flat : sans carte autour, pour une liste déjà dans un cadre (cloche, messagerie).
export function SkeletonRows({ rows = 5, className, flat, avatar = true }: { rows?: number; className?: string; flat?: boolean; avatar?: boolean }) {
  return (
    <SkeletonGroup className={cn(flat ? "space-y-3" : "divide-y divide-line/60 rounded-[20px] border border-line bg-white px-4", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn("flex items-center gap-3", !flat && "py-3.5")}>
          {avatar && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-3.5", index % 2 ? "w-2/5" : "w-1/2")} />
            <Skeleton className={cn("h-3", index % 2 ? "w-3/5" : "w-3/4")} />
          </div>
          {!flat && <Skeleton className="hidden h-6 w-20 shrink-0 rounded-full sm:block" />}
        </div>
      ))}
    </SkeletonGroup>
  );
}

export function SkeletonCards({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-w-0 rounded-[20px] border border-line bg-white p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

export function SkeletonForm({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("rounded-[24px] border border-line bg-white p-6", className)}>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-2 h-3 w-3/4" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

export function SkeletonPage({ className, stats = 4, rows = 5 }: { className?: string; stats?: number; rows?: number }) {
  return (
    <div className={cn("space-y-4", className)}>
      <SkeletonStats count={stats} />
      <SkeletonRows rows={rows} />
    </div>
  );
}

export function SkeletonThread({ className }: { className?: string }) {
  const bubbles = ["w-2/5", "ml-auto w-1/3", "w-1/2", "ml-auto w-2/5", "w-1/3"];
  return (
    <SkeletonGroup className={cn("space-y-3", className)}>
      {bubbles.map((width, index) => (
        <Skeleton key={index} className={cn("h-11 rounded-2xl", width)} />
      ))}
    </SkeletonGroup>
  );
}
