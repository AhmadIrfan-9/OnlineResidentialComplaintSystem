"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  identifier: z.string().min(3, "Email or user ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: data.identifier.trim(),
        password: data.password,
        redirect: false,
      });

      if (!result?.ok) {
        setError(result?.error || "Authentication failed. Please check your email/user ID and password.");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200/90 bg-white/95 shadow-xl shadow-sky-100/60 backdrop-blur">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl text-slate-900">Account Login</CardTitle>
        <CardDescription className="text-slate-600">
          Sign in as student, management, or admin
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email or User ID</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="e.g. user@orcs.local or S12345"
              disabled={isLoading}
              className="h-12 border-slate-300/90 bg-slate-50 text-base"
              {...form.register("identifier")}
            />
            {form.formState.errors.identifier ? (
              <p className="text-sm text-red-600">{form.formState.errors.identifier.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              disabled={isLoading}
              className="h-12 border-slate-300/90 bg-slate-50 text-base"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              className="h-12 w-full bg-gradient-to-r from-sky-600 to-blue-700 text-base text-white hover:from-sky-700 hover:to-blue-800"
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
