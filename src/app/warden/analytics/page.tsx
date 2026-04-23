import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { db } from "@/lib/db";
import { getUnitenSemester } from "@/lib/semester";
import { AnalyticsClient, TrendData, CategoryData, HistogramData } from "@/components/analytics/AnalyticsClient";
import { Prisma } from "@prisma/client";

const RESPONSE_HISTO_BUCKETS = ["0-1 day", "1-2 days", "2-3 days", "3-5 days", "5+ days"];
const asDays = (ms: number): number => ms / (1000 * 60 * 60 * 24);

export default async function ManagementAnalyticsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);
  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  // Handle Search Params
  const searchParams = await props.searchParams;
  const hostelFilter = typeof searchParams?.hostel === "string" ? searchParams.hostel : "ALL";
  const rangeFilter = typeof searchParams?.range === "string" ? searchParams.range : "30D"; // 7D, 30D, SEMESTER

  // Base scope based on RBAC
  const assignedHostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  const assignedHostelIds = assignedHostels.map(h => h.id);
  
  // Apply UI Filters
  let activeHostelIds = assignedHostelIds;
  if (assignedHostelIds.length === 0) {
    const allHostels = await db.hostel.findMany({ select: { id: true } });
    activeHostelIds = allHostels.map(h => h.id);
  }

  if (hostelFilter !== "ALL" && (assignedHostelIds.includes(hostelFilter) || assignedHostelIds.length === 0)) {
    activeHostelIds = [hostelFilter];
  }

  const whereScope = activeHostelIds.length > 0 ? { hostelId: { in: activeHostelIds } } : {};

  const now = new Date();
  const semester = getUnitenSemester(now);

  const slaSettings = await db.adminSlaSetting.findFirst();
  // Fetch safe days from updated prisma client
  const safeDays = slaSettings?.safeThresholdDays ?? 14;

  // Determine Time Range
  let startDate = new Date(now);
  if (rangeFilter === "7D") {
    startDate.setDate(now.getDate() - 6);
  } else if (rangeFilter === "30D") {
    startDate.setDate(now.getDate() - 29);
  } else {
    startDate = semester.start;
  }
  startDate.setHours(0, 0, 0, 0);

  // 1. Prisma GroupBy for Category Breakdown
  const categoryGroups = await db.complaint.groupBy({
    by: ['category'],
    where: {
      ...whereScope,
      createdAt: { gte: startDate, lte: now }
    },
    _count: {
      id: true
    }
  });

  const categoryData: CategoryData[] = categoryGroups.map(g => ({
    name: g.category.charAt(0) + g.category.slice(1).toLowerCase(),
    count: g._count.id
  })).sort((a, b) => b.count - a.count);

  // 2. Fetch Base Data for other metrics
  const complaints = await db.complaint.findMany({
    where: {
      ...whereScope,
      createdAt: { gte: semester.start, lte: now },
    },
    select: {
      id: true,
      category: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const rangeComplaints = complaints.filter(c => c.createdAt >= startDate);

  const totalComplaints = rangeComplaints.length;
  
  const resolvedSemester = complaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const resolvedRange = rangeComplaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  
  const avgResolutionHours =
    resolvedRange.length === 0
      ? 0
      : resolvedRange.reduce((sum, item) => {
          const end = item.resolvedAt ?? item.closedAt ?? item.updatedAt;
          return sum + (end.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0) / resolvedRange.length;

  const slaCompliantCount = rangeComplaints.filter((c) => {
    const end = (c.status === "PENDING" || c.status === "IN_PROGRESS") ? now : (c.resolvedAt ?? c.closedAt ?? c.updatedAt);
    const elapsed = asDays(end.getTime() - c.createdAt.getTime());
    return elapsed <= safeDays;
  }).length;
  
  const slaCompliance = totalComplaints ? (slaCompliantCount / totalComplaints) * 100 : 100;

  // 3. Trend Data Mapping (Days)
  // We calculate buckets based on the range length
  const rangeDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const maxBuckets = Math.min(rangeDays || 1, 60); // Cap at 60 points for line chart
  
  const trendBuckets = Array.from({ length: maxBuckets }, (_, i) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    day.setHours(0, 0, 0, 0);
    return day;
  });

  // Prisma `$queryRaw` could be used here but JS mapping on pre-fetched `rangeComplaints` is safer for timezone alignment 
  // since this system stores dates in UTC.
  const trendData: TrendData[] = trendBuckets.map((day) => {
    const dateStr = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = rangeComplaints.filter((c) => c.createdAt.toDateString() === day.toDateString()).length;
    return { dateStr, date: day.toISOString(), count };
  });

  // 4. Histogram mapping
  const responseTimesRange = resolvedRange.map((c) => {
    const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    return asDays(end.getTime() - c.createdAt.getTime());
  });

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

  const rangeCounts = getBucketCounts(responseTimesRange);
  const semesterCountsRaw = getBucketCounts(responseTimesSemester);
  const scaleFactor = Math.max(1, semester.months); // Simplified average divisor

  const histogramData: HistogramData[] = RESPONSE_HISTO_BUCKETS.map(bucket => {
    const key = bucket === "0-1 day" ? "0-1" : bucket === "1-2 days" ? "1-2" : bucket === "2-3 days" ? "2-3" : bucket === "3-5 days" ? "3-5" : "5+";
    return {
      bucket,
      current: rangeCounts[key as keyof typeof rangeCounts],
      avg: parseFloat((semesterCountsRaw[key as keyof typeof semesterCountsRaw] / scaleFactor).toFixed(1))
    };
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Performance Analytics</h1>
          <p className="text-sm text-slate-500">
            Deep-dive operational metrics for your assigned student accommodations.
          </p>
        </header>

        <AnalyticsClient
          trendData={trendData}
          categoryData={categoryData}
          histogramData={histogramData}
          hostels={assignedHostels}
          semesterName={semester.name}
          totalComplaints={totalComplaints}
          slaCompliance={slaCompliance}
          avgResolutionHours={avgResolutionHours}
        />
      </div>
    </main>
  );
}
