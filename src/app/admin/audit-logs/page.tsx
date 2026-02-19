import { db } from "@/lib/db";
import { AuditLogsClient } from "@/components/admin/AuditLogsClient";

export default async function AdminAuditLogsPage() {
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Read-only trace of system activity for auditability and compliance.
        </p>
      </section>
      <AuditLogsClient userOptions={users.map((u) => u.name)} />
    </div>
  );
}
