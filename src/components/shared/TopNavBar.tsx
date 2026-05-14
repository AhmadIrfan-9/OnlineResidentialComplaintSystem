"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";
import {
  Bell,
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
  X,
  ChevronDown,
  Loader2,
  UserCog,
  Eye,
  EyeOff,
} from "lucide-react";
import { logoutAndRedirect } from "@/lib/client/logout";
import { cn } from "@/lib/utils";
import { isAdminRole, isManagementRole, isStudentRole } from "@/lib/roles";

// ─── Brand colour ────────────────────────────────────────────────────────────
const NAVY = "#dc2626";

// ─── Role-based nav items ─────────────────────────────────────────────────────
type NavItem = { label: string; href: string; icon: React.ElementType };

const getNavItems = (role: string | undefined): NavItem[] => {
  if (isAdminRole(role)) {
    return [
      { label: "System Health",    href: "/admin",                icon: Activity       },
      { label: "Configuration",    href: "/admin/configuration",  icon: Settings       },
      { label: "User Management",  href: "/admin/users",          icon: Users          },
      { label: "Audit Logs",       href: "/admin/audit-logs",     icon: FileText       },
      { label: "Reports",          href: "/admin/reports",        icon: BarChart3      },
    ];
  }
  if (isManagementRole(role)) {
    return [
      { label: "Dashboard",           href: "/warden/dashboard",  icon: LayoutDashboard },
      { label: "Complaint Queue",     href: "/warden/queue",      icon: ClipboardList   },
      { label: "Insights",             href: "/warden/analytics",  icon: Activity        },
      { label: "Overview",             href: "/warden/table",      icon: FileText        },
    ];
  }
  if (isStudentRole(role)) {
    return [
      { label: "Home",             href: "/dashboard/student",   icon: LayoutDashboard },
      { label: "Submit Complaint", href: "/complaints/new",      icon: SendHorizontal  },
      { label: "My History",       href: "/complaints",          icon: History         },
      { label: "Profile",          href: "/profile",             icon: UserCircle2     },
    ];
  }
  return [];
};

const isActive = (pathname: string, href: string) => pathname === href;

// ─── Sign-out confirmation modal ──────────────────────────────────────────────
function SignOutModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const handleConfirm = () => {
    setBusy(true);
    logoutAndRedirect("manual");
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="mb-2 text-lg font-bold text-slate-900">
          Confirm Sign Out / Sahkan Log Keluar
        </h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to end your session? / Adakah anda pasti ingin menamatkan sesi ini?
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            No, Stay
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-all"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing Out…
              </>
            ) : (
              "Yes, Sign Out"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Notification bell (embedded in nav) ─────────────────────────────────────
type NotificationItem = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  complaintId: string;
};

function NavNotificationBell({ session }: { session: any }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const socketBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001",
    []
  );
  const unreadCount = useMemo(() => items.filter((i) => !i.isRead).length, [items]);

  // Fetch on mount + poll
  useEffect(() => {
    let active = true;
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setItems(data.notifications ?? []);
      } catch {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Socket.io live updates
  useEffect(() => {
    if (!session?.user?.id) return;
    const socket: Socket = io(socketBaseUrl, {
      transports: ["websocket", "polling"],
      auth: { userId: session.user.id, role: session.user.role },
    });
    socket.on("notification:new", (n: NotificationItem) => {
      setItems((prev) => prev.some((i) => i.id === n.id) ? prev : [n, ...prev]);
    });
    return () => { socket.disconnect(); };
  }, [session?.user?.id, session?.user?.role, socketBaseUrl]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toComplaintPath = (complaintId: string) => {
    const role = String(session?.user?.role ?? "").toUpperCase();
    if (role === "STUDENT") return `/complaints/${complaintId}`;
    if (role === "MANAGEMENT" || role === "IT_STAFF_ADMIN") return `/warden/complaints/${complaintId}`;
    return `/complaints/${complaintId}`;
  };

  const onClickItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isRead: true } : i));
      await fetch(`/api/notifications/${item.id}/read`, { method: "PATCH" });
    }
    setOpen(false);
    router.push(toComplaintPath(item.complaintId));
    router.refresh();
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-400 ring-1 ring-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[340px] max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-400 italic">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onClickItem(item)}
                  className="w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <p className={cn("text-sm text-slate-800", !item.isRead && "font-semibold")}>
                    {item.message}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Settings Modal ───────────────────────────────────────────────────
