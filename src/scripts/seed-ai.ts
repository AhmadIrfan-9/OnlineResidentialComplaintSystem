/**
 * src/scripts/seed-ai.ts
 *
 * Seeds the complaint_embeddings table with 20 ground-truth Anchor Cases
 * to serve as reference points for the Cosine Similarity RAG pipeline.
 */

import { getComplaintEmbedding } from "../lib/ai/embeddings";
import { upsertComplaintEmbedding } from "../lib/ai/retrieval";

const ANCHOR_CASES = [
  {
    id: "001",
    title: "Exposed Wiring",
    description: "There are sparks coming from the wall socket near the bed in C1-04-02.",
    category: "Security/Safety",
    priority: 10,
    reasoning: "Life Safety: Immediate fire hazard."
  },
  {
    id: "002",
    title: "Theft of Laptop",
    description: "My laptop was stolen from my room while I was at class today.",
    category: "Security/Safety",
    priority: 9,
    reasoning: "Criminal Offense: Requires immediate security and police report."
  },
  {
    id: "003",
    title: "Unauthorized Guest",
    description: "An outsider has been staying in room C2-05-01 for the past three nights.",
    category: "Discipline",
    priority: 8,
    reasoning: "Section 7(b): Violation of guest policy; RM50 fine."
  },
  {
    id: "004",
    title: "Smoking in Room",
    description: "Strong smell of cigarette smoke coming from unit C3-02-04.",
    category: "Discipline",
    priority: 8,
    reasoning: "Serious Offense: Prohibited behavior; RM250 fine."
  },
  {
    id: "005",
    title: "Broken Digital Lock",
    description: "The digital keypad at the main door is totally dead; we are locked out.",
    category: "Security/Safety",
    priority: 7,
    reasoning: "Major Asset: High-value equipment (RM1500); limits access."
  },
  {
    id: "006",
    title: "AC Not Cooling",
    description: "The air conditioner in the common area is blowing hot air and making noise.",
    category: "Utilities/Asset",
    priority: 7,
    reasoning: "Major Asset: High-value equipment; affects living conditions."
  },
  {
    id: "007",
    title: "Total Water Cut",
    description: "No water at all in the bathroom or kitchen sinks since this morning.",
    category: "Plumbing",
    priority: 6,
    reasoning: "Essential Utility: Affects basic hygiene and student welfare."
  },
  {
    id: "008",
    title: "Power Trip (Unit)",
    description: "The electricity went out only in our unit after using the kettle.",
    category: "Electrical",
    priority: 6,
    reasoning: "Essential Utility: Disrupts study and daily activities."
  },
  {
    id: "009",
    title: "Clogged Toilet",
    description: "The master bathroom toilet is overflowing and cannot be used.",
    category: "Plumbing",
    priority: 5,
    reasoning: "Basic Hygiene: Health risk and inconvenience."
  },
  {
    id: "010",
    title: "Ants/Pest Issue",
    description: "There is a massive ant infestation in the kitchen cupboards in C1-08-01.",
    category: "Maintenance",
    priority: 5,
    reasoning: "Basic Hygiene: Affects food safety and comfort."
  },
  {
    id: "011",
    title: "Damaged Mattress",
    description: "I noticed a large tear and spring poking out of the provided mattress.",
    category: "Furniture",
    priority: 4,
    reasoning: "Furniture Damage: Replaceable item; potential RM300 fine."
  },
  {
    id: "012",
    title: "Prohibited Item",
    description: "Room check found a high-wattage air fryer being used in the bedroom.",
    category: "Discipline",
    priority: 4,
    reasoning: "Section 7(h): Prohibited electrical appliance; fire risk."
  },
  {
    id: "013",
    title: "Broken Study Chair",
    description: "One of the wheels on my study chair has snapped off.",
    category: "Furniture",
    priority: 3,
    reasoning: "General Repair: Minor furniture replacement."
  },
  {
    id: "014",
    title: "Burnt Lightbulb",
    description: "The ceiling light in the hallway has burnt out and needs a new bulb.",
    category: "Electrical",
    priority: 3,
    reasoning: "General Repair: Simple maintenance task."
  },
  {
    id: "015",
    title: "Squeaky Door",
    description: "The bedroom door makes a very loud noise every time it opens.",
    category: "Maintenance",
    priority: 2,
    reasoning: "General Repair: Minor annoyance; non-urgent."
  },
  {
    id: "016",
    title: "Wall Paint Peeling",
    description: "The paint on the ceiling is starting to peel and flake off.",
    category: "Maintenance",
    priority: 2,
    reasoning: "Cosmetic: Minor aesthetic issue."
  },
  {
    id: "017",
    title: "Loose Cabinet Handle",
    description: "The handle on the kitchen cabinet is loose and about to fall off.",
    category: "Furniture",
    priority: 2,
    reasoning: "General Repair: Minor fix."
  },
  {
    id: "018",
    title: "Stained Curtains",
    description: "The curtains provided in the room have old coffee stains on them.",
    category: "Maintenance",
    priority: 1,
    reasoning: "Cosmetic: Non-functional issue; very low priority."
  },
  {
    id: "019",
    title: "Vandalized Signage",
    description: "Someone has scratched graffiti onto the 'Exit' sign in the corridor.",
    category: "Discipline",
    priority: 8,
    reasoning: "Vandalism: Intentional damage to university property."
  },
  {
    id: "020",
    title: "Broken Window Latch",
    description: "The window in the living room cannot be locked properly.",
    category: "Security/Safety",
    priority: 7,
    reasoning: "Security: High risk of unauthorized entry to the unit."
  }
];

async function runSeed() {
  console.log(`[SEED] Starting embedding generation for ${ANCHOR_CASES.length} Anchor Cases...`);

  let count = 0;
  for (const item of ANCHOR_CASES) {
    count++;
    console.log(`[SEED] Processing ${count}/${ANCHOR_CASES.length}: ${item.title}`);
    
    // We mock the block based on description or just set it to null if not explicit.
    // The embedding function uses these to structure the embedded text.
    const blockMatch = item.description.match(/C[1-3]/);
    const block = blockMatch ? blockMatch[0] : null;

    const embedding = await getComplaintEmbedding({
      title: item.title,
      description: item.description,
      category: item.category,
      hostelName: "Cendekiawan",
      hostelBlock: block,
      roomNumber: null,
    });

    await upsertComplaintEmbedding({
      id: `anchor-${item.id}`,
      complaintId: `anchor-${item.id}`,
      category: item.category,
      hostelName: "Cendekiawan",
      hostelBlock: block,
      descriptionSnap: `Title: ${item.title}\nDescription: ${item.description}`,
      resolutionSnap: `[Priority: ${item.priority}/10] Reasoning: ${item.reasoning}`,
      embedding,
    });
  }

  console.log(`[SEED] Successfully seeded ${ANCHOR_CASES.length} anchor cases.`);
}

runSeed().catch(console.error);
