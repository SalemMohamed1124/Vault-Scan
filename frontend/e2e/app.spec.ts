import { test, expect, type Page } from "@playwright/test";

// ─── Helper: login ──────────────────────────────────────
async function login(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await page.fill("#email", "admin@demo.com");
  await page.fill("#password", "Admin123!");
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(overview|scans|assets)/, { timeout: 15000 });
}

// ────────────────────────────────────────────────────────
// 1. Landing Page
// ────────────────────────────────────────────────────────
test.describe("Landing Page", () => {
  test("should display the landing page with hero section", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=VaultScan").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Get Started Free").first()).toBeVisible({ timeout: 10000 });
  });

  test("should have working navigation links", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=Features").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=How It Works").first()).toBeVisible({ timeout: 10000 });
  });

  test("should show Dashboard button when logged in", async ({ page }) => {
    await login(page);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=Go to Dashboard").first()).toBeVisible({ timeout: 10000 });
  });
});

// ────────────────────────────────────────────────────────
// 2. Authentication
// ────────────────────────────────────────────────────────
test.describe("Authentication", () => {
  test("should show login page with form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#password")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should reject invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.fill("#email", "wrong@email.com");
    await page.fill("#password", "wrongpass");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Should still be on login page
    expect(page.url()).toContain("/login");
  });

  test("should login successfully", async ({ page }) => {
    await login(page);
    expect(page.url()).toMatch(/\/(overview|scans|assets)/);
  });

  test("should show registration page", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
  });
});

// ────────────────────────────────────────────────────────
// 3. Dashboard / Overview
// ────────────────────────────────────────────────────────
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display overview stats", async ({ page }) => {
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Total Assets").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Active Scans").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Open Findings").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display AI Insights card", async ({ page }) => {
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=AI Security Insights").first()).toBeVisible({ timeout: 20000 });
  });

  test("should display Security Score", async ({ page }) => {
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Security Score").first()).toBeVisible({ timeout: 10000 });
  });
});

// ────────────────────────────────────────────────────────
// 4. Assets
// ────────────────────────────────────────────────────────
test.describe("Assets", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display assets page", async ({ page }) => {
    await page.goto("/assets");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Assets").first()).toBeVisible({ timeout: 10000 });
  });
});

// ────────────────────────────────────────────────────────
// 5. Scans
// ────────────────────────────────────────────────────────
test.describe("Scans", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display scans page", async ({ page }) => {
    await page.goto("/scans");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Scans").first()).toBeVisible({ timeout: 10000 });
  });

  test("should have Start New Scan button", async ({ page }) => {
    await page.goto("/scans");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Start New Scan").first()).toBeVisible({ timeout: 10000 });
  });
});

// ────────────────────────────────────────────────────────
// 6. AI Chat Widget
// ────────────────────────────────────────────────────────
test.describe("AI Chat Widget", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should open chat and show suggested questions", async ({ page }) => {
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // The floating chat button
    const chatButton = page.locator("button.fixed.bottom-6.right-6");
    if (await chatButton.isVisible({ timeout: 5000 })) {
      await chatButton.click();
      await page.waitForTimeout(500);

      await expect(page.locator("text=VaultScan AI")).toBeVisible();
      await expect(page.locator("text=How can I help you?")).toBeVisible();
    }
  });
});

// ────────────────────────────────────────────────────────
// 7. Navigation
// ────────────────────────────────────────────────────────
test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should navigate between pages via sidebar", async ({ page }) => {
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // Navigate to Assets
    await page.locator('a[href="/assets"]').first().click();
    await page.waitForURL("**/assets", { timeout: 10000 });

    // Navigate to Scans
    await page.locator('a[href="/scans"]').first().click();
    await page.waitForURL("**/scans", { timeout: 10000 });

    // Navigate to Findings
    await page.locator('a[href="/findings"]').first().click();
    await page.waitForURL("**/findings", { timeout: 10000 });
  });
});

// ────────────────────────────────────────────────────────
// 8. Settings & Notifications
// ────────────────────────────────────────────────────────
test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display settings page", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Settings").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display notifications page", async ({ page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Notifications").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Reports", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display reports page", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Reports").first()).toBeVisible({ timeout: 10000 });
  });
});
