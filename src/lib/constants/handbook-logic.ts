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
    },
    DUTY_ROSTER_APRIL_2026: {
      location: "CENDEKIAWAN RESIDENCY",
      principals: [
        { name: "Mr. Shahanif Izham", phone: "012-215 5785" },
        { name: "Dr. Lim Kok Cheng", phone: "016-218 8321" }
      ],
      fellows: [
        { name: "Mr. Mohd", apartment: "C1-00-01", phone: "012-267 7003" },
        { name: "Mr. Hisyam", apartment: "C1-00-03", phone: "013-933 1817" },
        { name: "Mr. Azman", apartment: "C1-00-05", phone: "018-661 6068" },
        { name: "Mr. Asmad", apartment: "C2-00-03", phone: "013-436 6510" },
        { name: "Mr. Asyrof", apartment: "C2-00-01", phone: "019-409 6766" },
        { name: "Mr. Taqiuddin", apartment: "C3-00-01", phone: "013-299 8373" },
        { name: "Mr. Saufi", apartment: "C3-00-03", phone: "016-274 6624" },
        { name: "Mr. Rizal", apartment: "C3-00-04", phone: "018-207 2050" }
      ],
      schedule: {
        1: "Mr. Rizal", 2: "Mr. Mohd", 3: "Mr. Hisyam", 4: "Mr. Taqiuddin", 5: "Mr. Asyrof",
        6: "Mr. Azman", 7: "Mr. Asmad", 8: "Mr. Saufi", 9: "Mr. Hisyam", 10: "Mr. Rizal",
        11: "Mr. Taqiuddin", 12: "Mr. Rizal", 13: "Mr. Asmad", 14: "Mr. Rizal", 15: "Mr. Asyrof",
        16: "Mr. Taqiuddin", 17: "Mr. Azman", 18: "Mr. Mohd", 19: "Mr. Hisyam", 20: "Mr. Taqiuddin",
        21: "Mr. Asmad", 22: "Mr. Azman", 23: "Mr. Saufi", 24: "Mr. Mohd", 25: "Mr. Azman",
        26: "Mr. Saufi", 27: "Mr. Mohd", 28: "Mr. Hisyam", 30: "Mr. Asyrof"
      },
      duty_hours: {
        weekdays: "5.30pm until 6.00am next day",
        weekends_holidays: "7.00am until 6.00am next day",
        office_hours: "Cendekiawan office at block C2 ground floor"
      },
      contact_methods: ["Call", "SMS", "WhatsApp"]
    }
  }
};
