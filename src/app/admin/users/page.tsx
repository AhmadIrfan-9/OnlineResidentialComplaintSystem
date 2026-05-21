import { db } from "@/lib/db";
import { UserManagementClient } from "@/components/admin/UserManagementClient";

export default async function AdminUsersPage() {
  // Fetch data sequentially to avoid pool timeout with connection_limit=1
  const hostels = await db.hostel.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <section className="surface-hero px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">Admin Portal</p>
        <h1 className="text-xl font-black text-white">User Management</h1>
        <p className="mt-0.5 text-sm text-blue-200">
          Manage user accounts, roles, hostel mappings, and account status.
        </p>
      </section>
      <UserManagementClient hostels={hostels} />
    </div>
  );
}
