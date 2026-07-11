import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

function preferenceSave(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/profile"
  );
}

test("authenticated response applies the persisted theme before the first frame and shell markup", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/profile");
  const appearance = page.getByRole("group", { name: "Appearance" });
  const darkSave = preferenceSave(page);
  await appearance.getByRole("button", { name: "Dark" }).click();
  await darkSave;
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.addInitScript(() => {
    const state = {
      firstAnimationFrameTheme: undefined as string | null | undefined,
      mutations: [] as Array<string | null>,
    };
    Object.assign(window, { __initialThemeState: state });

    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target instanceof HTMLElement) {
          state.mutations.push(record.target.dataset.theme ?? null);
        }
      }
    }).observe(document, {
      attributes: true,
      attributeFilter: ["data-theme"],
      subtree: true,
    });

    requestAnimationFrame(() => {
      state.firstAnimationFrameTheme =
        document.documentElement.dataset.theme ?? null;
    });
  });

  const response = await page.goto("/home");
  expect(response).not.toBeNull();
  expect(consoleErrors).toEqual([]);
  const initialThemeState = await page.evaluate(() =>
    Reflect.get(window, "__initialThemeState")
  );

  expect(initialThemeState.firstAnimationFrameTheme).toBe("dark");
  expect(
    initialThemeState.mutations.every(
      (theme: string | null) => theme === "dark"
    )
  ).toBe(true);

  const html = await response!.text();
  const rootThemeIndex = html.indexOf('data-theme="dark"');
  const shellIndex = html.indexOf("<header");

  expect(response!.ok()).toBe(true);
  expect(rootThemeIndex).toBeGreaterThanOrEqual(0);
  expect(shellIndex).toBeGreaterThan(rootThemeIndex);

  await page.goto("/profile");
  const resetSave = preferenceSave(page);
  await appearance.getByRole("button", { name: "System" }).click();
  await resetSave;
});
