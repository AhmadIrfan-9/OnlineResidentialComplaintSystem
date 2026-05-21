/**
 * DELETE /api/rag/documents/[id]
 * GET    /api/rag/documents/[id]  — poll status (used by UI while PROCESSING)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagementRole, isAdminRole, isStudentRole, normalizeRoleKey } from "@/lib/roles";
import { storageService } from "@/lib/storage/StorageService";
import { deleteDocumentChunks } from "@/lib/ai/rag-vault";

// ─── GET — Poll document status ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRoleKey(session.user.role);
  if (!isManagementRole(role) && !isAdminRole(role) && !isStudentRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await db.ragDocument.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, chunkCount: true, errorMessage: true },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(doc);
}

// ─── DELETE — Remove document + chunks + S3 file ─────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRoleKey(session.user.role);
  if (!isManagementRole(role) && !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await db.ragDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only uploader or admin can delete
  if (role !== "IT_STAFF_ADMIN" && doc.uploadedById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden — you can only delete your own documents" }, { status: 403 });
  }

  // Delete chunks from pgvector table
  await deleteDocumentChunks(id);

  // Delete from Prisma (cascades to rag_document_chunks via relation)
  await db.ragDocument.delete({ where: { id } });

  // Best-effort S3 delete (don't fail if already gone)
  if (doc.fileKey) {
    try {
      const parsed = storageService.parseObjectKey(doc.fileKey);
      if (parsed) {
        await storageService.deleteObject(parsed.complaintId, parsed.fileUuid, parsed.extension);
      }
    } catch {
      // log but don't fail
      console.warn(`[RAG] Could not delete S3 object for doc ${id}: ${doc.fileKey}`);
    }
  }

  return NextResponse.json({ deleted: true });
}
