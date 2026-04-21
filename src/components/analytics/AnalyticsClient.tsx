"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Download, Filter, Building, Calendar, AlertCircle } from "lucide-react";

export type TrendData = { dateStr: string; date: string; count: number };
export type CategoryData = { name: string; count: number };
export type HistogramData = { bucket: string; current: number; avg: number };

interface AnalyticsClientProps {
  trendData: TrendData[];
  categoryData: CategoryData[];
  histogramData: HistogramData[];
  hostels: { id: string; name: string }[];
  semesterName: string;
  totalComplaints: number;
  slaCompliance: number;
  avgResolutionHours: number;
}

export function AnalyticsClient({
  trendData,
  categoryData,
  histogramData,
  hostels,
  semesterName,
  totalComplaints,
  slaCompliance,
  avgResolutionHours,
}: AnalyticsClientProps) {
  const [selectedHostel, setSelectedHostel] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<string>("30D"); // 7D, 30D, SEMESTER

  // This would ideally map to URL searchParams, but for now it's purely UI state
  // If we want it to map to searchParams, we should use useRouter and useSearchParams
  
  const handlePrint = () => {
    window.print();
  };

  const isEmpty = trendData.length === 0;

  // Teal/Navy Academic Palette
  const colors = {
    tealPrimary: "#0f766e", // Teal 700
    tealSecondary: "#14b8a6", // Teal 500
    tealLight: "#ccfbf1", // Teal 50
    navyPrimary: "#1e3a8a", // Blue 900
    navySecondary: "#1e40af", // Blue 800
    navyLight: "#dbeafe", // Blue 100
    gray: "#64748b",
  };

  const tooltipStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    color: "#0f172a",
    fontSize: "12px",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Print styles injected for clean PDF generation */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-full-width { width: 100% !important; max-width: 100% !important; }
        }
      `}} />

      {/* Filter Bar (Top Row) */}
      <div className="no-print flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm border border-slate-100">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Filters</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            >
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="SEMESTER">This Semester</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-slate-400" />
            <select 
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Assigned Hostels</option>
              {hostels.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-navyPrimary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-navySecondary focus:outline-none focus:ring-2 focus:ring-navyPrimary focus:ring-offset-2"
        >
          <Download className="h-4 w-4" />
          Generate PDF Report
        </button>
      </div>

      {/* Overview Metrics for PDF Context */}
      <div className="hidden print-full-width md:grid md:grid-cols-4 gap-4 mb-6">
         <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Semester Total</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{totalComplaints}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">SLA Compliance</p>
            <p className="mt-1 text-3xl font-semibold text-tealPrimary">{slaCompliance.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Avg Resolution</p>
            <p className="mt-1 text-3xl font-semibold text-navyPrimary">{avgResolutionHours.toFixed(1)}h</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Semester Context</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 line-clamp-2">{semesterName}</p>
          </div>
      </div>

      {isEmpty ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 shadow-sm animate-pulse">
            <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-700">Collecting Data...</p>
            <p className="text-sm mt-1">Not enough complaints exist in the selected range to generate analytics.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Row 1: Complaint Volume Trend (Line Chart) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print-full-width">
            <h3 className="mb-4 text-base font-bold text-slate-900">Complaint Volume Trend</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
                    itemStyle={{ color: colors.navyPrimary, fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Complaints"
                    stroke={colors.navyPrimary}
                    strokeWidth={3}
                    activeDot={{ r: 6, fill: colors.tealPrimary, stroke: "#fff", strokeWidth: 2 }}
                    dot={{ r: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Category Breakdown & SLA Compliance Gauge */}
          <div className="grid gap-6 lg:grid-cols-2 print-full-width">
            {/* Category Breakdown (Horizontal Bar Chart) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-slate-900">Category Breakdown</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#334155", fontWeight: 500 }} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Complaints" radius={[0, 4, 4, 0]} fill={colors.tealPrimary}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? colors.tealPrimary : colors.navySecondary} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SLA Compliance Gauge */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col items-center justify-center relative">
              <h3 className="absolute top-5 left-5 text-base font-bold text-slate-900">SLA Compliance</h3>
              <div className="h-48 w-full mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Compliant", value: slaCompliance },
                        { name: "Overdue", value: 100 - slaCompliance }
                      ]}
                      cx="50%"
                      cy="100%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius="60%"
                      outerRadius="90%"
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill={colors.tealPrimary} />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [typeof val === 'number' ? val.toFixed(1) + "%" : String(val), ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
                <p className="text-4xl font-extrabold" style={{color: colors.navyPrimary}}>{slaCompliance.toFixed(1)}%</p>
                <p className="text-sm font-medium text-slate-500 mt-1">Resolution SLA Met</p>
              </div>
            </div>
          </div>

          {/* Row 3: Performance Analytics (Response Times) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print-full-width">
            <h3 className="mb-4 text-base font-bold text-slate-900">Performance Analytics: Response Time Distribution</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }} barGap={4}>
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
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                  />
                  <Bar
                    dataKey="current"
                    name="Current Period"
                    fill={colors.navyPrimary}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="avg"
                    name="Semester Average"
                    fill="#cbd5e1"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
