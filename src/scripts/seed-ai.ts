/**
 * src/scripts/seed-ai.ts
 *
 * Seeds the complaint_embeddings table with 50 synthetic 'Past Complaints'
 * to serve as Reference Anchors for the Cosine Similarity RAG pipeline.
 */

import { getComplaintEmbedding } from "../lib/ai/embeddings";
import { upsertComplaintEmbedding } from "../lib/ai/retrieval";
import { randomUUID } from "crypto";

// Helper to generate a complaint ID
const genId = (idx: number) => `seed-complaint-${idx}`;

const HISTORICAL_COMPLAINTS = [
  // High Severity / Emergency
  {
    title: "Digital lock battery dead, cannot enter room",
    category: "Maintenance",
    hostelName: "Cendekiawan",
    hostelBlock: "A",
    severityScore: 9,
    outcome: "Resolved in 1 hour. Dispatched emergency technician.",
  },
  {
    title: "Water pipe burst in bathroom",
    category: "Plumbing",
    hostelName: "Cendekiawan",
    hostelBlock: "B",
    severityScore: 10,
    outcome: "Resolved in 2 hours. Main valve shut off immediately.",
  },
  {
    title: "Smoke smell in the corridor",
    category: "Security",
    hostelName: "Cendekiawan",
    hostelBlock: "C",
    severityScore: 10,
    outcome: "Escalated to Fire Department. Resolved. Warning issued.",
  },
  {
    title: "Sparking electrical outlet",
    category: "Electrical",
    hostelName: "Cendekiawan",
    hostelBlock: "D",
    severityScore: 9,
    outcome: "Resolved in 3 hours. Replaced faulty socket. Room power isolated.",
  },
  {
    title: "Student collapsed in lobby",
    category: "Health & Safety",
    hostelName: "Cendekiawan",
    hostelBlock: "A",
    severityScore: 10,
    outcome: "Escalated to emergency services. Ambulance called immediately.",
  },
  {
    title: "Main entrance glass door shattered",
    category: "Maintenance",
    hostelName: "Cendekiawan",
    hostelBlock: "B",
    severityScore: 8,
    outcome: "Resolved in 4 hours. Temporary barricade placed, glass replaced.",
  },
  {
    title: "Stranger sleeping in common room",
    category: "Security",
    hostelName: "Cendekiawan",
    hostelBlock: "C",
    severityScore: 9,
    outcome: "Escalated to campus security. Intruder removed.",
  },

  // Medium Severity / Urgent
  {
    title: "Aircon leaking water onto desk",
    category: "Maintenance",
    hostelName: "Cendekiawan",
    hostelBlock: "A",
    severityScore: 6,
    outcome: "Resolved in 1 day. Aircon serviced and pipe cleared.",
  },
  {
    title: "No hot water in shower",
    category: "Plumbing",
    hostelName: "Cendekiawan",
    hostelBlock: "B",
    severityScore: 5,
    outcome: "Resolved in 2 days. Heater unit replaced.",
  },
  {
    title: "Wifi router blinking red, no internet",
    category: "IT Support",
    hostelName: "Cendekiawan",
    hostelBlock: "C",
    severityScore: 7,
    outcome: "Resolved in 4 hours. Router reset and firmware updated.",
  },
  {
    title: "Loud party next door after midnight",
    category: "Discipline",
    hostelName: "Cendekiawan",
    hostelBlock: "D",
    severityScore: 6,
    outcome: "Resolved. Warden intervened. RM50 fine issued to residents.",
  },
  {
    title: "Washing machine swallowed coins but didn't start",
    category: "Facilities",
    hostelName: "Cendekiawan",
    hostelBlock: "A",
    severityScore: 5,
    outcome: "Resolved in 2 days. Vendor refunded money and repaired machine.",
  },
  {
    title: "Foul smell from rubbish chute",
    category: "Cleanliness",
    hostelName: "Cendekiawan",
    hostelBlock: "B",
    severityScore: 6,
    outcome: "Resolved in 1 day. Cleaners cleared blockage and sanitized.",
  },
  {
    title: "Room window latch broken",
    category: "Maintenance",
    hostelName: "Cendekiawan",
    hostelBlock: "C",
    severityScore: 5,
    outcome: "Resolved in 3 days. Latch replaced.",
  },
  {
    title: "Smoking in corridor",
    category: "Discipline",
    hostelName: "Cendekiawan",
    hostelBlock: "D",
    severityScore: 7,
    outcome: "Escalated to Management. RM100 fine issued.",
  },
  {
    title: "Pantry sink clogged",
    category: "Plumbing",
    hostelName: "Cendekiawan",
    hostelBlock: "A",
    severityScore: 5,
    outcome: "Resolved in 1 day. Plumber cleared food waste.",
  },

  // Low Severity / Routine
  {
    title: "Lightbulb fused in hallway",
    category: "Electrical",
    hostelName: "Cendekiawan",
    hostelBlock: "A",
    severityScore: 3,
    outcome: "Resolved in 2 days. Bulb replaced by maintenance.",
  },
  {
    title: "Chair wheel broken",
    category: "Furniture",
    hostelName: "Cendekiawan",
    hostelBlock: "B",
    severityScore: 2,
    outcome: "Resolved in 4 days. New chair issued from store.",
  },
  {
    title: "Ants in the pantry",
    category: "Pest Control",
    hostelName: "Cendekiawan",
    hostelBlock: "C",
    severityScore: 4,
    outcome: "Resolved in 1 week. Pest control sprayed area.",
  },
  {
    title: "Dusty fan in room",
    category: "Cleanliness",
    hostelName: "Cendekiawan",
    hostelBlock: "D",
    severityScore: 1,
    outcome: "Resolved. Student advised to clean it themselves.",
  },
  {
    title: "Study lamp not working",
    category: "Electrical",
    hostelName: "Cendekiawan",
    hostelBlock: "A",
    severityScore: 2,
    outcome: "Resolved in 3 days. Lamp replaced.",
  },
  {
    title: "Mattress feels uncomfortable",
    category: "Furniture",
    hostelName: "Cendekiawan",
    hostelBlock: "B",
    severityScore: 1,
    outcome: "Rejected. Mattress is within standard age limit.",
  },
  {
    title: "Slow internet connection during peak hours",
    category: "IT Support",
    hostelName: "Cendekiawan",
    hostelBlock: "C",
    severityScore: 3,
    outcome: "Resolved. IT notified and bandwidth allocated.",
  },
  {
    title: "Vending machine out of stock",
    category: "Facilities",
    hostelName: "Cendekiawan",
    hostelBlock: "D",
    severityScore: 1,
    outcome: "Resolved. Vendor notified to restock.",
  },
];

