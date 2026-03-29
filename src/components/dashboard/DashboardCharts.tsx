"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Lightbulb, Calendar, LineChart as LineChartIcon, PieChart, BarChart3 } from "lucide-react";

type TrendData = { dateStr: string; date: string; count: number };
type CategoryData = {
  dateStr: string;
  date: string;
  IT: number;
  Facilities: number;
  Admin: number;
};
type HistogramData = {
  bucket: string;
  currentMonth: number;
  semesterAvg: number;
};

export function DashboardCharts({
  trendData,
  categoryData,
  histogramData,
}: {
  trendData: TrendData[];
  categoryData: CategoryData[];
  histogramData: HistogramData[];
}) {
  const [viewMode, setViewMode] = useState<"Month" | "Semester">("Month");

  // Insight calculation
  const currentTotal = histogramData.reduce((acc, curr) => acc + curr.currentMonth, 0);
  const avgTotal = histogramData.reduce((acc, curr) => acc + curr.semesterAvg, 0);
  
  const currentFast = histogramData[0].currentMonth + histogramData[1].currentMonth; // 0-1, 1-2
  const avgFast = histogramData[0].semesterAvg + histogramData[1].semesterAvg;
  
  const percentFastCurrent = currentTotal ? currentFast / currentTotal : 0;
  const percentFastAvg = avgTotal ? avgFast / avgTotal : 0;
  
  let insightText = "Response times are steady compared to the semester average.";
  if (percentFastCurrent > percentFastAvg + 0.05) {
    insightText = `Your response time for the current month is faster than the semester average. Well done!`;
  } else if (percentFastCurrent < percentFastAvg - 0.05) {
    insightText = `Response times have slightly slowed down this month compared to the semester average.`;
  }

  // Common Tooltip Style
  const tooltipStyle = {
    backgroundColor: "#1e293b",
    border: "none",
    borderRadius: "8px",
    color: "#f8fafc",
    fontSize: "12px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-3">
        {/* 1. Interactive Line Chart */}
        <div className="surface-card p-4 xl:col-span-2">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <LineChartIcon className="h-4 w-4" /> Complaint Volume Trend (Last 30 Days)
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="dateStr" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "#64748b" }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "#e2e8f0" }}
                  labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                  formatter={(value: any) => [`${value} Complaints`, "Volume"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={3}
                  activeDot={{ r: 6, fill: "#1d4ed8", stroke: "#fff", strokeWidth: 2 }}
                  dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Category Breakdown Area Chart */}
        <div className="surface-card p-4">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <PieChart className="h-4 w-4" /> Category Breakdown (Monthly)
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={categoryData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dateStr" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", color: "#334155", paddingTop: "10px" }}
                />
                <Area type="monotone" dataKey="Facilities" stackId="1" stroke="#0f766e" fill="#14b8a6" name="Facilities" />
                <Area type="monotone" dataKey="IT" stackId="1" stroke="#1d4ed8" fill="#3b82f6" name="Wifi/IT" />
                <Area type="monotone" dataKey="Admin" stackId="1" stroke="#64748b" fill="#94a3b8" name="Admin" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3. Executive Analytics - Combined View */}
      <section className="surface-card p-5">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <BarChart3 className="h-5 w-5 text-blue-600" /> Performance Analytics: Semester 2 (2025/2026)
          </p>
          
          {/* Toggle Switch */}
          <div className="flex inline-flex items-center rounded-full bg-slate-100 p-1 text-sm font-medium text-slate-600">
            <button
              onClick={() => setViewMode("Month")}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                viewMode === "Month" ? "bg-white text-blue-700 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              [ Month ]
            </button>
            <button
              onClick={() => setViewMode("Semester")}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                viewMode === "Semester" ? "bg-white text-blue-700 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              [ Semester ]
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }} barGap={2} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="bucket" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    wrapperStyle={{ paddingTop: "20px" }}
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <div className="flex justify-center flex-wrap gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-sm bg-blue-600" />
                            <span>Current Month (March)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-sm bg-slate-300" />
                            <span>Semester 2 Average</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="currentMonth"
                    name="Current Month"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                    activeBar={{ fill: "#1d4ed8" }}
                  >
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-curr-${index}`} fill={index === 4 ? "#ef4444" : "#2563eb"} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="semesterAvg"
                    name="Semester Average"
                    fill="#cbd5e1"
                    radius={[4, 4, 0, 0]}
                    activeBar={{ fill: "#94a3b8" }}
                  >
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-avg-${index}`} fill={index === 4 ? "#fca5a5" : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold text-blue-900">
                <Lightbulb className="h-5 w-5 fill-blue-600 text-blue-600" />
                AI Insight
              </div>
              <p className="text-sm leading-relaxed text-blue-800">
                {insightText}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                <Calendar className="h-5 w-5 text-slate-500" />
                View Scope
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Currently showing performance metrics for the <strong>{viewMode === "Month" ? "Last 30 Days" : "Full Semester"}</strong>.
                Toggle at the top to switch your analytics context.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
