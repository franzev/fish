import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname !== "/sign-in");

  const endStaleCall = page.getByRole("button", { name: "End call" });
  if (new URL(page.url()).pathname.startsWith("/calls/")) {
    await expect(endStaleCall).toBeVisible();
    await endStaleCall.click();
  }
  await expect(page).toHaveURL(/\/home$/);
}

async function openMessages(page: Page) {
  await page.goto("/messages");
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const endStaleCall = page.getByRole("button", { name: "End call" });
  await expect(composer.or(endStaleCall)).toBeVisible();
  if (await endStaleCall.isVisible().catch(() => false)) {
    await endStaleCall.click();
  }
  await expect(composer).toBeVisible();
  return composer;
}

test("client edits an own message inline without losing a draft, then confirms deletion", async ({
  page,
}) => {
  await signIn(page);
  const composer = await openMessages(page);
  await expect(page).toHaveURL(/\/messages\//);

  const original = `Own message ${Date.now()}`;
  const revised = `${original} revised`;
  const unsentDraft = `Draft kept ${Date.now()}`;
  await composer.fill(original);
  await page.getByRole("button", { name: "Send message" }).click();

  let row = page.locator("li", { hasText: original });
  await expect(row).toHaveCount(1);
  await row.hover();
  await expect(row.getByRole("button", { name: "Edit message" })).toBeVisible();

  await composer.fill(unsentDraft);
  await row.getByRole("button", { name: "Edit message" }).click();

  const editor = page.getByRole("textbox", { name: "Edit message" });
  await expect(editor).toHaveValue(original);
  await expect(page.getByText("Finish editing the message above")).toBeVisible();
  await expect(composer).toHaveCount(0);

  await editor.fill(revised);
  await page.getByRole("button", { name: "Save changes" }).click();

  row = page.locator("li", { hasText: revised });
  await expect(row).toHaveCount(1);
  const rowId = await row.getAttribute("id");
  expect(rowId).not.toBeNull();
  await expect(composer).toHaveValue(unsentDraft);
  await expect(row.getByText("Edited")).toBeVisible();

  await row.hover();
  await row.getByRole("button", { name: "More actions for message" }).click();
  await page.getByRole("button", { name: "Delete message" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Delete this message?",
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByText(
      "The message will be removed. “Message deleted” will appear in its place."
    )
  ).toBeVisible();
  await expect(row).toContainText(revised);

  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Delete this message?")).toHaveCount(0);

  const actions = page.getByRole("dialog", { name: "Message actions" });
  await actions.getByRole("button", { name: "Delete message" }).click();
  await actions.getByRole("button", { name: "Delete message" }).click();

  await expect(page.locator(`#${rowId}`)).toContainText("Message deleted");
  await composer.fill("");
});

test.describe("touch disclosure", () => {
  test.use({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });

  test("touch keeps one persistent trigger and moves actions into its popover", async ({
    page,
  }) => {
    await signIn(page);
    const composer = await openMessages(page);

    const body = `Touch message ${Date.now()}`;
    await composer.fill(body);
    await page.getByRole("button", { name: "Send message" }).click();

    const row = page.locator("li", { hasText: body });
    const more = row.getByRole("button", { name: "More actions for message" });
    await expect(more).toBeVisible({ timeout: 20_000 });
    await expect(row.getByRole("button", { name: "Edit message" })).toBeHidden();
    await expect(row.getByRole("button", { name: "Add a reaction" })).toBeHidden();

    await more.click();
    const actions = page.getByRole("dialog", { name: "Message actions" });
    await expect(actions.getByRole("button", { name: "Add a reaction" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Reply" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Edit message" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Delete message" })).toBeVisible();

    await actions.getByRole("button", { name: "Delete message" }).click();
    const confirmation = page.getByRole("dialog", {
      name: "Delete this message?",
    });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(actions.getByRole("button", { name: "Edit message" })).toBeVisible();
  });
});
