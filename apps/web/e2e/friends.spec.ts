import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function localEnv(name: string): string {
  const configured = process.env[name];
  if (configured) return configured;
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const line = content.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
  if (!value) throw new Error(`Missing ${name} for friends E2E coverage.`);
  return value;
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test.describe.serial("client friendships", () => {
  const supabaseUrl = localEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = localEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let franz: { id: string; username: string };
  let sam: { id: string; username: string };

  async function cleanupPair() {
    const pair = [franz.id, sam.id];
    await admin.from("friendships").delete()
      .or(`user_low_id.in.(${pair.join(",")}),user_high_id.in.(${pair.join(",")})`);
    await admin.from("user_notifications").delete()
      .or(`recipient_id.in.(${pair.join(",")}),actor_id.in.(${pair.join(",")})`);
    await admin.from("user_blocks").delete()
      .or(`blocker_id.in.(${pair.join(",")}),blocked_id.in.(${pair.join(",")})`);
    await admin.from("friend_requests").delete()
      .or(`sender_id.in.(${pair.join(",")}),recipient_id.in.(${pair.join(",")})`);
  }

  test.beforeAll(async () => {
    const { data, error } = await admin
      .from("profiles")
      .select("id, username, display_name")
      .in("display_name", ["Franz Eva", "Sam Okafor"]);
    if (error) throw error;
    const franzRow = data?.find((profile) => profile.display_name === "Franz Eva");
    const samRow = data?.find((profile) => profile.display_name === "Sam Okafor");
    if (!franzRow || !samRow) throw new Error("Friend E2E fixtures are missing.");
    franz = { id: franzRow.id, username: franzRow.username };
    sam = { id: samRow.id, username: samRow.username };
    const gate = await admin
      .from("feature_flags")
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq("key", "friends");
    if (gate.error) throw gate.error;
    await cleanupPair();
  });

  test.afterAll(async () => {
    await cleanupPair();
    await admin
      .from("feature_flags")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("key", "friends");
  });

  test("sends, accepts, blocks, and unblocks through the real UI", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const franzContext = await browser.newContext();
    const samContext = await browser.newContext();
    const franzPage = await franzContext.newPage();
    const samPage = await samContext.newPage();

    try {
      await Promise.all([
        signIn(franzPage, "client1@fish.dev"),
        signIn(samPage, "client2@fish.dev"),
      ]);

      await franzPage.goto("/channels/general");
      const samProfileTrigger = franzPage
        .getByRole("button", { name: "View Sam Okafor profile" })
        .last();
      await samProfileTrigger.scrollIntoViewIfNeeded();
      await samProfileTrigger.focus();
      await samProfileTrigger.press("Enter");
      await expect(
        franzPage.getByRole("dialog", { name: "Sam Okafor" })
      ).toBeVisible();
      await franzPage.getByRole("button", { name: "Add friend" }).click();
      await expect(franzPage.getByText(/Request sent/)).toBeVisible();

      await samPage.getByRole("link", { name: /^Friends/ }).click();
      await samPage.getByRole("link", { name: /friend request is waiting/i }).click();
      await samPage.getByRole("link", { name: /Franz Eva/ }).click();
      await samPage.getByRole("button", { name: "Accept request" }).click();
      await expect(samPage).toHaveURL(/\/friends$/);

      await samPage.goto("/channels/general");
      const franzProfileTrigger = samPage
        .getByRole("button", { name: "View Franz Eva profile" })
        .last();
      await franzProfileTrigger.scrollIntoViewIfNeeded();
      await franzProfileTrigger.focus();
      await franzProfileTrigger.press("Enter");
      await samPage
        .getByRole("button", { name: "More actions for Franz Eva" })
        .click();
      await samPage.getByRole("menuitem", { name: "Block member" }).click();
      await expect(
        samPage.getByText(/still see each other’s community messages/i)
      ).toBeVisible();
      await samPage.getByRole("button", { name: "Block", exact: true }).click();
      await expect(
        samPage.getByText(/Franz Eva is blocked/i)
      ).toBeVisible();

      await samPage
        .getByRole("button", { name: "Close Franz Eva profile" })
        .click();
      await samPage.getByRole("link", { name: /^Friends/ }).click();
      await samPage.getByRole("link", { name: "Blocked people" }).click();
      await expect(samPage).toHaveURL(/\/friends\/blocked$/);
      await expect(samPage.getByText("Franz Eva")).toBeVisible();
      await samPage.getByRole("button", { name: "Unblock" }).click();
      await expect(
        samPage.getByText("Franz Eva is no longer blocked.")
      ).toBeVisible();
      await expect(samPage.getByText("No one is blocked right now.")).toBeVisible();
    } finally {
      await Promise.all([franzContext.close(), samContext.close()]);
    }
  });
});
