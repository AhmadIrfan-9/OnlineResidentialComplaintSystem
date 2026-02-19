import { expect, test } from "@playwright/test";
import { loginAs } from "./utils/auth";

test.describe("MANAGEMENT RBAC", () => {
  test("management can access management interface", async ({ page }) => {
    await loginAs(page, "management");
    await page.goto("/dashboard/warden");
    await expect(page).toHaveURL(/\/dashboard\/warden$/);
    await expect(page.getByText("Pending complaints")).toBeVisible();
    await expect(page.getByRole("link", { name: "Complaint Queue" })).toBeVisible();
  });

  test("management cannot access student pages", async ({ page }) => {
    await loginAs(page, "management");
    await page.goto("/dashboard/student");
    await expect(page).toHaveURL(/\/dashboard\/warden$/);
  });

  test("management cannot access admin pages", async ({ page }) => {
    await loginAs(page, "management");
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/dashboard\/warden$/);
    await expect(page.getByText("User Management")).not.toBeVisible();
  });
});

