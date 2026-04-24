import { db } from "@/lib/db";
import { UserManagementClient } from "@/components/admin/UserManagementClient";

export default async function AdminUsersPage() {
  // Fetch data sequentially to avoid pool timeout with connection_limit=1
  const hostels = await db.hostel.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const rooms = await db.room.findMany({
    orderBy: [{ hostel: { name: "asc" } }, { roomNumber: "asc" }],
    select: {
      id: true,
      roomNumber: true,
      floor: true,
      hostel: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <section className="surface-hero p-4">
        <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage user accounts, roles, hostel mappings, and account status.
        </p>
      </section>
      <UserManagementClient hostels={hostels} rooms={rooms} />
    </div>
  );
}
