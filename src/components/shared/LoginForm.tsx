"use client";

import { useState } from "react";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from "lucide-react";

const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, "Please enter your student email."),
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
  const router = useRouter();
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
        email: data.identifier.trim(),
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

      router.push("/");
      router.refresh();
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
    <>
      {/* Dark Glass Card */}

      <div className="flex flex-col items-center w-full">
        {/* Header - Natural Flow */}
        <div className="flex flex-col items-center text-center px-4 mb-10 sm:mb-12 w-screen sm:w-auto">
          <h1 className="whitespace-nowrap text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md leading-tight">
            Online Residential Complaint System
          </h1>
          <p className="mt-3 text-lg sm:text-xl font-medium drop-shadow-md text-white/95">
            Universiti Tenaga Nasional
          </p>
        </div>

        {/* Dark Glass Card */}
        <div className="w-full max-w-[420px] rounded-[20px] border border-white/10 bg-[#0f141e]/70 shadow-[0_40px_80px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl backdrop-saturate-150">
          {/* Form Body */}
          <div className="px-6 sm:px-10 py-8">
          {view === "login" && (
            <>
              {/* Session Timeout Warning Banner */}
              {sessionExpired && (
                <div className="mb-5 flex items-start gap-3 rounded-xl p-4 animate-in fade-in slide-in-from-top-1"
                  style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.30)" }}>
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#fcd34d" }} />
                  <p className="text-sm font-medium leading-snug" style={{ color: "#fde68a" }}>
                    Security Notice: Your session has timed out. Please log in to continue.
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl p-4 animate-in fade-in"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.30)" }}>
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#fca5a5" }} />
                  <p className="text-sm font-medium leading-snug" style={{ color: "#fca5a5" }}>
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
            <div className="space-y-1.5">
              <label
                htmlFor="identifier"
                className="block text-sm font-semibold text-white/80"
              >
                Student Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                  <Mail className="h-5 w-5 transition-colors" style={{ color: "rgba(255,255,255,0.38)" }} />
                </div>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g StudentID@uniten.edu.my"
                  disabled={isLoading}
                  className={`block h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-5 text-sm text-slate-100 transition-all placeholder:text-white/30 focus:border-red-400/75 focus:bg-white/10 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.18),0_2px_8px_rgba(0,0,0,0.25)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                    form.formState.errors.identifier
                      ? "border-red-400/50"
                      : ""
                  }`}
                  {...form.register("identifier")}
                />
              </div>
              {form.formState.errors.identifier && (
                <p className="flex items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-1" style={{ color: "#fca5a5" }}>
                  <AlertCircle className="h-3.5 w-3.5" />
                  {form.formState.errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-white/80"
              >
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                  <Lock className="h-5 w-5 transition-colors" style={{ color: "rgba(255,255,255,0.38)" }} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className={`block h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-12 text-sm text-slate-100 transition-all placeholder:text-white/30 focus:border-red-400/75 focus:bg-white/10 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.18),0_2px_8px_rgba(0,0,0,0.25)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                    form.formState.errors.password ? "border-red-400/50" : ""
                  }`}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-4 flex items-center transition-colors"
                  style={{ color: "rgba(255,255,255,0.38)" } as React.CSSProperties}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex-1">
                  {form.formState.errors.password && (
                    <p className="flex items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-1" style={{ color: "#fca5a5" }}>
                      <AlertCircle className="h-3.5 w-3.5" />
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setView("forgot-password");
                    setError(null);
                    setResetError(null);
                  }}
                  className="text-xs sm:text-sm font-medium text-red-300/90 transition-colors hover:text-white hover:underline underline-offset-2 shrink-0 ml-3"
                  tabIndex={-1}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="relative mt-3 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-red-700 to-red-600 text-sm font-bold text-white transition-all hover:-translate-y-[2px] hover:shadow-[0_14px_36px_rgba(220,38,38,0.55)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
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
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.50)" }}>
                  Enter your university email to receive a reset link.
                </p>
              </div>

              {resetError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl p-4 animate-in fade-in"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.30)" }}>
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#fca5a5" }} />
                  <p className="text-sm font-medium leading-snug" style={{ color: "#fca5a5" }}>
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
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-white/80"
                  >
                    University Email
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                      <Mail className="h-5 w-5 transition-colors" style={{ color: "rgba(255,255,255,0.38)" }} />
                    </div>
                    <input
                      id="email"
                      type="email"
                      placeholder="e.g. name@uniten.edu.my"
                      disabled={isResetting}
                      className={`block h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-5 text-sm text-slate-100 transition-all placeholder:text-white/30 focus:border-red-400/75 focus:bg-white/10 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.18),0_2px_8px_rgba(0,0,0,0.25)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                        resetForm.formState.errors.email ? "border-red-400/50" : ""
                      }`}
                      {...resetForm.register("email")}
                    />
                  </div>
                  {resetForm.formState.errors.email && (
                    <p className="flex items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-1" style={{ color: "#fca5a5" }}>
                      <AlertCircle className="h-3.5 w-3.5" />
                      {resetForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isResetting}
                  className="relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-red-700 to-red-600 text-sm font-bold text-white transition-all hover:-translate-y-[2px] hover:shadow-[0_14px_36px_rgba(220,38,38,0.55)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-medium text-red-300/90 transition-colors hover:text-white hover:underline"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back to Login
                </button>
              </form>
            </div>
          )}

          {view === "forgot-password-success" && (
            <div className="animate-in zoom-in-95 duration-300 flex flex-col items-center text-center py-6">
              <div className="h-20 w-20 rounded-full flex items-center justify-center mb-5"
                style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.35)" }}>
                <CheckCircle2 className="h-10 w-10" style={{ color: "#6ee7b7" }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Check Your Email</h3>

              <div className="rounded-xl p-5 mb-8"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>
                  A password reset link has been sent to your registered email. Please check your inbox.
                </p>
                <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.40)" }}>
                  Sila semak peti masuk emel anda. Pautan set semula kata laluan telah dihantar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setView("login");
                  resetForm.reset();
                }}
                className="text-sm font-bold text-red-300/90 transition-colors hover:text-white hover:underline"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>
        </div>

        {/* Footer - Below Card */}
        <div className="mt-8 text-center z-50">
          <p className="text-sm font-medium text-white/90 drop-shadow-md">
            IT Support:{" "}
            <a
              href="mailto:OCRSsupport@uniten.edu.my"
              className="font-bold text-white transition-colors hover:underline"
            >
              OCRSsupport@uniten.edu.my
            </a>
          </p>
          <p className="mt-1 text-xs font-medium text-white/80 drop-shadow-md" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} Universiti Tenaga Nasional
          </p>
        </div>
      </div>

      {/* Floating Logos - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50 hidden sm:flex items-center gap-4">
        <div className="transition-transform hover:scale-105">
          <Image
            src="/assets/UNITENLOGO.png"
            alt="UNITEN Logo"
            width={120}
            height={64}
            className="object-contain drop-shadow-xl"
            priority
          />
        </div>
        <div className="transition-transform hover:scale-105">
          <Image
            src="/assets/logo-light.png"
            alt="ORCS Logo"
            width={64}
            height={64}
            className="object-contain drop-shadow-xl"
            priority
          />
        </div>
      </div>
    </>
  );
}
