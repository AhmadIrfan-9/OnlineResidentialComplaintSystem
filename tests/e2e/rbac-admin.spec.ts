import { expect, test } from "@playwright/test";
import { loginAs } from "./utils/auth";

test.describe("ADMIN RBAC", () => {
  test("admin can access admin interface", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Configuration" })).toBeVisible();
    await expect(page.getByRole("link", { name: "User Management" })).toBeVisible();
  });

  test("admin can access management interface", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/warden/queue");
    await expect(page).toHaveURL(/\/warden\/queue$/);
    await expect(page.getByText("Complaint Queue")).toBeVisible();
  });

  test("admin cannot access student interface", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/dashboard/student");
    await expect(page).toHaveURL(/\/dashboard\/warden$/);
  });
});
