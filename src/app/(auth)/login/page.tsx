import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/shared/LoginForm";
import { dashboardPathByRole } from "@/lib/roles";
import Image from "next/image";
import {
  ClipboardList,
  Clock,
  BarChart2,
  ShieldCheck,
} from "lucide-react";

export const metadata = {
  title: "Sign In | ORCS — UNITEN",
  description:
    "Sign in to the Online Residential Complaint System — Universiti Tenaga Nasional.",
};

const features = [
  {
    icon: ClipboardList,
    title: "Submit & Track Complaints",
    desc: "Log issues with supporting evidence and follow them in real time.",
  },
  {
    icon: Clock,
    title: "SLA-Monitored Workflows",
    desc: "Automatic escalation ensures every ticket is resolved on schedule.",
  },
  {
    icon: BarChart2,
    title: "Performance Analytics",
    desc: "Deep-dive dashboards for management and administrative review.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access Control",
    desc: "Secure separation of student, warden, and admin capabilities.",
  },
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(dashboardPathByRole(session.user.role));
  }

  return (
    <div className="flex min-h-screen font-sans">
      {/* ─── LEFT PANEL (decorative / brand) ─────────────────────── */}
      <div
        className="relative hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, #001f5c 0%, #003087 40%, #0f4c9e 75%, #0e6aad 100%)",
        }}
      >
        {/* Subtle background image overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "url('/assets/login-bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Geometric accent circles */}
        <div
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 -left-24 h-80 w-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #e05c2a 0%, transparent 70%)" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          {/* Brand header */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20">
                <Image
                  src="/assets/logo-light.png"
                  alt="UNITEN"
                  width={34}
                  height={34}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-white/90">
                  Universiti Tenaga Nasional
                </p>
                <p className="text-xs text-white/50">The Energy University</p>
              </div>
            </div>
          </div>

          {/* Hero text */}
          <div>
            <div className="mb-2 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
              CCI Portal &nbsp;·&nbsp; Est. 2025
            </div>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
              Online Residential
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #7dd3fc, #93c5fd)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Complaint System
              </span>
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-white/60">
              A unified, intelligent platform for students, wardens, and
              administrators to manage hostel issues with full transparency.
            </p>

            {/* Feature list */}
            <ul className="mt-8 space-y-4">
              {features.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15 backdrop-blur">
                    <Icon className="h-4 w-4 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs leading-relaxed text-white/50">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom divider */}
          <div className="border-t border-white/10 pt-6 text-xs text-white/35">
            College of Computing and Informatics &nbsp;·&nbsp; Faculty Systems Division
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL (login form) ─────────────────────────────── */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10"
        style={{
          background:
            "linear-gradient(160deg, #f0f4ff 0%, #f8faff 50%, #eef2ff 100%)",
        }}
      >
        {/* Subtle dot grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, #c7d2fe 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Mobile brand bar (shown only on small screens) */}
        <div className="relative z-10 mb-8 flex items-center gap-3 lg:hidden">
          <Image
            src="/assets/logo-light.png"
            alt="UNITEN"
            width={44}
            height={44}
            className="object-contain"
          />
          <div>
            <p className="text-sm font-bold text-slate-800">UNITEN ORCS</p>
            <p className="text-xs text-slate-500">Residential Portal</p>
          </div>
        </div>

        {/* Form card */}
        <div className="relative z-10 w-full max-w-xl">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
