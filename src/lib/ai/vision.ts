import OpenAI from "openai";
import { z } from "zod";

// ─── Bilingual Forensic Auditor System Prompt ─────────────────────────────────
//
// Handles complaints written in English, Bahasa Melayu, or "Manglish" (mixed).
// Follows a 4-step verification protocol and returns dual-language explanations.
// ──────────────────────────────────────────────────────────────────────────────

const BILINGUAL_EVIDENCE_GUARD_PROMPT = `[Role]
You are a Bilingual Forensic Auditor (English & Bahasa Melayu) for the UNITEN ORCS (Online Residential Complaint System). You are the gatekeeper for hostel evidence uploads.

[Task]
Verify if the uploaded image matches the complaint description, regardless of whether the student writes in English or Malay.

[Language Instructions]

Translate Intent: If the text is in Malay, translate it internally to a visual concept.
  - Example: "Sinki tersumbat" → "Clogged sink / Water pooling"
  - Example: "Katil patah" → "Broken bed frame / Splintered wood"
  - Example: "Lampu tak berfungsi" → "Non-functioning light / Dark room"
  - Example: "Paip bocor" → "Leaking pipe / Water dripping"
  - Example: "Dinding retak" → "Cracked wall / Visible wall fracture"
  - Example: "Siling bocor" → "Ceiling leak / Water stain on ceiling"
  - Example: "Tandas tersumbat" → "Clogged toilet / Water not draining"

Vocabulary Support: Recognize common UNITEN hostel terms:
  - asrama = hostel/dormitory
  - felo = fellow (residential advisor)
  - bilik air = bathroom
  - kipas = fan (ceiling or standing)
  - pintu digital = digital lock
  - bilik = room
  - katil = bed
  - almari = wardrobe/cabinet
  - sinki = sink
  - paip = pipe
  - lampu = light/lamp
  - siling = ceiling
  - dinding = wall
  - tingkap = window
  - lantai = floor
  - tandas = toilet
  - penyaman udara / aircond = air conditioner
  - soket elektrik = electrical socket/outlet
  - wayar = wire/cable

[Verification Logic]

Step 1: Read the Title and Description (English or Malay). Detect the input language.

Step 2: Identify the core "Visual Keyword" — the main physical object or condition that SHOULD appear in the image.
  - Example: Title "Broken chair" → Visual Keyword = "Chair with visible damage"
  - Example: Title "Kipas rosak" → Visual Keyword = "Damaged or non-functioning fan"

Step 3: Analyze the image. Does it contain the Visual Keyword?
  - Does the PRIMARY subject of the image match the described issue?
  - Is the environment consistent with a UNITEN hostel interior? (tiled floors, white/cream walls, standard institutional furniture)

Step 4: Apply REJECTION criteria:
  - REJECT if the image is a meme, cartoon, or humorous content.
  - REJECT if the image is a selfie or portrait photo unrelated to facilities.
  - REJECT if the image is a screenshot of a chat, social media, or web page UNLESS the screenshot contains text explicitly related to a UNITEN hostel issue or complaint.
  - REJECT if the image is a generic internet/stock photo not taken in a hostel.
  - REJECT if the image is too blurry or dark to identify ANY facility issue.
  - REJECT if the image shows a COMPLETELY different issue than described (e.g., Title says "Broken chair" but image shows a clean bathroom).

[Tone & Respect]
The Residential Handbook requires a "respectable manner." If the complaint title or description uses rude, vulgar, or offensive language in either language, note this in the explanation but do NOT reject the evidence based on language alone — focus on the IMAGE match.

[Final Decision]
Output a single valid JSON object — NO markdown, NO explanation outside the JSON. DO NOT wrap the response in \`\`\`json ... \`\`\` markdown blocks:
{
  "match": true | false,
  "detected_language": "English" | "Malay" | "Mixed",
  "visual_keyword": "<The core physical object/condition extracted from the complaint>",
  "explanation_en": "<Clear reason in English (1-2 sentences)>",
  "explanation_ms": "<Sebab yang jelas dalam Bahasa Melayu (1-2 ayat)>",
  "confidence": <integer 0-100>,
  "decision": "APPROVED" | "REJECTED",
  "action": "Proceed to submission" | "Request new photo"
}`;

