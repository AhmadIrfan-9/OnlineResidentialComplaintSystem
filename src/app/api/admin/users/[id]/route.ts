import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";
import { normalizeLoginIdentifier } from "@/lib/identity";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().min(3).optional(),
  role: z.enum(["STUDENT", "MANAGEMENT", "IT_STAFF_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  hostelId: z.string().nullable().optional(),
  resetPassword: z.boolean().optional(),
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
    const before = await db.user.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.email !== undefined) {
      data.email = normalizeLoginIdentifier(payload.email, payload.role ?? before.role);
    }
    if (payload.role !== undefined) data.role = payload.role;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;
    if (payload.resetPassword) data.password = await hash("ChangeMe123!", 10);

    const updated = await db.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
    });

    if (payload.role === "MANAGEMENT" && payload.hostelId) {
      await db.hostel.update({
        where: { id: payload.hostelId },
        data: { wardenId: id },
      });
    }

    await logAudit({
      userId: admin.id,
      userName: admin.name ?? "Admin",
      action: "Update",
      resource: "User",
      before: JSON.stringify(before),
      after: JSON.stringify(updated),
      ipAddress: request.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const before = await db.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ message: "User not found" }, { status: 404 });

  await db.user.delete({ where: { id } });
  await logAudit({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: "Delete",
    resource: "User",
    before: JSON.stringify(before),
    ipAddress: request.headers.get("x-forwarded-for"),
  });
  return NextResponse.json({ ok: true });
}
