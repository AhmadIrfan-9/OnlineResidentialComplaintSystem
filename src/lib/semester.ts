/**
 * UNITEN Academic Semester Utility
 *
 * UNITEN follows three academic periods:
 * - Semester 1: September → January
 * - Semester 2: February → June
 * - Short Semester / Break: June → August
 */

export type Semester = {
  name: string;
  start: Date;
  end: Date;
  months: number;
};

/**
 * Returns the UNITEN academic semester that contains the given date.
 */
export const getUnitenSemester = (date: Date): Semester => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0 = Jan)

  // September (8) → January (0 next year)
  if (month >= 8) {
    return {
      name: `Sem 1 ${year}/${year + 1}`,
      start: new Date(year, 8, 1),     // Sept 1
      end: new Date(year + 1, 0, 31),  // Jan 31
      months: 5,
    };
  }

  // January (0) — still part of Sem 1 from previous year
  if (month === 0) {
    return {
      name: `Sem 1 ${year - 1}/${year}`,
      start: new Date(year - 1, 8, 1),  // Sept 1 prev year
      end: new Date(year, 0, 31),       // Jan 31
      months: 5,
    };
  }

  // February (1) → May (4) → Semester 2
  if (month >= 1 && month <= 4) {
    return {
      name: `Sem 2 ${year - 1}/${year}`,
      start: new Date(year, 1, 1),  // Feb 1
      end: new Date(year, 4, 31),   // May 31
      months: 4,
    };
  }

  // June (5) → August (7) → Short Semester / Break
  return {
    name: `Short Sem ${year}`,
    start: new Date(year, 5, 1),  // June 1
    end: new Date(year, 7, 31),   // Aug 31
    months: 3,
  };
};

/**
 * Convenience: returns current semester info.
 */
export const getCurrentSemester = (): Semester => getUnitenSemester(new Date());

/**
 * Returns the number of elapsed days in the current semester (capped at today).
 */
export const getElapsedSemesterDays = (now: Date = new Date()): number => {
  const sem = getUnitenSemester(now);
  const elapsed = now.getTime() - sem.start.getTime();
  return Math.max(0, Math.floor(elapsed / (1000 * 60 * 60 * 24)));
};
