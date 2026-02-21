import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { SignOutButton } from "@/components/shared/SignOutButton";

const navItems = [
  { label: "System Health", href: "/admin" },
  { label: "Configuration", href: "/admin/configuration" },
  { label: "User Management", href: "/admin/users" },
  { label: "Audit Logs", href: "/admin/audit-logs" },
  { label: "Reports", href: "/admin/reports" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-gradient-to-br from-sky-500 to-blue-700" />
            <span className="text-sm font-semibold text-slate-900">ORCS</span>
          </div>

          <nav className="hide-scrollbar flex max-w-full gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-pill px-3 py-1.5"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <SignOutButton label={`${session.user.name ?? "Admin"} | Logout`} />
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-3 md:p-6">{children}</section>
    </main>
  );
}
