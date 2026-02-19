import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/shared/LoginForm";

export const metadata = {
  title: "Sign In | Student Complaint System",
  description: "Sign in to your account",
};

export default async function LoginPage() {
  // Redirect if already authenticated
  const session = await auth();
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            ORCS - Online Residential Complaint System
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to continue
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
