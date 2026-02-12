import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/shared/LoginForm";

export const metadata = {
  title: "Sign In | Student Complaint System",
  description: "Sign in to your account",
};

export default async function LoginPage() {
  // Redirect if already authenticated
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            Student Complaint System
          </h1>
          <p className="mt-2 text-gray-600">
            Online Residential Complaint Management
          </p>
        </div>
        <div className="flex justify-center">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