function ProfileSettingsModal({
  session,
  onClose,
}: {
  session: any;
  onClose: () => void;
}) {
  const { update } = useSession();
  const router = useRouter();
  // Profile fields
  const [name, setName] = useState<string>(session?.user?.name ?? "");
  const [phone, setPhone] = useState<string>(session?.user?.phone ?? "");
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password fields
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const handleProfileSave = async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ text: data.error ?? "Update failed", ok: false });
      } else {
        setProfileMsg({ text: "Profile updated successfully.", ok: true });
        await update({ name: name.trim() });
        router.refresh();
      }
    } catch {
      setProfileMsg({ text: "Network error. Please try again.", ok: false });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg({ text: "Please fill in all password fields.", ok: false });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: "New passwords do not match.", ok: false });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ text: "New password must be at least 6 characters.", ok: false });
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ text: data.error ?? "Password update failed", ok: false });
      } else {
        setPwMsg({ text: "Password changed successfully.", ok: true });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      }
    } catch {
      setPwMsg({ text: "Network error. Please try again.", ok: false });
    } finally {
      setSavingPw(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Profile Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ── Profile Section ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Account Details
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Email</label>
              <input
                type="text"
                value={session?.user?.email ?? ""}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0123456789"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {profileMsg && (
              <p className={`text-xs font-semibold ${profileMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {profileMsg.text}
              </p>
            )}

            <button
              type="button"
              onClick={handleProfileSave}
              disabled={savingProfile}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {savingProfile ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : "Save Profile"}
            </button>
          </section>

          <div className="border-t border-slate-100" />

          {/* ── Password Section ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Change Password
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {pwMsg && (
              <p className={`text-xs font-semibold ${pwMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {pwMsg.text}
              </p>
            )}

            <button
              type="button"
              onClick={handlePasswordSave}
              disabled={savingPw}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
            >
              {savingPw ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
              ) : "Change Password"}
            </button>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Profile / User avatar dropdown ──────────────────────────────────────────
function ProfileDropdown({ session }: { session: any }) {
  const [open, setOpen] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const name: string = session?.user?.name ?? session?.user?.email ?? "User";
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 pl-1 pr-2.5 py-1 text-white transition-colors"
          aria-label="User menu"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] font-black text-[#003366]">
            {initial}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150">
            {/* User info header */}
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
              <p className="text-[11px] text-slate-400 truncate">{session?.user?.email}</p>
            </div>
            {/* Profile Settings entry */}
            <button
              type="button"
              onClick={() => { setOpen(false); setShowProfile(true); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <UserCog className="h-4 w-4 text-slate-400" />
              Profile Settings
            </button>
            {/* Sign out entry */}
            <button
              type="button"
              onClick={() => { setOpen(false); setShowSignOut(true); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {showSignOut && <SignOutModal onClose={() => setShowSignOut(false)} />}
      {showProfile && <ProfileSettingsModal session={session} onClose={() => setShowProfile(false)} />}
    </>
  );
}

// ─── Main TopNavBar component ─────────────────────────────────────────────────
const HIDDEN_PATHS = ["/login"];

export function TopNavBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const navItems = getNavItems(role);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hide on auth pages
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const userName: string = session?.user?.name ?? session?.user?.email ?? "";

  return (
    <>
      {/* ── Fixed top bar ───────────────────────────────────────────────────── */}
      <header
        className="fixed inset-x-0 top-0 z-50 h-16 shadow-md"
        style={{ backgroundColor: NAVY }}
      >
        <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-4 px-4 md:px-6">

          {/* Left: Logo + Brand */}
          <Link href="/" className="flex flex-shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 p-1">
              <Image
                src="/assets/logo-light.png"
                alt="UNITEN ORCS"
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                Online Residential
              </p>
              <p className="text-sm font-bold text-white">Complaint System</p>
            </div>
          </Link>

          {/* Centre: Desktop Nav Links */}
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-semibold transition-colors duration-150",
                    active ? "text-white" : "text-white/65 hover:text-white"
                  )}
                >
                  {item.label}
                  {/* Active bottom indicator */}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-white" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Spacer on mobile so right cluster stays right */}
          <div className="flex-1 lg:hidden" />

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            {status === "authenticated" && session?.user && (
              <>
                <NavNotificationBell session={session} />
                <ProfileDropdown session={session} />
              </>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer (portal) ───────────────────────────────────────────── */}
      {typeof document !== "undefined" && mobileOpen
        ? createPortal(
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[9990] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
              />

              {/* Slide-in panel */}
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                className="fixed inset-y-0 right-0 z-[9991] flex w-72 flex-col shadow-2xl animate-in slide-in-from-right duration-300"
                style={{ backgroundColor: NAVY }}
              >
                {/* Drawer header */}
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 p-1">
                      <Image src="/assets/logo-light.png" alt="ORCS" width={24} height={24} className="object-contain" />
                    </div>
                    <p className="text-sm font-bold text-white">Complaint System</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* User info */}
                {status === "authenticated" && (
                  <div className="border-b border-white/10 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-base font-black text-[#003366]">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{userName}</p>
                        <p className="truncate text-[11px] text-white/50">{session?.user?.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Nav links */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                  {navItems.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                          active
                            ? "bg-white/15 text-white"
                            : "text-white/65 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", active ? "text-white" : "text-white/50")} />
                        {item.label}
                        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                      </Link>
                    );
                  })}
                </nav>

                {/* Sign out at bottom */}
                <div className="border-t border-white/10 p-4">
                  <SignOutTrigger />
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}

// Small helper that triggers sign-out modal from the mobile drawer
function SignOutTrigger() {
  const [show, setShow] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-300 hover:bg-white/10 hover:text-red-200 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
      {show && <SignOutModal onClose={() => setShow(false)} />}
    </>
  );
}
