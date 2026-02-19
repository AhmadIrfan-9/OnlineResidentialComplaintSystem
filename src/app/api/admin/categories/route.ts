import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const categories = await db.adminCategory.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const payload = createSchema.parse(await request.json());
    const created = await db.adminCategory.create({ data: payload });

    await logAudit({
      userId: admin.id,
      userName: admin.name ?? "Admin",
      action: "Create",
      resource: "AdminCategory",
      after: JSON.stringify(created),
      ipAddress: request.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({ category: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create category" }, { status: 500 });
  }
}

