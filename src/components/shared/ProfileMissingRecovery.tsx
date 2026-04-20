"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, LogOut } from "lucide-react";
import { logoutAndRedirect } from "@/lib/client/logout";

interface ProfileMissingRecoveryProps {
  userName?: string;
}

export function ProfileMissingRecovery({ userName }: ProfileMissingRecoveryProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Status badge */}
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Account Setup Required
          </span>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-red-200 bg-white shadow-lg">
          <div className="border-b border-red-100 bg-red-50 px-6 py-5 rounded-t-2xl">
            <h1 className="text-lg font-bold text-red-900">
              Student Profile Not Found
            </h1>
            {userName && (
              <p className="mt-1 text-sm text-red-700">
                Signed in as <span className="font-semibold">{userName}</span>
              </p>
            )}
          </div>

          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              Your account does not have a linked student profile. This is
              required before you can access the portal. You can either set up
              your profile now, or sign out and contact management.
            </p>

            {/* Primary CTA */}
            <Link
              href="/profile"
              id="setup-profile-link"
              className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-medium text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <span>Set Up My Student Profile</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400">or</span>
              </div>
            </div>

            {/* Emergency logout */}
            <button
              type="button"
              id="emergency-signout-btn"
              onClick={() => void logoutAndRedirect("manual")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>

            {/* Fallback hard-link in case JS fails */}
            <p className="text-center text-xs text-slate-400">
              If the button above doesn&apos;t work,{" "}
              <a
                href="/api/auth/signout"
                className="text-blue-600 underline hover:text-blue-800"
              >
                click here to force sign out
              </a>
            </p>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-4 text-center text-xs text-slate-400">
          UNITEN CCI &middot; Residential Complaint Portal
        </p>
      </div>
    </main>
  );
}
