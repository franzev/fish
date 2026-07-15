import { expect, test } from "@playwright/test";
import {
  expectMobileControlTargets,
  expectNoDocumentOverflow,
  signInAsClient,
  watchConsole,
} from "./helpers";

const viewports = [
  { name: "small-phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 2560, height: 1440 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} keeps public flows inside the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const consoleMessages = watchConsole(page);

    for (const route of ["/", "/sign-in", "/signup", "/forgot-password"]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      await expectNoDocumentOverflow(page);
      if (viewport.width < 768) await expectMobileControlTargets(page);
    }

    expect(consoleMessages).toEqual([]);
  });
}

for (const viewport of [viewports[1], viewports[2], viewports[4]]) {
  test(`${viewport.name} keeps authenticated home and chat responsive`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const consoleMessages = watchConsole(page);
    await signInAsClient(page);

    for (const route of ["/home", "/channels/general", "/profile"]) {
      await page.goto(route);
      await expectNoDocumentOverflow(page);
      if (viewport.width < 768) await expectMobileControlTargets(page);
    }

    expect(consoleMessages).toEqual([]);
  });
}

test("text scaling and forced colors preserve the sign-in flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/sign-in");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expectNoDocumentOverflow(page);
});
