export const normalizeStudentIdentifier = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@student.orcs.local`;
};

