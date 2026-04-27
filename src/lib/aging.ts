/**
 * src/lib/aging.ts
 * 
 * Logic for calculating complaint aging and visual triggers based on HANDBOOK_LOGIC.
 */

import { HANDBOOK_LOGIC } from "./constants/handbook-logic";

export type AgingCategory = "GREEN" | "YELLOW" | "RED";

export interface AgingInfo {
  category: AgingCategory;
  days: number;
  label: string;
  action: string;
  color: string;
}

/**
 * Calculates the aging info for a complaint based on its creation date.
 */
export function getAgingInfo(createdAt: Date | string): AgingInfo {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - createdDate.getTime());
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const { AGING } = HANDBOOK_LOGIC.OPERATIONAL_LOGIC;

  if (days <= AGING.GREEN.range[1]) {
    return {
      category: "GREEN",
      days,
      label: AGING.GREEN.label,
      action: AGING.GREEN.action,
      color: "emerald", // Tailwind color mapping
    };
  }

  if (days <= AGING.YELLOW.range[1]) {
    return {
      category: "YELLOW",
      days,
      label: AGING.YELLOW.label,
      action: AGING.YELLOW.action,
      color: "amber",
    };
  }

  return {
    category: "RED",
    days,
    label: AGING.RED.label,
    action: AGING.RED.action,
    color: "rose",
  };
}
