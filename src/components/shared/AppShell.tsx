"use client";

import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/shared/DashboardSidebar";
import { NotificationBell } from "@/components/shared/NotificationBell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarHiddenPaths = ["/login"];
  const hasSidebar = !sidebarHiddenPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!hasSidebar) {
    return (
      <div className="relative flex min-h-screen flex-col bg-slate-50">
        <NotificationBell />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 md:grid md:grid-cols-[320px_1fr]">
      <NotificationBell />
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}

