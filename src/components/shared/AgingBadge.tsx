"use client";

import { getAgingInfo } from "@/lib/aging";
import { AlertCircle, Clock, ShieldCheck } from "lucide-react";

/**
 * src/components/shared/AgingBadge.tsx
 * 
 * A visual indicator for complaint aging (Green/Yellow/Red) 
 * as defined in the UNITEN Residential Handbook Operational Logic.
 */

interface AgingBadgeProps {
  createdAt: Date | string;
  showLabel?: boolean;
}

export function AgingBadge({ createdAt, showLabel = true }: AgingBadgeProps) {
  const aging = getAgingInfo(createdAt);

  const icons = {
    GREEN: ShieldCheck,
    YELLOW: Clock,
    RED: AlertCircle,
  };

  const Icon = icons[aging.category];

  // Map categories to semantic Tailwind colors
  const styles = {
    GREEN: "bg-emerald-50 text-emerald-700 border-emerald-200",
    YELLOW: "bg-amber-50 text-amber-700 border-amber-200",
    RED: "bg-rose-50 text-rose-700 border-rose-200 animate-pulse shadow-[0_0_8px_rgba(225,29,72,0.2)]",
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-tight ${styles[aging.category]}`}
      title={`${aging.label}: ${aging.days} days aging. Recommended: ${aging.action}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{aging.days}D</span>
      {showLabel && <span className="ml-0.5 opacity-80">{aging.label}</span>}
    </div>
  );
}
