import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";

const templateSchema = z.object({
  key: z.enum(["submission", "status_update", "escalation_alert"]),
  name: z.string().min(2),
  subject: z.string().min(2),
  html: z.string().min(2),
});

const defaults = [
  {
    key: "submission",
    name: "Submission Confirmation",
    subject: "Complaint Submitted",
    html: "<p>Dear {{student_name}}, complaint {{ticket_id}} was submitted.</p>",
  },
  {
    key: "status_update",
    name: "Status Update",
    subject: "Complaint Status Updated",
    html: "<p>Status changed to {{status}} for {{ticket_id}}.</p>",
  },
  {
    key: "escalation_alert",
    name: "Escalation Alert",
    subject: "Complaint Escalation Alert",
    html: "<p>Escalation required for {{ticket_id}}.</p>",
  },
];

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  for (const tmpl of defaults) {
    await db.adminEmailTemplate.upsert({
      where: { key: tmpl.key },
      update: {},
      create: tmpl,
    });
  }

  const templates = await db.adminEmailTemplate.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ templates });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const payload = templateSchema.parse(await request.json());
    const before = await db.adminEmailTemplate.findUnique({ where: { key: payload.key } });
    const updated = await db.adminEmailTemplate.upsert({
      where: { key: payload.key },
      create: payload,
      update: payload,
    });

    await logAudit({
      userId: admin.id,
      userName: admin.name ?? "Admin",
      action: "Update",
      resource: "AdminEmailTemplate",
      before: before ? JSON.stringify(before) : null,
      after: JSON.stringify(updated),
      ipAddress: request.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to save template" }, { status: 500 });
  }
}

