"use client";

import { useState } from "react";
import Link from "next/link";
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
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from "lucide-react";

const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, "Please enter your institutional email or student ID."),
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
    } catch (err: any) {
      if (err?.type === "CredentialsSignin" || err?.message?.includes("CredentialsSignin")) {
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
      {/* Inject focus-glow micro-interaction styles */}
      <style>{`
        .orcs-input {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }
        .orcs-input:focus {
          outline: none;
          border-color: #1d4ed8;
          background-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12), 0 1px 3px rgba(0,0,0,0.06);
        }
        .orcs-input:focus + .input-icon {
          color: #1d4ed8;
        }
        .orcs-btn {
          position: relative;
          overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .orcs-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .orcs-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(0, 48, 135, 0.35);
        }
        .orcs-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .field-error {
          animation: slideIn 0.2s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .error-banner {
          animation: shakeIn 0.3s ease;
        }
        @keyframes shakeIn {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-4px); }
          40%,80% { transform: translateX(4px); }
        }
      `}</style>

      {/* Card */}
      <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80">
        {/* Card Header */}
        <div className="flex flex-col items-center px-4 sm:px-8 pt-8 pb-6 text-center border-b border-slate-100">
          {/* UNITEN Logo */}
          <div className="mb-5 flex items-center justify-center rounded-2xl bg-white p-3 shadow-md ring-1 ring-slate-100">
            <Image
              src="/assets/logo-light.png"
              alt="UNITEN Logo"
              width={72}
              height={72}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Online Residential Complaint System
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Universiti Tenaga Nasional &mdash; CCI Portal
          </p>

          {/* Security badge */}
          {view === "login" && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure institutional login
            </div>
          )}
        </div>

        {/* Form Body */}
        <div className="px-4 sm:px-8 py-7">
          {view === "login" && (
            <>
              {/* Session Timeout Warning Banner */}
              {sessionExpired && (
                <div className="field-error mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <p className="text-sm font-medium leading-snug text-amber-800">
                    Security Notice: Your session has timed out. Please log in to continue.
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="error-banner mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                  <p className="text-sm font-medium leading-snug text-red-700">
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
                className="block text-base sm:text-lg font-semibold text-slate-700"
              >
                Institutional Email or Student ID
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                  <Mail className="input-icon h-5 w-5 text-slate-400 transition-colors" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. name@uniten.edu.my or MM12345"
                  disabled={isLoading}
                  className={`orcs-input block h-14 sm:h-16 w-full rounded-xl border pl-12 pr-5 text-base sm:text-lg text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                    form.formState.errors.identifier
                      ? "border-red-300 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                  {...form.register("identifier")}
                />
              </div>
              {form.formState.errors.identifier && (
                <p className="field-error flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {form.formState.errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-base sm:text-lg font-semibold text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setView("forgot-password");
                    setError(null);
                    setResetError(null);
                  }}
                  className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 transition-colors"
                  tabIndex={-1}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                  <Lock className="input-icon h-5 w-5 text-slate-400 transition-colors" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className={`orcs-input block h-14 sm:h-16 w-full rounded-xl border pl-12 pr-12 text-base sm:text-lg text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                    form.formState.errors.password
                      ? "border-red-300 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="field-error flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="orcs-btn mt-2 flex h-14 sm:h-16 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-800 to-blue-700 text-lg sm:text-xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
              style={{ background: isLoading ? undefined : "linear-gradient(135deg, #003087 0%, #1d4ed8 100%)" }}
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
                <h3 className="text-xl font-bold text-slate-900">Reset Password</h3>
                <p className="text-base text-slate-500 mt-1">
                  Enter your university email to receive a reset link.
                </p>
              </div>

              {resetError && (
                <div className="error-banner mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                  <p className="text-sm font-medium leading-snug text-red-700">
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
                    className="block text-base sm:text-lg font-semibold text-slate-700"
                  >
                    University Email
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                      <Mail className="input-icon h-5 w-5 text-slate-400 transition-colors" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      placeholder="e.g. name@uniten.edu.my"
                      disabled={isResetting}
                      className={`orcs-input block h-14 sm:h-16 w-full rounded-xl border pl-12 pr-5 text-base sm:text-lg text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                        resetForm.formState.errors.email
                          ? "border-red-300 bg-red-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                      {...resetForm.register("email")}
                    />
                  </div>
                  {resetForm.formState.errors.email && (
                    <p className="field-error flex items-center gap-1.5 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      {resetForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isResetting}
                  className="orcs-btn mt-2 flex h-14 sm:h-16 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-800 to-blue-700 text-lg sm:text-xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ background: isResetting ? undefined : "linear-gradient(135deg, #003087 0%, #1d4ed8 100%)" }}
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
                  className="mt-5 flex w-full items-center justify-center gap-2 text-base font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back to Login
                </button>
              </form>
            </div>
          )}

          {view === "forgot-password-success" && (
            <div className="animate-in zoom-in-95 duration-300 flex flex-col items-center text-center py-6">
              <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h3>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
                <p className="text-base text-slate-700 leading-relaxed mb-3">
                  A password reset link has been sent to your registered email. Please check your inbox.
                </p>
                <p className="text-sm text-slate-500 italic">
                  Sila semak peti masuk emel anda. Pautan set semula kata laluan telah dihantar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setView("login");
                  resetForm.reset();
                }}
                className="text-base font-bold text-blue-700 hover:text-blue-900 transition-colors"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-4 sm:px-8 py-4 text-center">
          <p className="text-xs text-slate-500">
            For IT support, contact{" "}
            <a
              href="mailto:itsupport@uniten.edu.my"
              className="font-medium text-blue-700 hover:underline"
            >
              itsupport@uniten.edu.my
            </a>
          </p>
          <p className="mt-1 text-xs text-slate-400" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} Universiti Tenaga Nasional. All
            rights reserved.
          </p>
        </div>
      </div>
    </>
  );
}
