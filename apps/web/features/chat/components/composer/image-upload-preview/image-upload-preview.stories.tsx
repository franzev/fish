import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { PendingChatImage } from "../../../hooks/use-chat-image-uploads";
import { ImageUploadPreview } from "./image-upload-preview";

function previewFixture(width: number, height: number, hue: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="hsl(${hue} 32% 34%)"/>
      <circle cx="25%" cy="30%" r="18%" fill="hsl(${hue} 42% 62%)"/>
      <rect x="15%" y="62%" width="70%" height="12%" rx="6%" fill="hsl(${hue} 24% 78%)"/>
    </svg>
  `)}`;
}

function pendingFixture(
  id: string,
  width: number,
  height: number,
  hue: number,
  status: PendingChatImage["status"] = "ready",
  progress = status === "ready" ? 1 : 0.54
): PendingChatImage {
  return {
    clientUploadId: id,
    file: new File([`storybook ${id}`], `${id}.png`, { type: "image/png" }),
    kind: "image",
    sourceMimeType: "image/png",
    previewUrl: previewFixture(width, height, hue),
    progress,
    status,
  };
}

const portrait = pendingFixture("portrait", 600, 1000, 215);
const landscape = pendingFixture("landscape", 1200, 700, 24);
const square = pendingFixture("square", 800, 800, 145);
const ultraWide = pendingFixture("ultra-wide", 1600, 360, 285);
const ultraTall = pendingFixture("ultra-tall", 360, 1600, 48);
const baseImage = pendingFixture("storybook-upload", 320, 240, 215, "uploading");

const meta = {
  title: "Chat/Attachments/ImageUploadPreview",
  component: ImageUploadPreview,
  tags: ["autodocs"],
  args: {
    images: [baseImage],
    onRemove: fn(),
    onRetry: fn(),
  },
  decorators: [
    (Story) => <div className="max-w-message rounded-card bg-surface-2 p-sm"><Story /></div>,
  ],
} satisfies Meta<typeof ImageUploadPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Uploading: Story = {};

export const Ready: Story = {
  args: { images: [{ ...baseImage, status: "ready", progress: 1 }] },
};

export const Failed: Story = {
  args: { images: [{ ...baseImage, status: "failed" }] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Upload failed/ });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("menuitem", { name: "Retry" })).toBeInTheDocument();
    const remove = await body.findByRole("menuitem", { name: "Remove" });
    await expect(remove).toHaveClass("text-notice");
    await userEvent.click(remove);
    await expect(args.onRemove).toHaveBeenCalledWith("storybook-upload");
  },
};

export const MultipleWithFailure: Story = {
  args: {
    images: [
      { ...baseImage, clientUploadId: "ready", status: "ready", progress: 1 },
      { ...baseImage, clientUploadId: "uploading", file: new File(["two"], "second.png", { type: "image/png" }) },
      { ...baseImage, clientUploadId: "failed", file: new File(["three"], "third.png", { type: "image/png" }), status: "failed" },
    ],
  },
};

export const ImageCountOverview: Story = {
  render: (args) => (
    <div className="flex flex-col gap-lg">
      {[
        [landscape],
        [portrait, landscape],
        [portrait, landscape, square],
        [portrait, landscape, square, ultraWide],
        [portrait, landscape, square, ultraWide, ultraTall],
      ].map((images) => (
        <section key={images.length} data-story-scenario={`preview-count-${images.length}`} className="flex flex-col gap-xs">
          <h3 className="text-ui-sm text-muted">{images.length} {images.length === 1 ? "image" : "images"}</h3>
          <ImageUploadPreview {...args} images={images} />
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-story-scenario^='preview-count-']")).toHaveLength(5);
    await expect(within(canvasElement).getAllByAltText("Preview of image to send")).toHaveLength(15);
  },
};

export const UploadStateOverview: Story = {
  args: {
    images: [
      pendingFixture("preparing", 600, 1000, 215, "preparing", 0.08),
      pendingFixture("uploading", 1200, 700, 24, "uploading", 0.52),
      pendingFixture("processing", 800, 800, 145, "processing", 0.92),
      pendingFixture("ready", 1600, 360, 285),
      pendingFixture("failed", 360, 1600, 48, "failed", 0.92),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("progressbar")).toHaveLength(3);
    await expect(canvas.getByRole("button", { name: /Upload failed/ })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Remove ready.png" })).toBeInTheDocument();
  },
};
