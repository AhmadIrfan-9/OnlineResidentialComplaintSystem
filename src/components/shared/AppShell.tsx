"use client";

import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/shared/DashboardSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarHiddenPaths = ["/login", "/admin", "/warden"];
  const hasSidebar = !sidebarHiddenPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!hasSidebar) {
    return <main className="min-h-screen bg-gradient-to-b from-slate-50 to-sky-50/40">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-sky-50/40 md:grid md:grid-cols-[260px_1fr]">
      <DashboardSidebar />
      <main className="pb-20 md:pb-0">{children}</main>
    </div>
  );
}
