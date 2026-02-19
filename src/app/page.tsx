import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();

  // Redirect authenticated users to dashboard
  if (session?.user?.id) {
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

    redirect("/dashboard");
  }

  // Redirect unauthenticated users to login
  redirect("/login");
}
