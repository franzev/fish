import { expect, test } from "@playwright/test";
import { deflateSync } from "node:zlib";

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function avatarPng(): Buffer {
  const width = 256;
  const height = 256;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      rows.set([90 + Math.floor(x / 4), 105, 150 + Math.floor(y / 4), 255], start + 1 + x * 4);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("client crops, publishes, displays, and removes a private avatar", async ({ page }) => {
  await signIn(page, "client1@fish.dev", "fish-client-dev");
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/profile/avatar");

  await page.getByLabel("Choose profile photo").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: avatarPng(),
  });
  await expect(page.getByLabel("Reposition profile photo")).toBeVisible();
  await page.getByLabel("Reposition profile photo").press("ArrowRight");
  await expect(page.getByRole("button", { name: "Save photo" })).toBeEnabled();
  await page.getByRole("button", { name: "Save photo" }).click();

  await expect(page).toHaveURL(/\/profile$/, { timeout: 45_000 });
  await expect(page.locator('img[src*="/storage/v1/object/sign/avatars/"]').first())
    .toBeVisible({ timeout: 15_000 });

  await page.goto("/profile/avatar");
  await page.getByRole("button", { name: "Remove current photo" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator('img[src*="/storage/v1/object/sign/avatars/"]')).toHaveCount(0);
});

test("coach can open the shared avatar editor", async ({ page }) => {
  await signIn(page, "coach@fish.dev", "fish-coach-dev");
  await expect(page).toHaveURL(/\/coach$/);
  await page.goto("/profile/avatar");
  await expect(page.getByRole("heading", { name: "Profile photo" })).toBeVisible();
  await expect(page.getByText("Choose photo")).toBeVisible();
});
