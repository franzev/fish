import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(home|coach)$/);
}

test("an active direct conversation has no unread-message banner", async ({
  browser,
}) => {
  const clientContext = await browser.newContext();
  const coachContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  const coachPage = await coachContext.newPage();

  try {
    await signIn(clientPage, "client1@fish.dev", "fish-client-dev");
    await clientPage.goto("/messages");
    await expect(clientPage).toHaveURL(/\/messages\/[0-9a-f-]+$/);
    const conversationUrl = clientPage.url();

    await signIn(coachPage, "coach@fish.dev", "fish-coach-dev");
    await coachPage.goto(conversationUrl);
    await expect(
      coachPage.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();

    const body = `Active conversation verification ${Date.now()}`;
    await coachPage
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(body);
    await coachPage.getByRole("button", { name: "Send message" }).click();
    await expect(coachPage.locator("li", { hasText: body })).toHaveCount(1);

    await expect(clientPage.locator("li", { hasText: body })).toHaveCount(1);
    await expect(
      clientPage.getByRole("region", { name: "Unread messages" }),
    ).toHaveCount(0);
    await expect(
      clientPage.getByRole("button", { name: "Mark as read" }),
    ).toHaveCount(0);

    await clientPage.setViewportSize({ width: 375, height: 812 });
    await expect(clientPage.locator("li", { hasText: body })).toHaveCount(1);
    await expect(
      clientPage.getByRole("region", { name: "Unread messages" }),
    ).toHaveCount(0);
  } finally {
    await Promise.all([clientContext.close(), coachContext.close()]);
  }
});
