"use client";

import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import type { CategoryData } from "./CommandCenterClient";

// ─── UNITEN Brand Colour Palette ────────────────────────────────────────────

const PALETTE = [
  "#1e3a8a", // navy-800
  "#0f766e", // teal-700
  "#1d4ed8", // blue-700
  "#0d9488", // teal-600
  "#3b82f6", // blue-500
  "#14b8a6", // teal-500
  "#64748b", // slate-500 — Miscellaneous
];

const MAX_SLICES = 6;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProcessedSlice {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

interface CategoryDistributionChartProps {
  /** Raw category data from the server, sorted descending by count. */
  categoryData: CategoryData[];
  /** The total complaints for the selected period (used for % calculation). */
  totalComplaints: number;
  /**
   * Optional class override for the outer wrapper card.
   * Defaults to the standard Management Insights white card style.
   */
  className?: string;
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload as ProcessedSlice;
  return (
    <div
      className="pointer-events-none rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl"
      style={{ minWidth: 180 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-sm font-extrabold text-slate-800">{item.name}</span>
      </div>
      <p className="text-xs text-slate-500 font-semibold">
        {item.count} ticket{item.count !== 1 ? "s" : ""}
        <span className="ml-1 font-extrabold text-slate-700">
          ({item.percentage.toFixed(1)}%)
        </span>
      </p>
    </div>
  );
}

// ─── Custom Legend ───────────────────────────────────────────────────────────

function CustomLegend({ slices }: { slices: ProcessedSlice[] }) {
  return (
    <div className="flex flex-col justify-center gap-2 pl-4">
      {slices.map((slice) => (
        <div key={slice.name} className="flex items-center gap-2 min-w-0">
          <span
            className="flex-shrink-0 h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: slice.color }}
          />
          <span className="truncate text-[11px] font-semibold text-slate-600 leading-tight">
            {slice.name}
          </span>
          <span className="ml-auto flex-shrink-0 text-[11px] font-extrabold text-slate-400 tabular-nums">
            {slice.percentage.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CategoryDistributionChart({
  categoryData,
  totalComplaints,
  className,
}: CategoryDistributionChartProps) {
  // ── AI-driven grouping logic: merge smallest into Miscellaneous ─────────
  const slices: ProcessedSlice[] = useMemo(() => {
    if (!categoryData.length || totalComplaints === 0) return [];

    const total = totalComplaints;

    // Already sorted descending by count from the server.
    const top = categoryData.slice(0, MAX_SLICES);
    const rest = categoryData.slice(MAX_SLICES);

    const result: Array<Omit<ProcessedSlice, "color">> = top.map((c) => ({
      name: c.name,
      count: c.count,
      percentage: (c.count / total) * 100,
    }));

    if (rest.length > 0) {
      const miscCount = rest.reduce((s, c) => s + c.count, 0);
      result.push({
        name: "Miscellaneous",
        count: miscCount,
        percentage: (miscCount / total) * 100,
      });
    }

    // Assign colours — Miscellaneous always gets the last palette colour
    return result.map((item, i) => ({
      ...item,
      color:
        item.name === "Miscellaneous"
          ? PALETTE[PALETTE.length - 1]
          : PALETTE[i % (PALETTE.length - 1)],
    }));
  }, [categoryData, totalComplaints]);

  const isEmpty = slices.length === 0;

  return (
    <div
      className={
        className ??
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      }
    >
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-900 leading-tight">
          Complaint Volume by Category
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Distribution across {slices.length} categor{slices.length !== 1 ? "ies" : "y"} ·{" "}
          <span className="font-semibold text-slate-700">
            {totalComplaints} total
          </span>
        </p>
      </div>

      {isEmpty ? (
        <div className="flex h-56 items-center justify-center">
          <p className="text-sm text-slate-400 italic">No data available for this period.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2" style={{ height: 240 }}>
          {/* Doughnut — fixed width so legend has room */}
          <div style={{ flex: "0 0 200px", height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {slices.map((slice, i) => (
                    <radialGradient
                      key={`grad-${i}`}
                      id={`catGrad-${i}`}
                      cx="50%"
                      cy="50%"
                      r="50%"
                    >
                      <stop offset="0%" stopColor={slice.color} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={slice.color} stopOpacity={1} />
                    </radialGradient>
                  ))}
                </defs>

                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={90}
                  paddingAngle={3}
                  strokeWidth={0}
                  isAnimationActive
                  animationBegin={0}
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {slices.map((slice, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={`url(#catGrad-${i})`}
                      stroke="white"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>

                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ outline: "none" }}
                />

                {/* Centre label */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x="50%"
                    dy="-8"
                    fontSize={22}
                    fontWeight={800}
                    fill="#0f172a"
                  >
                    {totalComplaints}
                  </tspan>
                  <tspan
                    x="50%"
                    dy={18}
                    fontSize={10}
                    fontWeight={700}
                    fill="#94a3b8"
                    letterSpacing="0.08em"
                  >
                    TICKETS
                  </tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Right-side Legend */}
          <div className="flex-1 min-w-0">
            <CustomLegend slices={slices} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PDF-safe static version (no animation, used inside html2canvas) ─────────

export function CategoryDistributionChartStatic({
  categoryData,
  totalComplaints,
}: Pick<CategoryDistributionChartProps, "categoryData" | "totalComplaints">) {
  const slices: ProcessedSlice[] = useMemo(() => {
    if (!categoryData.length || totalComplaints === 0) return [];
    const total = totalComplaints;
    const top = categoryData.slice(0, MAX_SLICES);
    const rest = categoryData.slice(MAX_SLICES);
    const result: Array<Omit<ProcessedSlice, "color">> = top.map((c) => ({
      name: c.name,
      count: c.count,
      percentage: (c.count / total) * 100,
    }));
    if (rest.length > 0) {
      const miscCount = rest.reduce((s, c) => s + c.count, 0);
      result.push({
        name: "Miscellaneous",
        count: miscCount,
        percentage: (miscCount / total) * 100,
      });
    }
    return result.map((item, i) => ({
      ...item,
      color:
        item.name === "Miscellaneous"
          ? PALETTE[PALETTE.length - 1]
          : PALETTE[i % (PALETTE.length - 1)],
    }));
  }, [categoryData, totalComplaints]);

  return (
    <div>
      <h3 className="text-base font-black mb-4" style={{ color: "#0f172a" }}>
        Complaint Volume by Category
      </h3>
      <div className="space-y-3">
        {slices.map((slice, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span style={{ color: "#0f172a" }}>{slice.name}</span>
              <span style={{ color: "#64748b" }}>
                {slice.count} · {slice.percentage.toFixed(1)}%
              </span>
            </div>
            <div
              className="h-2.5 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: "#f1f5f9" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${slice.percentage}%`,
                  backgroundColor: slice.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
