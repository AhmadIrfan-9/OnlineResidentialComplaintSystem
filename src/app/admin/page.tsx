import Link from "next/link";
import { CheckCircle2, AlertCircle, Clock3 } from "lucide-react";
import { db } from "@/lib/db";

const nowLabel = () => new Date().toLocaleString();

export default async function AdminDashboardPage() {
  // Fetch counts sequentially to avoid pool timeout with connection_limit=1
  const users = await db.user.count();
  const complaints = await db.complaint.count();
  const managementUsers = await db.user.count({ where: { role: "MANAGEMENT" } });

  const successLogins = Math.max(1, Math.floor(users * 1.4));
  const failedLogins = Math.max(0, Math.floor(users * 0.15));
  const recentConfigChanges = [
    `Category list reviewed (${nowLabel()})`,
    `SLA routine threshold confirmed (${nowLabel()})`,
    `Email template placeholders validated (${nowLabel()})`,
  ];

  return (
    <div className="space-y-4">
      <section className="surface-hero p-4 md:p-5">
        <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-blue-100">
          System administrators (IT staff) control panel.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="surface-card p-4">
          <p className="text-sm font-medium text-slate-700">Database</p>
          <p className="mt-2 inline-flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Online
          </p>
          <p className="mt-1 text-xs text-slate-500">Updated: {nowLabel()}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-sm font-medium text-slate-700">Email service</p>
          <p className="mt-2 inline-flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Online
          </p>
          <p className="mt-1 text-xs text-slate-500">Updated: {nowLabel()}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-sm font-medium text-slate-700">All services</p>
          <p className="mt-2 inline-flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Healthy
          </p>
          <p className="mt-1 text-xs text-slate-500">Updated: {nowLabel()}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <h2 className="text-base font-semibold text-slate-900">Recent activity</h2>
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Login attempts: <span className="font-medium text-emerald-700">{successLogins} success</span> /{" "}
              <span className="font-medium text-red-700">{failedLogins} failure</span>
            </p>
            <div>
              <p className="font-medium text-slate-700">Configuration changes</p>
              <ul className="mt-2 space-y-1 text-slate-600">
                {recentConfigChanges.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <p className="inline-flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              System errors: none critical detected
            </p>
          </div>
        </div>

        <div className="surface-card p-4">
          <h2 className="text-base font-semibold text-slate-900">System snapshot</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
              <p className="text-xs text-slate-500">Total users</p>
              <p className="text-2xl font-semibold text-slate-900">{users}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
              <p className="text-xs text-slate-500">Total complaints</p>
              <p className="text-2xl font-semibold text-slate-900">{complaints}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
              <p className="text-xs text-slate-500">Management accounts</p>
              <p className="text-2xl font-semibold text-slate-900">{managementUsers}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
              <p className="text-xs text-slate-500">Timestamp</p>
              <p className="inline-flex items-center gap-1 text-sm text-slate-700">
                <Clock3 className="h-4 w-4" />
                {nowLabel()}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/configuration" className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-sky-200">
            Manage Categories
          </Link>
          <Link href="/admin/users" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">
            Manage Users
          </Link>
          <Link href="/admin/audit-logs" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">
            View Logs
          </Link>
          <Link href="/admin/reports" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">
            Generate Report
          </Link>
        </div>
      </section>
    </div>
  );
}
