import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isManagementRole, normalizeRoleKey } from "@/lib/roles";

export default async function ManagementReportsPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);
  if (!session?.user || !isManagementRole(role)) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="mt-2 text-sm text-slate-600">
          Report generation workspace is ready for milestone expansion.
        </p>
      </div>
    </main>
  );
}
