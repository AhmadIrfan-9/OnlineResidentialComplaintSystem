import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

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
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-blue-600" />
            <span className="text-sm font-semibold text-slate-900">ORCS</span>
          </div>

          <nav className="hide-scrollbar flex max-w-full gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
            {session.user.name ?? "Admin Name"} ↓
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-3 md:p-6">{children}</section>
    </main>
  );
}

