import { expect, test } from "@playwright/test";
import { loginAs } from "./utils/auth";

test("unauthenticated user is redirected to /login for protected route", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("student is redirected to /dashboard/student from /dashboard", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard\/student$/);
});

test("management is redirected to /dashboard/warden from /dashboard", async ({ page }) => {
  await loginAs(page, "management");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard\/warden$/);
});

test("admin is redirected to /admin from /dashboard", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/admin$/);
});

