import OpenAI from "openai";
import { z } from "zod";

const EVIDENCE_GUARD_PROMPT = `[Role]
You are the Lead Forensic Auditor for the UNITEN ORCS (Online Residential Complaint System). Your sole purpose is to verify that the visual evidence provided by a student matches their written claim.

[Strict Validation Protocol]
Perform a three-stage analysis of the attached image:
1. Visual Classification: Identify the primary objects, their state (e.g., broken, leaking, stained), and the environment (e.g., bathroom, bedroom, ceiling).
2. Semantic Alignment: Compare the Visual Classification to the Complaint Title and Description.
   - Match Example: Title says "Leaking Tap"; Image shows a faucet with water dripping. (High Confidence)
   - Mismatch Example: Title says "Broken Chair"; Image shows a laptop screen. (Rejection)
3. Contextual Fraud Detection:
   - Check for "Meme" content, unrelated screenshots, or general internet stock photos.
   - Verify if the background matches a typical UNITEN hostel interior (e.g., tiled floors, white walls, standard wooden furniture).

[Rejection Criteria]
* REJECT if the image is a screenshot of a text message.
* REJECT if the image is too blurry to identify the issue.
* REJECT if the image is a random selfie or non-hostel related object.
* REJECT if the image depicts a different room category than the student's registered unit (e.g., a "Premium" bed in a "Standard" room report).

[Output Format - JSON ONLY]
You must return the result in this exact JSON structure:
{
  "decision": "APPROVED" | "REJECTED",
  "confidence_score": <integer 0-100>,
  "ai_description": "<A brief 1-sentence description of what you see.>",
  "rejection_reason": "<Provide if REJECTED, otherwise null>",
  "action": "Proceed to submission" | "Request new photo"
}`;

export const VisionValidationSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  confidence_score: z.number().int().min(0).max(100),
  ai_description: z.string(),
  rejection_reason: z.string().nullable(),
  action: z.enum(["Proceed to submission", "Request new photo"]),
});

export type VisionValidationResult = z.infer<typeof VisionValidationSchema>;

export interface ValidateEvidenceInput {
  imageUrl: string;
  title: string;
  description: string;
  location: string;
}

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("[AI] OPENAI_API_KEY is not configured.");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export async function validateEvidenceImage(input: ValidateEvidenceInput): Promise<VisionValidationResult> {
  const client = getClient();

  const userContext = `[Context]
Complaint Title: ${input.title}
Complaint Description: ${input.description}
Student Location: ${input.location}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    max_tokens: 300,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EVIDENCE_GUARD_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userContext },
          {
            type: "image_url",
            image_url: {
              url: input.imageUrl,
              detail: "low", // Keep it low to save cost and time, high resolution is rarely needed for basic triage
            },
          },
        ],
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "{}";
  
  try {
    const parsed = JSON.parse(rawContent);
    const validated = VisionValidationSchema.parse(parsed);
    return validated;
  } catch (error) {
    console.error("[Vision Validation] Failed to parse LLM response:", error);
    // Fallback to APPROVED to avoid blocking users if the AI fails or hallucinates format
    return {
      decision: "APPROVED",
      confidence_score: 0,
      ai_description: "AI validation failed to parse.",
      rejection_reason: null,
      action: "Proceed to submission",
    };
  }
}
