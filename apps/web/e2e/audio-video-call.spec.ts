import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

async function capturePeerConnections(context: BrowserContext) {
  await context.addInitScript(() => {
    const NativePeerConnection = window.RTCPeerConnection;
    const connections: RTCPeerConnection[] = [];
    Object.defineProperty(window, "__fishPeerConnections", {
      value: connections,
    });
    class TrackedPeerConnection extends NativePeerConnection {
      constructor(configuration?: RTCConfiguration) {
        super(configuration);
        connections.push(this);
      }
    }
    window.RTCPeerConnection = TrackedPeerConnection;
  });
}

async function videoStats(page: Page) {
  return page.evaluate(async () => {
    const connections = (
      window as typeof window & {
        __fishPeerConnections?: RTCPeerConnection[];
      }
    ).__fishPeerConnections ?? [];
    const samples: Array<Record<string, number | string>> = [];
    for (const connection of connections) {
      const report = await connection.getStats();
      report.forEach((stat) => {
        if (
          ["inbound-rtp", "outbound-rtp", "remote-inbound-rtp", "candidate-pair"]
            .includes(stat.type) &&
          (stat.kind === "video" || stat.mediaType === "video" || stat.nominated)
        ) {
          samples.push({
            id: stat.id,
            type: stat.type,
            timestamp: stat.timestamp,
            bytesReceived: stat.bytesReceived ?? 0,
            bytesSent: stat.bytesSent ?? 0,
            framesDecoded: stat.framesDecoded ?? 0,
            framesEncoded: stat.framesEncoded ?? 0,
            framesPerSecond: stat.framesPerSecond ?? 0,
            framesDropped: stat.framesDropped ?? 0,
            packetsLost: stat.packetsLost ?? 0,
            jitter: stat.jitter ?? 0,
            roundTripTime: stat.currentRoundTripTime ?? stat.roundTripTime ?? 0,
          });
        }
      });
    }
    return samples;
  });
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
    capturePeerConnections(coachContext),
    capturePeerConnections(clientContext),
  ]);
  await Promise.all([
    coachContext.grantPermissions(["microphone", "camera"], {
      origin: "http://localhost:3001",
    }),
    clientContext.grantPermissions(["microphone", "camera"], {
      origin: "http://localhost:3001",
    }),
  ]);
  const coach = await coachContext.newPage();
  const client = await clientContext.newPage();

  await Promise.all([
    signIn(coach, "coach@fish.dev", "fish-coach-dev"),
    signIn(client, "client1@fish.dev", "fish-client-dev"),
  ]);
  await Promise.all([
    expect(coach).toHaveURL(/\/coach$/),
    expect(client).toHaveURL(/\/home$/),
  ]);

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
      const firstStats = await videoStats(pair.client);
      await pair.client.waitForTimeout(3_000);
      const secondStats = await videoStats(pair.client);
      console.log("[DEBUG-video-quality]", JSON.stringify({ firstStats, secondStats }));
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
