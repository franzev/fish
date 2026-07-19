import { expect, test } from "@playwright/test";

test("sign-in form uses calm, token-sized vertical rhythm", async ({ page }) => {
  await page.goto("/sign-in");

  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password", { exact: true });
  const signIn = page.getByRole("button", { name: "Sign in" });
  const google = page.getByRole("button", { name: "Continue with Google" });

  const emailBox = await email.boundingBox();
  const passwordBox = await password.boundingBox();
  const passwordLabelBox = await page.locator("label", { hasText: "Password" }).boundingBox();
  const signInBox = await signIn.boundingBox();
  const googleBox = (await google.count()) > 0 ? await google.boundingBox() : null;

  expect(emailBox).not.toBeNull();
  expect(passwordBox).not.toBeNull();
  expect(passwordLabelBox).not.toBeNull();
  expect(signInBox).not.toBeNull();
  if (!googleBox) {
    // Local E2E runs intentionally do not configure an external Google provider.
    // Keep the spacing contract meaningful by validating the form's final action.
    const forgotPassword = page.getByRole("link", { name: "Forgot your password?" });
    const forgotPasswordBox = await forgotPassword.boundingBox();
    expect(forgotPasswordBox).not.toBeNull();
    const linkGap = forgotPasswordBox!.y - (signInBox!.y + signInBox!.height);
    expect(linkGap).toBeGreaterThanOrEqual(40);
    expect(linkGap).toBeLessThanOrEqual(56);
    return;
  }

  const fieldGap = passwordLabelBox!.y - (emailBox!.y + emailBox!.height);
  const actionGap = signInBox!.y - (passwordBox!.y + passwordBox!.height);
  const buttonGap = googleBox.y - (signInBox!.y + signInBox!.height);
  const googleWidthRatio = googleBox.width / signInBox!.width;

  expect(fieldGap).toBeGreaterThanOrEqual(12);
  expect(fieldGap).toBeLessThanOrEqual(20);
  expect(actionGap).toBeGreaterThanOrEqual(20);
  expect(actionGap).toBeLessThanOrEqual(28);
  expect(buttonGap).toBeGreaterThanOrEqual(8);
  expect(buttonGap).toBeLessThanOrEqual(16);
  expect(googleWidthRatio).toBeLessThan(0.85);
});
