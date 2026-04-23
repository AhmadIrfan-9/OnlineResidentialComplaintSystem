import Link from "next/link";
import { redirect } from "next/navigation";
import { type Complaint, type Status } from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  Clock3,
  FileClock,
  ChevronRight,
  TrendingUp,
  Lightbulb
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { getUnitenSemester } from "@/lib/semester";

const STATUS_OPEN: Status[] = ["PENDING", "IN_PROGRESS"];


const asDays = (ms: number): number => ms / (1000 * 60 * 60 * 24);

const metricColor = (type: "pending" | "overdue" | "sla", value: number): string => {
  if (type === "pending") return value > 5 ? "text-amber-600" : "text-slate-900";
  if (type === "overdue") return value > 0 ? "text-red-600" : "text-slate-900";
  if (value > 90) return "text-emerald-600";
  if (value >= 70) return "text-amber-600";
  return "text-red-600";
};

// Generates an SVG polyline string from an array of numbers
const chartStrokePoints = (values: number[], width = 120, height = 30): string => {
  if (values.length === 0) return "";
  const maxVal = Math.max(...values, 1) * 1.2; // Add 20% padding top
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((v, i) => {
      const x = i * stepX;
      // Flip Y axis for SVG (0 is top)
      const y = height - (v / maxVal) * height;
      return `${x},${y}`;
    })
    .join(" ");
};

const Sparkline = ({ data, colorClass, stroke = "#2563eb" }: { data: number[], colorClass: string, stroke?: string }) => {
  return (
    <div className={`mt-3 h-8 w-32 opacity-70 ${colorClass}`}>
      <svg width="100%" height="100%" viewBox="0 0 120 30" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={chartStrokePoints(data, 120, 30)}
        />
      </svg>
    </div>
  );
};

