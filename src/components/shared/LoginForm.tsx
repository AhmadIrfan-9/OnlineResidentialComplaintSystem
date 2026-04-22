"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, "Please enter your institutional email or student ID."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
        setError(
          result?.error ||
            "Authentication failed. Please verify your credentials and try again."
        );
        setIsLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
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
        <div className="flex flex-col items-center px-8 pt-8 pb-6 text-center border-b border-slate-100">
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
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure institutional login
          </div>
        </div>

        {/* Form Body */}
        <div className="px-8 py-7">
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
                className="block text-sm font-semibold text-slate-700"
              >
                Institutional Email or Student ID
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                  <Mail className="input-icon h-4 w-4 text-slate-400 transition-colors" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. name@uniten.edu.my or MM12345"
                  disabled={isLoading}
                  className={`orcs-input block h-12 w-full rounded-xl border pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                    form.formState.errors.identifier
                      ? "border-red-300 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                  {...form.register("identifier")}
                />
              </div>
              {form.formState.errors.identifier && (
                <p className="field-error flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {form.formState.errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>
                <Link
                  href="/login"
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 transition-colors"
                  tabIndex={-1}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                  <Lock className="input-icon h-4 w-4 text-slate-400 transition-colors" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className={`orcs-input block h-12 w-full rounded-xl border pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ${
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
                  className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="field-error flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="orcs-btn mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-800 to-blue-700 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              style={{ background: isLoading ? undefined : "linear-gradient(135deg, #003087 0%, #1d4ed8 100%)" }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In to ORCS"
              )}
            </button>
          </form>
        </div>

        {/* Card Footer */}
        <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-8 py-4 text-center">
          <p className="text-xs text-slate-500">
            For IT support, contact{" "}
            <a
              href="mailto:itsupport@uniten.edu.my"
              className="font-medium text-blue-700 hover:underline"
            >
              itsupport@uniten.edu.my
            </a>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Universiti Tenaga Nasional. All
            rights reserved.
          </p>
        </div>
      </div>
    </>
  );
}
