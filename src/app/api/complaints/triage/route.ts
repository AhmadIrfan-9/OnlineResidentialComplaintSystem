/**
 * src/app/api/complaints/triage/route.ts
 *
 * POST /api/complaints/triage
 * ────────────────────────────
 * On-demand ITIL triage endpoint. Evaluates an existing complaint using
 * the Impact-Urgency Matrix and persists the result to the database.
 *
 * Also exported as `runTriageForComplaint()` for internal fire-and-forget
 * use by the complaint submission pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { triageComplaint, mapToPriority } from "@/lib/ai/triage";

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { complaintId, title, description, imageAnalysisSummary } = body as {
      complaintId?: string;
      title?: string;
      description?: string;
      imageAnalysisSummary?: string | null;
    };

    if (!complaintId || !title || !description) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: complaintId, title, and description are required.",
        },
        { status: 400 }
      );
    }

    // ── Ownership / existence check ──────────────────────────────────────────
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        studentProfile: {
          select: { userId: true },
        },
        hostel: {
          select: { wardenId: true },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found." },
        { status: 404 }
      );
    }

    // Only the owning student, the hostel warden, or admin staff may trigger triage
    const isOwner =
      complaint.studentProfile?.userId === session.user.id;
    const isWarden =
      complaint.hostel?.wardenId === session.user.id;
    const isStaff =
      session.user.role === "IT_STAFF_ADMIN" ||
      session.user.role === "MANAGEMENT";

    if (!isOwner && !isWarden && !isStaff) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to triage this complaint." },
        { status: 403 }
      );
    }

    // ── Run ITIL Triage ──────────────────────────────────────────────────────
    const triageResult = await triageComplaint({
      title,
      description,
      imageAnalysisSummary: imageAnalysisSummary ?? null,
    });

    const dbPriority = mapToPriority(triageResult.final_priority);

    // ── Persist to Database ──────────────────────────────────────────────────
    const updated = await db.complaint.update({
      where: { id: complaintId },
      data: {
        priority: dbPriority,
        aiUrgencyScore: triageResult.calculated_urgency,
        aiImpactScore: triageResult.calculated_impact,
        aiSlaHours: triageResult.sla_hours_target,
        aiReasoningEn: triageResult.ai_reasoning_en,
        aiReasoningMs: triageResult.ai_reasoning_ms,
      },
      select: {
        id: true,
        priority: true,
        aiUrgencyScore: true,
        aiImpactScore: true,
        aiSlaHours: true,
        aiReasoningEn: true,
        aiReasoningMs: true,
      },
    });

    console.log(
      `[Triage] Complaint ${complaintId} → Priority: ${triageResult.final_priority} | ` +
        `Urgency: ${triageResult.calculated_urgency} | Impact: ${triageResult.calculated_impact} | ` +
        `SLA: ${triageResult.sla_hours_target}h`
    );

    return NextResponse.json(
      {
        complaint_id: complaintId,
        triage: triageResult,
        db_record: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Triage API Error]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during triage." },
      { status: 500 }
    );
  }
}

// ─── Internal Helper — fire-and-forget from complaint submission ──────────────

/**
 * Runs ITIL triage for an existing complaint record and persists the result.
 * Designed for non-blocking fire-and-forget use: errors are caught and logged
 * without propagating, so they never interrupt the submission response.
 *
 * @param complaintId - The DB id of the newly created complaint
 * @param input       - Title, description, and optional image analysis summary
 */
export async function runTriageForComplaint(
  complaintId: string,
  input: { title: string; description: string; imageAnalysisSummary?: string | null }
): Promise<void> {
  try {
    const triageResult = await triageComplaint({
      title: input.title,
      description: input.description,
      imageAnalysisSummary: input.imageAnalysisSummary ?? null,
    });

    const dbPriority = mapToPriority(triageResult.final_priority);

    await db.complaint.update({
      where: { id: complaintId },
      data: {
        priority: dbPriority,
        aiUrgencyScore: triageResult.calculated_urgency,
        aiImpactScore: triageResult.calculated_impact,
        aiSlaHours: triageResult.sla_hours_target,
        aiReasoningEn: triageResult.ai_reasoning_en,
        aiReasoningMs: triageResult.ai_reasoning_ms,
      },
    });

    console.log(
      `[Triage:Auto] Complaint ${complaintId} → Priority: ${triageResult.final_priority} | ` +
        `Urgency: ${triageResult.calculated_urgency} | Impact: ${triageResult.calculated_impact} | ` +
        `SLA: ${triageResult.sla_hours_target}h`
    );
  } catch (err) {
    // Non-blocking: log but never throw — submission must not fail due to triage error
    console.error(`[Triage:Auto] Failed for complaint ${complaintId}:`, err);
  }
}
