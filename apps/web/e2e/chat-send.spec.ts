import { expect, test } from "@playwright/test";

test("client sends a message and it persists as exactly one row after reload", async ({
  page,
}) => {
  const body = `Playwright chat send ${Date.now()}`;

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/channels/general");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await page.getByRole("button", { name: "Send message" }).click();

  // Exactly one matching row proves the send landed without a duplicate.
  // A newest-row-only match is never used here — selecting only the most
  // recent row would silently hide a duplicate instead of proving there is
  // only one.
  const sentRow = page.locator("li", { hasText: body });
  await expect(sentRow).toHaveCount(1);
  // Optimistic rows intentionally appear immediately. The message action bar
  // is rendered only after the Server Action confirms the persisted row, so
  // wait for that stable UI contract before reloading the page.
  await expect(
    sentRow.getByRole("button", { name: "More actions for message" })
  ).toHaveCount(1);
  await expect(page.getByText("Not sent yet")).toHaveCount(0);
  await expect(
    page.getByText("That did not send yet. Keep this open and try again.")
  ).toHaveCount(0);

  // The community feed proves the send lifecycle through persistence, not a
  // per-message Sent/Delivered/Read status tick — the feed intentionally
  // does not render one (calm, one-thing, feed idiom; sketch-findings-fish).
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true })
  ).toBeVisible();
  await expect(page.locator("li", { hasText: body })).toHaveCount(1);
});
