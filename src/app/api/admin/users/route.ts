import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";
import { normalizeLoginIdentifier } from "@/lib/identity";
import { ROOM_LABEL_RE } from "@/lib/room-regex";

const generateTempPassword = (): string =>
  randomBytes(6).toString("base64url").slice(0, 10);

const createSchema = z
  .object({
    name:      z.string().min(2),
    email:     z.string().min(3),
    role:      z.enum(["STUDENT", "MANAGEMENT", "IT_STAFF_ADMIN"]),
    roomLabel: z.string().optional(), // e.g. "C1-04-02"
    hostelId:  z.string().optional(),
    isActive:  z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.role === "STUDENT") {
      if (!value.roomLabel) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["roomLabel"], message: "Room is required for student accounts" });
      } else if (!ROOM_LABEL_RE.test(value.roomLabel)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["roomLabel"], message: "Room must follow pattern C[1-3]-[01-10]-[01-08]" });
      }
    }
    if (value.role === "MANAGEMENT" && !value.hostelId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hostelId"], message: "Hostel is required for management accounts" });
    }
  });

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      wardenHostels: { select: { id: true, name: true }, take: 1 },
      studentProfile: {
        select: {
          assignedRoom: true,
          room: {
            select: {
              hostel: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const payload = createSchema.parse(await request.json());
    const email = normalizeLoginIdentifier(payload.email, payload.role);
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ message: "Email or identifier already exists" }, { status: 409 });
    }

    const tempPassword = generateTempPassword();
    const defaultPassword = await hash(tempPassword, 10);

    const created = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: payload.name.trim(),
          email,
          role: payload.role,
          isActive: payload.isActive,
          password: defaultPassword,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });

      if (payload.role === "STUDENT" && payload.roomLabel) {
        const studentId = `PENDING-${newUser.id.slice(0, 8).toUpperCase()}`;

        // Parse the roomLabel into parts to find/create the Room record
        // roomLabel format: "C1-04-02" → roomNumber = "C1-04-02", floor = 4
        const parts = payload.roomLabel.split("-");
        const floorNum = parseInt(parts[1], 10);

        // Find the hostel that matches the block prefix (C1, C2, C3)
        // We look for a Room with this roomNumber in any hostel; if not found, create it
        let room = await tx.room.findFirst({
          where: { roomNumber: payload.roomLabel },
        });

        if (!room) {
          // Find the first available hostel (prefer the one the admin selected)
          const targetHostelId = payload.hostelId ||
            (await tx.hostel.findFirst({ select: { id: true } }))?.id;
          if (targetHostelId) {
            room = await tx.room.create({
              data: { roomNumber: payload.roomLabel, floor: floorNum, hostelId: targetHostelId },
            });
          }
        }

        await tx.studentProfile.create({
          data: {
            userId: newUser.id,
            studentId,
            roomId: room?.id ?? undefined,
            assignedRoom: payload.roomLabel,
          },
        });
      }

      if (payload.role === "MANAGEMENT" && payload.hostelId) {
        await tx.hostel.update({
          where: { id: payload.hostelId },
          data: { wardenId: newUser.id },
        });
      }

      return newUser;
    });

    await logAudit({
      userId: admin.id,
      userName: admin.name ?? "Admin",
      action: "Create",
      resource: "User",
      after: JSON.stringify(created),
      ipAddress: request.headers.get("x-forwarded-for"),
    });

    // Return the plain-text temp password ONCE so the admin can share it with the user.
    // It is never stored in plain text — only the bcrypt hash is persisted.
    return NextResponse.json({ user: created, tempPassword }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create user" }, { status: 500 });
  }
}
