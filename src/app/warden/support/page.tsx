import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roles";
import { ManagementSupportDashboard } from "@/components/messaging/ManagementSupportDashboard";

export default async function ManagementSupportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = normalizeRoleKey(session.user.role);
  if (role !== "MANAGEMENT" && role !== "IT_STAFF_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <ManagementSupportDashboard />
      </div>
    </main>
  );
}
