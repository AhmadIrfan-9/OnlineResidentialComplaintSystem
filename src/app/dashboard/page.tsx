import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { dashboardPathByRole } from "@/lib/roles";

export default async function DashboardRouterPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(dashboardPathByRole(session.user.role));
}
