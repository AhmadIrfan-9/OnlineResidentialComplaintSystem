import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { AssistantClient } from "@/components/warden/AssistantClient";

export default async function AssistantPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  return <AssistantClient />;
}