// ─── Zod Schema — validates bilingual LLM output ─────────────────────────────

export const BilingualVisionSchema = z.object({
  match: z.boolean(),
  detected_language: z.enum(["English", "Malay", "Mixed"]),
  visual_keyword: z.string(),
  explanation_en: z.string(),
  explanation_ms: z.string(),
  confidence: z.number().int().min(0).max(100),
  decision: z.enum(["APPROVED", "REJECTED"]),
  action: z.enum(["Proceed to submission", "Request new photo"]),
});

export type BilingualVisionResult = z.infer<typeof BilingualVisionSchema>;

// ─── Legacy schema kept for backward compat if any consumer still uses it ────

export const VisionValidationSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  confidence_score: z.number().int().min(0).max(100),
  ai_description: z.string(),
  rejection_reason: z.string().nullable(),
  action: z.enum(["Proceed to submission", "Request new photo"]),
});

export type VisionValidationResult = z.infer<typeof VisionValidationSchema>;

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface ValidateEvidenceInput {
  /** Publicly accessible image URL or base64 data URI */
  imageUrl: string;
  title: string;
  description: string;
  location: string;
  category?: string;
}

// ─── OpenAI Client Singleton ──────────────────────────────────────────────────

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("[AI] OPENAI_API_KEY is not configured.");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// ─── Bilingual Validation (Primary) ──────────────────────────────────────────

/**
 * Validates an evidence image against the complaint description using the
 * bilingual forensic auditor prompt. Supports English, Bahasa Melayu, and
 * Manglish complaint text.
 *
 * @param input - Image URL (or base64 data URI), complaint title, description, location, category
 * @returns Bilingual validation result with dual-language explanations
 */
export async function validateEvidenceBilingual(
  input: ValidateEvidenceInput
): Promise<BilingualVisionResult> {
  const client = getClient();

  const categoryLine = input.category
    ? `\nComplaint Category: ${input.category}`
    : "";

  const userContext = `[Context]
Complaint Title: ${input.title}
Complaint Description: ${input.description}${categoryLine}
Student Location: ${input.location}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: BILINGUAL_EVIDENCE_GUARD_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userContext },
          {
            type: "image_url",
            image_url: {
              url: input.imageUrl,
              detail: "low",
            },
          },
        ],
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(rawContent);
    const validated = BilingualVisionSchema.parse(parsed);
    return validated;
  } catch (error) {
    console.error("[Bilingual Vision] Failed to parse LLM response:", error);
    console.error("[Bilingual Vision] Raw content:", rawContent);

    // Graceful fallback — approve to avoid blocking users if AI fails
    return {
      match: true,
      detected_language: "English",
      visual_keyword: "Unknown",
      explanation_en:
        "AI validation could not be completed. Evidence has been auto-approved for manual review.",
      explanation_ms:
        "Pengesahan AI tidak dapat diselesaikan. Bukti telah diluluskan secara automatik untuk semakan manual.",
      confidence: 0,
      decision: "APPROVED",
      action: "Proceed to submission",
    };
  }
}

// ─── Legacy Validation (Backward Compat) ─────────────────────────────────────

/**
 * @deprecated Use `validateEvidenceBilingual` instead.
 * Kept for backward compatibility with any existing consumers.
 */
export async function validateEvidenceImage(
  input: ValidateEvidenceInput
): Promise<VisionValidationResult> {
  // Delegate to the bilingual version and map the response
  const bilingual = await validateEvidenceBilingual(input);

  return {
    decision: bilingual.decision,
    confidence_score: bilingual.confidence,
    ai_description: bilingual.explanation_en,
    rejection_reason:
      bilingual.decision === "REJECTED" ? bilingual.explanation_en : null,
    action: bilingual.action,
  };
}
