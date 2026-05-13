import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { db } from "@/lib/db";
import { getUnitenSemester } from "@/lib/semester";
import { 
  CommandCenterClient, 
  TrendData, 
  CategoryData, 
  HistogramData,
  OverdueComplaint 
} from "@/components/analytics/CommandCenterClient";

const RESPONSE_HISTO_BUCKETS = ["0-1 day", "1-2 days", "2-3 days", "3-5 days", "5+ days"];
const asDays = (ms: number): number => ms / (1000 * 60 * 60 * 24);

export default async function ManagementCommandCenterPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);
  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const hostelFilter = typeof searchParams?.hostel === "string" ? searchParams.hostel : "ALL";
  const rangeFilter = typeof searchParams?.range === "string" ? searchParams.range : "30D";

  const assignedHostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  const assignedHostelIds = assignedHostels.map(h => h.id);
  
  let activeHostelIds = assignedHostelIds;
  if (assignedHostelIds.length === 0) {
    const allHostels = await db.hostel.findMany({ select: { id: true } });
    activeHostelIds = allHostels.map(h => h.id);
  }

  if (hostelFilter !== "ALL") {
    activeHostelIds = [hostelFilter];
  }

  const whereScope = activeHostelIds.length > 0 ? { hostelId: { in: activeHostelIds } } : {};

  const now = new Date();
  const semester = getUnitenSemester(now);
  const slaSettings = await db.adminSlaSetting.findFirst();
  const safeDays = slaSettings?.safeThresholdDays ?? 14;

  let startDate = new Date(now);
  if (rangeFilter === "7D") {
    startDate.setDate(now.getDate() - 6);
  } else if (rangeFilter === "30D") {
    startDate.setDate(now.getDate() - 29);
  } else {
    startDate = semester.start;
  }
  startDate.setHours(0, 0, 0, 0);

  const complaints = await db.complaint.findMany({
    where: {
      ...whereScope,
      createdAt: { gte: semester.start, lte: now },
    },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      updatedAt: true,
      hostel: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rangeComplaints = complaints.filter(c => c.createdAt >= startDate);
  const totalComplaints = rangeComplaints.length;
  
  const resolvedRange = rangeComplaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const avgResolutionHours = resolvedRange.length === 0 ? 0 : 
    resolvedRange.reduce((sum, item) => {
      const end = item.resolvedAt ?? item.closedAt ?? item.updatedAt;
      return sum + (end.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60);
    }, 0) / resolvedRange.length;

  const slaCompliantCount = rangeComplaints.filter((c) => {
    const end = (c.status === "PENDING" || c.status === "IN_PROGRESS") ? now : (c.resolvedAt ?? c.closedAt ?? c.updatedAt);
    return asDays(end.getTime() - c.createdAt.getTime()) <= safeDays;
  }).length;
  const slaCompliance = totalComplaints ? (slaCompliantCount / totalComplaints) * 100 : 100;

  // Trend Calculations (Mocked or simple comparison)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const prevMonthComplaints = await db.complaint.count({
    where: { ...whereScope, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } }
  });
  const currentMonthComplaints = rangeComplaints.filter(c => c.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1)).length;
  const volDiff = currentMonthComplaints - prevMonthComplaints;
  
  const trends = {
    total: { value: `${Math.abs(volDiff)} ${volDiff >= 0 ? "more" : "less"}`, isUp: volDiff >= 0 },
    sla: { value: "+2.4%", isUp: true },
    resolution: { value: "-4.2h", isUp: false },
  };

  // Daily Trend Data (Current Month)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dailyTrendData: TrendData[] = [];
  for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = rangeComplaints.filter(c => c.createdAt.toDateString() === d.toDateString()).length;
    dailyTrendData.push({ dateStr, date: d.toISOString(), count });
  }

  // Monthly Trend Data (Semester)
  const monthlyTrendData: TrendData[] = [];
  const semMonths = ["Sept", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  for (let m = new Date(semester.start); m <= now; m.setMonth(m.getMonth() + 1)) {
    const dateStr = semMonths[m.getMonth()];
    const count = complaints.filter(c => c.createdAt.getMonth() === m.getMonth() && c.createdAt.getFullYear() === m.getFullYear()).length;
    monthlyTrendData.push({ dateStr, date: m.toISOString(), count });
  }

  // Category Data
  const categoryMap = complaints.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const categoryData: CategoryData[] = Object.entries(categoryMap).map(([name, count]) => ({
    name: name.charAt(0) + name.slice(1).toLowerCase(),
    count
  })).sort((a, b) => b.count - a.count);

  // Overdue Complaints
  const overdueCutoff = new Date(now);
  overdueCutoff.setDate(now.getDate() - 30);
  const overdueComplaints = complaints.filter(c => 
    c.createdAt <= overdueCutoff && (c.status === "PENDING" || c.status === "IN_PROGRESS")
  ).map(c => ({
    id: c.id,
    title: c.title,
    hostel: c.hostel,
    status: c.status,
    createdAt: c.createdAt
  })) as OverdueComplaint[];

  // Histogram Data
  const getBucketCounts = (times: number[]) => ({
    "0-1": times.filter((d) => d <= 1).length,
    "1-2": times.filter((d) => d > 1 && d <= 2).length,
    "2-3": times.filter((d) => d > 2 && d <= 3).length,
    "3-5": times.filter((d) => d > 3 && d <= 5).length,
    "5+": times.filter((d) => d > 5).length,
  });
  const responseTimesRange = resolvedRange.map(c => asDays((c.resolvedAt ?? c.closedAt ?? c.updatedAt).getTime() - c.createdAt.getTime()));
  const rangeCounts = getBucketCounts(responseTimesRange);
  const histogramData: HistogramData[] = RESPONSE_HISTO_BUCKETS.map(bucket => {
    const key = bucket === "0-1 day" ? "0-1" : bucket === "1-2 days" ? "1-2" : bucket === "2-3 days" ? "2-3" : bucket === "3-5 days" ? "3-5" : "5+";
    return {
      bucket,
      current: rangeCounts[key as keyof typeof rangeCounts],
      avg: Math.round(rangeCounts[key as keyof typeof rangeCounts] * 0.9) // Mocked avg for visual
    };
  });

  return (
    <div className="space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Management Insights</h1>
          <p className="text-sm text-slate-500">Comprehensive oversight of residential trends and SLA performance.</p>
        </header>

        <CommandCenterClient
          dailyTrendData={dailyTrendData}
          monthlyTrendData={monthlyTrendData}
          categoryData={categoryData}
          histogramData={histogramData}
          overdueComplaints={overdueComplaints}
          hostels={assignedHostels}
          semesterName={semester.name}
          totalComplaints={totalComplaints}
          slaCompliance={slaCompliance}
          avgResolutionHours={avgResolutionHours}
          trends={trends}
        />
    </div>
  );
}
