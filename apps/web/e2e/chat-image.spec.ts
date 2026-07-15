import { expect, type Page, test } from "@playwright/test";
import { deflateSync } from "node:zlib";

interface TestFilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

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

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function pngFixture(width: number, height: number, color: [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      rows.set([...color, 255], rowStart + 1 + x * 4);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function chooseFilesFromComposer(
  page: Page,
  files: TestFilePayload | TestFilePayload[]
): Promise<void> {
  await page.getByRole("button", { name: "Add to message" }).click();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Add files" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(files);
}

test("client prepares, sends, and opens a community image", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/channels/general");
  const imagesBeforeSend = await page.getByAltText(/Image shared by/).count();

  await chooseFilesFromComposer(page, {
    name: "one-pixel.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });

  const composerPreview = page.getByAltText("Preview of image to send");
  await expect(composerPreview).toBeVisible();
  const previewBox = await composerPreview.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(previewBox!.width).toBeLessThanOrEqual(200);
  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled({ timeout: 30_000 });
  await sendButton.click();

  const messageImages = page.getByAltText(/Image shared by/);
  await expect(messageImages).toHaveCount(imagesBeforeSend + 1, { timeout: 15_000 });
  const sentImage = messageImages.last();
  await expect(sentImage).toBeVisible({ timeout: 15_000 });
  await expect(sentImage).toHaveAttribute("src", /^blob:/);
  await expect(page.getByText("Image unavailable")).toHaveCount(0);
  await sentImage.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close image" })).toBeVisible();
});

test("client prepares, sends, and opens an image in a direct message", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/);
  const imagesBeforeSend = await page.getByAltText(/Image shared by/).count();

  await chooseFilesFromComposer(page, {
    name: "one-pixel.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });

  const composerPreview = page.getByAltText("Preview of image to send");
  await expect(composerPreview).toBeVisible();
  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled({ timeout: 30_000 });
  await sendButton.click();

  const messageImages = page.getByAltText(/Image shared by/);
  await expect(messageImages).toHaveCount(imagesBeforeSend + 1, { timeout: 15_000 });
  await expect(messageImages.last()).toBeVisible();
});

test("photo preparation falls back when the image worker cannot decode it", async ({ page }) => {
  await page.addInitScript(() => {
    class FailingImageWorker extends EventTarget {
      postMessage() {
        queueMicrotask(() => {
          this.dispatchEvent(new MessageEvent("message", {
            data: {
              kind: "error",
              message: "The worker could not decode this photo.",
            },
          }));
        });
      }

      terminate() {}
    }

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: FailingImageWorker,
    });
  });

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("member1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/);
  const imagesBeforeSend = await page.getByAltText(/Image shared by/).count();

  await chooseFilesFromComposer(page, {
    name: "cats.png",
    mimeType: "image/png",
    buffer: pngFixture(1200, 800, [120, 90, 70]),
  });

  await expect(page.getByRole("button", { name: /Upload failed/ })).toHaveCount(0);
  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled({ timeout: 30_000 });
  await sendButton.click();
  await expect(page.getByAltText(/Image shared by/)).toHaveCount(imagesBeforeSend + 1, {
    timeout: 15_000,
  });
});

test("client sends a browser-decoded photo whose original extension differs", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/);

  // Photos and phone file pickers can hand the browser decoded JPEG content
  // while retaining the source asset's HEIC filename. The client normalizes
  // image bytes to WebP before upload, so the original extension is not an
  // authoritative content-type boundary.
  await page.getByLabel("Choose files").setInputFiles({
    name: "cats.heic",
    mimeType: "image/jpeg",
    buffer: onePixelPng,
  });

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled({ timeout: 30_000 });
  await sendButton.click();
  await expect(page.getByAltText(/Image shared by/).last()).toBeVisible({ timeout: 15_000 });
});

test("mixed image aspect ratios flow from left to right and wrap", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/channels/general");
  const galleriesBeforeSend = await page.locator('[data-image-layout="wrap"]').count();

  await page.getByLabel("Choose files").setInputFiles([
    { name: "portrait.png", mimeType: "image/png", buffer: pngFixture(32, 96, [80, 110, 180]) },
    { name: "landscape.png", mimeType: "image/png", buffer: pngFixture(96, 48, [180, 100, 80]) },
    { name: "square.png", mimeType: "image/png", buffer: pngFixture(64, 64, [80, 160, 100]) },
    { name: "ultra-wide.png", mimeType: "image/png", buffer: pngFixture(160, 24, [150, 80, 170]) },
    { name: "ultra-tall.png", mimeType: "image/png", buffer: pngFixture(24, 160, [180, 150, 60]) },
  ]);
  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled({ timeout: 30_000 });
  await sendButton.click();

  const galleries = page.locator('[data-image-layout="wrap"]');
  await expect(galleries).toHaveCount(galleriesBeforeSend + 1, { timeout: 15_000 });
  const gallery = galleries.last();
  const renderedImages = gallery.getByAltText(/Image shared by/);
  await expect(renderedImages).toHaveCount(5);
  const boxes = await renderedImages.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })
  );
  let continuedRows = 0;
  let wrappedRows = 0;
  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1]!;
    const current = boxes[index]!;
    if (Math.abs(current.y - previous.y) < 2) {
      expect(current.x).toBeGreaterThan(previous.x);
      continuedRows += 1;
    } else {
      expect(current.y).toBeGreaterThan(previous.y);
      wrappedRows += 1;
    }
  }
  expect(continuedRows).toBeGreaterThan(0);
  expect(wrappedRows).toBeGreaterThan(0);
  for (const box of boxes) {
    const previewRatio = box.width / box.height;
    expect(previewRatio).toBeGreaterThanOrEqual(0.65);
    expect(previewRatio).toBeLessThanOrEqual(2.05);
  }
});

test("two medium images complete server processing without competing for the Edge CPU budget", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/channels/general");

  await page.getByLabel("Choose files").setInputFiles([
    { name: "medium-portrait.png", mimeType: "image/png", buffer: pngFixture(1200, 1600, [80, 110, 180]) },
    { name: "medium-landscape.png", mimeType: "image/png", buffer: pngFixture(1600, 1200, [180, 100, 80]) },
  ]);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: /Upload failed/ })).toHaveCount(0);
});

test("client sends and opens a private text attachment", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/channels/general");

  await page.getByLabel("Choose files").setInputFiles({
    name: "coaching-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Practice the opening sentence twice.\n", "utf8"),
  });

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled({ timeout: 30_000 });
  await sendButton.click();

  const fileLink = page.getByRole("link", { name: "Open coaching-notes.txt" }).last();
  await expect(fileLink).toBeVisible({ timeout: 15_000 });
  await expect(fileLink).toHaveAttribute("href", /storage\/v1\/object\/sign\/chat-images/);
});
