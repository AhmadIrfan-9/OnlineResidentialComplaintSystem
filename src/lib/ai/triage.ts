/**
 * src/lib/ai/triage.ts
 *
 * ITIL Impact-Urgency Matrix Triage Engine
 * ─────────────────────────────────────────
 * Evaluates a residential complaint using a formal 3×3 ITIL matrix to
 * derive a Priority Level (Low → Critical) and an SLA Deadline Target.
 *
 * Uses GPT-4o with response_format: json_object for deterministic output.
 * All responses are validated via Zod before being returned to callers.
 */

import OpenAI from "openai";
import { z } from "zod";
import { Priority } from "@prisma/client";

// ─── ITIL System Prompt ───────────────────────────────────────────────────────

const ITIL_TRIAGE_SYSTEM_PROMPT = `[Role]
You are a Lead Incident Triage Analyst for the UNITEN CCI Online Residential Complaint System (ORCS).
Your task is to evaluate a hostel maintenance complaint using the formal ITIL Impact-Urgency Matrix and assign a priority level with an SLA resolution deadline.

[Input]
You will receive:
1. Complaint Title (may be in English, Bahasa Melayu, or Manglish)
2. Complaint Description (may be in English, Bahasa Melayu, or Manglish)
3. Optional: An image analysis summary from a prior AI vision scan

[ITIL Urgency Score Definition]
Score 3 — HIGH Urgency:
  Immediate safety hazard or rapid structural degradation.
  Examples: exposed live wiring, electrical fire hazard, burst water main flooding a unit, gas leak, structural collapse risk.

Score 2 — MEDIUM Urgency:
  Disrupted core utility but not an immediate safety hazard.
  Examples: clogged toilet/sink, localized room electrical trip (not fire hazard), malfunctioning keyless digital lock, broken water heater, air-conditioner not functioning.

Score 1 — LOW Urgency:
  Minor cosmetic or convenience issue; does not disrupt daily living critically.
  Examples: broken wardrobe handle, squeaky ceiling fan, peeling paint, flickering non-critical light, scratched furniture.

[ITIL Impact Score Definition]
Score 3 — HIGH Impact:
  Affects an entire floor, block, or hostel-wide service.
  Examples: total internet outage for a block, main water tank failure, power failure to entire floor, blocked main drain affecting shared bathrooms.

Score 2 — MEDIUM Impact:
  Affects a full apartment unit or shared space used by multiple roommates.
  Examples: broken shared bathroom fixture, malfunctioning keyless door lock to a shared unit, common area AC failure.

Score 1 — LOW Impact:
  Isolated strictly to a single individual's private bedroom space or personal item.
  Examples: broken personal study desk lamp, personal wardrobe handle, individual room's non-shared fan.

[Priority Matrix Crossing]
Apply the following matrix to determine final_priority and sla_hours_target:

| Urgency \\ Impact | High (3) | Medium (2) | Low (1) |
|------------------|----------|------------|---------|
| High (3)         | Critical | High       | High    |
| Medium (2)       | High     | Medium     | Medium  |
| Low (1)          | Medium   | Low        | Low     |

SLA Targets:
  - Critical: sla_hours_target = 4
  - High:     sla_hours_target = 12
  - Medium:   sla_hours_target = 48
  - Low:      sla_hours_target = 120

[Language Instructions]
- Input may be in English, Bahasa Melayu, or mixed (Manglish). Translate internally as needed.
- Common Malay hostel terms: sinki=sink, tandas=toilet, paip=pipe, lampu=light, kipas=fan, siling=ceiling, dinding=wall, bilik=room, almari=wardrobe, tingkap=window, soket=socket, wayar=wire, pintu digital=digital lock, penyaman udara/aircond=air conditioner
- Always produce ai_reasoning_en in clear English.
- Always produce ai_reasoning_ms in natural Bahasa Melayu (not a word-for-word machine translation).

[Output]
Return ONLY a single valid JSON object with NO markdown, NO code blocks, NO extra explanation:
{
  "calculated_urgency": <1|2|3>,
  "calculated_impact": <1|2|3>,
  "final_priority": <"Low"|"Medium"|"High"|"Critical">,
  "sla_hours_target": <4|12|48|120>,
  "ai_reasoning_en": "<1-3 sentence English explanation referencing the specific issue and why it scored these values>",
  "ai_reasoning_ms": "<1-3 ayat penjelasan dalam Bahasa Melayu yang merujuk kepada isu spesifik>"
}`;

