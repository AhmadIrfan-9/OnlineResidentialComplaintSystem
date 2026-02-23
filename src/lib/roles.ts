export const normalizeRoleKey = (role: unknown): string =>
  String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/[ /-]+/g, "_");

export const isStudentRole = (role: unknown): boolean =>
  normalizeRoleKey(role) === "STUDENT";

export const isAdminRole = (role: unknown): boolean =>
  normalizeRoleKey(role) === "IT_STAFF_ADMIN";

export const isManagementRole = (role: unknown): boolean => {
  const normalized = normalizeRoleKey(role);
  return normalized === "MANAGEMENT";
};

export const dashboardPathByRole = (role: unknown): string => {
  if (isAdminRole(role)) return "/admin";
  if (isManagementRole(role)) return "/warden/dashboard";
  if (isStudentRole(role)) return "/dashboard/student";
  return "/dashboard";
};
