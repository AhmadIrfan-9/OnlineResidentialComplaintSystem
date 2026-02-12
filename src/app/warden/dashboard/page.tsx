import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock, FileText } from "lucide-react";
import { ComplaintsDataTable } from "@/components/warden/ComplaintsDataTable";

type StatCardColor = "blue" | "orange" | "red" | "green";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: StatCardColor;
}) {
  const colorMap: Record<StatCardColor, string> = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
    green: "bg-green-50 text-green-700",
  };

  const iconColorMap: Record<StatCardColor, string> = {
    blue: "text-blue-600",
    orange: "text-orange-600",
    red: "text-red-600",
    green: "text-green-600",
  };

  return (
    <Card className={`${colorMap[color]} border-0`}>
      <div className="flex items-start justify-between p-6">
        <div>
          <p className="text-sm font-medium opacity-75">{label}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
        </div>
        <Icon className={`${iconColorMap[color]} h-8 w-8`} />
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome back, Warden! Manage {hostel.name} hostel complaints
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Complaints"
          value={totalComplaints}
          icon={FileText}
          color="blue"
        />
        <StatCard
          label="Pending Today"
          value={pendingToday}
          icon={Clock}
          color="orange"
        />
        <StatCard
          label="Urgent Issues"
          value={urgentIssues}
          icon={AlertCircle}
          color="red"
        />
        <StatCard
          label="Resolved This Week"
          value={resolvedThisWeek}
          icon={CheckCircle}
          color="green"
        />
      </div>

      {/* Hostel Information */}
      <Card className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Hostel Name</p>
            <p className="font-semibold text-lg">{hostel.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Location</p>
            <p className="font-semibold text-lg">
              {hostel.city}, {hostel.state}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Capacity</p>
            <p className="font-semibold text-lg">{hostel.capacity}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Rooms</p>
            <p className="font-semibold text-lg">Coming Soon</p>
          </div>
        </div>
      </Card>

      {/* Complaints Data Table */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">All Complaints</h2>
        <ComplaintsDataTable />
      </div>
    </div>
  );
}
