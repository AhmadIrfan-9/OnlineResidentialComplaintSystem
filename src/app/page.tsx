import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { dashboardPathByRole } from "@/lib/roles";

export default async function Home() {
  const session = await auth();

  // Redirect authenticated users to dashboard
  if (session?.user) {
    redirect(dashboardPathByRole(session.user.role));
  }

  // Redirect unauthenticated users to login
  redirect("/login");
}
