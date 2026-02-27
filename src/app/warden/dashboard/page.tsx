import Link from "next/link";
import { redirect } from "next/navigation";
import { type Complaint, type Status } from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  FileClock,
  LineChart,
  PieChart,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { SignOutButton } from "@/components/shared/SignOutButton";

const STATUS_OPEN: Status[] = ["SUBMITTED", "ACKNOWLEDGED", "UNDER_REVIEW", "IN_PROGRESS"];
const RESPONSE_HISTO_BUCKETS = ["0-1 day", "1-2 days", "2-3 days", "3-5 days", "5+ days"];

const slaDaysByPriority = (priority: Complaint["priority"]): number => {
  if (priority === "EMERGENCY") return 4 / 24;
  if (priority === "URGENT") return 1;
  return 7;
};

const asDays = (ms: number): number => ms / (1000 * 60 * 60 * 24);

const cssPercent = (value: number, total: number): string => {
  if (total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
};

const metricColor = (type: "pending" | "overdue" | "sla", value: number): string => {
  if (type === "pending") return value > 5 ? "text-red-600" : "text-slate-900";
  if (type === "overdue") return value > 0 ? "text-red-600" : "text-slate-900";
  if (value > 90) return "text-emerald-600";
  if (value >= 70) return "text-amber-600";
  return "text-red-600";
};

const chartStrokePoints = (values: number[], width = 360, height = 120): string => {
  if (values.length === 0) return "";
  const maxVal = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / maxVal) * (height - 10) - 5;
      return `${x},${y}`;
    })
    .join(" ");
};

const navClass = "nav-pill inline-flex items-center";

