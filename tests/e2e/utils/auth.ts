import { expect, Page } from "@playwright/test";

type RoleKey = "student" | "management" | "admin";

type RoleCredentials = {
  studentId: string;
  password: string;
};

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const roleCredentials = (role: RoleKey): RoleCredentials => {
  if (role === "student") {
    return {
      studentId: requiredEnv("E2E_STUDENT_ID"),
      password: requiredEnv("E2E_STUDENT_PASSWORD"),
    };
  }

  if (role === "management") {
    return {
      studentId: requiredEnv("E2E_MANAGEMENT_ID"),
      password: requiredEnv("E2E_MANAGEMENT_PASSWORD"),
    };
  }

  return {
    studentId: requiredEnv("E2E_ADMIN_ID"),
    password: requiredEnv("E2E_ADMIN_PASSWORD"),
  };
};

export const loginAs = async (page: Page, role: RoleKey): Promise<void> => {
  const credentials = roleCredentials(role);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Student ID").fill(credentials.studentId);
  await page.getByLabel("Password").fill(credentials.password);

  await page.locator("form").filter({ has: page.locator("#studentId") }).getByRole("button", { name: "Login" }).click();

  await expect(page).not.toHaveURL(/\/login$/);
};

