import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole, normalizeRoleKey } from "@/lib/roles";
import { AssistantClient } from "@/components/warden/AssistantClient";

export default async function AdminAssistantPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || !isAdminRole(role)) {
    redirect("/login");
  }

  return <AssistantClient />;
}
