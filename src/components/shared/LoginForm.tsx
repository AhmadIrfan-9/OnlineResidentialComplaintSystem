"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

const loginSchema = z.object({
  studentId: z.string().min(3, "Student ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const identifier = data.studentId.trim();
      const result = await signIn("credentials", {
        email: identifier,
        password: data.password,
        redirect: false,
      });

      if (!result?.ok) {
        setError(result?.error || "Authentication failed. Please check your Student ID and password.");
        setIsLoading(false);
        return;
      }

      // Redirect based on role
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Student Login</CardTitle>
        <CardDescription>
          Access your residential complaint dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="studentId">Student ID</Label>
            <Input
              id="studentId"
              type="text"
              placeholder="Enter your Student ID"
              disabled={isLoading}
              className="h-12 text-base"
              {...register("studentId")}
            />
            {errors.studentId && (
              <p className="text-sm text-red-600">{errors.studentId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              disabled={isLoading}
              className="h-12 text-base"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              className="h-12 w-full text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Forgot Password?
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Help
              </Link>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

