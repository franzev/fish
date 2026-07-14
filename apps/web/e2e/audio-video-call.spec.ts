import {
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

const testOrigin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function measureVideoFps(page: Page, label: string) {
  return page.getByLabel(label).evaluate((element) => {
    const video = element as HTMLVideoElement;
    return new Promise<number>((resolve) => {
      const startedAt = performance.now();
      let frames = 0;
      let settled = false;
      const finish = (now: number) => {
        if (settled) return;
        settled = true;
        resolve((frames * 1_000) / (now - startedAt));
      };
      const fallback = window.setTimeout(() => finish(performance.now()), 5_000);
      const sample = (now: number) => {
        frames += 1;
        const elapsed = now - startedAt;
        if (elapsed >= 3_000) {
          window.clearTimeout(fallback);
          finish(now);
          return;
        }
        video.requestVideoFrameCallback(sample);
      };
      video.requestVideoFrameCallback(sample);
    });
  });
}

async function expectHdVideo(page: Page, label: string) {
  const video = page.getByLabel(label);
  await expect(video).toBeVisible();
  await expect.poll(
    () => video.evaluate((element) => (element as HTMLVideoElement).videoWidth),
    { timeout: 20_000 }
  ).toBeGreaterThanOrEqual(1280);
  await expect.poll(
    () => video.evaluate((element) => (element as HTMLVideoElement).videoHeight),
    { timeout: 20_000 }
  ).toBeGreaterThanOrEqual(720);
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

  await Promise.all([
    signIn(coach, "coach@fish.dev", "fish-coach-dev"),
    signIn(client, "client1@fish.dev", "fish-client-dev"),
  ]);
  await Promise.all([
    expect(coach).toHaveURL(/\/(?:home|coach)$/, { timeout: 20_000 }),
    expect(client).toHaveURL(/\/home$/, { timeout: 20_000 }),
  ]);
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
  test("audio call connects, mutes, and ends for both participants", async ({
    browser,
  }) => {
    const pair = await callPair(browser);
    try {
      await pair.client.getByRole("button", {
        name: "Call Patty Cake",
        exact: true,
      }).click();
      await expect(pair.client.getByRole("heading", { name: "Calling Patty Cake" }))
        .toBeVisible();

      await expect(pair.coach).toHaveURL(/\/calls\//);
      await expect(pair.coach.getByRole("heading", { name: "Franz Eva is calling" }))
        .toBeVisible();
      await pair.coach.getByRole("button", { name: "Answer call" }).click();

      await expect(pair.coach.getByRole("heading", { name: "In call with Franz Eva" }))
        .toBeVisible();
      await expect(pair.client.getByRole("heading", { name: "In call with Patty Cake" }))
        .toBeVisible();
      await pair.client.getByRole("button", { name: "Mute" }).click();
      await expect(pair.client.getByRole("button", { name: "Unmute" })).toBeVisible();

      await pair.coach.getByRole("button", { name: "End call" }).click();
      await expect(pair.coach.getByRole("heading", { name: "Call ended" })).toBeVisible();
      await expect(pair.client.getByRole("heading", { name: "Call ended" })).toBeVisible();
    } finally {
      await pair.close();
    }
  });

  test("video call publishes camera surfaces and ends cleanly", async ({ browser }) => {
    const pair = await callPair(browser);
    try {
      await pair.client.getByRole("button", { name: "Video call Patty Cake" }).click();
      await expect(pair.client.getByRole("heading", { name: "Video calling Patty Cake" }))
        .toBeVisible();

      await expect(pair.coach).toHaveURL(/\/calls\//);
      await expect(pair.coach.getByRole("heading", { name: "Video call from Franz Eva" }))
        .toBeVisible();
      await pair.coach.getByRole("button", { name: "Answer video call" }).click();

      await expect(pair.coach.getByRole("heading", { name: "Video call with Franz Eva" }))
        .toBeVisible();
      await expect(pair.client.getByRole("heading", { name: "Video call with Patty Cake" }))
        .toBeVisible();
      await Promise.all([
        expectHdVideo(pair.client, "Your video preview"),
        expectHdVideo(pair.client, "Patty Cake video"),
      ]);
      const [localFps, remoteFps] = await Promise.all([
        measureVideoFps(pair.client, "Your video preview"),
        measureVideoFps(pair.client, "Patty Cake video"),
      ]);
      expect(remoteFps).toBeGreaterThanOrEqual(15);
      expect(remoteFps).toBeGreaterThanOrEqual(localFps * 0.8);
      await pair.client.getByRole("button", { name: "Turn camera off" }).click();
      await expect(pair.client.getByRole("button", { name: "Turn camera on" }))
        .toBeVisible();

      await pair.coach.getByRole("button", { name: "End call" }).click();
      await expect(pair.coach.getByRole("heading", { name: "Call ended" })).toBeVisible();
      await expect(pair.client.getByRole("heading", { name: "Call ended" })).toBeVisible();
    } finally {
      await pair.close();
    }
  });

  test("leaving the call route stops media and ends the call", async ({ browser }) => {
    const pair = await callPair(browser);
    try {
      await pair.client.getByRole("button", {
        name: "Call Patty Cake",
        exact: true,
      }).click();
      await expect(pair.coach).toHaveURL(/\/calls\//);
      await pair.coach.getByRole("button", { name: "Answer call" }).click();
      await expect(pair.client.getByRole("heading", { name: "In call with Patty Cake" }))
        .toBeVisible();

      await pair.client.getByRole("link", { name: "FISH home" }).click();

      await expect(pair.client).toHaveURL(/\/home$/);
      await expect(pair.coach.getByRole("heading", { name: "Call ended" })).toBeVisible();
    } finally {
      await pair.close();
    }
  });
});
