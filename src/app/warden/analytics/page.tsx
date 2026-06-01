import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { db } from "@/lib/db";
import { getUnitenSemester } from "@/lib/semester";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  CommandCenterClient,
  TrendData,
  CategoryData,
  HistogramData,
  OverdueComplaint,
  StatusCounts,
} from "@/components/analytics/CommandCenterClient";

const RESPONSE_HISTO_BUCKETS = ["0-1 day", "1-2 days", "2-3 days", "3-5 days", "5+ days"];
const asDays = (ms: number): number => ms / (1000 * 60 * 60 * 24);

/** Returns the 4 most-recent UNITEN semesters starting from `reference` (inclusive). */
function buildSemesterOptions(reference: Date) {
  const options: { name: string; value: string }[] = [];
  let cursor = new Date(reference);
  for (let i = 0; i < 4; i++) {
    const s = getUnitenSemester(cursor);
    const isoStart = s.start.toISOString().split("T")[0];
    options.push({ name: s.name + (i === 0 ? " (Current)" : ""), value: `SEM:${isoStart}` });
    // step back one day before this semester's start
    cursor = new Date(s.start.getTime() - 24 * 60 * 60 * 1000);
  }
  return options;
}

export default async function ManagementCommandCenterPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);
  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const rangeFilter = typeof searchParams?.range === "string" ? searchParams.range : "30D";

  const assignedHostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const assignedHostelIds = assignedHostels.map((h) => h.id);
  let activeHostelIds = assignedHostelIds;
  if (assignedHostelIds.length === 0) {
    const allHostels = await db.hostel.findMany({ select: { id: true } });
    activeHostelIds = allHostels.map((h) => h.id);
  }

  const whereScope = activeHostelIds.length > 0 ? { hostelId: { in: activeHostelIds } } : {};

  const now = new Date();
  const currentSemester = getUnitenSemester(now);
  const slaSettings = await db.adminSlaSetting.findFirst();
  const safeDays = slaSettings?.safeThresholdDays ?? 14;
  const semesterOptions = buildSemesterOptions(now);

  // ── Resolve query date range ────────────────────────────────────────────────
  let queryStart: Date;
  let queryEnd: Date = now;
  let displaySemesterName = currentSemester.name;

  if (rangeFilter === "7D") {
    queryStart = new Date(now);
    queryStart.setDate(now.getDate() - 6);
    queryStart.setHours(0, 0, 0, 0);
  } else if (rangeFilter === "30D") {
    queryStart = new Date(now);
    queryStart.setDate(now.getDate() - 29);
    queryStart.setHours(0, 0, 0, 0);
  } else if (rangeFilter.startsWith("SEM:")) {
    const semDate = new Date(rangeFilter.slice(4));
    const selectedSem = getUnitenSemester(semDate);
    queryStart = selectedSem.start;
    queryEnd = selectedSem.end.getTime() < now.getTime() ? selectedSem.end : now;
    displaySemesterName = selectedSem.name;
  } else if (rangeFilter.startsWith("CUSTOM:")) {
    const parts = rangeFilter.slice(7).split(":");
    queryStart = new Date(parts[0]);
    queryStart.setHours(0, 0, 0, 0);
    queryEnd = new Date(parts[1]);
    queryEnd.setHours(23, 59, 59, 999);
    displaySemesterName = "Custom Period";
  } else {
    // "SEMESTER" backwards-compat or default
    queryStart = currentSemester.start;
  }

  // ── Fetch complaints ────────────────────────────────────────────────────────
  const complaints = await db.complaint.findMany({
    where: {
      ...whereScope,
      createdAt: { gte: queryStart, lte: queryEnd },
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

  const rangeComplaints = complaints;
  const totalComplaints = rangeComplaints.length;

  const resolvedRange = rangeComplaints.filter(
    (c) => c.status === "RESOLVED" || c.status === "CLOSED"
  );
  const avgResolutionHours =
    resolvedRange.length === 0
      ? 0
      : resolvedRange.reduce((sum, item) => {
          const end = item.resolvedAt ?? item.closedAt ?? item.updatedAt;
          return sum + (end.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0) / resolvedRange.length;

  const slaCompliantCount = rangeComplaints.filter((c) => {
    const end =
      c.status === "PENDING" || c.status === "IN_PROGRESS"
        ? queryEnd
        : (c.resolvedAt ?? c.closedAt ?? c.updatedAt);
    return asDays(end.getTime() - c.createdAt.getTime()) <= safeDays;
  }).length;
  const slaCompliance = totalComplaints ? (slaCompliantCount / totalComplaints) * 100 : 100;

  // ── Trend Calculations ──────────────────────────────────────────────────────
  const periodMs = queryEnd.getTime() - queryStart.getTime();
  const prevPeriodStart = new Date(queryStart.getTime() - periodMs);

  const prevPeriodComplaints = await db.complaint.findMany({
    where: {
      ...whereScope,
      createdAt: { gte: prevPeriodStart, lt: queryStart },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      updatedAt: true,
    },
  });

  const prevResolved = prevPeriodComplaints.filter(
    (c) => c.status === "RESOLVED" || c.status === "CLOSED"
  );
  const prevAvgResolutionHours =
    prevResolved.length === 0
      ? avgResolutionHours
      : prevResolved.reduce((sum, c) => {
          const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
          return sum + (end.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0) / prevResolved.length;

  const prevSlaCompliantCount = prevPeriodComplaints.filter((c) => {
    const end =
      c.status === "PENDING" || c.status === "IN_PROGRESS"
        ? queryEnd
        : (c.resolvedAt ?? c.closedAt ?? c.updatedAt);
    return asDays(end.getTime() - c.createdAt.getTime()) <= safeDays;
  }).length;
  const prevSlaCompliance = prevPeriodComplaints.length
    ? (prevSlaCompliantCount / prevPeriodComplaints.length) * 100
    : slaCompliance;

  const slaDiff = slaCompliance - prevSlaCompliance;
  const resDiff = avgResolutionHours - prevAvgResolutionHours;
  const volDiff = totalComplaints - prevPeriodComplaints.length;

  const trends = {
    total: { value: `${Math.abs(volDiff)} ${volDiff >= 0 ? "more" : "less"}`, isUp: volDiff >= 0 },
    sla: { value: `${slaDiff >= 0 ? "+" : ""}${slaDiff.toFixed(1)}%`, isUp: slaDiff >= 0 },
    resolution: { value: `${resDiff >= 0 ? "+" : ""}${resDiff.toFixed(1)}h`, isUp: resDiff <= 0 },
  };

  // ── Daily Trend Data ────────────────────────────────────────────────────────
  const rangeDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24));
  const dailyTrendData: TrendData[] = [];
  if (rangeDays <= 60) {
    for (
      let d = new Date(queryStart);
      d.getTime() <= queryEnd.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      const dCopy = new Date(d);
      const count = rangeComplaints.filter(
        (c) => c.createdAt.toDateString() === dCopy.toDateString()
      ).length;
      const dateStr = dCopy.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyTrendData.push({ dateStr, date: dCopy.toISOString(), count });
    }
  }

  // ── Monthly Trend Data ──────────────────────────────────────────────────────
  const monthlyTrendData: TrendData[] = [];
  for (
    let m = new Date(queryStart.getFullYear(), queryStart.getMonth(), 1);
    m.getTime() <= queryEnd.getTime();
    m.setMonth(m.getMonth() + 1)
  ) {
    const mCopy = new Date(m);
    const dateStr = mCopy.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const count = rangeComplaints.filter(
      (c) =>
        c.createdAt.getMonth() === mCopy.getMonth() &&
        c.createdAt.getFullYear() === mCopy.getFullYear()
    ).length;
    monthlyTrendData.push({ dateStr, date: mCopy.toISOString(), count });
  }

  // ── Category Data ───────────────────────────────────────────────────────────
  const categoryMap = rangeComplaints.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const categoryData: CategoryData[] = Object.entries(categoryMap)
    .map(([name, count]) => ({
      name: name.charAt(0) + name.slice(1).toLowerCase(),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Status Counts ───────────────────────────────────────────────────────────
  const statusCounts: StatusCounts = {
    PENDING: rangeComplaints.filter((c) => c.status === "PENDING").length,
    IN_PROGRESS: rangeComplaints.filter((c) => c.status === "IN_PROGRESS").length,
    RESOLVED: rangeComplaints.filter((c) => c.status === "RESOLVED").length,
    CLOSED: rangeComplaints.filter((c) => c.status === "CLOSED").length,
  };

  // ── Overdue Complaints ──────────────────────────────────────────────────────
  const overdueCutoff = new Date(queryEnd);
  overdueCutoff.setDate(queryEnd.getDate() - 30);
  const overdueComplaints = rangeComplaints
    .filter(
      (c) => c.createdAt <= overdueCutoff && (c.status === "PENDING" || c.status === "IN_PROGRESS")
    )
    .map((c) => ({
      id: c.id,
      title: c.title,
      hostel: c.hostel,
      status: c.status,
      createdAt: c.createdAt,
    })) as OverdueComplaint[];

  // ── Histogram Data ──────────────────────────────────────────────────────────
  const getBucketCounts = (times: number[]) => ({
    "0-1": times.filter((d) => d <= 1).length,
    "1-2": times.filter((d) => d > 1 && d <= 2).length,
    "2-3": times.filter((d) => d > 2 && d <= 3).length,
    "3-5": times.filter((d) => d > 3 && d <= 5).length,
    "5+": times.filter((d) => d > 5).length,
  });
  const responseTimesRange = resolvedRange.map((c) =>
    asDays((c.resolvedAt ?? c.closedAt ?? c.updatedAt).getTime() - c.createdAt.getTime())
  );
  const rangeCounts = getBucketCounts(responseTimesRange);
  const histogramData: HistogramData[] = RESPONSE_HISTO_BUCKETS.map((bucket) => {
    const key =
      bucket === "0-1 day"
        ? "0-1"
        : bucket === "1-2 days"
        ? "1-2"
        : bucket === "2-3 days"
        ? "2-3"
        : bucket === "3-5 days"
        ? "3-5"
        : "5+";
    return {
      bucket,
      current: rangeCounts[key as keyof typeof rangeCounts],
      avg: Math.round(rangeCounts[key as keyof typeof rangeCounts] * 0.9),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        portalType={`Management Portal · ${displaySemesterName}`}
        title="Management Insights"
        subtitle="Comprehensive oversight of residential trends and SLA performance."
      />

      <CommandCenterClient
        dailyTrendData={dailyTrendData}
        monthlyTrendData={monthlyTrendData}
        categoryData={categoryData}
        histogramData={histogramData}
        overdueComplaints={overdueComplaints}
        statusCounts={statusCounts}
        semesterName={displaySemesterName}
        semesterOptions={semesterOptions}
        totalComplaints={totalComplaints}
        slaCompliance={slaCompliance}
        avgResolutionHours={avgResolutionHours}
        trends={trends}
        initialRangeFilter={rangeFilter}
      />
    </div>
  );
}
