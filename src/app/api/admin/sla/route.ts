import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";

const schema = z.object({
  safeThresholdDays: z.number().int().positive(),
  warningThresholdDays: z.number().int().positive(),
  reminderFrequencyDays: z.number().int().positive(),
  routineTargetHours: z.number().int().positive(),
  urgentTargetHours: z.number().int().positive(),
  emergencyTargetHours: z.number().int().positive(),
});

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const setting =
    (await db.adminSlaSetting.findUnique({ where: { id: "default" } })) ??
    (await db.adminSlaSetting.create({
      data: {
        id: "default",
      },
    }));

  return NextResponse.json({ setting });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const payload = schema.parse(await request.json());
    const before = await db.adminSlaSetting.findUnique({ where: { id: "default" } });
    const updated = await db.adminSlaSetting.upsert({
      where: { id: "default" },
      create: { id: "default", ...payload },
      update: payload,
    });

    await logAudit({
      userId: admin.id,
      userName: admin.name ?? "Admin",
      action: "Update",
      resource: "AdminSlaSetting",
      before: before ? JSON.stringify(before) : null,
      after: JSON.stringify(updated),
      ipAddress: request.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({ setting: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to save SLA settings" }, { status: 500 });
  }
}

