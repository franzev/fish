import { expect, test } from "@playwright/test";
import {
  expectMobileControlTargets,
  expectMobileTextEntrySizes,
  expectNoDocumentOverflow,
  signInAsClient,
  watchConsole,
} from "./helpers";

const viewports = [
  { name: "small-phone", width: 320, height: 568 },
  { name: "compact-phone", width: 360, height: 800 },
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
      if (viewport.width < 768) {
        await expectMobileControlTargets(page);
        await expectMobileTextEntrySizes(page);
        if (route === "/book") {
          await page.locator("button[aria-pressed]:visible").first().click();
          await expect(page.getByRole("button", { name: "Book lesson" }))
            .toBeInViewport();
        }
      }
    }

    expect(consoleMessages).toEqual([]);
  });
}

for (const viewport of [
  viewports[0],
  viewports[1],
  viewports[2],
  viewports[3],
  viewports[5],
]) {
  test(`${viewport.name} keeps authenticated home and chat responsive`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const consoleMessages = watchConsole(page);
    await signInAsClient(page);

    for (const route of [
      "/home",
      "/channels/general",
      "/messages",
      "/notifications",
      "/friends",
      "/profile",
      "/profile/edit",
      "/profile/avatar",
      "/book",
    ]) {
      await page.goto(route);
      await expectNoDocumentOverflow(page);
      if (viewport.width < 768) {
        await expectMobileControlTargets(page);
        await expectMobileTextEntrySizes(page);
      }
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

test("mobile focus is visible and auth does not open the keyboard on arrival", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-in");

  await expect(page.getByLabel("Email")).not.toBeFocused();
  await page.keyboard.press("Tab");
  const focusStyle = await page.locator(":focus-visible").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });

  expect(focusStyle.outlineStyle).toBe("solid");
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focusStyle.outlineColor).not.toBe("transparent");
});

test("mobile expression picker is a dismissible in-viewport sheet", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await signInAsClient(page);
  await page.goto("/channels/general");
  await page.getByRole("button", { name: "Add emoji, GIF, or sticker" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Choose emoji, GIF, or sticker",
  });
  await expect(dialog).toBeInViewport();
  await expect(page.getByRole("button", {
    name: "Close expression picker",
  })).toBeFocused();
  await page.getByRole("button", { name: "Close expression picker" }).click();
  await expect(dialog).toBeHidden();
});
