"use client";

import React from "react";
import { AlertTriangle, Clock, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority?: string | null;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  // Gracefully handle loading / unpopulated state
  if (!priority) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-400 animate-pulse border border-slate-200/50",
          className
        )}
      >
        <Clock className="h-3 w-3 animate-spin" />
        Triage Pending...
      </span>
    );
  }

  const p = priority.toUpperCase();

  switch (p) {
    case "CRITICAL":
    case "EMERGENCY":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 animate-pulse border border-red-200 shadow-sm",
            className
          )}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
          Critical
        </span>
      );

    case "HIGH":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 border border-orange-200/80 shadow-sm",
            className
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
          High
        </span>
      );

    case "MEDIUM":
    case "URGENT":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-amber-50/50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200/80 shadow-sm",
            className
          )}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          Medium
        </span>
      );

    case "LOW":
    case "ROUTINE":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 border border-slate-200/60",
            className
          )}
        >
          Low
        </span>
      );
  }
}
