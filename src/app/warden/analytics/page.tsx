import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { db } from "@/lib/db";

export default async function ManagementAnalyticsPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);
  if (!session?.user || !isManagementRole(role)) {
    redirect("/login");
  }

  const hostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true },
  });
  const whereScope = role === "MANAGEMENT" ? { hostelId: { in: hostels.map((h) => h.id) } } : {};

  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(start30.getDate() - 29);
  start30.setHours(0, 0, 0, 0);

  const complaints = await db.complaint.findMany({
    where: {
      ...whereScope,
      createdAt: { gte: start30 },
    },
    select: {
      id: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const total = complaints.length;
  const resolved = complaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const avgResolutionHours =
    resolved.length === 0
      ? 0
      : resolved.reduce((sum, item) => {
          const end = item.resolvedAt ?? item.closedAt ?? item.updatedAt;
          return sum + (end.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0) / resolved.length;

  const categoryTrend = complaints.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  const dailyVolume = Array.from({ length: 30 }, (_, idx) => {
    const day = new Date(start30);
    day.setDate(start30.getDate() + idx);
    day.setHours(0, 0, 0, 0);
    const count = complaints.filter(
      (item) => item.createdAt.toDateString() === day.toDateString()
    ).length;
    return { day: day.toISOString().slice(0, 10), count };
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
          <p className="mt-2 text-sm text-slate-600">
            Last 30 days performance and trend insights.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Complaints (30 days)</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Resolved/Closed</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-700">{resolved.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Avg Resolution Time</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {avgResolutionHours.toFixed(1)}h
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recurring Issues</h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {Object.entries(categoryTrend)
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => (
                <li
                  key={category}
                  className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>{category}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Daily Complaint Volume</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Count</th>
                </tr>
              </thead>
              <tbody>
                {dailyVolume.map((entry) => (
                  <tr key={entry.day} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{entry.day}</td>
                    <td className="py-2 pr-3 font-medium">{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
