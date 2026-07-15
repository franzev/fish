import { expect, test } from "@playwright/test";
import { signInAsClient } from "./helpers";

const themes = ["light", "dark"] as const;
const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

for (const theme of themes) {
  for (const viewport of viewports) {
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
