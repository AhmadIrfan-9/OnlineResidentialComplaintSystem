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
    <div className="space-y-6">
      {children}
    </div>
  );
}

