import { db } from "@/lib/db";
import { AdminAnalyticsClient } from "@/components/admin/AdminAnalyticsClient";

export default async function AdminAnalyticsPage() {
  const now = new Date();

  const [
    complaintsByStatus,
    complaintsByPriority,
    complaintsByCategory,
    hostelStats,
    usersByRole,
    totalActive,
    totalInactive,
    recentComplaints,
    activityCount,
    resolvedComplaints,
  ] = await Promise.all([
    db.complaint.groupBy({ by: ["status"],   _count: { id: true } }),
    db.complaint.groupBy({ by: ["priority"], _count: { id: true } }),
    db.complaint.groupBy({ by: ["category"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 8 }),
    db.hostel.findMany({ select: { name: true, _count: { select: { complaints: true } } } }),
    db.user.groupBy({ by: ["role"], _count: { id: true } }),
    db.user.count({ where: { isActive: true } }),
    db.user.count({ where: { isActive: false } }),
    db.complaint.findMany({
      where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
      select: { createdAt: true, status: true },
    }),
    db.auditLog.count({ where: { action: { notIn: ["Login", "View"] } } }),
    db.complaint.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
  ]);

  const totalComplaints = complaintsByStatus.reduce((s, r) => s + r._count.id, 0);
  const totalUsers = usersByRole.reduce((s, r) => s + r._count.id, 0);
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;
  const pendingCount = complaintsByStatus.find((r) => r.status === "PENDING")?._count.id ?? 0;

  // Monthly trend — last 6 months
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const label = d.toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
    const inMonth = recentComplaints.filter((c) => c.createdAt >= d && c.createdAt <= end);
    return {
      label,
      total: inMonth.length,
      resolved: inMonth.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED").length,
    };
  });

  const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pending", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed",
  };
  const PRIORITY_LABELS: Record<string, string> = {
    ROUTINE: "Routine", URGENT: "Urgent", EMERGENCY: "Emergency",
  };
  const ROLE_LABELS: Record<string, string> = {
    STUDENT: "Student", MANAGEMENT: "Management", IT_STAFF_ADMIN: "Admin",
  };

  return (
    <div className="space-y-4">
      <section className="surface-hero px-5 py-4 md:py-5">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">Admin Portal</p>
        <h1 className="text-xl font-black text-white">Analytics</h1>
        <p className="mt-0.5 text-sm text-blue-200">
          Full visibility into complaints, users, and system activity.
        </p>
      </section>
      <AdminAnalyticsClient
        kpis={{ totalComplaints, totalUsers, resolutionRate, pendingCount, activityCount }}
        statusData={complaintsByStatus.map((r) => ({ name: STATUS_LABELS[r.status] ?? r.status, value: r._count.id }))}
        priorityData={complaintsByPriority.map((r) => ({ name: PRIORITY_LABELS[r.priority] ?? r.priority, value: r._count.id }))}
        categoryData={complaintsByCategory.map((r) => ({ name: r.category, value: r._count.id }))}
        hostelData={hostelStats.map((h) => ({ name: h.name, value: h._count.complaints }))}
        roleData={[
          ...usersByRole.map((r) => ({ name: ROLE_LABELS[r.role] ?? r.role, value: r._count.id })),
          { name: "Inactive", value: totalInactive },
        ]}
        monthlyTrend={monthlyTrend}
        activeUsers={totalActive}
        inactiveUsers={totalInactive}
      />
    </div>
  );
}
