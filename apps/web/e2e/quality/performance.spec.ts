import { expect, test, type Page } from "@playwright/test";
import { signInAsClient, watchConsole } from "./helpers";

declare global {
  interface Window {
    __fishPerformance?: {
      cls: number;
      events: number[];
      lcp: number;
    };
  }
}

async function installObservers(page: Page) {
  await page.addInitScript(() => {
    const metrics = { cls: 0, events: [] as number[], lcp: 0 };
    window.__fishPerformance = metrics;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 0) metrics.events.push(entry.duration);
      }
    }).observe({
      type: "event",
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit & { durationThreshold: number });
  });
}

async function expectBudgets(page: Page, route: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const scripts = performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/_next/static/") && entry.name.endsWith(".js")) as PerformanceResourceTiming[];
    return {
      ...window.__fishPerformance!,
      javascriptBytes: scripts.reduce((total, entry) => total + entry.transferSize, 0),
    };
  });

  expect(result.lcp, `${route} LCP`).toBeLessThanOrEqual(2_500);
  expect(result.cls, `${route} CLS`).toBeLessThanOrEqual(0.1);
  expect(Math.max(0, ...result.events), `${route} interaction duration`).toBeLessThanOrEqual(200);
  expect(result.javascriptBytes, `${route} transferred JavaScript`).toBeLessThanOrEqual(1_500_000);
}

test("critical public routes stay inside performance budgets", async ({ page }) => {
  await installObservers(page);
  const consoleMessages = watchConsole(page);

  for (const route of ["/", "/sign-in"]) {
    await page.goto(route);
    await expectBudgets(page, route);
  }

  expect(consoleMessages).toEqual([]);
});

test("critical authenticated routes stay inside performance budgets", async ({ page }) => {
  await installObservers(page);
  const consoleMessages = watchConsole(page);
  await signInAsClient(page);
  await expectBudgets(page, "/home");

  await page.goto("/channels/general");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
  await expectBudgets(page, "/channels/general");

  expect(consoleMessages).toEqual([]);
});

test("critical mobile routes stay inside performance budgets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installObservers(page);
  const consoleMessages = watchConsole(page);
  await signInAsClient(page);

  for (const route of ["/home", "/channels/general", "/book"]) {
    await page.goto(route);
    await expectBudgets(page, route);
  }

  expect(consoleMessages).toEqual([]);
});
