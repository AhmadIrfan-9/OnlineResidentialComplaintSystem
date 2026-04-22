import {
  Clock,
  Wrench,
  CheckCircle2,
  Archive,
} from "lucide-react";

/**
 * Accessible, colorblind-safe status badge system.
 *
 * Palette rationale:
 *  PENDING     → Amber  (#B45309 text / #FEF3C7 bg) — warm, urgent, distinct from green
 *  IN_PROGRESS → Blue   (#1D4ED8 text / #DBEAFE bg) — active/in-motion
 *  RESOLVED    → Green  (#15803D text / #DCFCE7 bg) — success, positive completion
 *  CLOSED      → Slate  (#475569 text / #F1F5F9 bg) — neutral, archived
 *
 * All combos pass WCAG AA (4.5:1 contrast ratio minimum).
 */

type StatusValue = "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const CONFIG: Record<
  StatusValue,
  {
    label: string;
    Icon: React.FC<{ className?: string }>;
    /** Tailwind classes for the pill */
    pill: string;
    /** hex for the left-border accent on table rows */
    borderHex: string;
  }
> = {
  PENDING: {
    label: "Pending",
    Icon: Clock,
    pill: "bg-amber-50 text-amber-700 border border-amber-200 ring-1 ring-amber-100",
    borderHex: "#D97706", // amber-600
  },
  IN_PROGRESS: {
    label: "In Progress",
    Icon: Wrench,
    pill: "bg-blue-50 text-blue-700 border border-blue-200 ring-1 ring-blue-100",
    borderHex: "#1D4ED8", // blue-700
  },
  RESOLVED: {
    label: "Resolved",
    Icon: CheckCircle2,
    pill: "bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-100",
    borderHex: "#15803D", // emerald-700
  },
  CLOSED: {
    label: "Closed",
    Icon: Archive,
    pill: "bg-slate-100 text-slate-600 border border-slate-200 ring-1 ring-slate-100",
    borderHex: "#64748B", // slate-500
  },
};

interface StatusBadgeProps {
  status: StatusValue | string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const key = (status as StatusValue) in CONFIG ? (status as StatusValue) : "PENDING";
  const { label, Icon, pill } = CONFIG[key];

  const iconCls = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textCls = size === "sm" ? "text-[11px]" : "text-xs";
  const padCls  = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${pill} ${padCls} ${textCls}`}
      aria-label={`Status: ${label}`}
    >
      <Icon className={`${iconCls} flex-shrink-0`} />
      {label}
    </span>
  );
}

/** Returns the left-border hex color for a given status — use with inline style */
export function statusBorderColor(status: string): string {
  const key = (status as StatusValue) in CONFIG ? (status as StatusValue) : "PENDING";
  return CONFIG[key].borderHex;
}
