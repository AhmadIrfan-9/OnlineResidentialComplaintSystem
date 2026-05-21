"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
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
  Bot,
} from "lucide-react";
import { logoutAndRedirect } from "@/lib/client/logout";
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
      { label: "AI Assistant", href: "/admin/assistant", icon: Bot },
    ];
  }
  if (isManagementRole(role)) {
    return [
      { label: "Dashboard", href: "/warden/dashboard", icon: LayoutDashboard },
      { label: "Complaint Queue", href: "/warden/queue", icon: ClipboardList },
      { label: "Insights", href: "/warden/analytics", icon: Activity },
      { label: "Overview", href: "/warden/table", icon: FileText },
      { label: "AI Assistant", href: "/warden/assistant", icon: Bot },
    ];
  }
  if (isStudentRole(role)) {
    return [
      { label: "Overview", href: "/dashboard/student", icon: LayoutDashboard },
      { label: "Submit Complaint", href: "/complaints/new", icon: SendHorizontal },
      { label: "My History", href: "/complaints", icon: History },
      { label: "AI Assistant", href: "/dashboard/student/assistant", icon: Bot },
    ];
  }
  return [];
};

const isActivePath = (pathname: string, href: string): boolean => {
  return pathname === href;
};

function SidebarLinks({
  pathname,
  role,
  onLinkClick,
}: {
  pathname: string;
  role: string | undefined;
  onLinkClick?: () => void;
}) {
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
            onClick={onLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200/50"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Icon
              className={cn("h-4 w-4", isActive ? "text-sky-600" : "text-slate-400")}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton() {
  const [showModal, setShowModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirm = () => {
    setIsLoggingOut(true);
    logoutAndRedirect("manual");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 shadow-sm bg-[#dc2626] text-[#ffffff] hover:bg-[#b91c1c] hover:shadow-md"
      >
        <LogOut className="h-4 w-4 text-[#ffffff]" />
        <span>Sign Out</span>
      </button>

      {showModal && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="mb-2 text-lg font-bold text-slate-900">
                  Confirm Sign Out / Sahkan Log Keluar
                </h3>
                <p className="mb-6 text-sm text-slate-500">
                  Are you sure you want to end your session? / Adakah anda pasti ingin
                  menamatkan sesi ini?
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={isLoggingOut}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    No, Stay
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isLoggingOut}
                    className="rounded-lg bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-[#ffffff] shadow-sm transition-all hover:bg-[#b91c1c] hover:shadow-md disabled:opacity-50"
                  >
                    {isLoggingOut ? "Signing Out..." : "Yes, Sign Out"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hiddenPaths = ["/login"];
  if (
    hiddenPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  ) {
    return null;
  }

  return (
    <>
      {/* ── Desktop Sidebar (lg: 1024px and above) ─────────────────── */}
      <aside className="hidden flex-col border-r border-slate-200 bg-white lg:flex sticky top-0 h-[100dvh]">
        {/* Brand */}
        <div className="px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm">
              <Image
                src="/assets/logo-light.png"
                alt="ORCS"
                width={52}
                height={52}
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Online Residential
              </p>
              <h1 className="text-sm font-bold text-slate-900">Complaint System</h1>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <SidebarLinks pathname={pathname} role={role} />
        </div>
        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
          <LogoutButton />
        </div>
      </aside>

      {/* ── Mobile: Floating Hamburger FAB (bottom-left, <lg) ──────── */}
      <button
        type="button"
        id="mobile-nav-fab"
        aria-label="Open navigation menu"
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-5 left-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#003087] shadow-lg ring-2 ring-white/20 transition-transform hover:scale-105 active:scale-95 lg:hidden"
      >
        <Menu className="h-6 w-6 text-white" />
      </button>

      {/* ── Mobile Drawer (portal-rendered) ─────────────────────────── */}
      {typeof document !== "undefined" && drawerOpen
        ? createPortal(
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setDrawerOpen(false)}
                aria-hidden="true"
              />

              {/* Slide-in panel */}
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Navigation Menu"
                className="fixed inset-y-0 left-0 z-[9991] flex w-[300px] flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-300"
              >
                {/* Drawer header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200">
                      <Image
                        src="/assets/logo-light.png"
                        alt="ORCS"
                        width={28}
                        height={28}
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Online Residential
                      </p>
                      <p className="text-xs font-bold text-slate-900">
                        Complaint System
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close navigation menu"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Nav links — scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <SidebarLinks
                    pathname={pathname}
                    role={role}
                    onLinkClick={() => setDrawerOpen(false)}
                  />
                </div>

                {/* Sign Out — pinned at bottom */}
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                  <LogoutButton />
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
