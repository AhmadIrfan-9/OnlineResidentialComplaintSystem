import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  // Fetch full user and profile
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      studentProfile: {
        include: { room: true }
      }
    }
  });

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
    hostelId: user.studentProfile?.room?.hostelId ?? "cm29d93o00000jlcqd70m6yze", // default string or fetch correctly
    roomNumberStr: user.studentProfile?.room?.roomNumber ?? ""
  };

  // Because the db might have random hostel IDs, let's just fetch Cendikiawan's ID to use as a fallback default
  const cendikiawan = await db.hostel.findUnique({ where: { name: "Cendikiawan" } });
  if (cendikiawan && !user.studentProfile?.room?.hostelId) {
    clientData.hostelId = cendikiawan.id;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <ProfileForm initialData={clientData} />
      </div>
    </div>
  );
}
