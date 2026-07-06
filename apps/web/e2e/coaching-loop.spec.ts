import { expect, test, type Page } from "@playwright/test";
import type { Database } from "@fish/supabase";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const client = {
  email: "client1@fish.dev",
  password: "fish-client-dev",
  displayName: "Alex Rivera",
};

const coach = {
  email: "coach@fish.dev",
  password: "fish-coach-dev",
  displayName: "Coach Dana",
};

type LocalEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

type SeedIds = {
  clientId: string;
  coachId: string;
  trackerVersionId: string;
  conversationId: string;
};

function loadLocalEnv(): LocalEnv {
  const envPath = resolve(process.cwd(), ".env.local");
  const contents = readFileSync(envPath, "utf-8");
  const values = new Map<string, string>();

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!key) continue;
    values.set(key, valueParts.join("=").replace(/^["']|["']$/g, ""));
  }

  const supabaseUrl = values.get("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = values.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing local Supabase env for Playwright setup.");
  }

  return { supabaseUrl, serviceRoleKey };
}

const env = loadLocalEnv();
const admin = createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email: string): Promise<string> {
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const found = data.users.find((user) => user.email === email);
    if (found) return found.id;
    if (data.users.length === 0) {
      throw new Error(`Seed user not found: ${email}`);
    }
    page += 1;
  }
}

async function loadSeedIds(): Promise<SeedIds> {
  const [clientId, coachId] = await Promise.all([
    findUserIdByEmail(client.email),
    findUserIdByEmail(coach.email),
  ]);

  const { data: trackerVersion, error: trackerVersionError } = await admin
    .from("tracker_config_versions")
    .select("id")
    .eq("is_active", true)
    .single();
  if (trackerVersionError || !trackerVersion) {
    throw trackerVersionError ?? new Error("Missing active tracker version.");
  }

  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .upsert(
      {
        client_id: clientId,
        coach_id: coachId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,coach_id" }
    )
    .select("id")
    .single();
  if (conversationError || !conversation) {
    throw conversationError ?? new Error("Missing seeded chat conversation.");
  }

  return {
    clientId,
    coachId,
    trackerVersionId: trackerVersion.id as string,
    conversationId: conversation.id as string,
  };
}

async function resetClientOnboarding(clientId: string): Promise<void> {
  const { data: attempts, error: attemptError } = await admin
    .from("onboarding_attempts")
    .select("id")
    .eq("client_id", clientId);
  if (attemptError) throw attemptError;

  const attemptIds = (attempts ?? []).map((attempt) => String(attempt.id));
  if (attemptIds.length > 0) {
    const { error: answerError } = await admin
      .from("onboarding_answers")
      .delete()
      .in("attempt_id", attemptIds);
    if (answerError) throw answerError;
  }

  const { error } = await admin
    .from("onboarding_attempts")
    .delete()
    .eq("client_id", clientId);
  if (error) throw error;
}

async function resetTrackerAssignment(seed: SeedIds): Promise<void> {
  const { data: assignments, error: assignmentReadError } = await admin
    .from("tracker_assignments")
    .select("id")
    .eq("client_id", seed.clientId);
  if (assignmentReadError) throw assignmentReadError;

  const assignmentIds = (assignments ?? []).map((row) => String(row.id));
  if (assignmentIds.length > 0) {
    const { error: entryDeleteError } = await admin
      .from("tracker_entries")
      .delete()
      .in("assignment_id", assignmentIds);
    if (entryDeleteError) throw entryDeleteError;
  }

  const { error: assignmentDeleteError } = await admin
    .from("tracker_assignments")
    .delete()
    .eq("client_id", seed.clientId);
  if (assignmentDeleteError) throw assignmentDeleteError;

  const { error: insertError } = await admin.from("tracker_assignments").insert({
    client_id: seed.clientId,
    coach_id: seed.coachId,
    version_id: seed.trackerVersionId,
  });
  if (insertError) throw insertError;
}

async function resetChat(seed: SeedIds): Promise<void> {
  const { error } = await admin
    .from("messages")
    .delete()
    .eq("conversation_id", seed.conversationId);
  if (error) throw error;

  const { error: readStateError } = await admin.from("message_reads").upsert(
    [
      {
        conversation_id: seed.conversationId,
        user_id: seed.clientId,
        last_read_message_id: null,
      },
      {
        conversation_id: seed.conversationId,
        user_id: seed.coachId,
        last_read_message_id: null,
      },
    ],
    { onConflict: "conversation_id,user_id" }
  );
  if (readStateError) throw readStateError;
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("v1.1 coaching loop smoke", () => {
  let seed: SeedIds;

  test.beforeAll(async () => {
    seed = await loadSeedIds();
  });

  test("onboarding saves and resumes at the next assigned question", async ({ page }) => {
    await resetClientOnboarding(seed.clientId);
    await login(page, client.email, client.password);

    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", {
        name: "Let's get your coach a little context",
      })
    ).toBeVisible();

    await page.getByRole("button", { name: "Speaking in meetings" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await expect(
      page.getByText("What kind of work conversations come up most often?")
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText("Question 2 of 6").first()).toBeVisible();
    await expect(
      page.getByText("What kind of work conversations come up most often?")
    ).toBeVisible();
  });

  test("tracker assignment renders for the seeded client without a chooser", async ({ page }) => {
    await resetTrackerAssignment(seed);
    await login(page, client.email, client.password);

    await page.goto("/tracker");
    await expect(page.getByRole("heading", { name: "Today's check-in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily check-in" })).toBeVisible();
    await expect(page.getByText("Your path")).toBeVisible();
    await expect(
      page.getByRole("list").getByText("Settle into a daily check-in")
    ).toBeVisible();
    await expect(page.getByText("Practice moment")).toBeVisible();
    await expect(page.getByRole("button", { name: "Yes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save entry" })).toBeVisible();
    await expect(page.locator("button.bg-primary")).toHaveCount(1);
    await expect(page.getByText(/streak|score|grade/i)).toHaveCount(0);
  });

  test("client send persists and the coach reads the same conversation", async ({
    browser,
  }) => {
    await resetChat(seed);
    const messageBody = `Playwright hello ${Date.now()}`;

    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    await login(clientPage, client.email, client.password);
    await clientPage.goto("/chat");
    await expect(clientPage.getByRole("heading", { name: coach.displayName })).toBeVisible();
    await clientPage.getByRole("textbox", { name: "Message" }).fill(messageBody);
    await clientPage.getByRole("button", { name: "Send message" }).click();
    await expect(
      clientPage
        .getByRole("log", { name: "Conversation messages" })
        .getByText(messageBody)
    ).toBeVisible();
    await expect(clientPage.getByText("Sent").last()).toBeVisible();
    await clientContext.close();

    const coachContext = await browser.newContext();
    const coachPage = await coachContext.newPage();
    await login(coachPage, coach.email, coach.password);
    await coachPage.goto("/chat");
    await expect(coachPage.getByRole("heading", { name: client.displayName })).toBeVisible();
    await expect(
      coachPage
        .getByRole("log", { name: "Conversation messages" })
        .getByText(messageBody)
    ).toBeVisible();
    await coachContext.close();
  });
});
