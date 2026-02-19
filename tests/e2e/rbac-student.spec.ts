import { expect, test } from "@playwright/test";
import { loginAs } from "./utils/auth";

test.describe("STUDENT RBAC", () => {
  test("student can access student interface", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/dashboard/student");
    await expect(page).toHaveURL(/\/dashboard\/student$/);
    await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Submit New Complaint" })).toBeVisible();
  });

  test("student cannot access management pages", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/warden/queue");
    await expect(page).toHaveURL(/\/dashboard\/student$/);
  });

  test("student cannot access admin pages", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard\/student$/);
    await expect(page.getByText("Admin Dashboard")).not.toBeVisible();
  });
});

