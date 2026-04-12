import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  // Fetch full user and profile + all hostels
  const [user, hostels] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      include: {
        studentProfile: {
          include: { room: true }
        }
      }
    }),
    db.hostel.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!user) {
    redirect("/login");
  }

  // Pre-fill parameters
  const clientData = {
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    studentId: user.studentProfile?.studentId ?? "",
    academicProgram: user.studentProfile?.academicProgram ?? "",
    hostelId: user.studentProfile?.room?.hostelId ?? (hostels[0]?.id ?? ""),
    roomNumberStr: user.studentProfile?.room?.roomNumber ?? ""
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <ProfileForm initialData={clientData} hostels={hostels} />
      </div>
    </div>
  );
}
