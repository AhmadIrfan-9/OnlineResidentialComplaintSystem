import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/shared/LoginForm";
import { TypewriterTitle } from "@/components/shared/TypewriterTitle";
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
    <div className="relative h-screen w-full flex flex-col lg:flex-row font-sans overflow-hidden bg-gray-50">
      {/* Background Image Layer (Full Screen) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/assets/loginbg.jpg')" }}
        ></div>

        <div className="absolute inset-0 bg-black/15 z-10"></div>
      </div>

      {/* Left Side / Top Side - Branding Content */}
      <div className="relative z-10 w-full lg:w-[55%] flex flex-col justify-between p-8 pb-6 lg:p-14 lg:pb-10 min-h-[40vh] lg:min-h-screen">
        {/* Top Header Content */}
        <div className="pt-4 lg:pt-8">
          <h1 className="text-3xl sm:text-4xl lg:text-[clamp(2.5rem,4.5vw,4.25rem)] font-black tracking-tight drop-shadow-2xl leading-[1.05] max-w-[95%] uppercase">
            <TypewriterTitle 
              segments={[
                { 
                  text: "Online Residential", 
                  style: { color: "#dc2626", WebkitTextStroke: "3px white", paintOrder: "stroke fill" } 
                },
                { 
                  text: "Complaint System", 
                  style: { color: "#2563eb", WebkitTextStroke: "3px white", paintOrder: "stroke fill" } 
                }
              ]}
              typingSpeed={100}
              pauseDuration={3000}
            />
          </h1>
        </div>
      </div>

      {/* Right Side / Bottom Side - Overlay Panel */}
      <div className="relative z-20 h-full w-full lg:w-[45%] flex flex-col bg-white rounded-t-[2.5rem] lg:rounded-none lg:rounded-l-[3.5rem] shadow-[-30px_0_60px_rgba(0,0,0,0.3)] lg:shadow-[-40px_0_80px_rgba(0,0,0,0.4)] px-6 py-6 lg:px-[clamp(2rem,5vw,5rem)] lg:py-10 overflow-hidden">
        
        {/* Main Content Area - Form & Text - Responsive Scaling */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-8">
          <div className="w-full max-w-[420px] py-2 pb-16">
            
            {/* Branding Logos - Top Header */}
            <div className="mb-6 lg:mb-8 flex items-center justify-center gap-[clamp(1.5rem,3vw,2.5rem)] animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="transition-transform hover:scale-105">
                <Image 
                  src="/assets/uniten.png" 
                  alt="UNITEN Logo" 
                  width={120} 
                  height={60} 
                  className="object-contain scale-[clamp(0.85,1.1vw,1)]" 
                  priority 
                />
              </div>
              <div className="transition-transform hover:scale-105">
                <Image 
                  src="/assets/logo-light.png" 
                  alt="ORCS Logo" 
                  width={60} 
                  height={60} 
                  className="object-contain drop-shadow-sm scale-[clamp(0.85,1.1vw,1)]" 
                  priority 
                />
              </div>
            </div>

            {/* Title Section */}
            <div className="mb-6 lg:mb-8 text-center">
              <h2 className="text-2xl lg:text-[1.65rem] font-black tracking-tight text-gray-900 leading-tight">
                SUBMIT COMPLAINT <br />
                <span className="text-blue-600">FOR SOLUTION</span>
              </h2>
              <div className="mt-3 h-1.5 w-16 bg-red-600 mx-auto rounded-full"></div>
            </div>
            
            <LoginForm />
          </div>
        </div>

        {/* Footer Text - FIXED POSITION to prevent movement when errors appear */}
        <div className="absolute bottom-6 left-0 right-0 text-center px-6">
          <p className="text-sm font-medium text-gray-500">
            IT Support:{" "}
            <a
              href="mailto:ORCSsupport@uniten.edu.my"
              className="font-bold text-blue-600 transition-colors hover:text-blue-700 hover:underline"
            >
              ORCSsupport@uniten.edu.my
            </a>
          </p>
          <p className="mt-1 text-[10px] sm:text-xs text-gray-400 font-medium">
            &copy; {new Date().getFullYear()} Universiti Tenaga Nasional
          </p>
        </div>
      </div>

    </div>
  );
}
