import { expect, test } from "@playwright/test";

test("client adds, removes, and restores a reaction through the emoji picker", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/channels/general");
  const messageBody = `Reaction verification ${Date.now()}`;
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(messageBody);
  await page.getByRole("button", { name: "Send message" }).click();

  const message = page.getByText(messageBody, { exact: true }).locator("xpath=ancestor::li[1]");
  await expect(message).toBeVisible();
  const addReaction = message.getByRole("button", { name: "Add a reaction" });
  const ownReaction = message.getByRole("button", {
    name: "👍 reaction, 1 person, including you",
  });

  async function chooseThumbsUp() {
    await message.hover();
    await addReaction.click();
    const picker = page.getByRole("dialog", { name: "Choose an emoji" });
    await picker.getByRole("searchbox", { name: "Search emoji" }).fill("thumbs up");
    await picker.getByRole("button", { name: "thumbs up", exact: true }).click();
  }

  await chooseThumbsUp();
  await expect(ownReaction).toHaveAttribute("aria-pressed", "true");

  await ownReaction.click();
  await expect(ownReaction).toHaveCount(0);

  await chooseThumbsUp();
  await expect(ownReaction).toHaveAttribute("aria-pressed", "true");
  await page.reload();

  const persistedMessage = page
    .getByText(messageBody, { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(
    persistedMessage.getByRole("button", {
      name: "👍 reaction, 1 person, including you",
    }),
  ).toHaveAttribute("aria-pressed", "true");
});
