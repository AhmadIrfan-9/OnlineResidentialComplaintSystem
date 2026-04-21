/**
 * src/app/api/ai/insight/route.ts
 *
 * POST /api/ai/insight
 *
 * Auth-gated endpoint that runs the RAG pipeline for a given complaintId.
 * Only accessible by MANAGEMENT and IT_STAFF_ADMIN roles.
 *
 * Request body:  { complaintId: string }
 * Response:      AiInsight JSON  or  { error: string, fallback: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagementRole, isAdminRole, normalizeRoleKey } from "@/lib/roles";
import { generateComplaintInsight } from "@/lib/ai/insight";
import { toPendingDays } from "@/lib/complaints";

// ─── Request Validation ────────────────────────────────────────────────────────

function isValidBody(
  body: unknown
): body is { complaintId: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "complaintId" in body &&
    typeof (body as Record<string, unknown>).complaintId === "string" &&
    ((body as Record<string, unknown>).complaintId as string).length > 0
  );
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeRoleKey(session.user.role);
  if (!isManagementRole(role) && !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "Missing or invalid complaintId" },
      { status: 400 }
    );
  }

  const { complaintId } = body;

  // 3. Fetch complaint from Prisma (authorisation check included)
  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    include: {
      hostel: { select: { name: true, wardenId: true } },
      room:   { select: { roomNumber: true } },
    },
  });

  if (!complaint) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  // Wardens can only analyse complaints from their own hostel
  if (
    role === "MANAGEMENT" &&
    complaint.hostel.wardenId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Run the RAG pipeline
  try {
    const insight = await generateComplaintInsight({
      id: complaint.id,
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
      hostelName: complaint.hostel.name,
      hostelBlock: complaint.locationBlock,
      roomNumber: complaint.room.roomNumber,
      daysPending: toPendingDays(complaint.createdAt),
    });

    return NextResponse.json(insight, {
      status: 200,
      headers: {
        // 5-minute CDN/browser cache — safe since insight is TTL-cached server-side too
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    console.error("[AI Route] Pipeline error:", message);

    // Never crash the UI — return a structured fallback
    return NextResponse.json(
      {
        error: message,
        fallback: true,
        priority: "ROUTINE",
        confidence: 0,
        reason: "AI analysis unavailable. Please review this complaint manually.",
        suggestedAction: "Follow standard hostel SOP for this category.",
        policyReference: null,
        similarCaseCount: 0,
        generatedAt: new Date().toISOString(),
        latencyMs: 0,
      },
      { status: 200 } // 200 so the client can safely display the fallback state
    );
  }
}
