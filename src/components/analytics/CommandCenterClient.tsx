"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryDistributionChart } from "./CategoryDistributionChart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Download,
  Filter,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  Zap,
  ClipboardList,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import { PriorityBadge } from "@/components/shared/PriorityBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrendData = { dateStr: string; date: string; count: number };
export type CategoryData = { name: string; count: number };
export type HistogramData = { bucket: string; current: number; avg: number };
export type OverdueComplaint = {
  id: string;
  title: string;
  hostel: { name: string };
  status: string;
  createdAt: Date;
  priority?: string | null;
};
export type StatusCounts = {
  PENDING: number;
  IN_PROGRESS: number;
  RESOLVED: number;
  CLOSED: number;
};

type KpiKey = "total" | "sla" | "resolution" | "semester";

interface CommandCenterClientProps {
  dailyTrendData: TrendData[];
  monthlyTrendData: TrendData[];
  categoryData: CategoryData[];
  histogramData: HistogramData[];
  overdueComplaints: OverdueComplaint[];
  statusCounts: StatusCounts;
  semesterName: string;
  semesterOptions: { name: string; value: string }[];
  totalComplaints: number;
  slaCompliance: number;
  avgResolutionHours: number;
  trends: {
    total: { value: string; isUp: boolean };
    sla: { value: string; isUp: boolean };
    resolution: { value: string; isUp: boolean };
  };
  initialRangeFilter?: string;
}

// ── Tooltip style ─────────────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#0f172a",
  fontSize: "12px",
  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
};

// ── KPI popup detail content ──────────────────────────────────────────────────

