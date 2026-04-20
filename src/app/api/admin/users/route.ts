import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";
import { normalizeLoginIdentifier } from "@/lib/identity";

const createSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().min(3),
    role: z.enum(["STUDENT", "MANAGEMENT", "IT_STAFF_ADMIN"]),
    phone: z.string().optional(),
    studentId: z.string().optional(), // Required for students; admin-assigned placeholder if omitted
    roomId: z.string().optional(),
    hostelId: z.string().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.role === "STUDENT" && !value.roomId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roomId"],
        message: "Room is required for student accounts",
      });
    }
    if (value.role === "MANAGEMENT" && !value.hostelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hostelId"],
        message: "Hostel is required for management accounts",
      });
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
          room: {
            select: {
              hostel: {
                select: { id: true, name: true },
              },
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

    const defaultPassword = await hash("ChangeMe123!", 10);

    const created = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: payload.name.trim(),
          email,
          role: payload.role,
          phone: payload.phone?.trim() || null,
          isActive: payload.isActive,
          password: defaultPassword,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });

      if (payload.role === "STUDENT" && payload.roomId) {
        // Use admin-supplied studentId if provided; otherwise generate a placeholder.
        // The student can update their real ID via the Profile Setup page.
        const studentId =
          payload.studentId?.trim().toUpperCase() ||
          `PENDING-${newUser.id.slice(0, 8).toUpperCase()}`;
        await tx.studentProfile.create({
          data: {
            userId: newUser.id,
            studentId,
            roomId: payload.roomId,
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

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create user" }, { status: 500 });
  }
}
