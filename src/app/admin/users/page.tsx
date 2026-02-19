import { db } from "@/lib/db";
import { UserManagementClient } from "@/components/admin/UserManagementClient";

export default async function AdminUsersPage() {
  const hostels = await db.hostel.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage user accounts, roles, hostel mappings, and account status.
        </p>
      </section>
      <UserManagementClient hostels={hostels} />
    </div>
  );
}
