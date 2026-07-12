import { expect, test, type Browser, type Page } from "@playwright/test";

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function callPair(browser: Browser) {
  const coachContext = await browser.newContext();
  const clientContext = await browser.newContext();
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
    logIn(coach, "coach@fish.dev", "fish-coach-dev"),
    logIn(client, "client1@fish.dev", "fish-client-dev"),
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
      await expect(pair.client.getByLabel("Your video preview")).toBeVisible();
      await expect(pair.client.getByLabel("Patty Cake video")).toBeVisible();
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
