import Link from "next/link";
import { redirect } from "next/navigation";
import { type Status } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { ProfileMissingRecovery } from "@/components/shared/ProfileMissingRecovery";

const OPEN_STATUSES: Status[] = ["SUBMITTED", "ACKNOWLEDGED", "UNDER_REVIEW", "IN_PROGRESS"];
const RESOLVED_STATUSES: Status[] = ["RESOLVED", "CLOSED"];

const formatStatus = (status: string): string =>
  status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const ticketId = (id: string): string => `#${id.slice(0, 8).toUpperCase()}`;

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

  const [activeCount, resolvedCount, unreadMessages, recentComplaints] = await Promise.all([
    db.complaint.count({
      where: {
        studentProfileId: studentProfile.id,
        status: { in: OPEN_STATUSES },
      },
    }),
    db.complaint.count({
      where: {
        studentProfileId: studentProfile.id,
        status: { in: RESOLVED_STATUSES },
      },
    }),
    db.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    }),
    db.complaint.findMany({
      where: { studentProfileId: studentProfile.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const studentName = session.user.name ?? "Student";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {studentName}</h1>
        <p className="text-sm text-slate-500">
          Track your complaint progress and submit new issues quickly.
        </p>
      </header>

      <section className="surface-card p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/complaints?status=SUBMITTED">
            <Card className="h-full border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                Active Complaints
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{activeCount}</p>
              <p className="mt-1 text-xs text-amber-800">View pending complaints</p>
            </Card>
          </Link>

          <Link href="/complaints?status=RESOLVED">
            <Card className="h-full border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Resolved</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{resolvedCount}</p>
              <p className="mt-1 text-xs text-emerald-800">View closed complaints</p>
            </Card>
          </Link>

          <Link href="/complaints">
            <Card className="h-full border border-blue-200/80 bg-gradient-to-br from-blue-50 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-800">New Messages</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{unreadMessages}</p>
              <p className="mt-1 text-xs text-blue-800">Notification count</p>
            </Card>
          </Link>
        </div>

        <div className="mt-5">
          <Link
            href="/complaints/new"
            className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-6 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Submit New Complaint
          </Link>
        </div>
      </section>

      <section className="surface-card p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Recent Complaints</h2>

        {recentComplaints.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No complaints submitted yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Ticket ID</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Submitted Date</th>
                  <th className="py-2 pr-3">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentComplaints.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-3 pr-3 font-medium text-slate-800">{ticketId(item.id)}</td>
                    <td className="py-3 pr-3 text-slate-700">{formatStatus(item.status)}</td>
                    <td className="py-3 pr-3 text-slate-600">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
