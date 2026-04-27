/**
 * src/lib/ai/insight.ts
 *
 * Orchestrates the full RAG pipeline for Complaint Intelligence:
 *   1. Embed the incoming complaint
 *   2. Retrieve similar past cases + relevant policy chunks (in parallel)
 *   3. Build the grounded prompt
 *   4. Call GPT-4o-mini with JSON response format
 *   5. Parse + validate the output with Zod
 *   6. Return typed AiInsight
 */

import OpenAI from "openai";
import { z } from "zod";
import { getComplaintEmbedding } from "./embeddings";
import { retrieveSimilarComplaints, retrievePolicyChunks } from "./retrieval";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";

// ─── OpenAI Client ────────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("[AI] OPENAI_API_KEY is not configured.");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// ─── Zod Schema — validates LLM output ───────────────────────────────────────

const AiInsightSchema = z.object({
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(500),
  suggestedAction: z.string().min(1).max(600),
  policyReference: z.string().nullable(),
  similarCaseCount: z.number().int().min(0),
  suggestedFine: z.string().nullable(), // Added for Handbook Logic integration
  evictionRisk: z.boolean().default(false), // Added for Handbook Logic integration
});

// ─── Public Types ─────────────────────────────────────────────────────────────

export type AiInsight = z.infer<typeof AiInsightSchema> & {
  /** ISO timestamp of when this insight was generated */
  generatedAt: string;
  /** Number of ms the pipeline took */
  latencyMs: number;
};

export interface ComplaintInsightInput {
  id: string;
  title: string;
  description: string;
  category: string;
  hostelName: string;
  hostelBlock?: string | null;
  roomNumber?: string | null;
  daysPending: number;
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
// Simple TTL cache per complaintId — avoids redundant API calls on sidebar re-opens.
// Self-resets on each server cold start (appropriate for dev + Vercel edge).

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const insightCache = new Map<string, { data: AiInsight; expiresAt: number }>();

function getCached(complaintId: string): AiInsight | null {
  const entry = insightCache.get(complaintId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    insightCache.delete(complaintId);
    return null;
  }
  return entry.data;
}

function setCache(complaintId: string, data: AiInsight): void {
  insightCache.set(complaintId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Runs the full RAG pipeline for a single complaint.
 *
 * @throws Only throws on unrecoverable errors (e.g., missing API key).
 *         Vector DB or LLM transient failures are caught and re-thrown
 *         with a descriptive message for the API route to handle gracefully.
 */
export async function generateComplaintInsight(
  input: ComplaintInsightInput
): Promise<AiInsight> {
  // 1. Check cache
  const cached = getCached(input.id);
  if (cached) return cached;

  const t0 = Date.now();

  // 2. Embed the complaint
  const embedding = await getComplaintEmbedding({
    title: input.title,
    description: input.description,
    category: input.category,
    hostelName: input.hostelName,
    hostelBlock: input.hostelBlock,
    roomNumber: input.roomNumber,
  });

  // 3. Retrieve context in parallel for speed
  const [similarCases, policyChunks] = await Promise.all([
    retrieveSimilarComplaints(embedding, 5),
    retrievePolicyChunks(embedding, input.category, 3),
  ]);

  // 4. Build the grounded prompt
  const userMessage = buildUserMessage({
    ...input,
    similarCases,
    policyChunks,
  });

  // 5. Call GPT-4o-mini with strict JSON mode
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1, // low temperature = deterministic, less hallucination risk
    max_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userMessage },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "{}";

  // 6. Parse and validate with Zod
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`[AI] LLM returned non-JSON content: ${rawContent.slice(0, 200)}`);
  }

  const validated = AiInsightSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[AI] Zod validation failed:", validated.error.flatten());
    // Return a graceful fallback rather than crashing
    const fallback: AiInsight = {
      confidence: 0,
      reason: "AI analysis could not be validated. Please review manually.",
      suggestedAction: "Manual review required.",
      policyReference: null,
      similarCaseCount: similarCases.length,
      suggestedFine: null,
      evictionRisk: false,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - t0,
    };
    return fallback;
  }

  const insight: AiInsight = {
    ...validated.data,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - t0,
  };

  // 7. Cache and return
  setCache(input.id, insight);
  return insight;
}
