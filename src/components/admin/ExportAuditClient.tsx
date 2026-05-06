"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, Loader2 } from "lucide-react";

interface ExportAuditClientProps {
  stats: {
    studentCount: number;
    staffCount: number;
    loginActions: number;
    evidenceCount: number;
    estimatedStorageMB: string;
  };
}

export function ExportAuditClient({ stats }: ExportAuditClientProps) {
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`System_Audit_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={generatePDF}
        disabled={isExporting}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-2 text-sm font-medium text-white transition-all hover:from-slate-700 hover:to-slate-800 disabled:opacity-50"
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export System Audit
      </button>

      {/* Hidden Report Template */}
      <div className="hidden">
        <div ref={reportRef} className="p-12 w-[800px] bg-white text-slate-900 font-sans">
          <div className="flex items-center justify-between border-b-2 border-slate-200 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">System Health & Audit Report</h1>
              <p className="text-slate-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-[#0f766e]">UNITEN</p>
              <p className="text-sm text-slate-500">Residential Portal</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="space-y-4">
              <h2 className="text-lg font-bold border-b border-slate-100 pb-2">Account Statistics</h2>
              <div className="flex justify-between">
                <span className="text-slate-600">Active Students:</span>
                <span className="font-bold">{stats.studentCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Management/Staff:</span>
                <span className="font-bold">{stats.staffCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Users:</span>
                <span className="font-bold">{stats.studentCount + stats.staffCount}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-bold border-b border-slate-100 pb-2">Security & Storage</h2>
              <div className="flex justify-between">
                <span className="text-slate-600">Recent Login Actions:</span>
                <span className="font-bold">{stats.loginActions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Stored Evidence Files:</span>
                <span className="font-bold">{stats.evidenceCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Est. Storage Usage:</span>
                <span className="font-bold">{stats.estimatedStorageMB} MB</span>
              </div>
            </div>
          </div>

          <div className="text-sm text-slate-500 text-center mt-20 pt-8 border-t border-slate-100">
            CONFIDENTIAL - Internal Management Use Only
          </div>
        </div>
      </div>
    </>
  );
}
