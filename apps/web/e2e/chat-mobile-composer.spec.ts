import { expect, test } from "@playwright/test";

test("mobile chat keeps the message composer above the bottom navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/messages");

  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const mobileNavigation = page.getByRole("navigation", {
    name: "Mobile primary",
  });
  await expect(composer).toBeInViewport();
  await expect(mobileNavigation).toBeInViewport();

  const [composerBox, navigationBox] = await Promise.all([
    composer.boundingBox(),
    mobileNavigation.boundingBox(),
  ]);
  expect(composerBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(
    navigationBox!.y
  );
});