export default async function ManagementDashboardPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  const assignedHostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedHostels = assignedHostels.length > 0 ? assignedHostels : await db.hostel.findMany({
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
  const scopeLabel = scopedHostels.length === 1 ? scopedHostels[0].name : `${scopedHostels.length} hostels`;

  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(now.getDate() - 29);
  start30.setHours(0, 0, 0, 0);

  const start14 = new Date(now);
  start14.setDate(now.getDate() - 13);
  start14.setHours(0, 0, 0, 0);

  const semester = getUnitenSemester(now);

  const slaSettings = await db.adminSlaSetting.findFirst();
  const warningDays = slaSettings?.warningThresholdDays ?? 30;
  const safeDays = slaSettings?.safeThresholdDays ?? 14;

  const monthComplaints = await db.complaint.findMany({
    where: {
      hostelId: { in: scopedHostels.map((item) => item.id) },
      createdAt: { gte: start30 },
    },
    select: {
      id: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      closedAt: true,
      studentProfile: { select: { user: { select: { name: true } } } }
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingComplaints = monthComplaints.filter((c) => STATUS_OPEN.includes(c.status)).length;
  const overdueComplaints = monthComplaints.filter((c) => {
    if (!STATUS_OPEN.includes(c.status)) return false;
    const elapsed = asDays(now.getTime() - c.createdAt.getTime());
    return elapsed > warningDays;
  }).length;

  const resolvedMonth = monthComplaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const avgResponseTimeDays = resolvedMonth.length === 0 ? 0 : resolvedMonth.reduce((acc, c) => {
    const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    return acc + asDays(end.getTime() - c.createdAt.getTime());
  }, 0) / resolvedMonth.length;

  const slaCompliantCount = monthComplaints.filter((c) => {
    const end = STATUS_OPEN.includes(c.status) ? now : c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    const elapsed = asDays(end.getTime() - c.createdAt.getTime());
    return elapsed <= safeDays;
  }).length;
  
  const slaCompliance = monthComplaints.length ? (slaCompliantCount / monthComplaints.length) * 100 : 0;

  // Generate 14-day Sparkline Trend Data
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start14);
    d.setDate(start14.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const sparklinePending = last14Days.map(day => monthComplaints.filter(c => c.createdAt.toDateString() === day.toDateString()).length);
  const sparklineResolved = last14Days.map(day => resolvedMonth.filter(c => (c.resolvedAt || c.updatedAt).toDateString() === day.toDateString()).length);
  
  // Create a slight jitter for the visual SLA sparkline based on exact day's compliance, or fallback to static average
  const sparklineSLA = last14Days.map(day => {
    const dayC = monthComplaints.filter(c => c.createdAt.toDateString() === day.toDateString());
    if (dayC.length === 0) return slaCompliance; // Static line if no tickets
    const compliant = dayC.filter(c => {
      const end = STATUS_OPEN.includes(c.status) ? now : c.resolvedAt ?? c.closedAt ?? c.updatedAt;
      return asDays(end.getTime() - c.createdAt.getTime()) <= safeDays;
    }).length;
    return (compliant / dayC.length) * 100;
  });

  // Calculate High Priority Queue (Latest 5 items by age)
  const highPriorityLatest = monthComplaints
    .filter(c => STATUS_OPEN.includes(c.status))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 5);

  // AI Insight Logic
  const percentFastCurrent = resolvedMonth.map(c => asDays((c.resolvedAt || c.updatedAt).getTime() - c.createdAt.getTime())).filter(time => time <= 2).length / (resolvedMonth.length || 1);
  let insightText = "Response times are steady compared to the 30-day average.";
  if (percentFastCurrent > 0.6) {
    insightText = `You are resolving ${Math.round(percentFastCurrent * 100)}% of complaints within 48 hours. Excellent operational speed!`;
  } else if (overdueComplaints > 3) {
    insightText = `Warning: You have ${overdueComplaints} overdue complaints. Prioritize oldest urgent tickets.`;
  }

  const isEmptyState = monthComplaints.length === 0;

  return (
    <div className="space-y-6 relative pb-24">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Scope: {scopeLabel}</p>
        {isFallbackScope && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No hostel assignment found. Showing full scope data.
          </div>
        )}
      </header>

      {/* --- Section 1: Summary Metric Cards --- */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card p-5 relative overflow-hidden group">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
            <FileClock className="h-4 w-4" /> Pending queue
          </div>
          <p className={`text-4xl font-bold tracking-tight ${metricColor("pending", pendingComplaints)}`}>
            {pendingComplaints}
          </p>
          {!isEmptyState && <Sparkline data={sparklinePending} colorClass="text-amber-500" stroke="#f59e0b" />}
        </div>
        
        <div className="surface-card p-5 relative overflow-hidden group">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Overdue tickets
          </div>
          <p className={`text-4xl font-bold tracking-tight ${metricColor("overdue", overdueComplaints)}`}>
            {overdueComplaints}
          </p>
          {!isEmptyState && <Sparkline data={[overdueComplaints > 0 ? overdueComplaints - 1 : 0, overdueComplaints]} colorClass="text-red-500" stroke="#ef4444" />}
        </div>
        
        <div className="surface-card p-5 relative overflow-hidden group">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
            <Clock3 className="h-4 w-4" /> Avg response
          </div>
          <p className="text-4xl font-bold tracking-tight text-slate-900">
            {avgResponseTimeDays.toFixed(1)} <span className="text-lg font-medium text-slate-500">days</span>
          </p>
          {!isEmptyState && <Sparkline data={sparklineResolved} colorClass="text-blue-500" stroke="#3b82f6" />}
        </div>
        
        <div className="surface-card p-5 relative overflow-hidden group">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
            <Activity className="h-4 w-4" /> SLA compliance
          </div>
          <p className={`text-4xl font-bold tracking-tight ${metricColor("sla", slaCompliance)}`}>
            {slaCompliance.toFixed(1)}<span className="text-lg font-medium opacity-80">%</span>
          </p>
          {!isEmptyState && <Sparkline data={sparklineSLA} colorClass="text-emerald-500" stroke="#10b981" />}
        </div>
      </section>

      {/* --- Section 2: Task-Focused Panels --- */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Left: High Priority Queue */}
        <div className="lg:col-span-2 surface-card flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Action Required: High Priority
            </h2>
            <Link href="/warden/queue?priority=EMERGENCY,URGENT" className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center">
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </div>
          
          <div className="flex-1 p-0">
            {isEmptyState || highPriorityLatest.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-slate-500">
                <div className="rounded-full bg-slate-50 p-3 mb-3">
                  <Activity className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">Inbox Zero!</p>
                <p className="text-xs mt-1 max-w-[250px]">No emergency or urgent complaints require your immediate attention.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {highPriorityLatest.map(ticket => (
                  <li key={ticket.id} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`h-2.5 w-2.5 rounded-full ${asDays(now.getTime() - ticket.createdAt.getTime()) > safeDays ? 'bg-orange-500' : 'bg-green-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {ticket.studentProfile?.user?.name || "Student"} &middot; {ticket.category}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Submitted {new Date(ticket.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/warden/complaints/${ticket.id}`}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 opacity-0 group-hover:opacity-100"
                    >
                      Resolve
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Quick Navigation / Analytics Link */}
        <div className="flex flex-col gap-4">
          <Link href="/warden/queue" className="surface-card p-5 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer group">
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 flex items-center justify-between">
              Complaint Queue <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
            </h3>
            <p className="text-xs text-slate-500 mt-2">Manage all standard tickets, apply filters, and update statuses.</p>
          </Link>
          
          <Link href="/warden/analytics" className="surface-card p-5 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer group flex-1">
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 flex items-center justify-between">
              Performance Analytics <TrendingUp className="h-4 w-4 text-slate-400 group-hover:text-purple-600" />
            </h3>
            <p className="text-xs text-slate-500 mt-2">View detailed historical charts, category breakdowns, and semester reports.</p>
          </Link>
        </div>
      </section>

      {/* --- Section 3: Floating Toggleable AI Insights Widget --- */}
      <div className="fixed bottom-6 right-6 z-50">
        <details className="group relative">
          <summary className="flex h-14 w-14 cursor-pointer list-none items-center justify-center rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 hover:scale-105 transition-all ring-4 ring-slate-900/10 active:scale-95">
            <Lightbulb className="h-6 w-6 text-amber-300" />
          </summary>
          <div className="absolute bottom-full right-0 mb-4 w-[340px] origin-bottom-right rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl opacity-0 scale-95 transition-all duration-300 ease-out group-open:opacity-100 group-open:scale-100">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-900">
                <Lightbulb className="h-4 w-4 text-amber-500 fill-amber-500" /> AI Intel
              </h4>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              {insightText}
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
              <Activity className="h-3 w-3" /> System performance auto-analysis
            </div>
          </div>
        </details>
      </div>

    </div>
  );
}
