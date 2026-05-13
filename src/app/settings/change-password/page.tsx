"use client";

import { useSession } from "next-auth/react";
import { ShieldAlert, Lock, ArrowRight } from "lucide-react";

export default function ChangePasswordPage() {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Security Update Required</h1>
          <p className="mt-2 text-slate-500">
            Hi {session?.user?.name || "User"}, for your security, you must change your password before continuing.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Account Security Status:</p>
            <div className="mt-2 flex items-center gap-2 text-amber-700">
              <Lock className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Temporary Password Active</span>
            </div>
          </div>

          <div className="pt-4">
             {/* This is a scaffold. In a real scenario, we'd have the form here. */}
             <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-400 font-medium italic">Change Password Form Placeholder</p>
                <p className="text-xs text-slate-300 mt-1">(Implementation of form logic requested separately)</p>
             </div>
          </div>

          <button 
            disabled 
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-200 font-bold text-slate-400 cursor-not-allowed"
          >
            Update Password
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          College of Computing and Informatics &nbsp;·&nbsp; UNITEN ORCS
        </p>
      </div>
    </div>
  );
}
