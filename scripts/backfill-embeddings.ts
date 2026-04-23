/**
 * scripts/backfill-embeddings.ts
 *
 * One-time backfill script: computes and stores embeddings for all
 * RESOLVED or CLOSED complaints that don't yet have an embedding record.
 *
 * Run with:
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Prerequisites:
 *   - OPENAI_API_KEY in .env
 *   - pgvector extension enabled on Supabase
 *   - add_pgvector_tables.sql migration applied
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { getComplaintEmbedding } from "../src/lib/ai/embeddings";
import { upsertComplaintEmbedding } from "../src/lib/ai/retrieval";

const prisma = new PrismaClient();

const BATCH_SIZE = 5;  // Process 5 at a time to avoid rate-limiting OpenAI
const DELAY_MS   = 500; // 500ms between batches

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🔍 Fetching complaints to embed...\n");

  const complaints = await prisma.complaint.findMany({
    where: {
      status: { in: ["RESOLVED", "CLOSED"] },
    },
    include: {
      hostel: { select: { name: true } },
      room:   { select: { roomNumber: true } },
      complaintUpdates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`📊 Found ${complaints.length} resolved/closed complaints to process.\n`);

  let succeeded = 0;
  let skipped   = 0;
  let failed    = 0;

  // Process in batches
  for (let i = 0; i < complaints.length; i += BATCH_SIZE) {
    const batch = complaints.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (c) => {
        try {
          const embedding = await getComplaintEmbedding({
            title: c.title,
            description: c.description,
            category: c.category,
            hostelName: c.hostel.name,
            hostelBlock: c.locationBlock,
            roomNumber: c.room.roomNumber,
          });

          const resolutionSnap = c.complaintUpdates[0]?.content ?? null;

          await upsertComplaintEmbedding({
            id: randomUUID(),
            complaintId: c.id,
            category: c.category,
            hostelName: c.hostel.name,
            hostelBlock: c.locationBlock,
            descriptionSnap: c.description.slice(0, 500),
            resolutionSnap: resolutionSnap?.slice(0, 300) ?? null,
            embedding,
          });

          succeeded++;
          console.log(`  ✅ [${succeeded + failed}/${complaints.length}] ${c.id.slice(0, 8)}… — ${c.category}`);
        } catch (err) {
          failed++;
          console.error(`  ❌ Failed: ${c.id.slice(0, 8)}… — ${(err as Error).message}`);
        }
      })
    );

    // Throttle between batches
    if (i + BATCH_SIZE < complaints.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`
╔══════════════════════════════════════════╗
║        Backfill Complete                 ║
╠══════════════════════════════════════════╣
║  ✅ Succeeded : ${String(succeeded).padEnd(24)} ║
║  ⏭️  Skipped   : ${String(skipped).padEnd(24)} ║
║  ❌ Failed    : ${String(failed).padEnd(24)} ║
╚══════════════════════════════════════════╝
  `);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
