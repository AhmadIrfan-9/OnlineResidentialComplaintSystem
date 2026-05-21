import { db } from "@/lib/db";
import { SystemClient } from "@/components/admin/SystemClient";

async function runHealthChecks() {
  let dbOnline = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOnline = true;
  } catch {
    dbOnline = false;
  }

  const emailConfigured =
    !!(process.env.SMTP_HOST ?? process.env.RESEND_API_KEY ?? process.env.SENDGRID_API_KEY);
  const aiConfigured = !!process.env.OPENAI_API_KEY;

  return { database: dbOnline, email: emailConfigured, ai: aiConfigured };
}

export default async function AdminSystemPage() {
  const [totalUsers, totalComplaints, activeUsers, userOptions, health] = await Promise.all([
    db.user.count(),
    db.complaint.count(),
    db.user.count({ where: { isActive: true } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { name: true }, take: 200 }),
    runHealthChecks(),
  ]);

  return (
    <div className="space-y-4">
      <section className="surface-hero px-5 py-4 md:py-5">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">Admin Portal</p>
        <h1 className="text-xl font-black text-white">System</h1>
        <p className="mt-0.5 text-sm text-blue-200">
          Monitor system health, manage configuration, and review audit activity.
        </p>
      </section>
      <SystemClient
        stats={{ totalUsers, totalComplaints, activeUsers }}
        userOptions={userOptions.map((u) => u.name)}
        health={health}
      />
    </div>
  );
}
