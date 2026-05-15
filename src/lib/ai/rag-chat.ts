/**
 * src/lib/ai/rag-chat.ts
 *
 * Hybrid RAG Chat pipeline:
 *   1. Detects whether the question needs live DB stats
 *   2. Embeds the question and searches the document vault
 *   3. Optionally queries live complaint DB for statistics
 *   4. Builds a grounded context window and calls OpenAI Chat
 *
 * Access:  all authenticated roles can query
 * Upload:  MANAGEMENT + IT_STAFF_ADMIN only (enforced at API layer)
 */

import OpenAI from "openai";
import { db } from "@/lib/db";
import { getEmbedding } from "./embeddings";
import { searchVault, type VaultChunkResult } from "./rag-vault";

// ─── OpenAI singleton ─────────────────────────────────────────────────────────

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("[RAG-Chat] OPENAI_API_KEY not set.");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatSource {
  docTitle: string;
  docFilename: string;
  similarity: number;
}

export interface ChatAnswer {
  answer: string;
  sources: ChatSource[];
  usedLiveData: boolean;
  latencyMs: number;
}

// ─── 1. Intent detection — does this need live DB data? ──────────────────────

const STATS_KEYWORDS = [
  "how many", "count", "total", "number of",
  "yesterday", "today", "this week", "last week", "this month",
  "pending", "resolved", "closed", "in progress", "overdue",
  "average", "avg", "rate", "sla", "compliance",
  "complaint", "ticket", "report", "summary",
  "category", "hostel", "block", "room",
];

export function needsLiveData(question: string): boolean {
  const q = question.toLowerCase();
  return STATS_KEYWORDS.some((kw) => q.includes(kw));
}

// ─── 2. Live DB stats query ───────────────────────────────────────────────────

export interface LiveStats {
  totalComplaints: number;
  byStatus: Record<string, number>;
  pendingToday: number;
  resolvedToday: number;
  resolvedYesterday: number;
  openOverdue: number;          // open > 30 days
  avgResolutionDays: number;
  topCategories: Array<{ category: string; count: number }>;
}