function KpiPopupContent({
  kpiKey,
  totalComplaints,
  slaCompliance,
  avgResolutionHours,
  semesterName,
  statusCounts,
  categoryData,
  histogramData,
  trends,
}: {
  kpiKey: KpiKey;
  totalComplaints: number;
  slaCompliance: number;
  avgResolutionHours: number;
  semesterName: string;
  statusCounts: StatusCounts;
  categoryData: CategoryData[];
  histogramData: HistogramData[];
  trends: CommandCenterClientProps["trends"];
}) {
  const statusRows = [
    { label: "Pending",     key: "PENDING" as const,     color: "#3b82f6" },
    { label: "In Progress", key: "IN_PROGRESS" as const, color: "#f59e0b" },
    { label: "Resolved",    key: "RESOLVED" as const,    color: "#10b981" },
    { label: "Closed",      key: "CLOSED" as const,      color: "#94a3b8" },
  ];
  const maxStatus = Math.max(...statusRows.map((r) => statusCounts[r.key]), 1);

  if (kpiKey === "total") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          Tracks every complaint submitted since the start of this period across all assigned residencies.
        </p>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Status Breakdown</p>
          <div className="space-y-2.5">
            {statusRows.map((row) => (
              <div key={row.key} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 w-20 shrink-0">{row.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(statusCounts[row.key] / maxStatus) * 100}%`, backgroundColor: row.color }} />
                </div>
                <span className="text-xs font-black w-6 text-right" style={{ color: row.color }}>{statusCounts[row.key]}</span>
              </div>
            ))}
          </div>
        </div>
        {categoryData.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Top Categories</p>
            <div className="space-y-2">
              {categoryData.slice(0, 4).map((cat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  <span className="flex-1 text-xs text-slate-700 truncate">{cat.name}</span>
                  <span className="text-xs font-bold text-slate-500">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700">
            Compared to previous period:{" "}
            <span className={cn("font-black", trends.total.isUp ? "text-amber-600" : "text-emerald-600")}>{trends.total.value}</span>
          </p>
        </div>
      </div>
    );
  }

  if (kpiKey === "sla") {
    const compliantCount = Math.round((slaCompliance / 100) * totalComplaints);
    const ringCls = slaCompliance >= 80 ? "border-emerald-500 text-emerald-600" : slaCompliance >= 60 ? "border-amber-500 text-amber-600" : "border-red-500 text-red-600";
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          SLA compliance measures complaints resolved within the <span className="font-bold text-slate-800">14-day target window</span>. Higher compliance means faster, more reliable service.
        </p>
        <div className={cn("flex flex-col items-center justify-center rounded-2xl border-4 py-6", ringCls)}>
          <p className="text-5xl font-black">{slaCompliance.toFixed(1)}%</p>
          <p className="text-sm font-semibold text-slate-500 mt-1">{compliantCount} / {totalComplaints} complaints on time</p>
        </div>
        <div>
          <div className="flex justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-500">Current Performance</span>
            <span className="text-slate-700">Target: ≥ 80%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(slaCompliance, 100)}%`, backgroundColor: slaCompliance >= 80 ? "#10b981" : slaCompliance >= 60 ? "#f59e0b" : "#ef4444" }} />
          </div>
          <div className="relative mt-1 h-4">
            <div className="absolute text-[10px] font-bold text-slate-400" style={{ left: "80%" }}>80%</div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-1">
          <p className="text-xs font-bold text-slate-700">How it&apos;s calculated</p>
          <p className="text-xs text-slate-500">(Complaints resolved ≤ 14 days) ÷ Total complaints × 100%</p>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700">
            Trend vs previous period: <span className={cn("font-black", trends.sla.isUp ? "text-emerald-600" : "text-red-600")}>{trends.sla.value}</span>
          </p>
        </div>
      </div>
    );
  }

  if (kpiKey === "resolution") {
    const maxBucket = Math.max(...histogramData.map((d) => d.current), 1);
    const HIST_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f97316", "#ef4444"];
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          Average resolution time from submission to resolution. Target is <span className="font-bold text-slate-800">under 72 hours</span> for routine issues.
        </p>
        <div className={cn("text-center rounded-2xl border-4 py-6", avgResolutionHours <= 72 ? "border-emerald-400 text-emerald-600" : avgResolutionHours <= 168 ? "border-amber-400 text-amber-600" : "border-red-400 text-red-600")}>
          <p className="text-5xl font-black">{avgResolutionHours.toFixed(1)}<span className="text-2xl font-bold ml-1">h</span></p>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            {avgResolutionHours <= 72 ? "Within target ✓" : avgResolutionHours <= 168 ? "Above target — review needed" : "Critical — action required"}
          </p>
        </div>
        {histogramData.some((d) => d.current > 0) && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Resolution Time Distribution</p>
            <div className="space-y-2">
              {histogramData.map((d, i) => (
                <div key={d.bucket} className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-slate-500 w-16 shrink-0">{d.bucket}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.current / maxBucket) * 100}%`, backgroundColor: HIST_COLORS[i] }} />
                  </div>
                  <span className="text-xs font-black w-5 text-right text-slate-600">{d.current}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700">
            Trend vs previous period: <span className={cn("font-black", trends.resolution.isUp ? "text-emerald-600" : "text-red-600")}>{trends.resolution.value}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 leading-relaxed">
        The academic semester defines the active complaint tracking window. Metrics are scoped to complaints submitted within this period.
      </p>
      <div className="rounded-2xl bg-blue-600 text-white px-6 py-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-2">Active Period</p>
        <p className="text-3xl font-black">{semesterName}</p>
        <p className="text-sm text-blue-200 mt-2">Complaint tracking is active</p>
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-2">
        <p className="text-xs font-bold text-slate-700">What this means</p>
        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
          <li>All complaint metrics are scoped to this semester</li>
          <li>SLA compliance is calculated within this window</li>
          <li>Historical comparison uses the equivalent prior period</li>
        </ul>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CommandCenterClient({
  dailyTrendData,
  monthlyTrendData,
  categoryData,
  histogramData,
  overdueComplaints,
  statusCounts,
  semesterName,
  semesterOptions,
  totalComplaints,
  slaCompliance,
  avgResolutionHours,
  trends,
  initialRangeFilter = "30D",
}: CommandCenterClientProps) {
  const router = useRouter();

  // Determine initial select value (custom → show "CUSTOM" placeholder)
  const initSelectVal = initialRangeFilter.startsWith("CUSTOM:") ? "CUSTOM" : initialRangeFilter;
  const initCustomFrom = initialRangeFilter.startsWith("CUSTOM:")
    ? initialRangeFilter.slice(7).split(":")[0]
    : new Date(Date.now() - 29 * 86400000).toISOString().split("T")[0];
  const initCustomTo = initialRangeFilter.startsWith("CUSTOM:")
    ? initialRangeFilter.slice(7).split(":")[1]
    : new Date().toISOString().split("T")[0];

  const [selectVal, setSelectVal] = useState(initSelectVal);
  const [showCustom, setShowCustom] = useState(initialRangeFilter.startsWith("CUSTOM:"));
  const [customFrom, setCustomFrom] = useState(initCustomFrom);
  const [customTo, setCustomTo] = useState(initCustomTo);
  const [chartView, setChartView] = useState<"daily" | "monthly">(
    dailyTrendData.length > 0 ? "daily" : "monthly"
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);

  const applyFilter = (range: string) => {
    router.push(`/warden/analytics?range=${encodeURIComponent(range)}`);
  };

  const handleSelectChange = (val: string) => {
    setSelectVal(val);
    if (val === "CUSTOM") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      applyFilter(val);
    }
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    applyFilter(`CUSTOM:${customFrom}:${customTo}`);
  };

  const slaAccent = slaCompliance >= 80 ? "border-t-emerald-500" : slaCompliance >= 60 ? "border-t-amber-500" : "border-t-red-500";
  const slaValueColor = slaCompliance >= 80 ? "text-emerald-600" : slaCompliance >= 60 ? "text-amber-600" : "text-red-600";

  const kpis: {
    key: KpiKey;
    label: string;
    description: string;
    value: string | number;
    trend?: { value: string; isUp: boolean };
    icon: React.ElementType;
    accent: string;
    valueColor: string;
  }[] = [
    { key: "total",      label: "Total Semester Tickets", description: "All complaints submitted since period start.", value: totalComplaints,                     trend: trends.total,      icon: ClipboardList, accent: "border-t-slate-400",  valueColor: "text-slate-900" },
    { key: "sla",        label: "SLA Compliance",         description: "% of complaints resolved within 14-day target.", value: `${slaCompliance.toFixed(1)}%`,  trend: trends.sla,        icon: CheckCircle2,  accent: slaAccent,            valueColor: slaValueColor },
    { key: "resolution", label: "Avg Resolution Time",    description: "Mean time from submission to resolution. Target: < 72h.", value: `${avgResolutionHours.toFixed(1)}h`, trend: trends.resolution, icon: Clock,         accent: "border-t-blue-500",  valueColor: "text-blue-700" },
    { key: "semester",   label: "Semester Context",       description: "Active academic period for complaint tracking.", value: semesterName,                    icon: Calendar,                                accent: "border-t-indigo-400", valueColor: "text-indigo-900" },
  ];

  const navyColor = "#1e3a8a";

  // ── PDF Export (programmatic — no html2canvas) ────────────────────────────
  const generatePDF = () => {
    setIsExporting(true);
    setExportMsg(null);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const W = 210;
      const margin = 15;
      let y = 0;

      // Header banner
      pdf.setFillColor(30, 58, 138);
      pdf.rect(0, 0, W, 42, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("UNITEN Management Report", margin, 18);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${semesterName}  ·  Generated ${new Date().toLocaleDateString("en-MY")}`, margin, 30);
      pdf.text("ORCS — Online Residential Complaint System", margin, 38);
      y = 52;

      // KPI row (3 boxes)
      const kpiBoxW = (W - margin * 2 - 8) / 3;
      const kpiData = [
        { label: "Total Complaints", value: String(totalComplaints), color: [30, 58, 138] as [number, number, number] },
        { label: "SLA Compliance", value: `${slaCompliance.toFixed(1)}%`, color: slaCompliance >= 80 ? [16, 185, 129] as [number, number, number] : slaCompliance >= 60 ? [245, 158, 11] as [number, number, number] : [239, 68, 68] as [number, number, number] },
        { label: "Avg Resolution", value: `${avgResolutionHours.toFixed(1)}h`, color: [37, 99, 235] as [number, number, number] },
      ];
      kpiData.forEach((k, i) => {
        const x = margin + i * (kpiBoxW + 4);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, y, kpiBoxW, 28, 3, 3, "F");
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(x, y, kpiBoxW, 28, 3, 3, "S");
        pdf.setTextColor(...k.color);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text(k.value, x + kpiBoxW / 2, y + 14, { align: "center" });
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(k.label.toUpperCase(), x + kpiBoxW / 2, y + 22, { align: "center" });
      });
      y += 38;

      // Status breakdown
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Status Breakdown", margin, y);
      y += 8;
      const statusData = [
        { label: "Pending",     count: statusCounts.PENDING,     color: [59, 130, 246] as [number, number, number] },
        { label: "In Progress", count: statusCounts.IN_PROGRESS, color: [245, 158, 11] as [number, number, number] },
        { label: "Resolved",    count: statusCounts.RESOLVED,    color: [16, 185, 129] as [number, number, number] },
        { label: "Closed",      count: statusCounts.CLOSED,      color: [148, 163, 184] as [number, number, number] },
      ];
      const maxCount = Math.max(...statusData.map((s) => s.count), 1);
      const barW = W - margin * 2 - 40;
      statusData.forEach((s) => {
        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(s.label, margin, y + 4);
        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(margin + 30, y, barW, 6, 2, 2, "F");
        pdf.setFillColor(...s.color);
        const filledW = Math.max((s.count / maxCount) * barW, s.count > 0 ? 2 : 0);
        if (filledW > 0) pdf.roundedRect(margin + 30, y, filledW, 6, 2, 2, "F");
        pdf.setTextColor(...s.color);
        pdf.setFont("helvetica", "bold");
        pdf.text(String(s.count), margin + 30 + barW + 4, y + 5);
        y += 10;
      });
      y += 6;

      // Category breakdown
      if (categoryData.length > 0) {
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Complaint Categories", margin, y);
        y += 8;
        const maxCat = Math.max(...categoryData.map((c) => c.count), 1);
        categoryData.slice(0, 8).forEach((cat, i) => {
          const colors: [number, number, number][] = [
            [30, 58, 138], [15, 118, 110], [29, 78, 216], [13, 148, 136],
            [59, 130, 246], [20, 184, 166], [100, 116, 139], [239, 68, 68],
          ];
          const c = colors[i % colors.length];
          pdf.setTextColor(71, 85, 105);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.text(cat.name, margin, y + 4);
          pdf.setFillColor(241, 245, 249);
          pdf.roundedRect(margin + 38, y, barW - 8, 6, 2, 2, "F");
          pdf.setFillColor(...c);
          const fw = Math.max((cat.count / maxCat) * (barW - 8), cat.count > 0 ? 2 : 0);
          if (fw > 0) pdf.roundedRect(margin + 38, y, fw, 6, 2, 2, "F");
          pdf.setTextColor(71, 85, 105);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${cat.count} (${totalComplaints ? Math.round((cat.count / totalComplaints) * 100) : 0}%)`, margin + 38 + barW - 8 + 4, y + 5);
          y += 10;
        });
        y += 4;
      }

      // Trend note
      pdf.setFillColor(239, 246, 255);
      pdf.roundedRect(margin, y, W - margin * 2, 20, 3, 3, "F");
      pdf.setTextColor(30, 58, 138);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Period Comparison vs Previous Period", margin + 4, y + 7);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(
        `Volume: ${trends.total.value}  ·  SLA: ${trends.sla.value}  ·  Resolution: ${trends.resolution.value}`,
        margin + 4, y + 14
      );
      y += 26;

      // Footer
      pdf.setFillColor(30, 58, 138);
      pdf.rect(0, 287, W, 10, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text("© 2026 UNITEN Residential Services  ·  ORCS Management Report  ·  Confidential", W / 2, 293, { align: "center" });

      pdf.save(`UNITEN_Report_${new Date().toISOString().split("T")[0]}.pdf`);
      setExportMsg("✓ PDF exported successfully.");
    } catch {
      setExportMsg("✕ Export failed. Please try again.");
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportMsg(null), 4000);
    }
  };

  const activeKpiConfig = kpis.find((k) => k.key === activeKpi) ?? null;

  return (
    <div className="space-y-4 pb-8">
      {/* ── Filter bar ────────────────────────────────────────────── */}
      <div className="surface-card px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold text-slate-700 text-xs">Filters</span>
            </div>
            <select
              value={selectVal}
              onChange={(e) => handleSelectChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <optgroup label="Semesters">
                {semesterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.name}</option>
                ))}
              </optgroup>
              <optgroup label="Custom">
                <option value="CUSTOM">Custom Period…</option>
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {exportMsg && (
              <span className={cn("text-xs font-semibold", exportMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600")}>
                {exportMsg}
              </span>
            )}
            <button
              onClick={generatePDF}
              disabled={isExporting}
              className="btn-primary px-4 py-2 text-sm gap-2"
            >
              {isExporting ? <Zap className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExporting ? "Generating…" : "Export PDF"}
            </button>
          </div>
        </div>

        {/* Custom date picker row */}
        {showCustom && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">From</label>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">To</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              onClick={applyCustom}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-1.5 text-sm font-bold text-white transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            onClick={() => setActiveKpi(kpi.key)}
            className={cn(
              "surface-card border-t-4 px-5 py-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group",
              kpi.accent
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{kpi.label}</p>
              <kpi.icon className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className={cn("text-2xl font-black", kpi.valueColor)}>{kpi.value}</p>
              {kpi.trend && (
                <span className={cn("flex items-center gap-0.5 text-[10px] font-bold", kpi.trend.isUp ? "text-emerald-600" : "text-rose-600")}>
                  {kpi.trend.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {kpi.trend.value}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">{kpi.description}</p>
            <p className="text-[10px] text-blue-500 font-semibold mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              Click for details →
            </p>
          </button>
        ))}
      </div>

      {/* ── Charts side by side ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Trend chart */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Complaint Volume Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Total:{" "}
                <span className="font-bold text-slate-700">
                  {(chartView === "daily" ? dailyTrendData : monthlyTrendData).reduce((s, d) => s + d.count, 0)}
                </span>
              </p>
            </div>
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              <button
                onClick={() => setChartView("daily")}
                disabled={dailyTrendData.length === 0}
                className={cn("rounded-lg px-3 py-1 text-xs font-bold transition-all disabled:opacity-40", chartView === "daily" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Daily
              </button>
              <button
                onClick={() => setChartView("monthly")}
                className={cn("rounded-lg px-3 py-1 text-xs font-bold transition-all", chartView === "monthly" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartView === "daily" ? dailyTrendData : monthlyTrendData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dateStr" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} dy={8} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: navyColor, fontWeight: 700 }} />
                <Line type="monotone" dataKey="count" name="Complaints" stroke={navyColor} strokeWidth={3} dot={{ r: 3, fill: "#fff", stroke: navyColor, strokeWidth: 2 }} activeDot={{ r: 5, fill: "#1d4ed8", stroke: "#fff", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category distribution */}
        <CategoryDistributionChart
          categoryData={categoryData}
          totalComplaints={totalComplaints}
          className="surface-card p-5"
        />
      </div>

      {/* ── SLA Overdue table ─────────────────────────────────────── */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">SLA Watch: Overdue Complaints</h3>
            <p className="text-xs text-rose-500 font-semibold mt-0.5">Critical focus required for resolution</p>
          </div>
          <AlertTriangle className="h-4 w-4 text-rose-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                {["Ref ID", "Complaint Title", "Block", "Priority", "Days Overdue", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {overdueComplaints.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 italic text-sm">
                    No overdue complaints detected in this period. Great job!
                  </td>
                </tr>
              ) : (
                overdueComplaints.map((c) => {
                  const aging = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000);
                  return (
                    <tr key={c.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-slate-400">#{c.id.slice(0, 6)}</td>
                      <td className="px-5 py-3 font-semibold text-slate-700 text-xs">{c.title}</td>
                      <td className="px-5 py-3"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{c.hostel.name}</span></td>
                      <td className="px-5 py-3"><PriorityBadge priority={c.priority} /></td>
                      <td className="px-5 py-3"><span className="text-xs font-extrabold text-rose-600">{aging}d</span></td>
                      <td className="px-5 py-3"><span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-rose-700 ring-1 ring-rose-200">{c.status}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── KPI Detail Dialog ─────────────────────────────────────── */}
      <Dialog open={Boolean(activeKpi)} onOpenChange={(open) => !open && setActiveKpi(null)}>
        <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
          {activeKpi && activeKpiConfig && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-xl p-2.5", activeKpi === "sla" ? "bg-emerald-100" : activeKpi === "resolution" ? "bg-blue-100" : activeKpi === "semester" ? "bg-indigo-100" : "bg-slate-100")}>
                    <activeKpiConfig.icon className={cn("h-5 w-5", activeKpiConfig.valueColor)} />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900">{activeKpiConfig.label}</DialogTitle>
                    <p className={cn("text-lg font-black mt-0.5", activeKpiConfig.valueColor)}>{activeKpiConfig.value}</p>
                  </div>
                </div>
              </DialogHeader>
              <div className="mt-2">
                <KpiPopupContent
                  kpiKey={activeKpi}
                  totalComplaints={totalComplaints}
                  slaCompliance={slaCompliance}
                  avgResolutionHours={avgResolutionHours}
                  semesterName={semesterName}
                  statusCounts={statusCounts}
                  categoryData={categoryData}
                  histogramData={histogramData}
                  trends={trends}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
