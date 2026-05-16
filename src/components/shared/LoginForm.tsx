"use client";

import { useState } from "react";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Mail,
  Lock,
} from "lucide-react";

const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, "Please enter your Email or Student ID."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginFormData = z.infer<typeof loginSchema>;

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address.")
    .refine(
      (val) =>
        val.endsWith("@uniten.edu.my") ||
        val.endsWith("@student.uniten.edu.my"),
      {
        message:
          "Please use a valid UNITEN email (@uniten.edu.my or @student.uniten.edu.my).",
      }
    ),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("logout") === "inactive";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password State
  const [view, setView] = useState<"login" | "forgot-password" | "forgot-password-success">("login");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const resetForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        identifier: data.identifier.trim(),
        password: data.password,
        redirect: false,
      });

      if (!result?.ok) {
        if (result?.error === "CredentialsSignin") {
          setError("Invalid credentials.");
        } else {
          setError(
            result?.error ||
              "Authentication failed. Please verify your credentials and try again."
          );
        }
        setIsLoading(false);
        return;
      }

      window.location.href = "/";
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e?.type === "CredentialsSignin" || (err instanceof Error && err.message?.includes("CredentialsSignin"))) {
        setError("Invalid credentials.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data: ForgotPasswordData) => {
    setIsResetting(true);
    setResetError(null);

    try {
      // Mock connecting to Supabase/Firebase/Database to trigger reset email
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      console.log(`[Mock Backend] Reset link sent to: ${data.email}`);
      
      setView("forgot-password-success");
    } catch {
      setResetError("Failed to send reset link. Please try again later.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-500 bg-red-600 rounded-4xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-red-500/30">
      {view === "login" && (
            <>
              {/* Session Timeout Warning Banner */}
              {sessionExpired && (
                <div className="mb-5 flex items-start gap-3 rounded-xl p-4 animate-in fade-in slide-in-from-top-1 bg-amber-50 border border-amber-100">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-sm font-medium leading-snug text-amber-800">
                    Security Notice: Your session has timed out. Please log in to continue.
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl p-4 animate-in fade-in bg-red-50 border border-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm font-medium leading-snug text-red-800">
                    {error}
                  </p>
                </div>
              )}

          <form
            onSubmit={form.handleSubmit(handleLogin)}
            className="space-y-5"
            noValidate
          >
            {/* Email / ID Field */}
            <div className="space-y-2">
              <label htmlFor="identifier" className="block text-sm font-bold text-white ml-1">
                Email or Student ID
              </label>
              <div className="relative">
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Email or Student ID"
                  aria-label="Email or Student ID"
                  disabled={isLoading}
                  className={`block h-12 w-full rounded-xl border border-white/20 bg-white pl-11 pr-4 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                    form.formState.errors.identifier
                      ? "border-blue-300 focus:border-blue-300 focus:ring-blue-300"
                      : ""
                  }`}
                  {...form.register("identifier")}
                />
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              </div>
              {form.formState.errors.identifier && (
                <p className="flex items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-1 text-white font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {form.formState.errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-bold text-white ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-label="Password"
                  disabled={isLoading}
                  className={`block h-12 w-full rounded-xl border border-white/20 bg-white pl-11 pr-12 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                    form.formState.errors.password ? "border-blue-300 focus:border-blue-300 focus:ring-blue-300" : ""
                  }`}
                  {...form.register("password")}
                />
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-4 flex items-center transition-colors text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <div className="flex flex-col gap-2 pt-1.5">
                {form.formState.errors.password && (
                  <p className="flex items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-1 text-white font-medium whitespace-nowrap">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {form.formState.errors.password.message}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot-password");
                      setError(null);
                      setResetError(null);
                    }}
                    className="text-xs sm:text-sm font-semibold text-blue-200 transition-colors hover:text-white"
                    tabIndex={-1}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="relative mt-3 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In to ORCS"
              )}
            </button>
          </form>
            </>
          )}

          {view === "forgot-password" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white">Reset Password</h3>
                <p className="text-sm mt-1 text-red-100">
                  Enter your university email to receive a reset link.
                </p>
              </div>

              {resetError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl p-4 animate-in fade-in bg-red-50 border border-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm font-medium leading-snug text-red-800">
                    {resetError}
                  </p>
                </div>
              )}

              <form
                onSubmit={resetForm.handleSubmit(handleResetPassword)}
                className="space-y-6"
                noValidate
              >
                <div className="space-y-1.5">
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      placeholder="University Email"
                      aria-label="University Email"
                      disabled={isResetting}
                      className={`block h-12 w-full rounded-xl border border-white/20 bg-white px-4 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                        resetForm.formState.errors.email ? "border-blue-300 focus:border-blue-300 focus:ring-blue-300" : ""
                      }`}
                      {...resetForm.register("email")}
                    />
                  </div>
                  {resetForm.formState.errors.email && (
                    <p className="flex items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-1 text-white font-medium">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {resetForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isResetting}
                  className="relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-blue-200 transition-colors hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back to Login
                </button>
              </form>
            </div>
          )}

          {view === "forgot-password-success" && (
            <div className="animate-in zoom-in-95 duration-300 flex flex-col items-center text-center py-6">
              <div className="h-20 w-20 rounded-full flex items-center justify-center mb-5 bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Check Your Email</h3>

              <div className="rounded-xl p-5 mb-8 bg-gray-50 border border-gray-100">
                <p className="text-sm leading-relaxed mb-3 text-gray-600">
                  A password reset link has been sent to your registered email. Please check your inbox.
                </p>
                <p className="text-xs italic text-gray-400">
                  Sila semak peti masuk emel anda. Pautan set semula kata laluan telah dihantar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setView("login");
                  resetForm.reset();
                }}
                className="text-sm font-semibold text-blue-200 transition-colors hover:text-white"
              >
                Return to Login
              </button>
            </div>
          )}
      </div>
  );
}
