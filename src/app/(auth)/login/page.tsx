import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/db";
import { LoginForm } from "@/components/shared/LoginForm";
import { isAdminRole, isManagementRole, isStudentRole } from "@/lib/roles";

export const metadata = {
  title: "Sign In | Student Complaint System",
  description: "Sign in to your account",
};

export default async function LoginPage() {
  // Redirect if already authenticated
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (isStudentRole(user?.role)) {
      redirect("/dashboard/student");
    }

    if (isAdminRole(user?.role)) {
      redirect("/admin");
    }

    if (isManagementRole(user?.role)) {
      redirect("/dashboard/warden");
    }

    redirect("/dashboard");
  }

  const allowedHostelOrder = ["Cendikiawan"] as const;

  const hostels = await db.hostel.findMany({
    where: {
      name: {
        in: [...allowedHostelOrder],
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      rooms: {
        orderBy: { roomNumber: "asc" },
        select: {
          id: true,
          roomNumber: true,
          floor: true,
        },
      },
    },
  });

  const hostelsByName = new Map(
    hostels.map((hostel) => [
      hostel.name,
      {
        id: hostel.id,
        name: hostel.name,
        rooms: hostel.rooms.map((room) => ({
          id: room.id,
          label: `${room.roomNumber} (Floor ${room.floor})`,
        })),
      },
    ])
  );

  const registrationHostels = allowedHostelOrder
    .map((name) => hostelsByName.get(name))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            ORCS - Online Residential Complaint System
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to continue
          </p>
        </div>
        <LoginForm registrationHostels={registrationHostels} />
      </div>
    </div>
  );
}
