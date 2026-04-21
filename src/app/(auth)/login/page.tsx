import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/shared/LoginForm";
import { dashboardPathByRole } from "@/lib/roles";

import Image from "next/image";

export const metadata = {
  title: "Sign In | ORCS",
  description: "Sign in to your account",
};

export default async function LoginPage() {
  // Redirect if already authenticated
  const session = await auth();
  if (session?.user) {
    redirect(dashboardPathByRole(session.user.role));
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="surface-hero mb-6 grid gap-4 p-6 text-slate-900 md:grid-cols-2 md:p-8">
          <div>
            <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-white p-2.5 shadow-md ring-1 ring-slate-100">
              <Image src="/assets/logo-light.png" alt="ORCS Logo" width={56} height={56} className="object-contain" priority />
            </div>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Online Residential Complaint System
            </h1>
            <p className="mt-3 text-sm text-slate-700">
              Unified portal for students, management, and administrators.
            </p>
          </div>
          <div className="surface-card p-4">
            <p className="text-sm font-semibold text-slate-800">What you can do</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li>Submit and track complaints with evidence</li>
              <li>Manage workflow with assignments and status updates</li>
              <li>Run admin operations, reports, and escalations</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
