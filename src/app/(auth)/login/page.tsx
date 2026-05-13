import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/shared/LoginForm";
import { dashboardPathByRole } from "@/lib/roles";

export const metadata = {
  title: "Sign In | ORCS — UNITEN",
  description:
    "Sign in to the Online Residential Complaint System — Universiti Tenaga Nasional.",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(dashboardPathByRole(session.user.role));
  }

  return (
    <>
      <style>{`
        .login-bg {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          position: relative;
          overflow: hidden;
          background-image: url('/assets/loginbg.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        /* Dark overlay to dim the photo */
        .login-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.52);
          z-index: 0;
        }

        .login-card-wrap {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 460px;
        }
      `}</style>

      <div className="login-bg font-sans">
        <div className="login-card-wrap">
          <LoginForm />
        </div>
      </div>
    </>
  );
}
