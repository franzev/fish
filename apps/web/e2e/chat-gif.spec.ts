import { expect, test } from "@playwright/test";

const gifDescription = "A happy cat nodding";

test("client searches, previews, sends, and reloads a GIF message", async ({ page }) => {
  await page.route("https://api.klipy.com/v2/featured**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [{
          id: "happy-cat-e2e",
          title: "Happy cat",
          content_description: gifDescription,
          itemurl: "https://klipy.com/gifs/happy-cat-e2e",
          media_formats: {
            preview: {
              url: "https://static.klipy.com/happy-cat-e2e.jpg",
              dims: [480, 270],
            },
            tinymp4: {
              url: "https://static1.klipy.com/happy-cat-e2e-tiny.mp4",
              dims: [320, 180],
            },
            mp4: {
              url: "https://static2.klipy.com/happy-cat-e2e.mp4",
              dims: [480, 270],
            },
          },
        }],
        next: "",
      }),
    });
  });
  await page.route("https://api.klipy.com/v2/registershare**", (route) =>
    route.fulfill({ status: 204, body: "" })
  );

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/channels/general");
  await expect(
    page
      .getByRole("log", { name: "Community messages" })
      .getByRole("listitem")
      .first()
  ).toBeVisible();
  const gifsBeforeSend = await page.getByRole("link", { name: "Via KLIPY" }).count();

  await page.getByRole("button", { name: "Add emoji, GIF, or sticker" }).click();
  await page.getByRole("tab", { name: /GIFs/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Choose emoji, GIF, or sticker" })
  ).toBeVisible();
  await page.getByRole("button", { name: `Choose ${gifDescription}` }).click();

  await expect(page.getByText("GIF selected")).toBeVisible();
  await expect(page.getByRole("link", { name: "Via KLIPY" })).toHaveCount(gifsBeforeSend);
  await page.getByRole("button", { name: "Send message" }).click();

  const attributions = page.getByRole("link", { name: "Via KLIPY" });
  await expect(attributions).toHaveCount(gifsBeforeSend + 1);
  const attribution = attributions.last();
  await expect(attribution).toBeVisible();
  await expect(page.getByText("Not sent yet")).toHaveCount(0);

  const gifRow = attribution.locator("xpath=ancestor::li[1]");
  await gifRow.hover();
  await gifRow.getByRole("button", { name: "Report GIF" }).click();
  await expect(page.getByText("Thanks. This GIF was reported.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "Via KLIPY" }).last()).toBeVisible();
});
