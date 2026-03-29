"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
    // Validate Student ID
    if (!/^[A-Z]{2}\d{7,8}$/.test(data.studentId)) {
      return { success: false, error: "Invalid student ID format." };
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
          studentId: data.studentId,
          academicProgram: data.academicProgram,
          roomId: room.id
        },
        update: {
          studentId: data.studentId,
          academicProgram: data.academicProgram,
          roomId: room.id
        }
      })
    ]);

    revalidatePath("/profile");
    return { success: true };
  } catch (error: any) {
    console.error("Profile update error:", error);
    if (error.code === "P2002") {
      return { success: false, error: "This Student ID is already registered to another account." };
    }
    return { success: false, error: "Failed to save profile changes." };
  }
}
