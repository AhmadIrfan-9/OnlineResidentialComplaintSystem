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
    redirect("/profile");
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
    <StudentComplaintForm
      categories={categories}
      hostelName={hostelName}
      roomId={studentProfile.roomId!}
    />
  );
}
