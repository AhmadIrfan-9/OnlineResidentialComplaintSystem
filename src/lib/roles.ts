export const normalizeRoleKey = (role: unknown): string =>
  String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/[ /-]+/g, "_");

export const isStudentRole = (role: unknown): boolean =>
  normalizeRoleKey(role) === "STUDENT";

export const isManagementRole = (role: unknown): boolean => {
  const normalized = normalizeRoleKey(role);
  return normalized === "MANAGEMENT" || normalized === "IT_STAFF_ADMIN";
};

