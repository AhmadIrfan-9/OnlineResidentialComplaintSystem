/**
 * src/lib/ai/auto-embed.ts
 *
 * Triggered automatically when a complaint status changes to RESOLVED.
 * Fetches the complaint from Prisma, computes its embedding, and upserts
 * it into the `complaint_embeddings` pgvector table.
 *
 * This is called fire-and-forget from `updateComplaintStatus` — it never
 * blocks the UI response and failures are only logged, not thrown.
 */

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { createInAppNotification } from "@/lib/notifications";
import { getComplaintEmbedding } from "./embeddings";
import { upsertComplaintEmbedding } from "./retrieval";

/**
 * Fetches a resolved complaint by ID and stores its embedding.
 * Safe to re-run (upserts on conflict).
 */
export async function embedAndStoreResolvedComplaint(
  complaintId: string
): Promise<void> {
  // Fetch the complaint with enough data to build a rich embedding
  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    include: {
      hostel: { select: { name: true, wardenId: true } },
      room:   { select: { roomNumber: true } },
      // Most recent resolution note
      complaintUpdates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  if (!complaint) {
    console.warn(`[AutoEmbed] Complaint ${complaintId} not found — skipping.`);
    return;
  }

  // Only embed RESOLVED or CLOSED complaints — guards against future race conditions
  if (complaint.status !== "RESOLVED" && complaint.status !== "CLOSED") {
    return;
  }

  try {
    const embedding = await getComplaintEmbedding({
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
      hostelName: complaint.hostel.name,
      hostelBlock: complaint.locationBlock,
      roomNumber: complaint.room.roomNumber,
    });

    const resolutionSnap = complaint.complaintUpdates[0]?.content ?? null;

    await upsertComplaintEmbedding({
      id: randomUUID(),
      complaintId: complaint.id,
      category: complaint.category,
      hostelName: complaint.hostel.name,
      hostelBlock: complaint.locationBlock,
      descriptionSnap: complaint.description.slice(0, 500),
      resolutionSnap: resolutionSnap?.slice(0, 300) ?? null,
      embedding,
    });

    console.log(
      `[AutoEmbed] ✅ Embedded complaint ${complaintId} (${complaint.category})`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[AutoEmbed] ❌ Embedding failed for ${complaintId}: ${msg}`);
    // Best-effort notification to warden so the failure is visible in-app
    if (complaint.hostel.wardenId) {
      createInAppNotification({
        userId: complaint.hostel.wardenId,
        complaintId,
        message: `AI indexing failed for complaint ${complaintId.slice(0, 8).toUpperCase()}. The complaint is resolved but will not appear in AI similarity search.`,
      }).catch(() => {});
    }
  }
}
