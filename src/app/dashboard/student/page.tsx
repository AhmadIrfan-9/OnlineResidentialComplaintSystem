import Link from "next/link";
import { redirect } from "next/navigation";
import { type Status } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/shared/SignOutButton";

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
    return (
      <main className="min-h-screen p-4 md:p-8">
        <Card className="mx-auto max-w-5xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-900">Student profile not found</h1>
          <p className="mt-1 text-sm text-red-800">
            Your account has no linked student profile. Please contact management.
          </p>
        </Card>
      </main>
    );
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
    <main className="min-h-screen p-3 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="surface-hero px-4 py-3 md:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold tracking-wide text-slate-900">ORCS</div>
            <SignOutButton label={`${studentName} | Logout`} />
          </div>

          <nav className="hide-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
            {[
              { label: "Dashboard", href: "/dashboard/student" },
              { label: "My Complaints", href: "/complaints" },
              { label: "Submit New", href: "/student/new" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`snap-start whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${
                  item.label === "Dashboard"
                    ? "rounded-full border border-sky-700 bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-sky-200"
                    : "nav-pill"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <section className="surface-card p-4 md:p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Welcome, {studentName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track your complaint progress and submit new issues quickly.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
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
              href="/student/new"
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
    </main>
  );
}
