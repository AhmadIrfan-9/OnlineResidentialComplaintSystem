export const normalizeStudentIdentifier = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@student.orcs.local`;
};

export const normalizeLoginIdentifier = (
  value: string,
  role?: "STUDENT" | "MANAGEMENT" | "IT_STAFF_ADMIN"
): string => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  if (role === "STUDENT") return `${trimmed}@student.orcs.local`;
  return `${trimmed}@orcs.local`;
};

export const buildLoginIdentifierCandidates = (value: string): string[] => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return [];
  if (trimmed.includes("@")) return [trimmed];

  return Array.from(
    new Set([
      `${trimmed}@student.orcs.local`,
      `${trimmed}@orcs.local`,
      `${trimmed}@management.orcs.local`,
      `${trimmed}@admin.orcs.local`,
    ])
  );
};
