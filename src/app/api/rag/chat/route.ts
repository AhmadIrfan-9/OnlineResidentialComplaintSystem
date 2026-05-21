/**
 * POST /api/rag/chat
 *
 * Hybrid RAG chat endpoint — accessible by all authenticated roles.
 * Body: { question: string }
 * Response: { answer, sources, usedLiveData, latencyMs }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roles";
import { answerQuestion } from "@/lib/ai/rag-chat";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { prefix: "rag-chat", limit: 20, windowSecs: 60 });
  if (limited) return limited;

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question =
    typeof body === "object" &&
    body !== null &&
    "question" in body &&
    typeof (body as Record<string, unknown>).question === "string"
      ? ((body as Record<string, unknown>).question as string).trim()
      : "";

  if (!question || question.length < 3) {
    return NextResponse.json({ error: "Question is too short" }, { status: 400 });
  }

  if (question.length > 1000) {
    return NextResponse.json({ error: "Question exceeds 1000 characters" }, { status: 400 });
  }

  try {
    const role = normalizeRoleKey(session.user.role);
    const result = await answerQuestion(question, session.user.id, role);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error";
    console.error("[RAG-Chat] Error:", message);
    return NextResponse.json(
      {
        answer: "Sorry, I encountered an error processing your question. Please try again.",
        sources: [],
        usedLiveData: false,
        latencyMs: 0,
        error: message,
      },
      { status: 200 }
    );
  }
}
