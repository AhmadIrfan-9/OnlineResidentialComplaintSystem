/**
 * POST /api/rag/documents  — upload a document to the knowledge vault
 * GET  /api/rag/documents  — list all vault documents (management/admin only)
 *
 * Upload flow:
 *   1. Auth + role check (MANAGEMENT | IT_STAFF_ADMIN)
 *   2. Parse multipart form (file + optional title)
 *   3. Create RagDocument row with status=PROCESSING
 *   4. Store raw file in S3 under rag-documents/{id}/{uuid}.{ext}
 *   5. Extract text, chunk, embed → store chunks
 *   6. Mark document READY (or ERROR)
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagementRole, isAdminRole, normalizeRoleKey } from "@/lib/roles";
import { storageService } from "@/lib/storage/StorageService";
import {
  extractText,
  chunkText,
  embedAndStoreChunks,
  updateDocumentChunkCount,
} from "@/lib/ai/rag-vault";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// ─── POST — Upload ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRoleKey(session.user.role);
  if (!isManagementRole(role) && !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden — management or admin only" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const titleRaw = formData.get("title") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 413 });
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, DOCX, TXT, PNG, or JPEG." },
      { status: 415 }
    );
  }

  const title = titleRaw?.trim() || file.name.replace(/\.[^.]+$/, "");
  const fileUuid = randomUUID();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";

  // 1. Create DB row (PROCESSING)
  let doc: Awaited<ReturnType<typeof db.ragDocument.create>>;
  try {
    doc = await db.ragDocument.create({
      data: {
        title,
        fileName: file.name,
        fileKey: "",
        mimeType: file.type,
        fileSize: file.size,
        status: "PROCESSING",
        uploadedById: session.user.id,
        uploadedByRole: role,
      },
    });
  } catch (err) {
    console.error("[RAG] DB create failed:", err);
    return NextResponse.json({ error: "Failed to create document record" }, { status: 500 });
  }

  // 2. Store raw file in S3 (rag-documents/{docId}/{uuid}.{ext})
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (err) {
    console.error("[RAG] Buffer read failed:", err);
    await db.ragDocument.update({ where: { id: doc.id }, data: { status: "ERROR", errorMessage: "Failed to read file" } });
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 500 });
  }
  let fileKey: string;
  try {
    const stored = await storageService.putObject({
      complaintId: doc.id,
      fileUuid,
      extension: ext,
      body: buffer,
      contentType: file.type,
      fileSize: file.size,
      uploaderId: session.user.id,
      virusScanStatus: "CLEAN",
    });
    fileKey = stored.key;

    await db.ragDocument.update({ where: { id: doc.id }, data: { fileKey } });
  } catch (err) {
    await db.ragDocument.update({
      where: { id: doc.id },
      data: { status: "ERROR", errorMessage: "File storage failed" },
    });
    return NextResponse.json({ error: "File storage failed" }, { status: 500 });
  }

  // 3. Extract text, chunk, embed — do this async (fire-and-forget style)
  // We return the doc immediately so the UI shows PROCESSING, then polls
  processDocumentAsync(doc.id, buffer, file.type).catch((err) =>
    console.error(`[RAG-Vault] Processing failed for ${doc.id}:`, err)
  );

  return NextResponse.json(
    {
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      status: "PROCESSING",
      chunkCount: 0,
      createdAt: doc.createdAt,
    },
    { status: 201 }
  );
}

async function processDocumentAsync(
  documentId: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  try {
    const { text, pageCount } = await extractText(buffer, mimeType);
    const chunks = await chunkText(text);

    if (chunks.length === 0) {
      await updateDocumentChunkCount(documentId, 0, "ERROR", "No extractable text found");
      return;
    }

    await embedAndStoreChunks(documentId, chunks);
    await updateDocumentChunkCount(documentId, chunks.length, "READY");

    if (pageCount > 0) {
      await db.ragDocument.update({ where: { id: documentId }, data: { pageCount } });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Processing failed";
    await updateDocumentChunkCount(documentId, 0, "ERROR", msg);
  }
}

// ─── GET — List documents ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRoleKey(session.user.role);
  if (!isManagementRole(role) && !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const docs = await db.ragDocument.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      status: true,
      errorMessage: true,
      chunkCount: true,
      pageCount: true,
      uploadedById: true,
      uploadedByRole: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ documents: docs });
}
