import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { normalizeStudentIdentifier } from "@/lib/identity";

const registerSchema = z
  .object({
    studentId: z.string().min(3, "Student ID is required"),
    name: z.string().min(2, "Name is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password is required"),
    phone: z.string().optional(),
    roomId: z.string().min(1, "Room is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = registerSchema.parse(payload);

    const email = normalizeStudentIdentifier(parsed.studentId);

    const [existingUser, room] = await Promise.all([
      db.user.findUnique({ where: { email }, select: { id: true } }),
      db.room.findUnique({ where: { id: parsed.roomId }, select: { id: true } }),
    ]);

    if (existingUser) {
      return NextResponse.json(
        { message: "Student ID is already registered" },
        { status: 409 }
      );
    }

    if (!room) {
      return NextResponse.json({ message: "Selected room not found" }, { status: 404 });
    }

    const hashedPassword = await hash(parsed.password, 10);

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: parsed.name.trim(),
          password: hashedPassword,
          role: "STUDENT",
          phone: parsed.phone?.trim() || null,
        },
        select: { id: true },
      });

      await tx.studentProfile.create({
        data: {
          userId: user.id,
          roomId: parsed.roomId,
        },
      });
    });

    return NextResponse.json(
      { message: "Registration successful. You can now log in." },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ message: first }, { status: 400 });
    }

    console.error("[Register API Error]", error);
    return NextResponse.json({ message: "Failed to register user" }, { status: 500 });
  }
}

