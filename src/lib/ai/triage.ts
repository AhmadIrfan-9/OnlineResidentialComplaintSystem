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
import { db } from "@/lib/db";

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

[Few-Shot Exemplar Examples]
Compare all incoming student submissions against these 5 bilingual UNITEN-specific exemplars to calibrate urgency, impact, and priority calculations:

Example 1: Critical Priority (Urgency 3, Impact 3, SLA 4)
- Title: Burnt DB board in Corridor / Panel DB asrama meletup & terbakar
- Description: Panel elektrik utama dekat koridor Blok C1 aras 4 tiba-tiba ada bunyi letupan kecil dan bau hangit terbakar yang kuat. Sekarang satu aras 4 total blackout! Ini sangat bahaya kalau ada litar pintas atau api marak.
- Result:
  {
    "calculated_urgency": 3,
    "calculated_impact": 3,
    "final_priority": "Critical",
    "sla_hours_target": 4,
    "ai_reasoning_en": "Immediate safety hazard due to electrical fire risk and total floor blackout, affecting multiple units.",
    "ai_reasoning_ms": "Bahaya keselamatan serta-merta akibat risiko kebakaran elektrik dan gangguan bekalan kuasa seluruh aras yang menjejaskan banyak unit."
  }

Example 2: High Priority (Urgency 3, Impact 1, SLA 12)
- Title: Burst water pipe spraying water inside room / Paip pecah air memancut dalam bilik
- Description: Paip bekalan air ke sinki dalam bilik asrama saya pecah tiba-tiba, air memancut keluar dengan laju sampai membanjiri lantai dan merosakkan barang. Saya dah tutup kepala paip tapi air masih keluar.
- Result:
  {
    "calculated_urgency": 3,
    "calculated_impact": 1,
    "final_priority": "High",
    "sla_hours_target": 12,
    "ai_reasoning_en": "Water pipe rupture causing localized flooding in a single room, creating high urgency but low overall impact.",
    "ai_reasoning_ms": "Paip air pecah menyebabkan banjir setempat di dalam sebuah bilik, mewujudkan kecemasan tinggi tetapi impak keseluruhan yang rendah."
  }

Example 3: Medium Priority (Urgency 2, Impact 2, SLA 48)
- Title: Clogged common bathroom toilet bowl / Tandas tersumbat teruk melimpah
- Description: Mangkuk tandas dalam bilik air kongsi unit kami tersumbat sepenuhnya dan air kumbahan melimpah keluar bila di-flush. Sangat berbau busuk dan tak boleh guna langsung oleh 5 orang ahli unit.
- Result:
  {
    "calculated_urgency": 2,
    "calculated_impact": 2,
    "final_priority": "Medium",
    "sla_hours_target": 48,
    "ai_reasoning_en": "Clogged toilet disrupting core hygiene utilities for an entire shared unit apartment.",
    "ai_reasoning_ms": "Tandas tersumbat menjejaskan kemudahan kebersihan utama untuk seluruh unit berkongsi pangsapuri."
  }

Example 4: Medium Priority (Urgency 2, Impact 1, SLA 48)
- Title: Tripped electrical breaker in single bedroom / Power trip satu bilik tidur sahaja
- Description: Socket electrical trip dalam bilik tidur personal saya sahaja selepas saya plug in laptop charger. Roommate lain dalam unit yang sama semua ada letrik, bilik air pun ada power. Kipas bilik saya tak pusing.
- Result:
  {
    "calculated_urgency": 2,
    "calculated_impact": 1,
    "final_priority": "Medium",
    "sla_hours_target": 48,
    "ai_reasoning_en": "Tripped power breaker affecting a single student's bedroom, disrupting core utilities but limited in impact scope.",
    "ai_reasoning_ms": "Pemicu litar elektrik terpelanting menjejaskan bilik tidur seorang pelajar, mengganggu kemudahan utama tetapi terhad dalam skop impak."
  }

Example 5: Low Priority (Urgency 1, Impact 1, SLA 120)
- Title: Wardrobe handle loose / Pemegang almari longgar nak tercabut
- Description: Pemegang pintu almari baju dalam bilik saya longgar gila dan skrunya macam nak tercabut. Sangat susah nak buka pintu almari untuk ambil baju.
- Result:
  {
    "calculated_urgency": 1,
    "calculated_impact": 1,
    "final_priority": "Low",
    "sla_hours_target": 120,
    "ai_reasoning_en": "Minor furniture convenience issue isolated strictly to a single resident's private wardrobe.",
    "ai_reasoning_ms": "Isu kemudahan perabot kecil yang terpencil hanya kepada almari peribadi seorang pemastautin."
  }

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

// ─── Internal Helper — fire-and-forget from complaint submission ──────────────

/**
 * Runs ITIL triage for an existing complaint record and persists the result.
 * Designed for non-blocking fire-and-forget use: errors are caught and logged
 * without propagating, so they never interrupt the submission response.
 *
 * @param complaintId - The DB id of the newly created complaint
 * @param input       - Title, description, and optional image analysis summary
 */
export async function runTriageForComplaint(
  complaintId: string,
  input: { title: string; description: string; imageAnalysisSummary?: string | null }
): Promise<void> {
  try {
    const triageResult = await triageComplaint({
      title: input.title,
      description: input.description,
      imageAnalysisSummary: input.imageAnalysisSummary ?? null,
    });

    const dbPriority = mapToPriority(triageResult.final_priority);

    await db.complaint.update({
      where: { id: complaintId },
      data: {
        priority: dbPriority,
        aiUrgencyScore: triageResult.calculated_urgency,
        aiImpactScore: triageResult.calculated_impact,
        aiSlaHours: triageResult.sla_hours_target,
        aiReasoningEn: triageResult.ai_reasoning_en,
        aiReasoningMs: triageResult.ai_reasoning_ms,
      },
    });

    console.log(
      `[Triage:Auto] Complaint ${complaintId} → Priority: ${triageResult.final_priority} | ` +
        `Urgency: ${triageResult.calculated_urgency} | Impact: ${triageResult.calculated_impact} | ` +
        `SLA: ${triageResult.sla_hours_target}h`
    );
  } catch (err) {
    // Non-blocking: log but never throw — submission must not fail due to triage error
    console.error(`[Triage:Auto] Failed for complaint ${complaintId}:`, err);
  }
}
