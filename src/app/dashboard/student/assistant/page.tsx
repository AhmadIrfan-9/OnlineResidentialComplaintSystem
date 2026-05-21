import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStudentRole, normalizeRoleKey } from "@/lib/roles";
import { AssistantClient } from "@/components/warden/AssistantClient";

export default async function StudentAssistantPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || !isStudentRole(role)) {
    redirect("/login");
  }

  return <AssistantClient />;
}
