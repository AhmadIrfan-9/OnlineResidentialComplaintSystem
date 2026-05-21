/**
 * src/lib/ai/embeddings.ts
 *
 * Converts complaint text into 1536-dimensional vector embeddings
 * using OpenAI text-embedding-3-small. These vectors are stored in
 * the `complaint_embeddings` Supabase table for RAG retrieval.
 */

import OpenAI from "openai";

// Lazy singleton — avoids repeated cold-start initialisation
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[AI] OPENAI_API_KEY is not set. Add it to your .env file."
      );
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComplaintEmbeddingInput {
  title: string;
  description: string;
  category: string;       // e.g. "PLUMBING"
  hostelName: string;
  hostelBlock?: string | null;
  roomNumber?: string | null;
}

// ─── Core Embedding Functions ─────────────────────────────────────────────────

/**
 * Converts any plain text into a 1536-dim embedding vector.
 * @param text - The text to embed. Should be < 8192 tokens.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const client = getClient();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.trim().slice(0, 8000),
    encoding_format: "float",
  });

  return response.data[0].embedding;
}

export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getClient();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.trim().slice(0, 8000)),
    encoding_format: "float",
  });

  return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Builds a semantically rich embedding for a complaint.
 *
 * The text prefix strategy ensures the embedding captures:
 * - Complaint category (type classification)
 * - Location (block-level clustering)
 * - Full problem description
 *
 * Example input text:
 * "[CATEGORY: PLUMBING] [HOSTEL: Kolej Perindu] [BLOCK: Block A]
 *  Burst pipe in bathroom — water flooding corridor near Room 302."
 */
export async function getComplaintEmbedding(
  input: ComplaintEmbeddingInput
): Promise<number[]> {
  const parts: string[] = [
    `[CATEGORY: ${input.category}]`,
    `[HOSTEL: ${input.hostelName}]`,
  ];

  if (input.hostelBlock) {
    parts.push(`[BLOCK: ${input.hostelBlock}]`);
  }
  if (input.roomNumber) {
    parts.push(`[ROOM: ${input.roomNumber}]`);
  }

  // Title carries high semantic weight — repeat it slightly so embedding space is informed
  parts.push(`Title: ${input.title}`);
  parts.push(`Description: ${input.description}`);

  const text = parts.join(" ");
  return getEmbedding(text);
}

/**
 * Converts a pgvector-formatted string back to a JS number array.
 * Supabase returns vectors as "[0.123,0.456,...]" strings when using raw SQL.
 */
export function parseVectorString(vectorStr: string): number[] {
  return vectorStr
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map(Number);
}

/**
 * Serialises a JS number array to the pgvector literal format.
 * e.g. [0.1, 0.2] → "[0.1,0.2]"
 */
export function formatVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
