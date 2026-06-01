"use server";

/**
 * src/lib/ai/rag-vault.ts
 *
 * Zero-cost RAG Document Vault pipeline:
 *   1. extractText()            — PDF / DOCX / TXT → plain text
 *   2. chunkText()              — sliding-window sentence-aware chunking
 *   3. storeChunks()            — store plain text chunks in Postgres
 *   4. searchVault()            — PostgreSQL Full-Text Search (tsvector/tsquery)
 *   5. deleteDocumentChunks()   — cascade delete chunks for a document
 *   6. updateDocumentChunkCount() — set final status after processing
 */

import { Pool } from "pg";
import { randomUUID } from "crypto";

// ─── DB Pool ──────────────────────────────────────────────────────────────────

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error("[RAG-Vault] No DB connection string.");
    _pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return _pool;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VaultChunkResult {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  docTitle: string;
  docFilename: string;
}

// ─── 1. Text Extraction ───────────────────────────────────────────────────────

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pageCount: number }> {
  const mime = mimeType.toLowerCase();

  // PDF
  if (mime === "application/pdf" || mime.includes("pdf")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> =
        require("pdf-parse");
      const result = await pdfParse(buffer);
      return { text: result.text, pageCount: result.numpages };
    } catch (error) {
      console.error("[RAG-Vault] Failed to parse PDF:", error);
      throw new Error("Failed to parse PDF document. The file might be corrupted or encrypted.");
    }
  }

  // DOCX
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime.includes("docx") ||
    mime.includes("wordprocessingml")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, pageCount: 0 };
  }

  // Plain text / markdown
  if (mime.startsWith("text/")) {
    return { text: buffer.toString("utf-8"), pageCount: 0 };
  }

  // Images — note: server-side OCR requires native binaries.
  // We extract a placeholder and store as a searchable note.
  if (mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg") {
    return {
      text: `[Image document uploaded. This file is an image and its text content could not be extracted automatically. Please upload PDF or DOCX versions of your documents for full text search support.]`,
      pageCount: 1,
    };
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

// ─── 2. Chunking ──────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1400;  // chars (~350 tokens)
const CHUNK_OVERLAP = 200;

export async function chunkText(text: string): Promise<string[]> {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = start + CHUNK_SIZE;

    if (end < clean.length) {
      const paraBreak = clean.lastIndexOf("\n\n", end);
      if (paraBreak > start + CHUNK_SIZE * 0.5) {
        end = paraBreak;
      } else {
        const lastSent = clean.lastIndexOf(". ", end);
        if (lastSent > start + CHUNK_SIZE * 0.4) {
          end = lastSent + 1;
        }
      }
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);

    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

// ─── 3. Store Chunks (no embeddings — uses tsvector for FTS) ─────────────────

export async function storeChunks(
  documentId: string,
  chunks: string[]
): Promise<void> {
  const pool = getPool();

  // Ensure tsvector column exists — create it if not
  await pool.query(`
    ALTER TABLE rag_document_chunks
      ADD COLUMN IF NOT EXISTS fts_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED
  `).catch(() => {
    // Column may already exist, ignore error
  });

  const ids = chunks.map(() => randomUUID());

  await pool.query(
    `INSERT INTO rag_document_chunks (id, document_id, chunk_index, content, embedded_at)
     VALUES ${chunks.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, NOW())`).join(", ")}
     ON CONFLICT (id) DO NOTHING`,
    chunks.flatMap((chunk, i) => [ids[i], documentId, i, chunk])
  );
}

// Alias preserved for the documents upload route import
export const embedAndStoreChunks = storeChunks;

// ─── 4. Full-Text Search ──────────────────────────────────────────────────────

export async function searchVault(
  query: string,
  k = 6,
  _similarityThreshold = 0.50
): Promise<VaultChunkResult[]> {
  const pool = getPool();

  try {
    // Build tsquery from user's question (plainto_tsquery handles natural language)
    const res = await pool.query<{
      id: string;
      document_id: string;
      chunk_index: number;
      content: string;
      rank: number;
      title: string;
      file_name: string;
    }>(
      `SELECT
         c.id::text,
         c.document_id::text,
         c.chunk_index,
         c.content,
         ts_rank_cd(to_tsvector('english', c.content), plainto_tsquery('english', $1)) AS rank,
         d.title,
         d.file_name
       FROM rag_document_chunks c
       JOIN rag_documents d ON d.id = c.document_id
       WHERE d.status = 'READY'
         AND to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [query, k]
    );

    return res.rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      chunkIndex: r.chunk_index,
      content: r.content,
      similarity: Math.min(Number(r.rank) * 2, 1.0), // normalise rank to 0-1 scale
      docTitle: r.title,
      docFilename: r.file_name,
    }));
  } catch (err) {
    console.error("[RAG-Vault] FTS search failed:", err);
    return [];
  }
}

// ─── 5. Delete chunks ─────────────────────────────────────────────────────────

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM rag_document_chunks WHERE document_id = $1`, [documentId]);
}

// ─── 6. Update chunk count on rag_documents ───────────────────────────────────

export async function updateDocumentChunkCount(
  documentId: string,
  count: number,
  status: "READY" | "ERROR",
  errorMessage?: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE rag_documents
     SET chunk_count = $2, status = $3, error_message = $4, updated_at = NOW()
     WHERE id = $1`,
    [documentId, count, status, errorMessage ?? null]
  );
}
