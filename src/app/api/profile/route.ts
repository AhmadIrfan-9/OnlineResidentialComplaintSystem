import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { compare, hash } from "bcryptjs";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, phone, currentPassword, newPassword, forceChange } = body as {
    name?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
    forceChange?: boolean;
  };

  const updateData: { name?: string; phone?: string; password?: string; mustChangePassword?: boolean } = {};

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updateData.name = trimmed;
  }

  if (phone !== undefined) {
    updateData.phone = phone.trim() || null!;
  }

  if (newPassword) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain at least one letter and one number" }, { status: 400 });
    }

    // forceChange = true means the user is on the mandatory change-password screen
    // and no current password check is needed (they only have the temp "123456")
    if (!forceChange) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }
      const user = await db.user.findUnique({ where: { id: session.user.id }, select: { password: true } });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const valid = await compare(currentPassword, user.password);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
    }

    updateData.password = await hash(newPassword, 10);
    updateData.mustChangePassword = false;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  await db.user.update({ where: { id: session.user.id }, data: updateData });
  return NextResponse.json({ success: true });
}