// Add more procedural low/medium severity cases to reach 50
const categories = ["Maintenance", "Plumbing", "Electrical", "IT Support", "Discipline", "Cleanliness"];
const blocks = ["A", "B", "C", "D"];
for (let i = HISTORICAL_COMPLAINTS.length; i < 50; i++) {
  const cat = categories[i % categories.length];
  const block = blocks[i % blocks.length];
  HISTORICAL_COMPLAINTS.push({
    title: `Minor ${cat.toLowerCase()} issue in block ${block}`,
    category: cat,
    hostelName: "Cendekiawan",
    hostelBlock: block,
    severityScore: Math.floor(Math.random() * 4) + 1, // 1-4
    outcome: `Resolved in ${Math.floor(Math.random() * 5) + 1} days. Standard procedure followed.`,
  });
}

async function runSeed() {
  console.log(`[SEED] Starting embedding generation for ${HISTORICAL_COMPLAINTS.length} historical complaints...`);

  let count = 0;
  for (const item of HISTORICAL_COMPLAINTS) {
    count++;
    console.log(`[SEED] Processing ${count}/${HISTORICAL_COMPLAINTS.length}: ${item.title}`);
    
    const embedding = await getComplaintEmbedding({
      title: item.title,
      description: `Historical case: ${item.title}. Severity: ${item.severityScore}/10`,
      category: item.category,
      hostelName: item.hostelName,
      hostelBlock: item.hostelBlock,
      roomNumber: null,
    });

    await upsertComplaintEmbedding({
      id: randomUUID(),
      complaintId: genId(count),
      category: item.category,
      hostelName: item.hostelName,
      hostelBlock: item.hostelBlock,
      descriptionSnap: `Historical case: ${item.title}. Severity: ${item.severityScore}/10`,
      resolutionSnap: `[Severity: ${item.severityScore}/10] ${item.outcome}`,
      embedding,
    });
  }

  console.log(`[SEED] Successfully seeded ${HISTORICAL_COMPLAINTS.length} cases.`);
}

runSeed().catch(console.error);
