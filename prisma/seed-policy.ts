/**
 * prisma/seed-policy.ts
 *
 * Seeds the `policy_chunks` table with UNITEN Residential Hostel Policy sections.
 * Each section is embedded via OpenAI and stored with its pgvector embedding.
 *
 * Run with:
 *   npx tsx prisma/seed-policy.ts
 *
 * ⚠️  Replace the policyData array below with your actual UNITEN policy document
 *     sections before FYP submission for maximum accuracy.
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { getEmbedding } from "../src/lib/ai/embeddings";
import { upsertPolicyChunk } from "../src/lib/ai/retrieval";

// ─── UNITEN Residential Hostel Policy — Knowledge Base ────────────────────────
// Source: UNITEN Residential College Rules & Regulations
// Replace/extend these with the actual policy PDF text. Each entry should be
// a self-contained chunk (max ~300 words) covering one specific rule or procedure.

const policyData: Array<{
  sectionRef: string;
  category: string | null;
  title: string;
  content: string;
}> = [
  // ── Section 1 — General Rules ──────────────────────────────────────────────
  {
    sectionRef: "Section 1.1",
    category: null,
    title: "General Conduct and Responsibilities",
    content:
      "All residents are required to maintain cleanliness and orderliness in their rooms and common areas at all times. Residents found negligently causing damage to hostel facilities shall be liable for repair costs as determined by the Residential Management Office. Any damage must be reported within 24 hours of discovery.",
  },
  {
    sectionRef: "Section 1.2",
    category: null,
    title: "Complaint Submission Procedure",
    content:
      "Residents must submit all maintenance and facility complaints through the official Online Residential Complaint System (ORCS). Walk-in verbal complaints will not be recorded in the official log. Management shall acknowledge complaints within 4 hours for EMERGENCY cases, 24 hours for URGENT cases, and 5 working days for ROUTINE cases.",
  },

  // ── Section 2 — Plumbing & Water ──────────────────────────────────────────
  {
    sectionRef: "Section 2.1",
    category: "PLUMBING",
    title: "Water Disruption — Emergency Response",
    content:
      "Any report of burst pipes, flooding, water overflow, or water contamination in residential blocks shall be classified as EMERGENCY priority. Management is required to dispatch a licensed plumber from the UNITEN Facilities Department within 2 hours of receiving the complaint. Affected residents must be temporarily relocated if the issue renders the room uninhabitable. The warden must inform the Deputy Director of Residential Affairs within 1 hour.",
  },
  {
    sectionRef: "Section 2.2",
    category: "PLUMBING",
    title: "Routine Plumbing Maintenance",
    content:
      "Routine plumbing issues such as dripping taps, slow drains, or minor leaks that do not cause flooding shall be attended to within 5 working days. Residents should not attempt to repair plumbing fixtures themselves. Use of chemical drain unblockers is prohibited without written permission from the Facilities Department.",
  },
  {
    sectionRef: "Section 2.3",
    category: "PLUMBING",
    title: "Recurrent Water Issues — Escalation Protocol",
    content:
      "If 3 or more complaints regarding water issues are received from the same residential block within any 7-day period, the Facilities Manager must conduct a block-wide pipe inspection within 48 hours. Findings must be submitted to the Director of Residential Affairs in a written report.",
  },

  // ── Section 3 — Electrical ────────────────────────────────────────────────
  {
    sectionRef: "Section 3.1",
    category: "ELECTRIC",
    title: "Electrical Failure — Emergency Protocol",
    content:
      "Total power failure, electrical sparking, burning smell from electrical fittings, or exposed live wiring constitutes an EMERGENCY. Residents must immediately evacuate and contact the warden. The warden must call the UNITEN Electrical Maintenance Team (ext. 4400) and report to TNAGA for external line faults. No resident or non-licensed personnel may interface with the main distribution board. Electrical emergencies must be resolved or made safe within 4 hours.",
  },
  {
    sectionRef: "Section 3.2",
    category: "ELECTRIC",
    title: "Partial Electrical Faults",
    content:
      "Partial electrical issues such as non-functioning power sockets, flickering lights, or tripped circuit breakers in individual rooms shall be attended to within 24 hours (URGENT). Residents must not reset the main circuit breaker without guidance from the Electrical Maintenance Team.",
  },
  {
    sectionRef: "Section 3.3",
    category: "ELECTRIC",
    title: "Prohibited Electrical Equipment",
    content:
      "The use of high-wattage electrical appliances including rice cookers, electric kettles exceeding 500W, electric irons, and air fryers is prohibited in student rooms without express written approval from the Residential Office. Violations may result in confiscation of the appliance and a RM50 compound fine per instance as per Schedule 3 of the Residential Rules.",
  },

  // ── Section 4 — Wi-Fi & Networking ───────────────────────────────────────
  {
    sectionRef: "Section 4.1",
    category: "WIFI",
    title: "Internet Connectivity Complaints",
    content:
      "Wi-Fi complaints affecting a single room are classified as ROUTINE and will be resolved within 3 working days by the IT Infrastructure Team. Complaints affecting an entire residential block or floor are classified as URGENT and must be resolved within 8 business hours. Residents must not install personal Wi-Fi routers or network equipment as this violates the UNITEN Acceptable Use Policy.",
  },
  {
    sectionRef: "Section 4.2",
    category: "WIFI",
    title: "Network Infrastructure Outage",
    content:
      "A total network outage affecting an entire hostel building is classified as EMERGENCY. The IT Department must restore or implement a temporary solution within 4 hours. During prolonged outages exceeding 6 hours, residents are entitled to submit a formal service disruption report to the Residential Quality Assurance Unit for potential rebate consideration.",
  },

  // ── Section 5 — Security ──────────────────────────────────────────────────
  {
    sectionRef: "Section 5.1",
    category: "SECURITY",
    title: "Security Breaches and Intrusions",
    content:
      "Reports of unauthorized persons within the residential block, broken access control systems, stolen property, or physical threats to residents are classified as EMERGENCY. The warden must immediately contact UNITEN Security (ext. 4911) and the Campus Police Liaison Officer. The warden must not attempt to physically intervene. A security incident report must be filed with the Registrar's Office within 2 hours.",
  },
  {
    sectionRef: "Section 5.2",
    category: "SECURITY",
    title: "Access Card and Entry System Faults",
    content:
      "Malfunctioning access card readers, broken gate locks, or non-functional CCTV cameras are classified as URGENT and must be rectified within 24 hours by the Security Systems Maintenance Unit. Temporary security patrols must be increased to every 2 hours during the period of the fault.",
  },

  // ── Section 6 — Noise & Disturbance ──────────────────────────────────────
  {
    sectionRef: "Section 6.1",
    category: "NOISE",
    title: "Quiet Hours and Noise Policy",
    content:
      "Quiet hours in all UNITEN residential hostels are enforced between 11:00 PM and 7:00 AM on weekdays and 12:00 AM to 8:00 AM on weekends. Violations of quiet hours reported by three or more residents shall be treated as URGENT. The warden must issue a written warning to the offender. Repeated violations (3 or more within a semester) may result in hostel expulsion as per Clause 12 of the Residential Agreement.",
  },

  // ── Section 7 — Cleaning & Hygiene ───────────────────────────────────────
  {
    sectionRef: "Section 7.1",
    category: "CLEANING",
    title: "Common Area Cleaning Schedule",
    content:
      "Common areas including corridors, toilets, laundry rooms, and prayer rooms are cleaned by UNITEN's contracted cleaning service twice daily (7:00 AM and 5:00 PM). Residents who observe unsatisfactory cleanliness must report via ORCS. Cleaning complaints will be escalated to the cleaning contractor within 4 hours and rectified before the next scheduled cleaning session.",
  },
  {
    sectionRef: "Section 7.2",
    category: "CLEANING",
    title: "Pest and Vermin Reports",
    content:
      "Any report of rats, cockroaches, bedbugs, or other vermin infestation is classified as URGENT. Management must arrange for a licensed pest control company (from the approved UNITEN vendor list) to inspect and treat the affected area within 48 hours. Residents in severely affected rooms may request temporary relocation per Section 8.3.",
  },

  // ── Section 8 — Furniture & Facilities ───────────────────────────────────
  {
    sectionRef: "Section 8.1",
    category: "FURNITURE",
    title: "Room Furniture Damage and Replacement",
    content:
      "Standard room furniture (bed frame, study desk, wardrobe, chair) damaged through normal wear and tear will be replaced by the Residential Office within 7 working days of a verified complaint. Furniture damaged due to resident negligence will be replaced at the cost of the resident. A formal damage assessment must be conducted by the Residential Facilities Officer before any charges are levied.",
  },

  // ── Section 9 — Maintenance ───────────────────────────────────────────────
  {
    sectionRef: "Section 9.1",
    category: "MAINTENANCE",
    title: "Structural and Civil Maintenance",
    content:
      "Structural issues such as ceiling leaks (non-plumbing), cracked walls, broken windows, or damaged flooring are classified based on safety: EMERGENCY if a safety hazard, URGENT if causing property damage, ROUTINE for cosmetic issues. All structural EMERGENCY cases must be reported to the Director of Facilities Management and the Deputy Vice-Chancellor (Campus Development) within 2 hours.",
  },
  {
    sectionRef: "Section 9.2",
    category: "MAINTENANCE",
    title: "Lift and Elevator Faults",
    content:
      "Lift breakdowns in residential buildings are classified as URGENT. The lift maintenance contractor must be notified within 30 minutes of the complaint, and repairs must be completed or a temporary lift provided within 8 hours. If a student is trapped in a lift, the Fire Brigade (994) must be called immediately — this is an EMERGENCY.",
  },
];

// ─── Seed Runner ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 Seeding ${policyData.length} UNITEN Residential Policy chunks...\n`);

  let succeeded = 0;
  let failed    = 0;

  for (const [index, chunk] of policyData.entries()) {
    try {
      // Embed the combined title + content for richer semantic matching
      const textToEmbed = `${chunk.sectionRef}: ${chunk.title}\n${chunk.content}`;
      const embedding = await getEmbedding(textToEmbed);

      await upsertPolicyChunk({
        id: randomUUID(),
        sectionRef: chunk.sectionRef,
        category: chunk.category,
        title: chunk.title,
        content: chunk.content,
        embedding,
      });

      succeeded++;
      console.log(`  ✅ [${index + 1}/${policyData.length}] ${chunk.sectionRef} — ${chunk.title}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ Failed: ${chunk.sectionRef} — ${(err as Error).message}`);
    }

    // Small delay to respect OpenAI rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`
╔══════════════════════════════════════════╗
║      Policy Seed Complete                ║
╠══════════════════════════════════════════╣
║  ✅ Succeeded : ${String(succeeded).padEnd(24)} ║
║  ❌ Failed    : ${String(failed).padEnd(24)} ║
╚══════════════════════════════════════════╝
  `);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
