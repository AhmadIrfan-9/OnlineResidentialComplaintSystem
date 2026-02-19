import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isManagementRole, isStudentRole } from "@/lib/roles";

export default async function DashboardRouterPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (isStudentRole(user?.role)) {
    redirect("/dashboard/student");
  }

  if (isAdminRole(user?.role)) {
    redirect("/admin");
  }

  if (isManagementRole(user?.role)) {
    redirect("/dashboard/warden");
  }

  redirect("/login");
}
