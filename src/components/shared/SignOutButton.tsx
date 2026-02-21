"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ label }: { label?: string }) {
  return (
    <button
      type="button"
      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {label ?? "Logout"}
    </button>
  );
}
