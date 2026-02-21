"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  History,
  LayoutDashboard,
  Menu,
  SendHorizontal,
  UserCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Submit Complaint", href: "/student/new", icon: SendHorizontal },
  { label: "My History", href: "/complaints", icon: History },
  { label: "Profile", href: "/profile", icon: UserCircle2 },
];

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
};

function SidebarLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="space-y-1.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-200"
                : "text-slate-600 hover:-translate-y-0.5 hover:bg-sky-50 hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const hiddenPaths = ["/login", "/admin", "/warden"];

  if (hiddenPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null;
  }

  return (
    <>
      <aside className="hidden border-r border-slate-200/80 bg-white/85 backdrop-blur md:block">
        <div className="border-b border-slate-200/80 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            UNITEN CCI
          </p>
          <h1 className="mt-2 text-lg font-semibold text-slate-900">
            Residential Portal
          </h1>
        </div>
        <div className="px-3 py-4">
          <SidebarLinks pathname={pathname} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Residential Portal
          </h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation">
                <Menu className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="!top-0 !left-0 h-screen w-[280px] max-w-[280px] !translate-x-0 !translate-y-0 rounded-none border-r border-slate-200 bg-white/95 p-0 backdrop-blur">
              <DialogTitle className="sr-only">Navigation Menu</DialogTitle>
              <div className="border-b border-slate-200 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  UNITEN CCI
                </p>
                <h2 className="mt-2 text-base font-semibold text-slate-900">
                  Residential Portal
                </h2>
              </div>
              <div className="px-3 py-4">
                <SidebarLinks pathname={pathname} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
    </>
  );
}
