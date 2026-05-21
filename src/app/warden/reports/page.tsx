import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { getUnitenSemester } from "@/lib/semester";
import { ReportClient } from "@/components/warden/ReportClient";
import { BarChart2 } from "lucide-react";
import { formatReportTimestampMYT } from "@/lib/format-date";

const asDays = (ms: number) => ms / (1000 * 60 * 60 * 24);

export default async function ManagementReportsPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  const now = new Date();
  const semester = getUnitenSemester(now);

  const slaSettings = await db.adminSlaSetting.findFirst();
  const safeDays = slaSettings?.safeThresholdDays ?? 14;
  const warningDays = slaSettings?.warningThresholdDays ?? 30;

  const assignedHostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedHostels =
    assignedHostels.length > 0
      ? assignedHostels
      : await db.hostel.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  const hostelScope =
    scopedHostels.length === 1
      ? scopedHostels[0].name
      : `${scopedHostels.length} Hostels`;

  if (scopedHostels.length === 0) {
    return (
      <main className="min-h-screen p-4 md:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          No hostel is configured yet. Please create at least one hostel in admin settings.
        </div>
      </main>
    );
  }

  const complaints = await db.complaint.findMany({
    where: {
      hostelId: { in: scopedHostels.map((h) => h.id) },
      createdAt: { gte: semester.start, lte: now },
    },
    select: {
      id: true,
      status: true,
      priority: true,
      category: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      updatedAt: true,
    },
  });

  const totalComplaints = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === "PENDING").length;
  const inProgressCount = complaints.filter((c) => c.status === "IN_PROGRESS").length;
  const resolvedCount = complaints.filter((c) => c.status === "RESOLVED").length;
  const closedCount = complaints.filter((c) => c.status === "CLOSED").length;

  const overdueCutoff = new Date(now);
  overdueCutoff.setDate(now.getDate() - warningDays);
  const overdueCount = complaints.filter(
    (c) => c.createdAt <= overdueCutoff && (c.status === "PENDING" || c.status === "IN_PROGRESS")
  ).length;

  const resolved = complaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const avgResolutionHours =
    resolved.length === 0
      ? 0
      : resolved.reduce((sum, c) => {
          const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
          return sum + (end.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0) / resolved.length;

  const slaCompliantCount = complaints.filter((c) => {
    const end =
      c.status === "PENDING" || c.status === "IN_PROGRESS"
        ? now
        : c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    return asDays(end.getTime() - c.createdAt.getTime()) <= safeDays;
  }).length;
  const slaCompliance = totalComplaints ? (slaCompliantCount / totalComplaints) * 100 : 100;

  const normalizeCategory = (cat: string): string => {
    if (!cat) return "Others";
    const lower = cat.trim().toLowerCase();
    if (lower === "plumbing") return "Plumbing";
    if (lower === "wifi" || lower === "wi-fi" || lower === "internet") return "WiFi";
    if (lower === "electrical" || lower === "electric" || lower === "electricity") return "Electrical";
    if (lower === "furniture") return "Furniture";
    if (lower === "water") return "Water";
    if (lower === "noise") return "Noise";
    if (lower === "security") return "Security";
    return "Others";
  };

  const categoryMap = complaints.reduce(
    (acc, c) => {
      const norm = normalizeCategory(c.category);
      acc[norm] = (acc[norm] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const priorityMap = complaints.reduce(
    (acc, c) => {
      const raw = c.priority || "ROUTINE";
      let norm = "Routine";
      if (raw.toUpperCase() === "URGENT") norm = "Urgent";
      if (raw.toUpperCase() === "EMERGENCY") norm = "Emergency";
      acc[norm] = (acc[norm] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const priorityBreakdown = Object.entries(priorityMap).map(([priority, count]) => ({ priority, count }));

  const generatedAt = formatReportTimestampMYT(now);

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-1 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Generate Report</h1>
            <p className="text-sm text-slate-500">
              Semester summary report for {hostelScope} · {semester.name}
            </p>
          </div>
          <Link
            href="/warden/analytics"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 print:hidden"
          >
            <BarChart2 className="h-4 w-4" /> View Analytics
          </Link>
        </div>
      </header>

      <ReportClient
        semesterName={semester.name}
        generatedAt={generatedAt}
        totalComplaints={totalComplaints}
        pendingCount={pendingCount}
        inProgressCount={inProgressCount}
        resolvedCount={resolvedCount}
        closedCount={closedCount}
        overdueCount={overdueCount}
        slaCompliance={slaCompliance}
        avgResolutionHours={avgResolutionHours}
        categoryBreakdown={categoryBreakdown}
        priorityBreakdown={priorityBreakdown}
        hostelScope={hostelScope}
      />
    </div>
  );
}
