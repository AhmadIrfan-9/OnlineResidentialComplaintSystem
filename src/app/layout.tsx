import type { Metadata } from "next";
import { AuthProvider } from "@/components/shared/AuthProvider";
import { AppShell } from "@/components/shared/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Student Complaint System",
  description: "Online residential complaint management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-slate-50">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
