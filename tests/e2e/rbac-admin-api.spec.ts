import { expect, test } from "@playwright/test";
import { loginAs } from "./utils/auth";

test.describe("Admin API RBAC", () => {
  test("unauthenticated request to /api/admin/users returns 401", async ({ request }) => {
    const response = await request.get("/api/admin/users");
    expect(response.status()).toBe(401);
  });

  test("student request to /api/admin/users returns 401", async ({ page }) => {
    await loginAs(page, "student");
    const response = await page.request.get("/api/admin/users");
    expect(response.status()).toBe(401);
  });

  test("management request to /api/admin/users returns 401", async ({ page }) => {
    await loginAs(page, "management");
    const response = await page.request.get("/api/admin/users");
    expect(response.status()).toBe(401);
  });

  test("admin request to /api/admin/users returns 200", async ({ page }) => {
    await loginAs(page, "admin");
    const response = await page.request.get("/api/admin/users");
    expect(response.status()).toBe(200);
  });
});

