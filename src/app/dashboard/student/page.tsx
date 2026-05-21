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
  ClipboardList,
  ChevronRight,
  SendHorizontal,
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

  // Fetch dashboard data sequentially to respect the connection_limit=1 restriction
  const activeCount = await db.complaint.count({
    where: { studentProfileId: studentProfile.id, status: { in: OPEN_STATUSES } },
  });
  const resolvedCount = await db.complaint.count({
    where: { studentProfileId: studentProfile.id, status: { in: RESOLVED_STATUSES } },
  });
  const unreadMessages = await db.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
  const recentComplaints = await db.complaint.findMany({
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
  });

  const studentName = session.user.name ?? "Student";
  const firstName = studentName.split(" ")[0];

  const metrics = [
    {
      label: "Active Complaints",
      value: activeCount,
      icon: AlertCircle,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      valueCls: activeCount > 0 ? "text-amber-600" : "text-slate-900",
      borderCls: "border-t-4 border-t-amber-500",
      href: "/complaints?status=PENDING",
      sub: "pending & in progress",
    },
    {
      label: "Resolved",
      value: resolvedCount,
      icon: CheckCircle2,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueCls: "text-emerald-600",
      borderCls: "border-t-4 border-t-emerald-500",
      href: "/complaints?status=RESOLVED",
      sub: "resolved & closed",
    },
    {
      label: "Notifications",
      value: unreadMessages,
      icon: Bell,
      iconBg: unreadMessages > 0 ? "bg-blue-100" : "bg-slate-100",
      iconColor: unreadMessages > 0 ? "text-blue-600" : "text-slate-500",
      valueCls: unreadMessages > 0 ? "text-blue-600" : "text-slate-900",
      borderCls: unreadMessages > 0 ? "border-t-4 border-t-blue-500" : "border-t-4 border-t-slate-300",
      href: "/complaints",
      sub: "unread messages",
    },
  ];

  return (
    <div className="space-y-6 pb-12">

      {/* ── Page header banner ── */}
      <div className="surface-hero px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">
            Student Portal
          </p>
          <h1 className="text-2xl font-black text-white">Welcome, {firstName}</h1>
          <p className="text-sm text-blue-200 mt-0.5">Track and manage your residential complaints.</p>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/complaints/new"
            className="flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            <Plus className="h-4 w-4" /> New Complaint
          </Link>
          <Link
            href="/complaints"
            className="flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            <ClipboardList className="h-4 w-4" /> My History
          </Link>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.label} href={m.href} className="block">
              <div className={`surface-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${m.borderCls}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      {m.label}
                    </p>
                    <p className={`text-4xl font-black tracking-tight ${m.valueCls}`}>
                      {m.value}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{m.sub}</p>
                  </div>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.iconBg}`}>
                    <Icon className={`h-5 w-5 ${m.iconColor}`} />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* ── Quick Actions ── */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/complaints/new"
          className="surface-card group flex flex-col p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-600 transition-colors">
              <SendHorizontal className="h-4 w-4 text-blue-700 group-hover:text-white transition-colors" />
            </span>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
            Submit New Complaint
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Report a residential issue for review by management.
          </p>
          <div className="mt-3 h-1 w-10 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        <Link
          href="/complaints"
          className="surface-card group flex flex-col p-5 hover:border-emerald-300 hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 group-hover:bg-emerald-600 transition-colors">
              <ClipboardList className="h-4 w-4 text-emerald-700 group-hover:text-white transition-colors" />
            </span>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
            View All Complaints
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Browse your full complaint history and check statuses.
          </p>
          <div className="mt-3 h-1 w-10 rounded-full bg-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </section>

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
