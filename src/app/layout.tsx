import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { LayoutDashboard, FileText, PlusCircle } from "lucide-react";
import { AuthProvider } from "@/components/shared/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Student Complaint System",
  description: "Online residential complaint management system",
};

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Complaints",
    href: "/complaints",
    icon: FileText,
  },
  {
    label: "New Complaint",
    href: "/complaints/new",
    icon: PlusCircle,
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 antialiased`}
      >
        <AuthProvider>
          <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
            <aside className="hidden border-r border-slate-200 bg-white md:block">
              <div className="px-6 py-5">
                <h1 className="text-lg font-semibold text-slate-900">
                  Student Complaint
                </h1>
              </div>
              <nav className="space-y-1 px-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>

            <main className="pb-20 md:pb-0">{children}</main>

            <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white md:hidden">
              <div className="grid grid-cols-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
