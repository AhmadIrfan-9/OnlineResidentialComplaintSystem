"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  SendHorizontal,
  UserCircle2,
  ClipboardList,
  BarChart3,
  Activity,
  Settings,
  Users,
  FileText,
} from "lucide-react";
import { logoutAndRedirect } from "@/lib/client/logout";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isAdminRole, isManagementRole, isStudentRole } from "@/lib/roles";

const getNavItems = (role: string | undefined) => {
  if (isAdminRole(role)) {
    return [
      { label: "System Health", href: "/admin", icon: Activity },
      { label: "Configuration", href: "/admin/configuration", icon: Settings },
      { label: "User Management", href: "/admin/users", icon: Users },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
      { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    ];
  }
  if (isManagementRole(role)) {
    return [
      { label: "Dashboard", href: "/warden/dashboard", icon: LayoutDashboard },
      { label: "Complaint Queue", href: "/warden/queue", icon: ClipboardList },
      { label: "Reports", href: "/warden/reports", icon: BarChart3 },
      { label: "Analytics", href: "/warden/analytics", icon: Activity },
    ];
  }
  if (isStudentRole(role)) {
    return [
      { label: "Overview", href: "/dashboard/student", icon: LayoutDashboard },
      { label: "Submit Complaint", href: "/complaints/new", icon: SendHorizontal },
      { label: "My History", href: "/complaints", icon: History },
      { label: "Profile", href: "/profile", icon: UserCircle2 },
    ];
  }
  return [];
};

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/dashboard/student" || href === "/warden/dashboard" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};

function SidebarLinks({ pathname, role }: { pathname: string; role: string | undefined }) {
  const items = getNavItems(role);

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200/50"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-sky-600" : "text-slate-400")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const hiddenPaths = ["/login"];
  if (hiddenPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null;
  }

  const brand = (
    <div className="px-6 py-8">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-xs font-bold text-white">
          ORCS
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            UNITEN CCI
          </p>
          <h1 className="text-sm font-bold text-slate-900">
            Residential Portal
          </h1>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden flex-col border-r border-slate-200 bg-white md:flex">
        {brand}
        <div className="flex flex-1 flex-col justify-between px-4 pb-6">
          <SidebarLinks pathname={pathname} role={role} />
          <div className="mt-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => void logoutAndRedirect("manual")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4 text-slate-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-sky-600 text-[10px] font-bold text-white">
              O
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              Residential Portal
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5 text-slate-600" />
                </Button>
              </DialogTrigger>
              <DialogContent className="!top-0 !left-0 flex h-screen w-[280px] max-w-[280px] !translate-x-0 !translate-y-0 flex-col rounded-none border-none bg-white p-0 shadow-2xl">
                <DialogTitle className="sr-only">Navigation Menu</DialogTitle>
                {brand}
                <div className="flex flex-1 flex-col justify-between px-4 pb-8">
                  <SidebarLinks pathname={pathname} role={role} />
                  <div className="mt-4 border-t border-slate-100 pt-6">
                    <button
                      type="button"
                      onClick={() => void logoutAndRedirect("manual")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
                    >
                      <LogOut className="h-4 w-4 text-slate-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
    </>
  );
}

