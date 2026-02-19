import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardRouterPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const role = String(user?.role ?? "").toUpperCase();

  if (role === "STUDENT") {
    redirect("/dashboard/student");
  }

  if (role === "WARDEN" || role === "MANAGEMENT") {
    redirect("/dashboard/warden");
  }

  redirect("/login");
}
