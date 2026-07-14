import { expect, test } from "@playwright/test";

test("client opens seeded channels from the full community rail", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/channels/introductions");
  await expect(
    page.getByRole("heading", { name: "# introduce yourself" }),
  ).toBeVisible();
  await expect(page.getByRole("log", { name: "Community messages" })).toContainText(
    "I’m",
  );

  const profileTrigger = page
    .getByRole("button", { name: "View Sam Okafor profile" })
    .last();
  await profileTrigger.scrollIntoViewIfNeeded();
  await profileTrigger.click();
  await expect(
    page.getByRole("dialog", { name: "Sam Okafor" })
  ).toBeVisible();
  await expect(page.getByText("Community member")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Sam Okafor" })
  ).toBeHidden();
  await expect(profileTrigger).toBeFocused();

  const channelNavigation = page.getByRole("navigation", { name: "Channels" });
  await expect(channelNavigation.getByRole("link")).toHaveCount(15);
  await channelNavigation
    .getByRole("link", { name: "coworker culture" })
    .click();
  await expect(page).toHaveURL(/\/channels\/coworker-culture$/);
  await expect(
    page.getByRole("heading", { name: "# coworker culture" }),
  ).toBeVisible();
  await expect(page.getByRole("log", { name: "Community messages" })).toContainText(
    "Small talk",
  );
});
