export type ComplaintAgeBand = "GREEN" | "YELLOW" | "RED";

const DAY_MS = 1000 * 60 * 60 * 24;
const ASSIGNMENT_PREFIX = "Assignment set to:";

export const toPendingDays = (createdAt: Date, now: Date = new Date()): number =>
  Math.max(0, (now.getTime() - createdAt.getTime()) / DAY_MS);

export const toAgeBand = (pendingDays: number): ComplaintAgeBand => {
  if (pendingDays > 30) return "RED";
  if (pendingDays > 14) return "YELLOW";
  return "GREEN";
};

export const toAgeBandFromDate = (
  createdAt: Date,
  now: Date = new Date()
): ComplaintAgeBand => toAgeBand(toPendingDays(createdAt, now));

export const ageBandLabel = (band: ComplaintAgeBand): string => {
  if (band === "RED") return "Over 30 days";
  if (band === "YELLOW") return "15-30 days";
  return "0-14 days";
};

export const parseAssignmentText = (content: string): string | null => {
  if (!content.startsWith(ASSIGNMENT_PREFIX)) return null;
  const value = content.slice(ASSIGNMENT_PREFIX.length).trim();
  return value.length > 0 ? value : "Unassigned";
};

export const assignmentComment = (assignee: string): string =>
  `${ASSIGNMENT_PREFIX} ${assignee.trim() || "Unassigned"}`;
