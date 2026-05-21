"use client";

import { usePathname } from "next/navigation";
import { TopNavBar } from "@/components/shared/TopNavBar";

/** Paths on which we suppress the nav entirely (e.g. login). */
const NAV_HIDDEN_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = NAV_HIDDEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (hideNav) {
    return (
      <div className="relative flex min-h-screen flex-col bg-slate-50">
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50">
      {/* Fixed top navigation bar */}
      <TopNavBar />

      {/* Content pushed below the 64 px nav bar */}
      <div className="flex flex-1 flex-col pt-16">
        {/* Page content */}
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto max-w-screen-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
