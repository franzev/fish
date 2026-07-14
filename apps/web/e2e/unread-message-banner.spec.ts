import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(home|coach)$/);
}

test("incoming direct messages remain unread until explicitly marked as read", async ({
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

    const initialMarkRead = clientPage.getByRole("button", {
      name: "Mark as read",
    });
    if ((await initialMarkRead.count()) > 0) {
      await initialMarkRead.click();
      await expect(initialMarkRead).toHaveCount(0);
    }

    await signIn(coachPage, "coach@fish.dev", "fish-coach-dev");
    await coachPage.goto(conversationUrl);
    await expect(
      coachPage.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();

    const body = `Unread banner verification ${Date.now()}`;
    await coachPage
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(body);
    await coachPage.getByRole("button", { name: "Send message" }).click();
    await expect(coachPage.locator("li", { hasText: body })).toHaveCount(1);

    const unreadBanner = clientPage.getByRole("region", {
      name: "Unread messages",
    });
    await expect(clientPage.locator("li", { hasText: body })).toHaveCount(1);
    await expect(unreadBanner).toContainText(/1 new message since /);
    const desktopBannerBox = await unreadBanner.boundingBox();
    expect(desktopBannerBox?.height).toBeLessThanOrEqual(40);

    await clientPage.setViewportSize({ width: 375, height: 812 });
    await expect(unreadBanner).toBeVisible();
    const mobileBannerBox = await unreadBanner.boundingBox();
    expect(mobileBannerBox?.height).toBeGreaterThanOrEqual(44);
    expect(
      await unreadBanner.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);

    await unreadBanner.getByRole("button", { name: "Mark as read" }).click();
    await expect(unreadBanner).toHaveCount(0);
  } finally {
    await Promise.all([clientContext.close(), coachContext.close()]);
  }
});
