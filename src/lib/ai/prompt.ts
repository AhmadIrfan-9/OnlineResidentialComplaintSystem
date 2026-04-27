/**
 * src/lib/ai/prompt.ts
 *
 * Builds the anti-hallucination system prompt and user message
 * for the UNITEN Complaint Intelligence LLM call.
 *
 * Core design principle:
 *   The LLM is ONLY allowed to cite policy sections that appear verbatim
 *   in the retrieved CONTEXT block. If no policy is found, it must say so
 *   explicitly — it must NEVER invent or extrapolate policy rules.
 */

import type { SimilarComplaint, PolicyChunkResult } from "./retrieval";
import { HANDBOOK_LOGIC } from "../constants/handbook-logic";

// ─── System Prompt ────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are the UNITEN Residential Complaint AI Advisor — a decision-support tool for residential management staff.

Your role is to help management triage and resolve student complaints faster by:
1. Recommending a specific action grounded in UNITEN Residential Policy.
2. Suggesting appropriate fines or penalties based on the "HANDBOOK FINES LOGIC".

────────────────────────────────────────────
STRICT RULES — VIOLATION IS NOT ACCEPTABLE:
────────────────────────────────────────────
RULE 1 — NO HALLUCINATION: You MUST only cite policy sections that appear word-for-word in the CONTEXT block under "RELEVANT POLICY SECTIONS". Never invent, paraphrase, or extrapolate policy text.

RULE 2 — FINES LOGIC: Use the "HANDBOOK FINES LOGIC" block to identify if a fine is applicable. If the complaint describes damage, cleaning failure, or a rule violation, find the matching item in the logic table and set "suggestedFine".

RULE 3 — EVICTION RISK: If the violation matches an item in the logic table with eviction status "IMMEDIATE" or "HIGH", set "evictionRisk" to true.

RULE 4 — POLICY NOT FOUND: If no relevant policy section is in the context, set "policyReference" to null. You may still suggest a fine based on the Handbook Logic if applicable.

RULE 5 — OUTPUT FORMAT: Respond ONLY with a single valid JSON object. No markdown, no prose, no explanation outside the JSON.

OUTPUT JSON SCHEMA (strictly follow this structure):
{
  "confidence": <float 0.0–1.0>,
  "reason": "<One clear sentence explaining the insight, referencing fine logic or recurrence>",
  "suggestedAction": "<Specific actionable step for management to take>",
  "policyReference": "<Section X.X: exact verbatim quote from context>" | null,
  "similarCaseCount": <integer>,
  "suggestedFine": "<Amount with RM prefix, e.g. RM300>" | null,
  "evictionRisk": <boolean>
}`;

// ─── User Message Builder ─────────────────────────────────────────────────────

export interface PromptInput {
  title: string;
  description: string;
  category: string;
  hostelName: string;
  hostelBlock?: string | null;
  roomNumber?: string | null;
  daysPending: number;
  similarCases: SimilarComplaint[];
  policyChunks: PolicyChunkResult[];
}

/**
 * Formats the retrieved context + complaint details into the user message
 * sent alongside the system prompt.
 */
export function buildUserMessage(input: PromptInput): string {
  // ── Format past cases ──────────────────────────────────────────────────────
  let casesBlock: string;
  if (input.similarCases.length === 0) {
    casesBlock = "No similar past complaints found in the database.";
  } else {
    casesBlock = input.similarCases
      .map((c, i) => {
        const location = [c.hostelName, c.hostelBlock].filter(Boolean).join(" / ");
        const resolution = c.resolutionSnap
          ? `Resolution: ${c.resolutionSnap}`
          : "Resolution: Not recorded";
        return `[Case ${i + 1}] Category: ${c.category} | Location: ${location} | Similarity: ${(c.similarity * 100).toFixed(0)}%
  Problem: ${c.descriptionSnap.slice(0, 200)}
  ${resolution}`;
      })
      .join("\n\n");
  }

  // ── Format policy sections ─────────────────────────────────────────────────
  let policyBlock: string;
  if (input.policyChunks.length === 0) {
    policyBlock = "No relevant policy sections found for this complaint category.";
  } else {
    policyBlock = input.policyChunks
      .map((p) => `${p.sectionRef}: ${p.title}\n"${p.content}"`)
      .join("\n\n");
  }

  // ── Build location string ──────────────────────────────────────────────────
  const locationParts = [
    input.hostelName,
    input.hostelBlock ? `Block ${input.hostelBlock}` : null,
    input.roomNumber ? `Room ${input.roomNumber}` : null,
  ].filter(Boolean);
  const locationStr = locationParts.join(", ");

  return `=== CONTEXT ===

--- HANDBOOK FINES LOGIC (GROUND TRUTH) ---
${JSON.stringify(HANDBOOK_LOGIC, null, 2)}

--- SIMILAR PAST CASES (${input.similarCases.length} found) ---
${casesBlock}

--- RELEVANT POLICY SECTIONS (${input.policyChunks.length} found) ---
${policyBlock}

=== COMPLAINT TO ANALYSE ===
Title: ${input.title}
Category: ${input.category}
Location: ${locationStr}
Days Pending: ${input.daysPending}
Description:
"${input.description}"

Analyse this complaint and respond with the JSON output.`;
}
