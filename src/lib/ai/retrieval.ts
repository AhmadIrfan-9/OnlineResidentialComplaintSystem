/**
 * src/lib/ai/retrieval.ts
 *
 * Retrieves semantically similar past complaints and relevant policy chunks
 * from Supabase using pgvector cosine similarity search.
 *
 * Uses the raw `pg` client (already in package.json) to issue vector queries
 * directly — Prisma does not support pgvector operators natively.
 */

import { Pool } from "pg";
import { formatVectorLiteral } from "./embeddings";

// ─── DB Client ────────────────────────────────────────────────────────────────

// Reuse a single Pool across the serverless function lifecycle
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("[RAG] No database connection string found in environment.");
    }
    _pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3, // limit connections in serverless context
    });
  }
  return _pool;
}

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface SimilarComplaint {
  id: string;
  complaintId: string;
  category: string;
  priority: string;
  hostelBlock: string | null;
  hostelName: string;
  descriptionSnap: string;
  resolutionSnap: string | null;
  similarity: number; // 0 → 1, higher = more similar
}

export interface PolicyChunkResult {
  id: string;
  sectionRef: string;
  category: string | null;
  title: string;
  content: string;
  similarity: number;
}

// ─── Retrieval Functions ──────────────────────────────────────────────────────

/**
 * Finds the top-k most semantically similar resolved complaints.
 *
 * Uses the `search_similar_complaints` SQL function created by the migration.
 * Falls back to a direct vector query if the function is unavailable.
 */
export async function retrieveSimilarComplaints(
  embedding: number[],
  k = 5,
  similarityThreshold = 0.72
): Promise<SimilarComplaint[]> {
  const pool = getPool();
  const vectorLiteral = formatVectorLiteral(embedding);

  try {
    const res = await pool.query<{
      id: string;
      complaint_id: string;
      category: string;
      priority: string;
      hostel_block: string | null;
      hostel_name: string;
      description_snap: string;
      resolution_snap: string | null;
      similarity: number;
    }>(
      `SELECT * FROM search_similar_complaints($1::vector, $2, $3)`,
      [vectorLiteral, similarityThreshold, k]
    );

    return res.rows.map((r) => ({
      id: r.id,
      complaintId: r.complaint_id,
      category: r.category,
      priority: r.priority,
      hostelBlock: r.hostel_block,
      hostelName: r.hostel_name,
      descriptionSnap: r.description_snap,
      resolutionSnap: r.resolution_snap,
      similarity: Number(r.similarity),
    }));
  } catch (err) {
    // Graceful fallback if the SQL function doesn't exist yet
    console.warn("[RAG] search_similar_complaints function not found, using inline query:", err);

    const res = await pool.query<{
      id: string;
      complaint_id: string;
      category: string;
      priority: string;
      hostel_block: string | null;
      hostel_name: string;
      description_snap: string;
      resolution_snap: string | null;
      similarity: number;
    }>(
      `SELECT
         id, complaint_id, category, priority, hostel_block,
         hostel_name, description_snap, resolution_snap,
         1 - (embedding <=> $1::vector) AS similarity
       FROM complaint_embeddings
       WHERE embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) > $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [vectorLiteral, similarityThreshold, k]
    );

    return res.rows.map((r) => ({
      id: r.id,
      complaintId: r.complaint_id,
      category: r.category,
      priority: r.priority,
      hostelBlock: r.hostel_block,
      hostelName: r.hostel_name,
      descriptionSnap: r.description_snap,
      resolutionSnap: r.resolution_snap,
      similarity: Number(r.similarity),
    }));
  }
}

/**
 * Finds the most relevant UNITEN Residential Policy sections for this complaint.
 * Category filter is applied loosely — also returns general (null category) sections.
 */
export async function retrievePolicyChunks(
  embedding: number[],
  category?: string,
  k = 3,
  similarityThreshold = 0.65
): Promise<PolicyChunkResult[]> {
  const pool = getPool();
  const vectorLiteral = formatVectorLiteral(embedding);

  try {
    const res = await pool.query<{
      id: string;
      section_ref: string;
      category: string | null;
      title: string;
      content: string;
      similarity: number;
    }>(
      `SELECT * FROM search_policy_chunks($1::vector, $2, $3, $4)`,
      [vectorLiteral, category ?? null, similarityThreshold, k]
    );

    return res.rows.map((r) => ({
      id: r.id,
      sectionRef: r.section_ref,
      category: r.category,
      title: r.title,
      content: r.content,
      similarity: Number(r.similarity),
    }));
  } catch (err) {
    console.warn("[RAG] search_policy_chunks function not found, using inline query:", err);

    const res = await pool.query<{
      id: string;
      section_ref: string;
      category: string | null;
      title: string;
      content: string;
      similarity: number;
    }>(
      `SELECT
         id, section_ref, category, title, content,
         1 - (embedding <=> $1::vector) AS similarity
       FROM policy_chunks
       WHERE embedding IS NOT NULL
         AND (category = $2 OR category IS NULL)
         AND 1 - (embedding <=> $1::vector) > $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [vectorLiteral, category ?? null, similarityThreshold, k]
    );

    return res.rows.map((r) => ({
      id: r.id,
      sectionRef: r.section_ref,
      category: r.category,
      title: r.title,
      content: r.content,
      similarity: Number(r.similarity),
    }));
  }
}

/**
 * Inserts or updates a complaint embedding record in the database.
 * Called automatically when a complaint is resolved.
 */
export async function upsertComplaintEmbedding(params: {
  id: string;
  complaintId: string;
  category: string;
  priority: string;
  hostelName: string;
  hostelBlock?: string | null;
  descriptionSnap: string;
  resolutionSnap?: string | null;
  embedding: number[];
}): Promise<void> {
  const pool = getPool();
  const vectorLiteral = formatVectorLiteral(params.embedding);

  await pool.query(
    `INSERT INTO complaint_embeddings
       (id, complaint_id, category, priority, hostel_name, hostel_block,
        description_snap, resolution_snap, embedded_at, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9::vector)
     ON CONFLICT (complaint_id)
     DO UPDATE SET
       embedding       = EXCLUDED.embedding,
       resolution_snap = EXCLUDED.resolution_snap,
       priority        = EXCLUDED.priority,
       embedded_at     = NOW()`,
    [
      params.id,
      params.complaintId,
      params.category,
      params.priority,
      params.hostelName,
      params.hostelBlock ?? null,
      params.descriptionSnap,
      params.resolutionSnap ?? null,
      vectorLiteral,
    ]
  );
}

/**
 * Inserts a policy chunk with its embedding into the policy_chunks table.
 * Used by the seed script.
 */
export async function upsertPolicyChunk(params: {
  id: string;
  sectionRef: string;
  category?: string | null;
  title: string;
  content: string;
  embedding: number[];
}): Promise<void> {
  const pool = getPool();
  const vectorLiteral = formatVectorLiteral(params.embedding);

  await pool.query(
    `INSERT INTO policy_chunks (id, section_ref, category, title, content, embedded_at, embedding)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6::vector)
     ON CONFLICT (id)
     DO UPDATE SET
       embedding  = EXCLUDED.embedding,
       content    = EXCLUDED.content,
       embedded_at = NOW()`,
    [
      params.id,
      params.sectionRef,
      params.category ?? null,
      params.title,
      params.content,
      vectorLiteral,
    ]
  );
}
