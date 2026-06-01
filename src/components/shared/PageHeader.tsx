"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Optional smaller uppercase tracker label (e.g. "Student Portal", "Management Portal") */
  portalType?: string;
  /** Primary title text */
  title: string;
  /** Optional description paragraph or secondary content under the title */
  subtitle?: React.ReactNode;
  /** Optional right-aligned utility slot (e.g. Action Button, SLA Legends) */
  action?: React.ReactNode;
  /** Optional custom container padding/styling overrides */
  className?: string;
}

/**
 * Reusable premium page header banner component.
 * Uses a gorgeous gradient background themed in HSL and handles mobile-responsiveness beautifully.
 */
export function PageHeader({
  portalType,
  title,
  subtitle,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("surface-hero px-6 py-5 shadow-sm transition-all duration-200", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Main text content */}
        <div className="min-w-0 flex-1">
          {portalType && (
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">
              {portalType}
            </p>
          )}
          <h1 className="text-xl font-black text-white leading-tight md:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <div className="text-sm text-blue-200 mt-1 font-medium leading-relaxed truncate-lines">
              {subtitle}
            </div>
          )}
        </div>

        {/* Right: Optional action button / visual elements container */}
        {action && (
          <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-auto">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
