"use client";

import { useSession } from "next-auth/react";

interface KpiCard {
  label: string;
  value: string | number;
  sub?: string;
}

interface WelcomeBannerProps {
  /** Optional KPI cards to display in the metric row. Pass an empty array to hide the row. */
  kpis?: KpiCard[];
}

/**
 * Full-width welcome section rendered directly below the TopNavBar.
 * Shows "Hi, [NAME] 👋" and an optional row of KPI metric cards.
 */
export function WelcomeBanner({ kpis }: WelcomeBannerProps) {
  const { data: session } = useSession();
  const name = session?.user?.name
    ? session.user.name.split(" ")[0]   // Show first name only
    : session?.user?.email?.split("@")[0] ?? "there";

  return (
    <div className="bg-slate-50 px-4 py-5 md:px-6 md:py-6 border-b border-slate-200">
      <div className="mx-auto max-w-screen-2xl">
        {/* Greeting */}
        <div className="mb-1">
          <h2 className="text-xl font-extrabold text-slate-900 md:text-2xl">
            Hi, {name}! 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome to the UNITEN Residential Portal.
          </p>
        </div>

        {/* KPI metric row */}
        {kpis && kpis.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((card, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {card.label}
                </p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{card.value}</p>
                {card.sub && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
