import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { db } from "@/lib/db";

export default async function ManagementReportsPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);
  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  const hostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const hostelIds = hostels.map((item) => item.id);
  if (hostelIds.length === 0 && role === "MANAGEMENT") {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-900">Reports</h1>
          <p className="mt-2 text-sm text-amber-800">No hostel assignment found for this account.</p>
        </div>
      </main>
    );
  }

  const whereScope = role === "MANAGEMENT" ? { hostelId: { in: hostelIds } } : {};
  const now = new Date();
  const overdueCutoff = new Date(now);
  overdueCutoff.setDate(overdueCutoff.getDate() - 30);

  const [complaints, overdueComplaints] = await Promise.all([
    db.complaint.findMany({
      where: whereScope,
      include: {
        hostel: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.complaint.findMany({
      where: {
        ...whereScope,
        createdAt: { lte: overdueCutoff },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      include: {
        hostel: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 30,
    }),
  ]);

  const total = complaints.length;
  const byStatus = complaints.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const byCategory = complaints.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-2 text-sm text-slate-600">
            Scope: {role === "MANAGEMENT" ? `${hostelIds.length} assigned hostel(s)` : "All hostels"}.
            Total complaints: {total}.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">By Status</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {Object.entries(byStatus).map(([key, value]) => (
                <li key={key} className="flex justify-between">
                  <span>{key}</span>
                  <span className="font-medium">{value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">By Category</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([key, value]) => (
                  <li key={key} className="flex justify-between">
                    <span>{key}</span>
                    <span className="font-medium">{value}</span>
                  </li>
                ))}
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Overdue Complaints (&gt; 30 days, open)</h2>
          {overdueComplaints.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No overdue complaints in scope.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Ticket</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Hostel</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueComplaints.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium">{item.id.slice(0, 8).toUpperCase()}</td>
                      <td className="py-2 pr-3">{item.title}</td>
                      <td className="py-2 pr-3">{item.hostel.name}</td>
                      <td className="py-2 pr-3">{item.status}</td>
                      <td className="py-2 pr-3">{item.createdAt.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
