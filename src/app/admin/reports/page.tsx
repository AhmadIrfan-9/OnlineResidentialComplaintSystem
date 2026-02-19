export default function AdminReportsPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">System Reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Generate system-level reports for usage, performance, and compliance metrics.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <button className="rounded-xl border border-slate-300 bg-white p-4 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
          User Activity Report
        </button>
        <button className="rounded-xl border border-slate-300 bg-white p-4 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
          Complaint SLA Report
        </button>
        <button className="rounded-xl border border-slate-300 bg-white p-4 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
          Configuration Change Report
        </button>
      </section>
    </div>
  );
}