export default async function ManagementDashboardPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || !isManagementRole(role)) {
    redirect("/login");
  }

  const assignedHostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedHostels =
    assignedHostels.length > 0
      ? assignedHostels
      : await db.hostel.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  if (scopedHostels.length === 0) {
    return (
      <main className="min-h-screen p-4 md:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          No hostel is configured yet. Please create at least one hostel in admin settings.
        </div>
      </main>
    );
  }

  const isFallbackScope = assignedHostels.length === 0;
  const scopeLabel =
    scopedHostels.length === 1
      ? scopedHostels[0].name
      : `${scopedHostels.length} hostels`;

  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(now.getDate() - 29);
  start30.setHours(0, 0, 0, 0);

  const complaints = await db.complaint.findMany({
    where: {
      hostelId: { in: scopedHostels.map((item) => item.id) },
      createdAt: { gte: start30 },
    },
    select: {
      id: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      closedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const pendingComplaints = complaints.filter((c) => STATUS_OPEN.includes(c.status)).length;

  const overdueComplaints = complaints.filter((c) => {
    if (!STATUS_OPEN.includes(c.status)) return false;
    const elapsed = asDays(now.getTime() - c.createdAt.getTime());
    return elapsed > slaDaysByPriority(c.priority);
  }).length;

  const resolved = complaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const avgResponseTimeDays =
    resolved.length === 0
      ? 0
      : resolved.reduce((acc, c) => {
          const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
          return acc + asDays(end.getTime() - c.createdAt.getTime());
        }, 0) / resolved.length;

  const slaCompliantCount = complaints.filter((c) => {
    const end = STATUS_OPEN.includes(c.status) ? now : c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    const elapsed = asDays(end.getTime() - c.createdAt.getTime());
    return elapsed <= slaDaysByPriority(c.priority);
  }).length;
  const slaCompliance = complaints.length ? (slaCompliantCount / complaints.length) * 100 : 0;

  const trendBuckets = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(start30);
    day.setDate(start30.getDate() + i);
    day.setHours(0, 0, 0, 0);
    return day;
  });
  const trendCounts = trendBuckets.map((day) =>
    complaints.filter((c) => c.createdAt.toDateString() === day.toDateString()).length
  );

  const statusPending = complaints.filter((c) =>
    c.status === "SUBMITTED" || c.status === "ACKNOWLEDGED"
  ).length;
  const statusInProgress = complaints.filter((c) =>
    c.status === "UNDER_REVIEW" || c.status === "IN_PROGRESS"
  ).length;
  const statusResolved = complaints.filter((c) =>
    c.status === "RESOLVED" || c.status === "CLOSED"
  ).length;
  const statusTotal = Math.max(complaints.length, 1);
  const pieGradient = `conic-gradient(
    #ef4444 0 ${cssPercent(statusPending, statusTotal)},
    #f59e0b ${cssPercent(statusPending, statusTotal)} ${cssPercent(
      statusPending + statusInProgress,
      statusTotal
    )},
    #10b981 ${cssPercent(statusPending + statusInProgress, statusTotal)} 100%
  )`;

  const responseTimes = resolved.map((c) => {
    const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    return asDays(end.getTime() - c.createdAt.getTime());
  });
  const histo = RESPONSE_HISTO_BUCKETS.map((bucket) => {
    if (bucket === "0-1 day") return responseTimes.filter((d) => d <= 1).length;
    if (bucket === "1-2 days") return responseTimes.filter((d) => d > 1 && d <= 2).length;
    if (bucket === "2-3 days") return responseTimes.filter((d) => d > 2 && d <= 3).length;
    if (bucket === "3-5 days") return responseTimes.filter((d) => d > 3 && d <= 5).length;
    return responseTimes.filter((d) => d > 5).length;
  });
  const histoMax = Math.max(...histo, 1);

  return (
    <main className="min-h-screen p-3 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="surface-hero p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-blue-600" />
              <div>
                <p className="text-base font-semibold text-slate-900">ORCS</p>
                <p className="text-xs text-slate-600">Dashboard scope: {scopeLabel}</p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-2">
              <Link href="/warden/dashboard" className="inline-flex items-center rounded-full border border-sky-700 bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-sky-200">
                Dashboard
              </Link>
              <Link href="/warden/queue" className={navClass}>
                Complaint Queue
              </Link>
              <Link href="/warden/support" className={navClass}>
                Support Chat
              </Link>
              <Link href="/warden/reports" className={navClass}>
                Reports
              </Link>
            </nav>
            <SignOutButton label={`${session.user.name ?? "Management"} | Logout`} />
          </div>
          {isFallbackScope && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No hostel assignment found for this management account. Showing data from all hostels.
            </div>
          )}
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
              <FileClock className="h-4 w-4" /> Pending complaints
            </div>
            <p className={`text-3xl font-semibold ${metricColor("pending", pendingComplaints)}`}>
              {pendingComplaints}
            </p>
          </div>
          <div className="surface-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
              <AlertTriangle className="h-4 w-4" /> Overdue complaints
            </div>
            <p className={`text-3xl font-semibold ${metricColor("overdue", overdueComplaints)}`}>
              {overdueComplaints}
            </p>
          </div>
          <div className="surface-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
              <Clock3 className="h-4 w-4" /> Average response time
            </div>
            <p className="text-3xl font-semibold text-slate-900">{avgResponseTimeDays.toFixed(1)} days</p>
          </div>
          <div className="surface-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
              <Activity className="h-4 w-4" /> SLA compliance
            </div>
            <p className={`text-3xl font-semibold ${metricColor("sla", slaCompliance)}`}>
              {slaCompliance.toFixed(1)}%
            </p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="surface-card p-4 xl:col-span-2">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <LineChart className="h-4 w-4" /> Complaint volume trend (last 30 days)
            </p>
            <svg viewBox="0 0 360 130" className="h-48 w-full">
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                points={chartStrokePoints(trendCounts)}
              />
              {trendCounts.map((count, i) => {
                const maxVal = Math.max(...trendCounts, 1);
                const x = trendCounts.length > 1 ? (i * 360) / (trendCounts.length - 1) : 0;
                const y = 120 - (count / maxVal) * 110;
                return <circle key={i} cx={x} cy={y} r="2.5" fill="#1d4ed8" />;
              })}
            </svg>
          </div>

          <div className="space-y-4">
            <div className="surface-card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <PieChart className="h-4 w-4" /> Status breakdown
              </p>
              <div className="mx-auto h-36 w-36 rounded-full" style={{ background: pieGradient }} />
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <p>Pending: {statusPending}</p>
                <p>In Progress: {statusInProgress}</p>
                <p>Resolved: {statusResolved}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="surface-card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BarChart3 className="h-4 w-4" /> Response time histogram
          </p>
          <div className="grid gap-3 md:grid-cols-5">
            {RESPONSE_HISTO_BUCKETS.map((bucket, idx) => (
              <div key={bucket} className="space-y-2">
                <div className="h-28 rounded bg-slate-100 p-2">
                  <div
                    className="h-full rounded bg-blue-600"
                    style={{ marginTop: `${100 - (histo[idx] / histoMax) * 100}%` }}
                  />
                </div>
                <p className="text-center text-xs text-slate-600">{bucket}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/warden/queue" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              View Complaint Queue
            </Link>
            <Link href="/warden/reports" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              Generate Report
            </Link>
            <Link href="/warden/analytics" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              View Analytics
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
