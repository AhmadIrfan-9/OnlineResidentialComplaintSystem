import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  slaRoutineHours: z.number().int().positive().optional(),
  slaUrgentHours: z.number().int().positive().optional(),
  slaEmergencyHours: z.number().int().positive().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const payload = updateSchema.parse(await request.json());
    const before = await db.adminDepartment.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ message: "Department not found" }, { status: 404 });

    const updated = await db.adminDepartment.update({ where: { id }, data: payload });

    await logAudit({
      userId: admin.id,
      userName: admin.name ?? "Admin",
      action: "Update",
      resource: "AdminDepartment",
      before: JSON.stringify(before),
      after: JSON.stringify(updated),
      ipAddress: request.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({ department: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to update department" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const before = await db.adminDepartment.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ message: "Department not found" }, { status: 404 });

  await db.adminDepartment.delete({ where: { id } });
  await logAudit({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: "Delete",
    resource: "AdminDepartment",
    before: JSON.stringify(before),
    ipAddress: request.headers.get("x-forwarded-for"),
  });
  return NextResponse.json({ ok: true });
}

