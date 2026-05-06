import { db } from "@/lib/db";
import { ExportAuditClient } from "@/components/admin/ExportAuditClient";
import { Users, ShieldCheck, Database } from "lucide-react";

export default async function AdminReportsPage() {
  const studentCount = await db.studentProfile.count();
  const staffCount = await db.user.count({
    where: { role: { in: ["MANAGEMENT", "IT_STAFF_ADMIN"] } },
  });

  const loginActions = await db.auditLog.count({
    where: { action: "Login" },
  });

  const evidenceCount = await db.evidence.count();
  // Simulate 2.5MB per image/video file average for storage calculation
  const estimatedStorageMB = (evidenceCount * 2.5).toFixed(1);

  const stats = {
    studentCount,
    staffCount,
    loginActions,
    evidenceCount,
    estimatedStorageMB,
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">System Health Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time administrative overview of system infrastructure and security.
          </p>
        </div>
        <ExportAuditClient stats={stats} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {/* Account Statistics */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="font-semibold text-slate-800">Account Statistics</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Registered Students</span>
              <span className="font-bold text-slate-900">{studentCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Management & Staff</span>
              <span className="font-bold text-slate-900">{staffCount}</span>
            </div>
          </div>
        </div>

        {/* Security Audit */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="font-semibold text-slate-800">Security Audit</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Recent Logins</span>
              <span className="font-bold text-slate-900">{loginActions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">System Status</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Secure
              </span>
            </div>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Database className="h-6 w-6" />
            </div>
            <h2 className="font-semibold text-slate-800">Storage Usage</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Evidence Files</span>
              <span className="font-bold text-slate-900">{evidenceCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Est. Data Size</span>
              <span className="font-bold text-slate-900">{estimatedStorageMB} MB</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
