"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const STUDENT_ID_REGEX = /^[A-Z]{2}\d{7}$/;

export async function updateStudentProfile(data: {
  studentId: string;
  name: string;
  phone: string;
  hostelId: string;
  block: string;
  floor: string;
  roomNo: string;
  academicProgram: string;
}) {
  const session = await auth();
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Normalize and validate Student ID
    const normalizedStudentId = data.studentId.trim().toUpperCase();
    if (!STUDENT_ID_REGEX.test(normalizedStudentId)) {
      return { success: false, error: "Invalid Student/Staff ID format. Must be 2 uppercase letters followed by 7 digits (e.g. SW0108123)." };
    }

    // Validate empty string requirements
    if (!data.name || !data.phone || !data.hostelId || !data.block || !data.floor || !data.roomNo || !data.academicProgram) {
      return { success: false, error: "All fields are required." };
    }

    // Resolve or Auto-create the Room
    const roomNumber = `${data.block}-${data.floor}-${data.roomNo}`;
    const floorInt = parseInt(data.floor, 10);

    let room = await db.room.findFirst({
      where: {
        hostelId: data.hostelId,
        roomNumber: roomNumber
      }
    });

    if (!room) {
      room = await db.room.create({
        data: {
          hostelId: data.hostelId,
          roomNumber,
          floor: isNaN(floorInt) ? 1 : floorInt
        }
      });
    }

    // Update Profile and User in Transaction
    await db.$transaction([
      db.user.update({
        where: { id: session.user.id },
        data: {
          name: data.name,
          phone: data.phone
        }
      }),
      db.studentProfile.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          studentId: normalizedStudentId,
          academicProgram: data.academicProgram,
          roomId: room.id
        },
        update: {
          studentId: normalizedStudentId,
          academicProgram: data.academicProgram,
          roomId: room.id
        }
      })
    ]);

    revalidatePath("/profile");
    return { success: true };
  } catch (error: unknown) {
    console.error("Profile update error:", error);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { success: false, error: "This Student/Staff ID is already registered to another account." };
    }
    return { success: false, error: "Failed to save profile changes." };
  }
}

export async function checkStudentIdAvailable(
  studentId: string
): Promise<{ available: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { available: false, error: "Unauthorized" };
  }

  const normalized = studentId.trim().toUpperCase();
  if (!STUDENT_ID_REGEX.test(normalized)) {
    return { available: false, error: "Invalid format" };
  }

  const existing = await db.studentProfile.findUnique({
    where: { studentId: normalized },
    select: { userId: true },
  });

  // Available if no one has it, or if the current user already owns it
  const available = !existing || existing.userId === session.user.id;
  return { available };
}
