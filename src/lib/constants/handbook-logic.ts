/**
 * src/lib/constants/handbook-logic.ts
 * 
 * Ground Truth: UNITEN Student Handbook Fines & Penalties Logic Table.
 * Used for automated fine calculation and warden summaries.
 */

export const HANDBOOK_LOGIC = {
  VERSION: "2026.04.28",
  SOURCE: "UNITEN Student Handbook - Residential Segment",
  
  CATEGORIES: {
    CLEANING_FAILURE: {
      flat_rate: 10,
      items: [
        "Floor", "Wall", "Door", "Cupboard", "Desk", "Bed", 
        "Mirror", "Window", "Kitchen Cabinets", "Sink", "Rubbish bin"
      ]
    },
    
    DAMAGES: {
      standard: [
        { item: "Curtains", fine: 100, unit: "per piece" },
        { item: "Mattress", fine: 300 },
        { item: "Bed", fine: 100 },
        { item: "Cupboard", fine: 100 },
        { item: "Chair", fine: 100 },
        { item: "Desk", fine: 100 },
        { item: "Faucet", fine: 20 },
        { item: "Shower head", fine: 20 },
        { item: "Cushion", fine: 40 },
        { item: "Cushion cover", fine: 20 },
        { item: "Long settee", fine: 300 },
        { item: "Single settee", fine: 200 },
        { item: "Settee table (large)", fine: 100 },
        { item: "Settee table (small)", fine: 80 },
        { item: "Mirror", fine: 50 },
        { item: "Doorglass", fine: 200 },
        { item: "Window", fine: 200 },
        { item: "Sink", fine: 300 },
        { item: "Toilet bowl", fine: 300 },
        { item: "Sliding door", fine: 300 },
        { item: "Air Conditioner", fine: 1500 },
        { item: "Air conditioner remote", fine: 150 },
        { item: "Water heater", fine: 700 },
        { item: "Fridge", fine: 1000 },
        { item: "Digital door lock set", fine: 1500 },
        { item: "Dining table", fine: 1000 },
        { item: "Dining chair", fine: 200 },
        { item: "New coffee table", fine: 300 }
      ],
      premium: [
        { item: "Study table set", fine: 1000 },
        { item: "Study table chair", fine: 200 },
        { item: "Mirror", fine: 200 },
        { item: "Bed", fine: 1000 },
        { item: "Cupboard", fine: 1000 },
        { item: "New sofa", fine: 1500 }
      ],
      deluxe: [
        { item: "Study table", fine: 500 },
        { item: "Study table chair", fine: 200 },
        { item: "Bed", fine: 800 },
        { item: "Cupboard", fine: 700 },
        { item: "New sofa", fine: 1000 }
      ],
      superior: [
        { item: "New sofa", fine: 1500 }
      ]
    },
    
    VIOLATIONS: {
      administrative: [
        { item: "Loss of card/keys and tag", fine: 30 },
        { item: "Loss of key", fine: 7 },
        { item: "Loss of tag only", fine: 13 },
        { item: "Changing room without permission", fine: 50 },
        { item: "Nailing or sticking posters", fine: 10 },
        { item: "Not switching off lights/fan/faucet", fine: 10 },
        { item: "Hanging clothes (restricted)", fine: 20 },
        { item: "Removing notice boards", fine: 100 }
      ],
      conduct: [
        { item: "Allowing squatters", fine: 50, eviction: "HIGH" },
        { item: "Misusing common facilities", fine: 50 },
        { item: "Duplicating keys", fine: 50, eviction: "MODERATE" },
        { item: "Wearing indecent clothes outside", fine: 50 },
        { item: "Bringing guests into room", fine: 50 },
        { item: "Hanging clothes along corridor", fine: 50 },
        { item: "Smoking", fine: 250, eviction: "MODERATE" },
        { item: "Keeping pets", fine: 100, eviction: "MODERATE" }
      ],
      safety: [
        { item: "Misusing fire prevention equipment", fine: 50, eviction: "IMMEDIATE" },
        { item: "Dirtying & damaging wall/ceiling", fine: 300, unit: "per wall/ceiling" },
        { item: "Gas stove/portable stove", fine: 300, eviction: "IMMEDIATE" },
        { item: "Prohibited items safety violation", fine: "50-300", eviction: "MODERATE" }
      ]
    },
    
    INFRASTRUCTURE: {
      network: [
        { item: "Cable", fine: 200 },
        { item: "Faceplate Module", fine: 30 },
        { item: "Faceplate", fine: 25 }
      ],
      electric: [
        { item: "Prepaid card", fine: 20 },
        { item: "Meter", fine: 400 }
      ]
    }
  },

  OPERATIONAL_LOGIC: {
    AGING: {
      GREEN: { range: [0, 14], label: "Safe Zone", action: "No reminder needed" },
      YELLOW: { range: [15, 30], label: "Warning Zone", action: "Trigger management reminder" },
      RED: { range: [31, 999], label: "Critical Zone", action: "High-visibility bottleneck" }
    },
    LIABILITY: {
      INDIVIDUAL_ROOM: "Only the resident of the specific room is liable.",
      COMMON_AREA: "If responsible party is unknown, the entire unit group is collectively liable for the fine."
    },
    EVICTION_POLICY: {
      REASON: "Serious offenses (Safety/Major Damage) lead to immediate eviction.",
      FINANCIAL_LIABILITY: "Evicted residents remain liable for the full semester's rent."
    },
    SERIOUS_OFFENSES: {
      SMOKING: { fine: 250, status: "Serious Offense" },
      PETS: { fine: 100, action: "Immediate Confiscation" },
      VANDALISM: { item: ["Fire Extinguisher", "Fire Alarm", "Lift"], action: "Full restoration costs charged to resident" }
    },
    SECURITY_RULES: {
      CRITICAL_VIOLATIONS: {
        triggers: ["Smoking", "Opposite Gender Visitor after 10:30 PM", "Drugs", "Alcohol", "Weapons"],
        label: "Critical Security Violation",
        action: "Immediate Management Escalation & Eviction Warning"
      },
      UNAUTHORIZED_STAY: {
        fine: 50,
        rule: "Allowing Squatters",
        action: "Immediate removal of visitor"
      },
      AUTHORITY: {
        final_decision: "Director of Student Affairs",
        rent_liability: "Resident remains liable for full semester's rent even if evicted."
      }
    }
  }
};
