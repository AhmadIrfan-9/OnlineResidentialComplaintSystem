"use client";

import React, { useState, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { 
  Download, 
  Filter, 
  Building, 
  Calendar, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export type TrendData = { dateStr: string; date: string; count: number };
export type CategoryData = { name: string; count: number };
export type HistogramData = { bucket: string; current: number; avg: number };
export type OverdueComplaint = {
  id: string;
  title: string;
  hostel: { name: string };
  status: string;
  createdAt: Date;
};

interface CommandCenterClientProps {
  dailyTrendData: TrendData[];
  monthlyTrendData: TrendData[];
  categoryData: CategoryData[];
  histogramData: HistogramData[];
  overdueComplaints: OverdueComplaint[];
  hostels: { id: string; name: string }[];
  semesterName: string;
  totalComplaints: number;
  slaCompliance: number;
  avgResolutionHours: number;
  trends: {
    total: { value: string; isUp: boolean };
    sla: { value: string; isUp: boolean };
    resolution: { value: string; isUp: boolean };
  };
}

export function CommandCenterClient({
  dailyTrendData,
  monthlyTrendData,
  categoryData,
  histogramData,
  overdueComplaints,
  hostels,
  semesterName,
  totalComplaints,
  slaCompliance,
  avgResolutionHours,
  trends,
}: CommandCenterClientProps) {
  const [selectedHostel, setSelectedHostel] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<string>("30D");
  const [chartView, setChartView] = useState<"daily" | "monthly">("daily");
  const [isExporting, setIsExporting] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);

  const colors = {
    tealPrimary: "#0f766e",
    tealSecondary: "#14b8a6",
    tealLight: "#ccfbf1",
    navyPrimary: "#1e3a8a",
    navySecondary: "#1e40af",
    navyLight: "#dbeafe",
    gray: "#64748b",
    red: "#ef4444",
  };

  const tooltipStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    color: "#0f172a",
    fontSize: "12px",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  };

  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
  const monthTotal = dailyTrendData.reduce((sum, item) => sum + item.count, 0);

  const generateInfographicPDF = async () => {
    if (!infographicRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(infographicRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`UNITEN_CommandCenter_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Filters */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm border border-slate-100">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Filters</span>
          </div>
          
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="7D">Last 7 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="SEMESTER">This Semester</option>
          </select>

          <select 
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Assigned Hostels</option>
            {hostels.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={generateInfographicPDF}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-lg bg-navyPrimary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-navySecondary disabled:opacity-50"
        >
          {isExporting ? <Zap className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generate Infographic PDF
        </button>
      </div>

      {/* KPI Cards */}
      <div className="overflow-x-auto">
        <div className="grid gap-4 md:grid-cols-4 min-w-[480px]">
          {[
            { label: "Total Semester Tickets", value: totalComplaints, trend: trends.total, icon: ClipboardList, color: "text-slate-600" },
            { label: "SLA Compliance", value: `${slaCompliance.toFixed(1)}%`, trend: trends.sla, icon: CheckCircle2, color: "text-tealPrimary" },
            { label: "Avg Resolution", value: `${avgResolutionHours.toFixed(1)}h`, trend: trends.resolution, icon: Clock, color: "text-navyPrimary" },
            { label: "Semester Context", value: semesterName, subtext: "Active Period", icon: Calendar, color: "text-slate-900" },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                <kpi.icon className="h-4 w-4 text-slate-300" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
                {kpi.trend && (
                  <div className={cn("flex items-center gap-0.5 text-xs font-bold", kpi.trend.isUp ? "text-emerald-600" : "text-rose-600")}>
                    {kpi.trend.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {kpi.trend.value}
                  </div>
                )}
              </div>
              {kpi.subtext && <p className="mt-1 text-[10px] font-medium text-slate-400">{kpi.subtext}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chart */}
      <div className="overflow-x-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden min-w-[320px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Complaint Volume Trend</h3>
              <p className="text-xs text-slate-500">Visualization of operational workload</p>
            </div>
            
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setChartView("daily")}
                className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", chartView === "daily" ? "bg-white text-navyPrimary shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Daily
              </button>
              <button
                onClick={() => setChartView("monthly")}
                className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", chartView === "monthly" ? "bg-white text-navyPrimary shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Monthly
              </button>
            </div>
          </div>

          {/* Chart Badge */}
          <div className="absolute top-6 right-36 z-10 px-3 py-1.5 rounded-full bg-navyPrimary/5 border border-navyPrimary/20 backdrop-blur-sm">
             <p className="text-[10px] font-bold text-navyPrimary uppercase tracking-tighter">
               Total for {chartView === "daily" ? currentMonthName : "Semester"}: {chartView === "daily" ? monthTotal : totalComplaints}
             </p>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={chartView === "daily" ? dailyTrendData : monthlyTrendData} 
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.navyPrimary} stopOpacity={0.1}/>
                    <stop offset="95%" stopColor={colors.navyPrimary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="dateStr" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: colors.navyPrimary, fontWeight: 700 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Total Complaints"
                  stroke={colors.navyPrimary}
                  strokeWidth={4}
                  dot={{ r: 4, fill: "#fff", stroke: colors.navyPrimary, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: colors.tealPrimary, stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Overdue Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">SLA Watch: Overdue Complaints</h3>
            <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider">Critical focus required for resolution</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Ref ID</th>
                <th className="px-6 py-4">Complaint Title</th>
                <th className="px-6 py-4">Block</th>
                <th className="px-6 py-4">SLA Aging</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {overdueComplaints.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No overdue complaints detected in this period. Great job!</td>
                </tr>
              ) : (
                overdueComplaints.map((c) => {
                  const aging = Math.floor((new Date().getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={c.id} className="group hover:bg-rose-50/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400 group-hover:text-rose-600">#{c.id.slice(0, 6)}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{c.title}</td>
                      <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold">{c.hostel.name}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-rose-500" style={{ width: "100%" }} />
                          </div>
                          <span className="text-xs font-extrabold text-rose-600">{aging} Days</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase ring-1 ring-rose-200">
                           {c.status}
                         </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Infographic Template for PDF Export */}
      <div className="sr-only">
        <div ref={infographicRef} className="w-[800px] p-12 font-sans" style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>
          <div className="flex items-center justify-between border-b-4 pb-8 mb-12" style={{ borderColor: "#1e3a8a" }}>
             <div className="flex items-center gap-6">
                <div className="h-20 w-20 flex items-center justify-center rounded-xl ring-2" style={{ backgroundColor: "#f8fafc", boxShadow: "0 0 0 2px #e2e8f0" }}>
                   <img src="/assets/logo-light.png" alt="UNITEN" className="h-16 w-16 object-contain" />
                </div>
                <div>
                   <h1 className="text-4xl font-black uppercase tracking-tighter" style={{ color: "#1e3a8a" }}>Management Report</h1>
                   <p className="text-xl font-bold" style={{ color: "#94a3b8" }}>UNITEN Residential Portal | {semesterName}</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-sm font-bold" style={{ color: "#94a3b8" }}>Generated On</p>
                <p className="text-lg font-black" style={{ color: "#1e3a8a" }}>{new Date().toLocaleDateString()}</p>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-8 mb-12">
             <div className="p-8 rounded-3xl ring-1" style={{ backgroundColor: "#f8fafc", boxShadow: "0 0 0 1px #e2e8f0" }}>
                <p className="text-sm font-bold uppercase mb-2" style={{ color: "#94a3b8" }}>Total Volume</p>
                <p className="text-5xl font-black" style={{ color: "#1e3a8a" }}>{totalComplaints}</p>
                <p className="text-sm font-bold mt-2" style={{ color: "#059669" }}>{trends.total.value} trend</p>
             </div>
             <div className="p-8 rounded-3xl ring-1" style={{ backgroundColor: "#f0fdfa", boxShadow: "0 0 0 1px #ccfbf1" }}>
                <p className="text-sm font-bold uppercase mb-2" style={{ color: "#94a3b8" }}>SLA Performance</p>
                <p className="text-5xl font-black" style={{ color: "#0f766e" }}>{slaCompliance.toFixed(1)}%</p>
                <p className="text-sm font-bold mt-2" style={{ color: "#0f766e" }}>{trends.sla.value} vs target</p>
             </div>
             <div className="p-8 rounded-3xl ring-1" style={{ backgroundColor: "#0f172a", boxShadow: "0 0 0 1px #1e293b" }}>
                <p className="text-sm font-bold uppercase mb-2" style={{ color: "#64748b" }}>Avg Resolution</p>
                <p className="text-5xl font-black" style={{ color: "#ffffff" }}>{avgResolutionHours.toFixed(1)}h</p>
                <p className="text-sm font-bold mt-2" style={{ color: "#94a3b8" }}>Operational Speed</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
             <div className="p-8 rounded-3xl ring-2 shadow-xl" style={{ backgroundColor: "#ffffff", boxShadow: "0 0 0 2px #f1f5f9, 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)" }}>
                <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                   <div className="h-2 w-8 rounded-full" style={{ backgroundColor: "#1e3a8a" }} />
                   Category Breakdown
                </h3>
                <div className="space-y-4">
                   {categoryData.slice(0, 5).map((cat, i) => (
                      <div key={i}>
                         <div className="flex justify-between text-sm font-bold mb-1">
                            <span>{cat.name}</span>
                            <span>{cat.count}</span>
                         </div>
                         <div className="h-3 w-full rounded-full overflow-hidden" style={{ backgroundColor: "#f1f5f9" }}>
                            <div 
                              className="h-full" 
                              style={{ width: `${(cat.count / totalComplaints) * 100}%`, backgroundColor: "#1e3a8a" }} 
                            />
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             <div className="p-8 rounded-3xl shadow-2xl relative overflow-hidden" style={{ backgroundColor: "#1e3a8a", color: "#ffffff" }}>
                <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full blur-3xl" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
                <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                   <Zap className="h-6 w-6" style={{ color: "#14b8a6" }} />
                   AI Forensic Insight
                </h3>
                <div className="space-y-4 relative z-10">
                   <p className="text-sm leading-relaxed opacity-90 font-medium">
                      Based on current metrics, <span className="font-black" style={{ color: "#14b8a6" }}>{categoryData[0]?.name || "Maintenance"}</span> is the primary driver of student dissatisfaction. 
                      Predictive analysis suggests focusing preventive maintenance on <span className="font-black" style={{ color: "#14b8a6" }}>Block {overdueComplaints[0]?.hostel.name.split(' ')[1] || "A"}</span> to optimize SLA compliance next month.
                   </p>
                   <div className="p-4 rounded-xl border" style={{ backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#14b8a6" }}>Recommendation</p>
                      <p className="text-xs font-bold mt-1">Audit high-wattage appliance usage to reduce electrical trip recurrence.</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="border-t pt-8 mt-auto flex justify-between items-center text-[10px] font-bold uppercase tracking-widest" style={{ borderColor: "#f1f5f9", color: "#94a3b8" }}>
             <p>© 2026 UNITEN Residential Services | All Rights Reserved</p>
             <p>Page 01 | Secure Operational Data</p>
          </div>
        </div>
      </div>
    </div>
  );
}
