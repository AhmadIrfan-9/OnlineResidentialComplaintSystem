import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StudentComplaintForm } from "@/components/shared/StudentComplaintForm";

interface CategoryOption {
  value: string;
  label: string;
}



export default async function NewComplaintPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = String(session.user.role ?? "").toUpperCase();
  if (role !== "STUDENT") {
    redirect("/dashboard");
  }

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      roomId: true,
      room: {
        select: {
          hostel: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!studentProfile?.roomId || !studentProfile.room) {
    redirect("/dashboard/student");
  }

  const hostelName = studentProfile.room!.hostel.name;

  let categories: CategoryOption[] = [];
  try {
    const adminCategories = await db.adminCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });

    categories = adminCategories.map((row) => ({
      value: row.name,
      label: row.name,
    }));
  } catch (err) {
    console.error("Failed to load categories", err);
  }

  return (
    <div className="space-y-4">
      <section className="surface-hero px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">Student Portal</p>
          <h1 className="text-xl font-black text-white">Submit Complaint</h1>
          <p className="mt-0.5 text-sm text-blue-200">Describe your issue clearly so management can respond faster.</p>
        </div>
        <Link
          href="/dashboard/student"
          className="flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          Back
        </Link>
      </section>
      <StudentComplaintForm
        categories={categories}
        hostelName={hostelName}
        roomId={studentProfile.roomId!}
      />
    </div>
  );
}
