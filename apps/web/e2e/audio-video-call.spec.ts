import {
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const testOrigin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

function localEnv(name: string): string {
  const configured = process.env[name];
  if (configured) return configured;
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const line = content.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
  if (!value) throw new Error(`Missing ${name} for call E2E coverage.`);
  return value;
}

const admin = createClient(
  localEnv("NEXT_PUBLIC_SUPABASE_URL"),
  localEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function resetCallFixtures() {
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("display_name", ["Patty Cake", "Franz Eva"]);
  if (profileError) throw profileError;

  const coachId = profiles?.find((profile) => profile.display_name === "Patty Cake")?.id;
  const clientId = profiles?.find((profile) => profile.display_name === "Franz Eva")?.id;
  if (!coachId || !clientId) throw new Error("Call E2E fixtures are missing.");

  const { error } = await admin
    .from("calls")
    .delete()
    .eq("coach_id", coachId)
    .eq("client_id", clientId);
  if (error) throw error;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectHdVideo(page: Page, label: string) {
  const video = page.getByLabel(label);
  await expect(video).toBeVisible();
  await expect.poll(
    () => video.evaluate((element) => (element as HTMLVideoElement).videoWidth),
    { message: `${label} should reach HD width`, timeout: 20_000 }
  ).toBeGreaterThanOrEqual(1280);
  await expect.poll(
    () => video.evaluate((element) => (element as HTMLVideoElement).videoHeight),
    { message: `${label} should reach HD height`, timeout: 20_000 }
  ).toBeGreaterThanOrEqual(720);
}

async function expectPlayingVideo(page: Page, label: string) {
  const video = page.getByLabel(label);
  await expect(video).toBeVisible();
  await expect.poll(
    () => video.evaluate((element) => (element as HTMLVideoElement).videoWidth),
    { timeout: 20_000 }
  ).toBeGreaterThan(0);
  await expect.poll(
    () => video.evaluate((element) => (element as HTMLVideoElement).videoHeight),
    { timeout: 20_000 }
  ).toBeGreaterThan(0);
}

async function closeRecoveredCall(page: Page, destination: "/home" | "/coach") {
  const close = page.getByRole("button", {
    name: /^(End call|Cancel call|Decline)$/,
  }).first();
  if (await close.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await close.click();
  }
  await page.goto(destination);
}

async function callPair(browser: Browser) {
  const coachContext = await browser.newContext();
  const clientContext = await browser.newContext();
  await Promise.all([
    coachContext.grantPermissions(["microphone", "camera"], {
      origin: testOrigin,
    }),
    clientContext.grantPermissions(["microphone", "camera"], {
      origin: testOrigin,
    }),
  ]);
  const coach = await coachContext.newPage();
  const client = await clientContext.newPage();

  // Keep authentication deterministic in the local Next.js development
  // server. Concurrent sign-in requests can race its initial route render and
  // briefly hydrate one context with the other participant's shell.
  await signIn(coach, "coach@fish.dev", "fish-coach-dev");
  await expect(coach).toHaveURL(/\/(?:home|coach)$/, {
    timeout: 20_000,
  });
  await closeRecoveredCall(coach, "/coach");
  await signIn(client, "client1@fish.dev", "fish-client-dev");
  await expect(client).toHaveURL(/\/home$/, {
    timeout: 20_000,
  });
  await closeRecoveredCall(client, "/home");
  if (new URL(coach.url()).pathname === "/home") {
    await coach.goto("/coach");
  }
  await expect(coach).toHaveURL(/\/coach$/, { timeout: 20_000 });

  return {
    coach,
    client,
    close: () => Promise.all([coachContext.close(), clientContext.close()]),
  };
}

test.describe.serial("one-to-one calls", () => {
  test.beforeEach(resetCallFixtures);

  test("audio call connects, mutes, and ends for both participants", async ({
    browser,
  }) => {
    const pair = await callPair(browser);
    try {
      await pair.coach.getByRole("link", { name: /Franz Eva/ }).click();
      const audioCall = pair.coach.getByRole("button", {
        name: "Call Franz Eva",
        exact: true,
      });
      await expect(audioCall).toBeVisible();
      const callStartPath = new URL(pair.coach.url()).pathname;
      await audioCall.click();
      await expect(pair.coach.getByRole("heading", { name: "Calling Franz Eva" }))
        .toBeVisible();
      await expect(pair.coach).toHaveURL(callStartPath);

      await expect(pair.client.getByRole("heading", { name: "Patty Cake is calling" }))
        .toBeVisible();
      await pair.client.getByRole("button", { name: "Answer call" }).click();

      await expect(pair.coach.getByRole("heading", { name: "In call with Franz Eva" }))
        .toBeVisible();
      await expect(pair.client.getByRole("heading", { name: "In call with Patty Cake" }))
        .toBeVisible();
      await pair.client.getByRole("button", { name: "Mute" }).click();
      await expect(pair.client.getByRole("button", { name: "Unmute" })).toBeVisible();

      await pair.coach.getByRole("button", { name: "End call" }).click();
      await expect(pair.coach.getByRole("heading", { name: "Call ended" })).toBeVisible();
      await expect(pair.client.getByRole("heading", { name: "Call ended" })).toBeVisible();
      await expect(pair.coach.getByRole("heading", { name: "Call ended" })).not
        .toBeVisible({ timeout: 7_000 });
      await expect(pair.client.getByRole("heading", { name: "Call ended" })).not
        .toBeVisible({ timeout: 7_000 });
    } finally {
      await pair.close();
    }
  });

  test("video call publishes camera surfaces and ends cleanly", async ({ browser }) => {
    const pair = await callPair(browser);
    try {
      await pair.coach.getByRole("link", { name: /Franz Eva/ }).click();
      await pair.coach.getByRole("button", { name: "Video call Franz Eva" }).click();
      await expect(pair.coach.getByRole("heading", { name: "Video calling Franz Eva" }))
        .toBeVisible();

      await expect(pair.client.getByRole("heading", { name: "Patty Cake is calling" }))
        .toBeVisible();
      await pair.client.getByRole("button", { name: "Answer" }).click();

      await expect(pair.coach).toHaveURL(/\/calls\//);
      await expect(pair.client).toHaveURL(/\/calls\//);
      await expect(pair.coach.getByRole("button", { name: /full screen/i }))
        .toHaveCount(0);

      await Promise.all([
        expectHdVideo(pair.coach, "Your video preview"),
        expectPlayingVideo(pair.coach, "Franz Eva video"),
      ]);

      await pair.client.goto("/messages");
      await expect(pair.client).toHaveURL(/\/calls\//);
      await expect(pair.client.getByLabel("Patty Cake video")).toBeVisible();

      await pair.coach.getByRole("button", { name: "Turn camera off" }).click();
      await expect(pair.coach.getByRole("button", { name: "Turn camera on" }))
        .toBeVisible();

      await pair.client.getByRole("button", { name: "End call" }).click();
      await expect(pair.coach.getByRole("heading", { name: "Call ended" })).toBeVisible();
      await expect(pair.client.getByRole("heading", { name: "Call ended" })).toBeVisible();
    } finally {
      await pair.close();
    }
  });

  test("video quality switches without reconnecting the call", async ({ browser }) => {
    const pair = await callPair(browser);
    try {
      await pair.coach.getByRole("link", { name: /Franz Eva/ }).click();
      await pair.coach.getByRole("button", { name: "Video call Franz Eva" }).click();
      await expect(pair.coach.getByRole("heading", { name: "Video calling Franz Eva" }))
        .toBeVisible();
      await expect(pair.client.getByRole("heading", { name: "Patty Cake is calling" }))
        .toBeVisible();
      await pair.client.getByRole("button", { name: "Answer" }).click();

      await expectPlayingVideo(pair.coach, "Franz Eva video");

      await pair.coach.getByRole("button", { name: "Call settings" }).click();
      const dataSaver = pair.coach.getByRole("switch", {
        name: "Use less data",
      });
      await expect(dataSaver).toHaveAttribute("aria-checked", "false");
      await dataSaver.click();
      await expect(dataSaver).toHaveAttribute("aria-checked", "true");
      await expect.poll(
        () => pair.coach.evaluate(() =>
          window.localStorage.getItem("fish.video-quality-preference")
        )
      ).toBe("data-saver");
      await expectPlayingVideo(pair.coach, "Franz Eva video");
      await expect(pair.coach.getByRole("button", { name: "End call" }))
        .toBeVisible();

      await dataSaver.click();
      await expect(dataSaver).toHaveAttribute("aria-checked", "false");
      await expect.poll(
        () => pair.coach.evaluate(() =>
          window.localStorage.getItem("fish.video-quality-preference")
        )
      ).toBe("auto");
      await expectPlayingVideo(pair.coach, "Franz Eva video");
      await expect(pair.coach.getByRole("button", { name: "End call" }))
        .toBeVisible();

      await pair.client.getByRole("button", { name: "End call" }).click();
      await expect(pair.coach.getByRole("heading", { name: "Call ended" })).toBeVisible();
    } finally {
      await pair.close();
    }
  });

  test("the call stays active while navigating and stays above mobile navigation", async ({ browser }) => {
    const pair = await callPair(browser);
    try {
      await pair.coach.getByRole("link", { name: /Franz Eva/ }).click();
      await pair.coach.getByRole("button", {
        name: "Call Franz Eva",
        exact: true,
      }).click();
      await expect(pair.client.getByRole("heading", { name: "Patty Cake is calling" }))
        .toBeVisible();
      await pair.client.getByRole("button", { name: "Answer call" }).click();
      await expect(pair.client.getByRole("heading", { name: "In call with Patty Cake" }))
        .toBeVisible();

      await pair.client.setViewportSize({ width: 390, height: 844 });
      await pair.client.goto("/messages");

      await expect(pair.client).toHaveURL(/\/messages\//);
      await expect(pair.client.getByRole("heading", { name: "In call with Patty Cake" }))
        .toBeVisible();
      await expect(pair.coach.getByRole("heading", { name: "In call with Franz Eva" }))
        .toBeVisible();

      const callPanel = await pair.client.getByRole("complementary").boundingBox();
      const mobileNavigation = await pair.client.getByRole("navigation", {
        name: "Mobile primary",
      }).boundingBox();
      expect(callPanel).not.toBeNull();
      expect(mobileNavigation).not.toBeNull();
      expect(callPanel!.y + callPanel!.height).toBeLessThanOrEqual(
        mobileNavigation!.y
      );

      await pair.client.getByRole("button", { name: "End call" }).click();
      await expect(pair.client.getByRole("heading", { name: "Call ended" })).toBeVisible();
    } finally {
      await pair.close();
    }
  });
});
