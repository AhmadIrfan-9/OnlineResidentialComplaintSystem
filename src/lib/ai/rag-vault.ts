"use server";

/**
 * src/lib/ai/rag-vault.ts
 *
 * Core RAG Document Vault pipeline:
 *   1. extractText()       — PDF / DOCX / TXT → plain text
 *   2. chunkText()         — sliding-window sentence-aware chunking
 *   3. embedAndStoreChunks() — embed each chunk via OpenAI + store in DB
 *   4. searchVault()       — cosine-similarity search across all READY docs
 *   5. deleteDocumentChunks() — cascade delete chunks (DB rows only; S3 handled by caller)
 */

import { Pool } from "pg";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { getEmbedding, formatVectorLiteral } from "./embeddings";

// ─── DB Pool (shared with retrieval.ts) ──────────────────────────────────────

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
      // pdf-parse ships both CJS and ESM; use require to avoid .default confusion
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

  // Images — use GPT-4o vision to extract text content
  if (mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("[RAG-Vault] OPENAI_API_KEY not set.");
    const client = new OpenAI({ apiKey });
    const base64 = buffer.toString("base64");
    const mediaType = mime === "image/png" ? "image/png" : "image/jpeg";
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract and transcribe all readable text from this image. If the image contains a document, form, notice, or written content, output the full text faithfully. If it is a photo with no text, describe the scene in detail instead.",
            },
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
          ],
        },
      ],
    });
    const extracted = response.choices[0]?.message?.content ?? "";
    return { text: extracted, pageCount: 1 };
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

// ─── 2. Chunking ──────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1400;  // chars (~350 tokens) — fits well in 8k context
const CHUNK_OVERLAP = 200; // chars kept from previous chunk for continuity

export async function chunkText(text: string): Promise<string[]> {
  // Normalise whitespace
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = start + CHUNK_SIZE;

    if (end < clean.length) {
      // Prefer to break at paragraph boundary
      const paraBreak = clean.lastIndexOf("\n\n", end);
      if (paraBreak > start + CHUNK_SIZE * 0.5) {
        end = paraBreak;
      } else {
        // Fall back to sentence boundary (. ! ?)
        const sentBreak = clean.search(new RegExp(`[.!?]\\s`, "g"));
        const lastSent = clean.lastIndexOf(". ", end);
        if (lastSent > start + CHUNK_SIZE * 0.4) {
          end = lastSent + 1;
        }
      }
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk); // skip tiny trailing fragments

    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

// ─── 3. Embed + Store Chunks ──────────────────────────────────────────────────

export async function embedAndStoreChunks(
  documentId: string,
  chunks: string[]
): Promise<void> {
  const pool = getPool();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const id = randomUUID();
    const embedding = await getEmbedding(chunk);
    const vectorLiteral = formatVectorLiteral(embedding);

    await pool.query(
      `INSERT INTO rag_document_chunks
         (id, document_id, chunk_index, content, embedded_at, embedding)
       VALUES ($1, $2, $3, $4, NOW(), $5::vector)
       ON CONFLICT (id) DO NOTHING`,
      [id, documentId, i, chunk, vectorLiteral]
    );
  }
}

// ─── 4. Vector Search ─────────────────────────────────────────────────────────

export async function searchVault(
  embedding: number[],
  k = 6,
  similarityThreshold = 0.60
): Promise<VaultChunkResult[]> {
  const pool = getPool();
  const vectorLiteral = formatVectorLiteral(embedding);

  try {
    const res = await pool.query<{
      id: string;
      document_id: string;
      chunk_index: number;
      content: string;
      similarity: number;
      doc_title: string;
      doc_filename: string;
    }>(
      `SELECT * FROM search_rag_chunks($1::vector, $2, $3)`,
      [vectorLiteral, similarityThreshold, k]
    );
    return res.rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      chunkIndex: r.chunk_index,
      content: r.content,
      similarity: Number(r.similarity),
      docTitle: r.doc_title,
      docFilename: r.doc_filename,
    }));
  } catch {
    // Fallback if SQL function not yet created
    const res = await pool.query<{
      id: string;
      document_id: string;
      chunk_index: number;
      content: string;
      similarity: number;
      title: string;
      file_name: string;
    }>(
      `SELECT
         c.id::text, c.document_id::text, c.chunk_index, c.content,
         1 - (c.embedding <=> $1::vector) AS similarity,
         d.title, d.file_name
       FROM rag_document_chunks c
       JOIN rag_documents d ON d.id = c.document_id
       WHERE c.embedding IS NOT NULL AND d.status = 'READY'
         AND 1 - (c.embedding <=> $1::vector) > $2
       ORDER BY c.embedding <=> $1::vector
       LIMIT $3`,
      [vectorLiteral, similarityThreshold, k]
    );
    return res.rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      chunkIndex: r.chunk_index,
      content: r.content,
      similarity: Number(r.similarity),
      docTitle: r.title,
      docFilename: r.file_name,
    }));
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
