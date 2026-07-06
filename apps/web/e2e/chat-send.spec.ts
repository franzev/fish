import { expect, test } from "@playwright/test";

test("client can send a chat message from the browser", async ({ page }) => {
  const body = `Playwright chat send ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/chat");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await page.getByRole("button", { name: "Send message" }).click();

  const messageRow = page.locator("li", { hasText: body }).last();
  await expect(messageRow).toBeVisible();
  await expect(
    messageRow.getByRole("img", { name: /Sent|Delivered|Read/ })
  ).toBeVisible();
  await expect(messageRow.getByText("Not sent yet")).toHaveCount(0);
  await expect(
    page.getByText("That did not send yet. Keep this open and try again.")
  ).toHaveCount(0);
});
