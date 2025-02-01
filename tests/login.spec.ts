import { test, expect } from "@playwright/test";

test("login page shows github login button", async ({ page }) => {
  await page.goto("/");

  // Wait for and verify the login button exists
  const loginButton = page.getByRole("button", {
    name: /sign in with github/i,
  });
  await expect(loginButton).toBeVisible();

  // Verify the welcome text
  await expect(
    page.getByRole("heading", { name: "Welcome to Orepo" })
  ).toBeVisible();
});
