import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManagementRole, isStudentRole } from "@/lib/roles";

export default async function Home() {
  const session = await auth();

  // Redirect authenticated users to dashboard
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (isStudentRole(user?.role)) {
      redirect("/dashboard/student");
    }

    if (isManagementRole(user?.role)) {
      redirect("/dashboard/warden");
    }

    redirect("/dashboard");
  }

  // Redirect unauthenticated users to login
  redirect("/login");
}
