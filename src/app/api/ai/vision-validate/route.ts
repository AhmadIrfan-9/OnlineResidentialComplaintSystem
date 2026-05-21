import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateEvidenceBilingual } from "@/lib/ai/vision";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl, title, description, location, category, evidenceId } = body;

    if (!imageUrl || !title || !description || !location) {
      return NextResponse.json(
        { error: "Missing required fields (imageUrl, title, description, location)" },
        { status: 400 }
      );
    }

    const validationResult = await validateEvidenceBilingual({
      imageUrl,
      title,
      description,
      location,
      category: category ?? undefined,
    });

    // Persist AI verification result on the Evidence record when an ID is provided
    if (evidenceId && typeof evidenceId === "string") {
      await db.evidence.update({
        where: { id: evidenceId },
        data: { aiVerified: validationResult.decision === "APPROVED" },
      }).catch(() => {}); // best-effort — never fail the validation response
    }

    return NextResponse.json(validationResult, { status: 200 });
  } catch (error) {
    console.error("[Vision API Error]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during image validation." },
      { status: 500 }
    );
  }
}
