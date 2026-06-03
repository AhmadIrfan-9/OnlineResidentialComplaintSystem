import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash, compare } from "bcryptjs";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";
import { normalizeLoginIdentifier } from "@/lib/identity";
import { ROOM_LABEL_RE } from "@/lib/room-regex";

const updateSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().min(3).optional(),
    role: z.enum(["STUDENT", "MANAGEMENT", "IT_STAFF_ADMIN"]).optional(),
    isActive: z.boolean().optional(),
    hostelId: z.string().nullable().optional(),
    roomLabel: z.string().optional(),
    resetPassword: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "STUDENT") {
      if (value.roomLabel && !ROOM_LABEL_RE.test(value.roomLabel)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["roomLabel"], message: "Room must follow pattern C[1-3]-[01-10]-[01-08]" });
      }
    }
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const adminPassword = request.headers.get("X-Admin-Password");
  if (!adminPassword) {
    return NextResponse.json({ message: "Admin password required" }, { status: 400 });
  }

  const adminUser = await db.user.findUnique({ where: { id: admin.id } });
  if (!adminUser || !(await compare(adminPassword, adminUser.password))) {
    return NextResponse.json({ message: "Invalid admin password" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const payload = updateSchema.parse(await request.json());
    const before = await db.user.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        wardenHostels: true,
      },
    });
    if (!before) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const updated = await db.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (payload.name !== undefined) data.name = payload.name.trim();
      if (payload.email !== undefined) {
        data.email = normalizeLoginIdentifier(payload.email, payload.role ?? before.role);
      }
      if (payload.role !== undefined) data.role = payload.role;
      if (payload.isActive !== undefined) data.isActive = payload.isActive;
      if (payload.resetPassword) data.password = await hash("ChangeMe123!", 10);

      const user = await tx.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
      });

      const nextRole = payload.role ?? before.role;

      if (nextRole === "STUDENT") {
        if (payload.roomLabel) {
          const parts = payload.roomLabel.split("-");
          const floorNum = parseInt(parts[1], 10);

          let room = await tx.room.findFirst({
            where: { roomNumber: payload.roomLabel },
          });

          if (!room) {
            const targetHostelId = payload.hostelId ||
              (await tx.hostel.findFirst({ select: { id: true } }))?.id;
            if (targetHostelId) {
              room = await tx.room.create({
                data: { roomNumber: payload.roomLabel, floor: floorNum, hostelId: targetHostelId },
              });
            }
          }

          const studentId = before.studentProfile?.studentId ?? `PENDING-${user.id.slice(0, 8).toUpperCase()}`;

          await tx.studentProfile.upsert({
            where: { userId: id },
            create: {
              userId: id,
              studentId,
              roomId: room?.id ?? null,
              assignedRoom: payload.roomLabel,
            },
            update: {
              roomId: room?.id ?? null,
              assignedRoom: payload.roomLabel,
            },
          });
        }
      } else {
        await tx.studentProfile.deleteMany({
          where: { userId: id },
        });
      }

      if (nextRole === "MANAGEMENT" && payload.hostelId) {
        await tx.hostel.update({
          where: { id: payload.hostelId },
          data: { wardenId: id },
        });
      }

      return user;
    });

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
  
  const adminPassword = request.headers.get("X-Admin-Password");
  if (!adminPassword) {
    return NextResponse.json({ message: "Admin password required" }, { status: 400 });
  }

  const adminUser = await db.user.findUnique({ where: { id: admin.id } });
  if (!adminUser || !(await compare(adminPassword, adminUser.password))) {
    return NextResponse.json({ message: "Invalid admin password" }, { status: 401 });
  }

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
