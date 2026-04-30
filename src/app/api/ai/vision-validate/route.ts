import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateEvidenceBilingual } from "@/lib/ai/vision";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl, title, description, location, category } = body;

    if (!imageUrl || !title || !description || !location) {
      return NextResponse.json(
        {
          error:
            "Missing required fields (imageUrl, title, description, location)",
        },
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

    return NextResponse.json(validationResult, { status: 200 });
  } catch (error) {
    console.error("[Vision API Error]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during image validation." },
      { status: 500 }
    );
  }
}
