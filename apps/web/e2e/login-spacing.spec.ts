import { expect, test } from "@playwright/test";

test("login form uses calm, token-sized vertical rhythm", async ({ page }) => {
  await page.goto("/login");

  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password", { exact: true });
  const login = page.getByRole("button", { name: "Log in" });
  const google = page.getByRole("button", { name: "Continue with Google" });

  const emailBox = await email.boundingBox();
  const passwordBox = await password.boundingBox();
  const passwordLabelBox = await page.locator("label", { hasText: "Password" }).boundingBox();
  const loginBox = await login.boundingBox();
  const googleBox = await google.boundingBox();

  expect(emailBox).not.toBeNull();
  expect(passwordBox).not.toBeNull();
  expect(passwordLabelBox).not.toBeNull();
  expect(loginBox).not.toBeNull();
  expect(googleBox).not.toBeNull();

  const fieldGap = passwordLabelBox!.y - (emailBox!.y + emailBox!.height);
  const actionGap = loginBox!.y - (passwordBox!.y + passwordBox!.height);
  const buttonGap = googleBox!.y - (loginBox!.y + loginBox!.height);
  const googleWidthRatio = googleBox!.width / loginBox!.width;

  expect(fieldGap).toBeGreaterThanOrEqual(12);
  expect(fieldGap).toBeLessThanOrEqual(20);
  expect(actionGap).toBeGreaterThanOrEqual(20);
  expect(actionGap).toBeLessThanOrEqual(28);
  expect(buttonGap).toBeGreaterThanOrEqual(8);
  expect(buttonGap).toBeLessThanOrEqual(16);
  expect(googleWidthRatio).toBeLessThan(0.85);
});
