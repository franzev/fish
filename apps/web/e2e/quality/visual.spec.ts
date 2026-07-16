import { expect, test, type Page } from "@playwright/test";
import { signInAsClient } from "./helpers";

const themes = ["light", "dark"] as const;
const viewports = [
  { name: "small-phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function applyStableTheme(page: Page, theme: "light" | "dark") {
  await page.waitForLoadState("networkidle");
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
  }, theme);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

for (const theme of themes) {
  for (const viewport of viewports) {
    if (viewport.name === "small-phone") continue;
    test(`${theme} ${viewport.name} public surfaces`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });

      await page.goto("/sign-in");
      await expect(page).toHaveScreenshot(`sign-in-${theme}-${viewport.name}.png`, {
        animations: "disabled",
        fullPage: true,
      });

      await page.goto("/");
      await expect(page).toHaveScreenshot(`landing-${theme}-${viewport.name}.png`, {
        animations: "disabled",
        fullPage: true,
      });
    });
  }
}

for (const theme of themes) {
  for (const viewport of viewports.slice(0, 2)) {
    test(`${theme} ${viewport.name} authenticated mobile surfaces`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await signInAsClient(page);
      const dynamicCounts = page.locator(".min-w-badge");

      for (const [name, route] of [
        ["home", "/home"],
        ["community-chat", "/channels/general"],
        ["profile", "/profile"],
        ["booking", "/book"],
      ] as const) {
        await page.goto(route);
        await applyStableTheme(page, theme);
        await expect(page).toHaveScreenshot(
          `${name}-${theme}-${viewport.name}.png`,
          {
            animations: "disabled",
            fullPage: true,
            mask: [dynamicCounts],
            maskColor: "rgb(127, 127, 127)",
          }
        );
        if (name === "booking") {
          await page.locator("button[aria-pressed]:visible").first().click();
          await expect(page.getByRole("button", { name: "Book lesson" }))
            .toBeInViewport();
          await expect(page).toHaveScreenshot(
            `booking-selected-${theme}-${viewport.name}.png`,
            {
              animations: "disabled",
              fullPage: true,
            }
          );
        }
      }
    });
  }
}

test("authenticated home and chat visual contract", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAsClient(page);
  const dynamicCounts = page.locator(".min-w-badge");
  await expect(page).toHaveScreenshot("home-authenticated-desktop.png", {
    animations: "disabled",
    fullPage: true,
    mask: [dynamicCounts],
    maskColor: "rgb(127, 127, 127)",
  });

  await page.goto("/channels/general");
  await expect(page).toHaveScreenshot("community-chat-desktop.png", {
    animations: "disabled",
    fullPage: true,
    mask: [dynamicCounts],
    maskColor: "rgb(127, 127, 127)",
  });
});
