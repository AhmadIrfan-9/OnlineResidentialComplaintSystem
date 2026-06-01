/**
 * GET  /api/admin/departments  — list all departments
 * POST /api/admin/departments  — create a department
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole, normalizeRoleKey } from "@/lib/roles";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const role = normalizeRoleKey(session.user.role);
  if (!isAdminRole(role)) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const departments = await db.adminDepartment.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ departments });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  try {
    const dept = await db.adminDepartment.create({
      data: { name, email },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ department: dept }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Department name already exists" }, { status: 409 });
  }
}
