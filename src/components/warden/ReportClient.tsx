"use client";

import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Download, Printer, Zap } from "lucide-react";

interface ReportClientProps {
  semesterName: string;
  generatedAt: string;
  totalComplaints: number;
  pendingCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  overdueCount: number;
  slaCompliance: number;
  avgResolutionHours: number;
  categoryBreakdown: { name: string; count: number }[];
  priorityBreakdown: { priority: string; count: number }[];
  hostelScope: string;
}

export function ReportClient(props: ReportClientProps) {
  const {
    semesterName, generatedAt, totalComplaints,
    pendingCount, inProgressCount, resolvedCount, closedCount,
    overdueCount, slaCompliance, avgResolutionHours,
    categoryBreakdown, priorityBreakdown, hostelScope,
  } = props;

  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handlePrint = () => window.print();

  const handlePDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ORCS_Management_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const slaColor = slaCompliance >= 90 ? "#059669" : slaCompliance >= 70 ? "#d97706" : "#dc2626";

  return (
    <>
      {/* Action bar — hidden when printing */}
      <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-800">Management Report — {semesterName}</p>
          <p className="text-xs text-slate-500">Scope: {hostelScope} · Generated {generatedAt}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={handlePDF}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {exporting ? <Zap className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Report body — captured for PDF and printed */}
      <div
        ref={reportRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden print:shadow-none print:border-0"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {/* Header */}
        <div style={{ background: "#1e3a8a", color: "#fff" }} className="px-8 py-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">ORCS · UNITEN Residential Services</p>
            <h1 className="mt-1 text-2xl font-black">Management Report</h1>
            <p className="text-sm font-medium opacity-80">{semesterName}</p>
          </div>
          <div className="text-right text-sm opacity-80">
            <p className="font-bold">Generated</p>
            <p>{generatedAt}</p>
            <p className="mt-1 text-xs">Scope: {hostelScope}</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* KPI Grid */}
          <section>
            <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Key Performance Indicators</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Total Complaints", value: totalComplaints, color: "#1e3a8a" },
                { label: "SLA Compliance", value: `${slaCompliance.toFixed(1)}%`, color: slaColor },
                { label: "Avg Resolution", value: `${avgResolutionHours.toFixed(1)}h`, color: "#0f766e" },
                { label: "Overdue Tickets", value: overdueCount, color: overdueCount > 0 ? "#dc2626" : "#059669" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                  <p className="mt-2 text-3xl font-black" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Status Breakdown */}
          <section>
            <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Complaint Status Breakdown</h2>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-right">Count</th>
                    <th className="px-5 py-3 text-right">Share</th>
                    <th className="px-5 py-3 text-left w-40">Bar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { label: "Pending", count: pendingCount, color: "#f59e0b" },
                    { label: "In Progress", count: inProgressCount, color: "#3b82f6" },
                    { label: "Resolved", count: resolvedCount, color: "#10b981" },
                    { label: "Closed", count: closedCount, color: "#6b7280" },
                  ].map((row) => (
                    <tr key={row.label} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-700">{row.label}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{row.count}</td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {totalComplaints > 0 ? ((row.count / totalComplaints) * 100).toFixed(1) : "0.0"}%
                      </td>
                      <td className="px-5 py-3">
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: totalComplaints > 0 ? `${(row.count / totalComplaints) * 100}%` : "0%",
                              backgroundColor: row.color,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Category & Priority — two-column */}
          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Top Categories</h2>
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoryBreakdown.slice(0, 8).map((cat) => (
                      <tr key={cat.name} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{cat.name}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{cat.count}</td>
                      </tr>
                    ))}
                    {categoryBreakdown.length === 0 && (
                      <tr><td colSpan={2} className="px-4 py-4 text-center text-slate-400 italic">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Priority Distribution</h2>
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3 text-left">Priority</th>
                      <th className="px-4 py-3 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {priorityBreakdown.map((p) => (
                      <tr key={p.priority} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{p.priority}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{p.count}</td>
                      </tr>
                    ))}
                    {priorityBreakdown.length === 0 && (
                      <tr><td colSpan={2} className="px-4 py-4 text-center text-slate-400 italic">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Footer */}
          <footer className="border-t border-slate-100 pt-6 flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-widest">
            <p>© 2026 UNITEN Residential Services · ORCS</p>
            <p>Confidential — Management Use Only</p>
          </footer>
        </div>
      </div>
    </>
  );
}
