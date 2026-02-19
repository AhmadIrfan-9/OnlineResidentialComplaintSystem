import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/shared/AuthProvider";
import { DashboardSidebar } from "@/components/shared/DashboardSidebar";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <AuthProvider>
          <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
            <DashboardSidebar />

            <main className="pb-20 md:pb-0">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
