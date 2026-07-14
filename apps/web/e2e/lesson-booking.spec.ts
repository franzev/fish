import { expect, test } from "@playwright/test";

test("client books a lesson in the saved 24-hour format", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect.poll(async () =>
    (await page.context().cookies()).some((cookie) => cookie.name.includes("auth-token"))
  ).toBe(true);

  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  const save = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/profile"
  );
  await page.getByRole("group", { name: "Time format" }).getByRole("button", { name: "24 hr" }).click();
  await save;

  await page.getByRole("link", { name: "FISH home" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await Promise.all([
    page.waitForURL(/\/book$/),
    page.getByRole("link", { name: "Book a lesson" }).click(),
  ]);
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);

  const time = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
  const selectedTime = await time.textContent();
  await time.click();
  await page.getByRole("button", { name: "Book lesson" }).click();

  await expect(page).toHaveURL(/\/book\/confirmed\//);
  await expect(page.getByRole("heading", { name: "Your lesson is booked" })).toBeVisible();
  await expect(page.getByText(selectedTime ?? "", { exact: true })).toBeVisible();
  await expect(page.getByText(/Asia\/Manila \(UTC\+8\)/)).toBeVisible();

  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page.getByText("Your next lesson")).toBeVisible();
  await expect(page.getByRole("link", { name: "Book a lesson" })).toHaveCount(0);
});
