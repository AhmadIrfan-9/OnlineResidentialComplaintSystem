import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categoryLabels, type ComplaintCategory } from "@/lib/validations";
import { StudentComplaintForm } from "@/components/shared/StudentComplaintForm";

interface CategoryRow {
  enumlabel: string;
}

interface CategoryOption {
  value: string;
  label: string;
}

const fallbackCategories: CategoryOption[] = (Object.keys(
  categoryLabels
) as ComplaintCategory[]).map(
  (key) => ({
    value: key,
    label: categoryLabels[key],
  })
);

const toLabel = (value: string): string => {
  const key = value as ComplaintCategory;
  return categoryLabels[key] ?? value.replaceAll("_", " ").toLowerCase();
};

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

  const hostelName = studentProfile?.room.hostel.name ?? "Hostel not assigned";

  let categories: CategoryOption[] = fallbackCategories;
  try {
    const rows = await db.$queryRaw<CategoryRow[]>`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ComplaintCategory'
      ORDER BY e.enumsortorder
    `;

    if (rows.length > 0) {
      categories = rows.map((row) => ({
        value: row.enumlabel,
        label: toLabel(row.enumlabel),
      }));
    }
  } catch {
    categories = fallbackCategories;
  }

  return <StudentComplaintForm categories={categories} hostelName={hostelName} />;
}