export async function fetchLiveStats(
  userId: string,
  role: string,
  hostelIds?: string[]
): Promise<LiveStats> {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);

  // If management, scope to their assigned hostels
  let scopedHostelIds: string[] | undefined = hostelIds;
  if (role === "MANAGEMENT" && !scopedHostelIds) {
    const hostels = await db.hostel.findMany({
      where: { wardenId: userId },
      select: { id: true },
    });
    scopedHostelIds = hostels.map((h) => h.id);
  }

  const where = scopedHostelIds?.length
    ? { hostelId: { in: scopedHostelIds } }
    : {};

  const [allComplaints, resolvedComplaints] = await Promise.all([
    db.complaint.findMany({
      where,
      select: { id: true, status: true, priority: true, category: true, createdAt: true, resolvedAt: true, updatedAt: true },
    }),
    db.complaint.findMany({
      where: { ...where, status: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, updatedAt: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const c of allComplaints) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  }

  const pendingToday = allComplaints.filter(
    (c) => c.status === "PENDING" && c.createdAt >= todayStart
  ).length;

  const resolvedToday = allComplaints.filter(
    (c) => (c.status === "RESOLVED" || c.status === "CLOSED") && c.updatedAt >= todayStart
  ).length;

  const resolvedYesterday = allComplaints.filter(
    (c) =>
      (c.status === "RESOLVED" || c.status === "CLOSED") &&
      c.updatedAt >= yesterdayStart &&
      c.updatedAt < todayStart
  ).length;

  const openOverdue = allComplaints.filter(
    (c) =>
      (c.status === "PENDING" || c.status === "IN_PROGRESS") &&
      c.createdAt <= thirtyDaysAgo
  ).length;

  const avgResolutionDays =
    resolvedComplaints.length === 0
      ? 0
      : resolvedComplaints.reduce((sum, c) => {
          const end = c.resolvedAt ?? c.updatedAt;
          return sum + (end.getTime() - c.createdAt.getTime()) / 86400000;
        }, 0) / resolvedComplaints.length;

  const categoryCount: Record<string, number> = {};
  for (const c of allComplaints) {
    categoryCount[c.category] = (categoryCount[c.category] ?? 0) + 1;
  }
  const topCategories = Object.entries(categoryCount)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalComplaints: allComplaints.length,
    byStatus,
    pendingToday,
    resolvedToday,
    resolvedYesterday,
    openOverdue,
    avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
    topCategories,
  };
}

// ─── 3. Context window builder ────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are ORCS AI Assistant — the intelligent knowledge helper for UNITEN Residential Complaint System.

You have access to two sources of information:
1. KNOWLEDGE BASE — uploaded hostel policy documents, SOPs, and handbooks.
2. LIVE DATA — real-time statistics from the complaint database.

STRICT RULES:
- Only cite facts that appear in the KNOWLEDGE BASE or LIVE DATA sections below.
- If neither section contains the answer, say clearly: "I don't have that information in my knowledge base."
- For numbers/statistics, always reference the LIVE DATA section.
- For policy, procedures, or regulations, always cite the document title and relevant excerpt.
- Be concise, professional, and helpful.
- Respond in the same language the user uses (English or Malay).`;
}

function buildUserMessage(
  question: string,
  chunks: VaultChunkResult[],
  liveStats: LiveStats | null
): string {
  let context = "";

  if (liveStats) {
    context += `--- LIVE DATA (as of right now) ---
Total complaints: ${liveStats.totalComplaints}
By status: ${Object.entries(liveStats.byStatus).map(([s, n]) => `${s}: ${n}`).join(", ")}
New today: ${liveStats.pendingToday} | Resolved today: ${liveStats.resolvedToday} | Resolved yesterday: ${liveStats.resolvedYesterday}
Open & overdue (>30 days): ${liveStats.openOverdue}
Average resolution time: ${liveStats.avgResolutionDays} days
Top categories: ${liveStats.topCategories.map((c) => `${c.category} (${c.count})`).join(", ")}

`;
  }

  if (chunks.length > 0) {
    context += `--- KNOWLEDGE BASE (${chunks.length} relevant sections) ---\n`;
    context += chunks
      .map(
        (c, i) =>
          `[${i + 1}] From "${c.docTitle}" (similarity: ${(c.similarity * 100).toFixed(0)}%)\n${c.content}`
      )
      .join("\n\n");
    context += "\n\n";
  }

  if (!liveStats && chunks.length === 0) {
    context = "No relevant documents or live data available for this question.\n\n";
  }

  return `${context}--- QUESTION ---\n${question}`;
}

// ─── 4. Full chat pipeline ────────────────────────────────────────────────────

export async function answerQuestion(
  question: string,
  userId: string,
  role: string
): Promise<ChatAnswer> {
  const t0 = Date.now();

  // Embed question + search vault in parallel with intent detection
  const [embedding, useLive] = await Promise.all([
    getEmbedding(question),
    Promise.resolve(needsLiveData(question)),
  ]);

  const [chunks, liveStats] = await Promise.all([
    searchVault(embedding, 6, 0.58),
    useLive ? fetchLiveStats(userId, role) : Promise.resolve(null),
  ]);

  const userMessage = buildUserMessage(question, chunks, liveStats);

  const completion = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user",   content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "Sorry, I could not generate a response.";

  // Deduplicate sources
  const seenDocs = new Set<string>();
  const sources: ChatSource[] = [];
  for (const c of chunks) {
    if (!seenDocs.has(c.documentId)) {
      seenDocs.add(c.documentId);
      sources.push({ docTitle: c.docTitle, docFilename: c.docFilename, similarity: c.similarity });
    }
  }

  return {
    answer,
    sources,
    usedLiveData: useLive,
    latencyMs: Date.now() - t0,
  };
}
