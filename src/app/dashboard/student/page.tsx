import Link from "next/link";
import { redirect } from "next/navigation";
import { type Status } from "@prisma/client";
import {
  AlertCircle,
  CheckCircle2,
  Bell,
  Plus,
  ExternalLink,
  FileText,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileMissingRecovery } from "@/components/shared/ProfileMissingRecovery";
import { RecentComplaintsTableClient } from "@/components/student/RecentComplaintsTableClient";

const OPEN_STATUSES: Status[] = ["PENDING", "IN_PROGRESS"];
const RESOLVED_STATUSES: Status[] = ["RESOLVED", "CLOSED"];

export default async function StudentDashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = String(session.user.role ?? "").toUpperCase();
  if (role !== "STUDENT") {
    redirect("/dashboard");
  }

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!studentProfile) {
    return <ProfileMissingRecovery userName={session.user.name ?? "Student"} />;
  }

  const [activeCount, resolvedCount, unreadMessages, recentComplaints] =
    await Promise.all([
      db.complaint.count({
        where: { studentProfileId: studentProfile.id, status: { in: OPEN_STATUSES } },
      }),
      db.complaint.count({
        where: { studentProfileId: studentProfile.id, status: { in: RESOLVED_STATUSES } },
      }),
      db.notification.count({
        where: { userId: session.user.id, isRead: false },
      }),
      db.complaint.findMany({
        where: { studentProfileId: studentProfile.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
          closedAt: true,
          complaintUpdates: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedBy: {
                select: {
                  name: true,
                  role: true
                }
              }
            },
            orderBy: { createdAt: "asc" }
          }
        },
      }),
    ]);

  const studentName = session.user.name ?? "Student";
  const firstName = studentName.split(" ")[0];

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">
          Good day, {firstName} 👋
        </h1>
        <p className="text-sm text-slate-500">
          Here&apos;s an overview of your complaint activity.
        </p>
      </header>

      {/* ── Summary Cards ── */}
      <section className="grid gap-4 sm:grid-cols-3">

        {/* Active Complaints — Amber (#D97706) */}
        <Link href="/complaints?status=PENDING" className="group block">
          <div className="flex h-full items-start gap-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-amber-300">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                Active Complaints
              </p>
              <p className="mt-1 text-3xl font-extrabold text-amber-900 tabular-nums">
                {activeCount}
              </p>
              <p className="mt-1 text-xs text-amber-600 group-hover:underline">
                View pending →
              </p>
            </div>
          </div>
        </Link>

        {/* Resolved — Emerald (#15803D) */}
        <Link href="/complaints?status=RESOLVED" className="group block">
          <div className="flex h-full items-start gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-emerald-300">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                Resolved
              </p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-900 tabular-nums">
                {resolvedCount}
              </p>
              <p className="mt-1 text-xs text-emerald-600 group-hover:underline">
                View closed →
              </p>
            </div>
          </div>
        </Link>

        {/* New Messages — Blue (#1D4ED8) */}
        <Link href="/complaints" className="group block">
          <div className="flex h-full items-start gap-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/30 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-blue-300">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
                Notifications
              </p>
              <p className="mt-1 text-3xl font-extrabold text-blue-900 tabular-nums">
                {unreadMessages}
              </p>
              <p className="mt-1 text-xs text-blue-600 group-hover:underline">
                View all →
              </p>
            </div>
          </div>
        </Link>
      </section>

      {/* ── Submit CTA ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/complaints/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-md active:translate-y-0"
          style={{ background: "linear-gradient(135deg, #003087 0%, #1d4ed8 100%)" }}
        >
          <Plus className="h-4 w-4" />
          Submit New Complaint
        </Link>
        <Link
          href="/complaints"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <FileText className="h-4 w-4 text-slate-500" />
          View All
        </Link>
      </div>

      {/* ── Recent Complaints Table ── */}
      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Recent Complaints</h2>
          <Link
            href="/complaints"
            className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline underline-offset-2"
          >
            View all <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <RecentComplaintsTableClient complaints={recentComplaints as any} />
      </section>
    </div>
  );
}
