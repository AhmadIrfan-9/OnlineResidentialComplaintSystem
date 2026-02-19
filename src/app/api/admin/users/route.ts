import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";
import { normalizeStudentIdentifier } from "@/lib/identity";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().min(3),
  role: z.enum(["STUDENT", "MANAGEMENT", "IT_STAFF_ADMIN"]),
  hostelId: z.string().optional(),
  isActive: z.boolean().default(true),
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
    const email = normalizeStudentIdentifier(payload.email);
    const defaultPassword = await hash("ChangeMe123!", 10);

    const created = await db.user.create({
      data: {
        name: payload.name,
        email,
        role: payload.role,
        isActive: payload.isActive,
        password: defaultPassword,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (payload.role === "MANAGEMENT" && payload.hostelId) {
      await db.hostel.update({
        where: { id: payload.hostelId },
        data: { wardenId: created.id },
      });
    }

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

