"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Lock, Eye, EyeOff, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

export default function ChangePasswordPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNew, setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [done, setDone]           = useState(false);

  // If password already changed, send user to their dashboard
  useEffect(() => {
    const user = session?.user as any;
    if (session && !user?.mustChangePassword) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const validate = (): string | null => {
    if (!newPw) return "New password is required.";
    if (newPw.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Za-z]/.test(newPw)) return "Password must contain at least one letter.";
    if (!/[0-9]/.test(newPw)) return "Password must contain at least one number.";
    if (newPw !== confirmPw) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPw, forceChange: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update password. Please try again.");
        return;
      }
      setDone(true);
      // Update session to clear mustChangePassword flag then redirect
      await update({ mustChangePassword: false });
      setTimeout(() => router.replace("/dashboard"), 1500);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 shadow-xl text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Password Updated</h1>
          <p className="mt-2 text-sm text-slate-500">Redirecting you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Security Update Required</h1>
          <p className="mt-2 text-sm text-slate-500">
            Hi {session?.user?.name || "User"}, your account was created with a temporary password.
            Please set a new secure password before continuing.
          </p>
        </div>

        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <Lock className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Temporary Password Active</span>
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-amber-600 pl-6 list-disc">
            <li>Minimum 8 characters</li>
            <li>At least one letter and one number</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 font-bold text-white shadow-md transition-all hover:from-sky-700 hover:to-blue-800 disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
            ) : (
              <><Lock className="h-4 w-4" /> Set New Password <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          College of Computing and Informatics · UNITEN ORCS
        </p>
      </div>
    </div>
  );
}
