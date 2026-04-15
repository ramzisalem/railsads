import { test, expect } from "@playwright/test";

test.describe("Public page navigation", () => {
  test("404 page shows for unknown routes", async ({ page }) => {
    const response = await page.goto("/this-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.locator("text=Page not found")).toBeVisible();
  });

  test("forgot-password page is accessible", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator("h1")).toContainText("Reset password");
  });
});
