import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/channels/general");
});

test("from: suggests channel members, searches the full history, and is individually removable", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Search messages" });
  await search.fill("from:");

  const suggestions = page.getByRole("listbox", { name: "From User" });
  await expect(suggestions).toBeVisible();
  await expect(suggestions.getByRole("option")).toHaveCount(9);

  await search.fill("coach");
  const coach = suggestions.getByRole("option", { name: /Patty Cake/i });
  await expect(coach).toBeVisible();
  await coach.click();

  await expect(search).toHaveValue(/from: coach_/i);
  await search.press("End");
  await search.type("Search target");
  await search.press("Enter");

  const results = page.getByRole("complementary", { name: "Search results" });
  await expect(results.getByText(/Search target https:\/\/example.com/)).toBeVisible();
  await expect(results.getByText("Search target plain")).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText(/Welcome to the general channel!/i);

  await search.fill("Search target");
  await search.press("Enter");
  await expect(results.getByText("Search target plain")).toBeVisible();
  await expect(results.getByText(/Search target https:\/\/example.com/)).toBeVisible();

  await results.getByRole("button", { name: "Close search results" }).click();
  await page.getByRole("button", { name: "Clear search" }).click();
  await search.focus();
  const historyMenu = page.getByRole("menu", { name: "Search filters" });
  await expect(historyMenu.getByText("History", { exact: true })).toBeVisible();
  await expect(historyMenu.getByText("Search target", { exact: true })).toHaveCount(2);
});

test("a selected sender alone returns that member's real message history", async ({ page }) => {
  const search = page.getByRole("combobox", { name: "Search messages" });
  await search.fill("from:");

  const suggestions = page.getByRole("listbox", { name: "From User" });
  await search.fill("patty");
  await suggestions.getByRole("option", { name: /Patty Cake/i }).click();
  await search.press("Enter");

  const results = page.getByRole("complementary", { name: "Search results" });
  await expect(results.getByText("No messages match this search.")).toHaveCount(0);
  await expect(
    results.getByText(/Welcome to the general channel!/, { exact: false })
  ).toBeVisible();
});

test("plain text search returns matches while the final word is still partial", async ({ page }) => {
  const search = page.getByRole("combobox", { name: "Search messages" });
  await search.fill("phon");
  await expect(page.getByRole("option", { name: "Search for phon" })).toBeVisible();
  await search.press("Enter");

  const results = page.getByRole("complementary", { name: "Search results" });
  await expect(
    results.getByText(/tips for phone calls/i, { exact: false }).first()
  ).toBeVisible();
  await expect(results.getByText("No messages match this search.")).toHaveCount(0);
});

test("the command menu opens the complete date and criteria editor", async ({ page }) => {
  await page.getByRole("combobox", { name: "Search messages" }).focus();
  const menu = page.getByRole("menu", { name: "Search filters" });
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  await menu.getByRole("menuitem", { name: /More filters/i }).click();

  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Add date" }).click();
  await dialog.getByRole("button", { name: "Date 1", exact: true }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("button", { name: "Next month" }).click();
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("combobox", { name: "Search messages" })).toHaveValue(
    /before: \d{4}-\d{2}-\d{2}/
  );
  await expect(page.getByTestId("search-filter-token")).toBeVisible();
  await expect(page.locator('[aria-label="Applied filters"]')).toHaveCount(0);
});

test("result pagination and sorting stay inside the right sidebar", async ({ page }) => {
  const search = page.getByRole("combobox", { name: "Search messages" });
  await search.fill("a");
  await search.press("Enter");

  const results = page.getByRole("complementary", { name: "Search results" });
  await expect(page).toHaveURL(/\?search=a$/);
  await expect(
    results.getByRole("navigation", { name: "Search result pages" }).getByText("…", { exact: true })
  ).toBeVisible();
  await expect(results.getByRole("button", { name: "3", exact: true })).toBeVisible();
  await expect(results.getByRole("button", { name: "2", exact: true })).toBeVisible();
  await results.getByRole("button", { name: "2", exact: true }).click();
  await expect(results.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/\?search=a&page=2$/);

  await page.reload();
  const restoredResults = page.getByRole("complementary", { name: "Search results" });
  await expect(restoredResults.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Search messages" })).toHaveValue("a");

  await restoredResults.getByRole("button", { name: "Sort", exact: true }).click();
  await page.getByRole("menuitem", { name: "Oldest first" }).click();
  await expect(restoredResults.getByRole("button", { name: "1", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/\?search=a&sort=asc$/);
  await expect(page.getByRole("log", { name: "Community messages" })).toContainText("Welcome to the general channel!");
});
