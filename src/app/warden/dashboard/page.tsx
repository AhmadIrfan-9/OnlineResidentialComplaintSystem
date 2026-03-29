import Link from "next/link";
import { redirect } from "next/navigation";
import { type Complaint, type Status } from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  Clock3,
  FileClock,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";

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

  const startSemester = new Date(now);
  startSemester.setDate(now.getDate() - 149); // Roughly 5 months
  startSemester.setHours(0, 0, 0, 0);

  const complaints = await db.complaint.findMany({
    where: {
      hostelId: { in: scopedHostels.map((item) => item.id) },
      createdAt: { gte: startSemester },
    },
    select: {
      id: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      closedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const monthComplaints = complaints.filter((c) => c.createdAt >= start30);

  const pendingComplaints = monthComplaints.filter((c) => STATUS_OPEN.includes(c.status)).length;

  const overdueComplaints = monthComplaints.filter((c) => {
    if (!STATUS_OPEN.includes(c.status)) return false;
    const elapsed = asDays(now.getTime() - c.createdAt.getTime());
    return elapsed > slaDaysByPriority(c.priority);
  }).length;

  const resolvedMonth = monthComplaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const avgResponseTimeDays =
    resolvedMonth.length === 0
      ? 0
      : resolvedMonth.reduce((acc, c) => {
          const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
          return acc + asDays(end.getTime() - c.createdAt.getTime());
        }, 0) / resolvedMonth.length;

  const slaCompliantCount = monthComplaints.filter((c) => {
    const end = STATUS_OPEN.includes(c.status) ? now : c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    const elapsed = asDays(end.getTime() - c.createdAt.getTime());
    return elapsed <= slaDaysByPriority(c.priority);
  }).length;
  const slaCompliance = monthComplaints.length ? (slaCompliantCount / monthComplaints.length) * 100 : 0;

  const trendBuckets = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(start30);
    day.setDate(start30.getDate() + i);
    day.setHours(0, 0, 0, 0);
    return day;
  });

  const trendData = trendBuckets.map((day) => {
    const dateStr = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = monthComplaints.filter((c) => c.createdAt.toDateString() === day.toDateString()).length;
    return { dateStr, date: day.toISOString(), count };
  });

  const categoryData = trendBuckets.map((day) => {
    const dateStr = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayComplaints = monthComplaints.filter((c) => c.createdAt.toDateString() === day.toDateString());
    
    const IT = dayComplaints.filter(c => c.category === 'WIFI').length;
    const Admin = dayComplaints.filter(c => ['SECURITY', 'NOISE', 'OTHER'].includes(c.category)).length;
    const Facilities = dayComplaints.length - IT - Admin; 

    return { dateStr, date: day.toISOString(), IT, Facilities, Admin };
  });

  const responseTimesMonth = resolvedMonth.map((c) => {
    const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    return asDays(end.getTime() - c.createdAt.getTime());
  });

  const resolvedSemester = complaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const responseTimesSemester = resolvedSemester.map((c) => {
    const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    return asDays(end.getTime() - c.createdAt.getTime());
  });

  const getBucketCounts = (times: number[]) => ({
    "0-1": times.filter((d) => d <= 1).length,
    "1-2": times.filter((d) => d > 1 && d <= 2).length,
    "2-3": times.filter((d) => d > 2 && d <= 3).length,
    "3-5": times.filter((d) => d > 3 && d <= 5).length,
    "5+": times.filter((d) => d > 5).length,
  });

  const monthCounts = getBucketCounts(responseTimesMonth);
  const semesterCountsRaw = getBucketCounts(responseTimesSemester);
  const MONTHS_IN_SEMESTER = 5;

  const histogramData = RESPONSE_HISTO_BUCKETS.map(bucket => {
    const key = bucket === "0-1 day" ? "0-1" : bucket === "1-2 days" ? "1-2" : bucket === "2-3 days" ? "2-3" : bucket === "3-5 days" ? "3-5" : "5+";
    return {
      bucket,
      currentMonth: monthCounts[key as keyof typeof monthCounts],
      semesterAvg: parseFloat((semesterCountsRaw[key as keyof typeof semesterCountsRaw] / MONTHS_IN_SEMESTER).toFixed(1))
    };
  });

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

        <DashboardCharts
          trendData={trendData}
          categoryData={categoryData}
          histogramData={histogramData}
        />

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