// ─── Zod Schema — strict output validation ────────────────────────────────────

export const TriageResultSchema = z.object({
  calculated_urgency: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  calculated_impact: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  final_priority: z.enum(["Low", "Medium", "High", "Critical"]),
  sla_hours_target: z.union([
    z.literal(4),
    z.literal(12),
    z.literal(48),
    z.literal(120),
  ]),
  ai_reasoning_en: z.string().min(10).max(800),
  ai_reasoning_ms: z.string().min(10).max(800),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;

// ─── Input Type ───────────────────────────────────────────────────────────────

export interface TriageInput {
  /** Complaint title — English, Malay, or Manglish */
  title: string;
  /** Full complaint description */
  description: string;
  /** Optional image analysis summary from a prior vision-validate call */
  imageAnalysisSummary?: string | null;
}

// ─── Priority Mapper (TriageResult → Prisma Priority enum) ───────────────────

export function mapToPriority(final_priority: TriageResult["final_priority"]): Priority {
  switch (final_priority) {
    case "Critical":
      return Priority.CRITICAL;
    case "High":
      return Priority.HIGH;
    case "Medium":
      return Priority.MEDIUM;
    case "Low":
    default:
      return Priority.LOW;
  }
}

// ─── OpenAI Client Singleton ──────────────────────────────────────────────────

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("[AI:Triage] OPENAI_API_KEY is not configured.");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// ─── Main Triage Function ─────────────────────────────────────────────────────

/**
 * Evaluates a complaint against the ITIL Impact-Urgency Matrix using GPT-4o.
 *
 * Returns a validated `TriageResult` with urgency score, impact score,
 * final priority level, SLA hours target, and bilingual AI reasoning.
 *
 * On LLM or parse failure, returns a safe LOW/LOW fallback so the pipeline
 * is never blocked by AI unavailability.
 *
 * @param input - Complaint title, description, and optional image analysis summary
 * @returns Validated TriageResult
 */
export async function triageComplaint(input: TriageInput): Promise<TriageResult> {
  const client = getClient();

  const imageLine = input.imageAnalysisSummary
    ? `\nImage Analysis Summary (from prior vision scan): ${input.imageAnalysisSummary}`
    : "";

  const userMessage = `[Complaint to Triage]
Title: ${input.title}
Description: ${input.description}${imageLine}`;

  let rawContent = "{}";

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.05, // near-deterministic for consistent triage scoring
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ITIL_TRIAGE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    rawContent = completion.choices[0]?.message?.content ?? "{}";
  } catch (llmError) {
    console.error("[AI:Triage] OpenAI call failed:", llmError);
    return buildFallback();
  }

  try {
    const parsed = JSON.parse(rawContent);
    const validated = TriageResultSchema.parse(parsed);
    return validated;
  } catch (parseError) {
    console.error("[AI:Triage] Zod validation failed:", parseError);
    console.error("[AI:Triage] Raw LLM content:", rawContent.slice(0, 400));
    return buildFallback();
  }
}

// ─── Graceful Fallback ────────────────────────────────────────────────────────

function buildFallback(): TriageResult {
  return {
    calculated_urgency: 1,
    calculated_impact: 1,
    final_priority: "Low",
    sla_hours_target: 120,
    ai_reasoning_en:
      "AI triage could not be completed. Complaint has been assigned Low priority pending manual review by the warden.",
    ai_reasoning_ms:
      "Penilaian AI tidak dapat diselesaikan. Aduan telah ditetapkan keutamaan Rendah dan menunggu semakan manual oleh warden.",
  };
}
