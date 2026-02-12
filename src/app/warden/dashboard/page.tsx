import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock, FileText } from "lucide-react";
import { ComplaintsDataTable } from "@/components/warden/ComplaintsDataTable";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border border-slate-200/80 bg-slate-50 shadow-none">
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
        </div>
        <Icon className="h-7 w-7 text-blue-600" />
      </div>
    </Card>
  );
}

export default async function WardenDashboard() {
  const session = await auth();

  // Verify user is warden
  if (!session?.user || session.user.role !== "WARDEN") {
    redirect("/login");
  }

  // Get warden's hostel
  const hostel = await db.hostel.findUnique({
    where: { wardenId: session.user.id },
  });

  if (!hostel) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">
          No hostel assigned to your account
        </h1>
      </div>
    );
  }

  // Get today's start time (midnight)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Get week start (7 days ago)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  // Fetch statistics using Prisma aggregation
  const [totalComplaints, pendingToday, urgentIssues, resolvedThisWeek] =
    await Promise.all([
      // Total Complaints: All complaints for this hostel
      db.complaint.count({
        where: { hostelId: hostel.id },
      }),

      // Pending Today: OPEN status created today
      db.complaint.count({
        where: {
          hostelId: hostel.id,
          status: "OPEN",
          createdAt: { gte: todayStart },
        },
      }),

      // Urgent Issues: HIGH priority regardless of status
      db.complaint.count({
        where: {
          hostelId: hostel.id,
          priority: "HIGH",
          status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] },
        },
      }),

      // Resolved This Week: RESOLVED status from last 7 days
      db.complaint.count({
        where: {
          hostelId: hostel.id,
          status: "RESOLVED",
          updatedAt: { gte: weekStart },
        },
      }),
    ]);

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-4 shadow-sm md:p-6">
        <header className="rounded-xl bg-slate-800 px-6 py-5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            Management Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Monitor and manage complaints for {hostel.name}
          </p>
        </header>

        <section className="rounded-xl border border-slate-200/70 bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">Key Metrics</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Complaints"
              value={totalComplaints}
              icon={FileText}
            />
            <StatCard
              label="Pending Today"
              value={pendingToday}
              icon={Clock}
            />
            <StatCard
              label="Urgent Issues"
              value={urgentIssues}
              icon={AlertCircle}
            />
            <StatCard
              label="Resolved This Week"
              value={resolvedThisWeek}
              icon={CheckCircle}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/70 bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">Hostel Overview</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Hostel Name</p>
              <p className="text-lg font-semibold text-slate-800">{hostel.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Warden ID</p>
              <p className="text-lg font-semibold text-slate-800">{session.user.id}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Rooms</p>
              <p className="text-lg font-semibold text-slate-800">Coming Soon</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/70 bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">All Complaints</h2>
          <ComplaintsDataTable />
        </section>
      </div>
    </main>
  );
}
