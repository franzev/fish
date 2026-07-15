import { expect, test } from "@playwright/test";

test("client selects, sends, and reloads a sticker-only message", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/channels/general");
  const log = page.getByRole("log", { name: "Community messages" });
  await expect(log.getByRole("listitem").first()).toBeVisible();
  const otterStickers = log.getByRole("img", { name: /sea otter/i });
  const stickersBeforeSend = await otterStickers.count();

  await page.getByRole("button", { name: "Add emoji, GIF, or sticker" }).click();
  await page.getByRole("tab", { name: /Stickers/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Choose emoji, GIF, or sticker" })
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Search stickers" }).fill("otter");
  await page.getByRole("button", { name: "Add Hello! sticker" }).click();

  await expect(
    page.getByRole("button", { name: "Remove selected sticker", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(otterStickers).toHaveCount(stickersBeforeSend + 1);
  await expect(otterStickers.last()).toBeVisible();
  await expect(page.getByText("Not sent yet")).toHaveCount(0);

  await page.reload();
  await expect(log.getByRole("img", { name: /sea otter/i })).toHaveCount(
    stickersBeforeSend + 1
  );
  await expect(log.getByRole("img", { name: /sea otter/i }).last()).toBeVisible();
});
