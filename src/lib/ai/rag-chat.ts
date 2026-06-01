/**
 * src/lib/ai/rag-chat.ts
 *
 * Extractive RAG Chat pipeline (No Generative AI):
 *   1. Detects whether the question needs live DB stats
 *   2. Searches the document vault via PostgreSQL Full-Text Search
 *   3. Optionally queries live complaint DB for statistics
 *   4. Re-ranks chunks using keyword scoring
 *   5. Returns direct textual extracts from the knowledge base or stats report
 *
 * Access:  all authenticated roles can query
 * Upload:  MANAGEMENT + IT_STAFF_ADMIN only (enforced at API layer)
 */

import { db } from "@/lib/db";
import { searchVault, type VaultChunkResult } from "./rag-vault";

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

// ─── 3. Keyword Scoring & Extractive Formatting ──────────────────────────────────────

function getKeywords(text: string): string[] {
  const stopWords = new Set(["the", "is", "at", "which", "on", "in", "a", "an", "and", "or", "to", "for", "of", "with", "what", "how", "why", "when", "where", "are"]);
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

interface RankedChunk extends VaultChunkResult {
  boostedScore: number;
}

function reRankChunks(chunks: VaultChunkResult[], question: string): VaultChunkResult[] {
  const keywords = getKeywords(question);

  return (chunks.map((chunk): RankedChunk => {
    const lowerContent = chunk.content.toLowerCase();
    const keywordHits = keywords.filter((kw) => lowerContent.includes(kw)).length;
    return { ...chunk, boostedScore: chunk.similarity + keywordHits * 0.05 };
  }) as RankedChunk[])
    .sort((a, b) => b.boostedScore - a.boostedScore)
    .slice(0, 3);
}

function buildExtractiveResponse(
  chunks: VaultChunkResult[],
  liveStats: LiveStats | null
): string {
  let response = "";

  if (liveStats) {
    response += `**📊 Live Data Report**\n`;
    response += `- **Total Complaints:** ${liveStats.totalComplaints}\n`;
    response += `- **New Today:** ${liveStats.pendingToday} | **Resolved Today:** ${liveStats.resolvedToday}\n`;
    response += `- **Average Resolution:** ${liveStats.avgResolutionDays} days\n`;
    response += `- **Open & Overdue (>30 days):** ${liveStats.openOverdue}\n`;
    response += `- **By Status:** ${Object.entries(liveStats.byStatus).map(([s, n]) => `${s}: ${n}`).join(", ")}\n`;
    response += `- **Top Categories:** ${liveStats.topCategories.map((c) => `${c.category} (${c.count})`).join(", ")}\n\n`;
  }

  if (chunks.length > 0) {
    response += `**📑 Knowledge Base Extracts**\n\n`;
    chunks.forEach((c) => {
      response += `> **From "${c.docTitle}"** (Relevance: ${(c.similarity * 100).toFixed(0)}%)\n`;
      response += `> ${c.content.replace(/\n/g, "\n> ")}\n\n`;
    });
  }

  if (!liveStats && chunks.length === 0) {
    response = "No matching records found in the Knowledge Base or Live Data.";
  }

  return response.trim();
}

// ─── 4. Full chat pipeline ────────────────────────────────────────────────────

export async function answerQuestion(
  question: string,
  userId: string,
  role: string
): Promise<ChatAnswer> {
  const t0 = Date.now();

  // Search vault using question text (PostgreSQL Full-Text Search) + check live data need
  const useLive = needsLiveData(question);

  const [chunks, liveStats] = await Promise.all([
    searchVault(question, 10, 0.50), // Pass question string directly for FTS
    useLive ? fetchLiveStats(userId, role) : Promise.resolve(null),
  ]);

  const topChunks = reRankChunks(chunks, question);
  const answer = buildExtractiveResponse(topChunks, liveStats);

  // Deduplicate sources
  const seenDocs = new Set<string>();
  const sources: ChatSource[] = [];
  for (const c of topChunks) {
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
