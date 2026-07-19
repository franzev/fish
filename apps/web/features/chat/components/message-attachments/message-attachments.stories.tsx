import type { ClientChatImage } from "@/lib/services";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { MessageAttachments } from "./message-attachments";

function imageFixture(
  id: string,
  width: number,
  height: number,
  hue: number
): ClientChatImage {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="hsl(${hue} 32% 34%)"/>
      <circle cx="25%" cy="30%" r="18%" fill="hsl(${hue} 42% 62%)"/>
      <rect x="15%" y="62%" width="70%" height="12%" rx="6%" fill="hsl(${hue} 24% 78%)"/>
    </svg>
  `);
  const url = `data:image/svg+xml;charset=utf-8,${svg}`;
  return {
    id,
    status: "ready",
    kind: "image",
    originalName: `${id}.png`,
    mimeType: "image/webp",
    byteSize: 84_000,
    width,
    height,
    thumbnailPath: `stories/${id}/thumbnail.webp`,
    displayPath: `stories/${id}/display.webp`,
    thumbnailUrl: url,
    displayUrl: url,
  };
}

function fileFixture(
  id: string,
  originalName: string,
  mimeType: string,
  byteSize = 128_000
): ClientChatImage {
  return {
    id,
    status: "ready",
    kind: "file",
    originalName,
    mimeType,
    byteSize,
    displayPath: `stories/${id}/${originalName}`,
    displayUrl: `data:${mimeType},Storybook%20attachment`,
  };
}

const portrait = imageFixture("portrait", 600, 1000, 215);
const landscape = imageFixture("landscape", 1200, 700, 24);
const square = imageFixture("square", 800, 800, 145);
const ultraWide = imageFixture("ultra-wide", 1600, 360, 285);
const ultraTall = imageFixture("ultra-tall", 360, 1600, 48);
const sameAspectImages = Array.from({ length: 5 }, (_, index) =>
  imageFixture(`landscape-${index + 1}`, 1200, 800, 24 + index * 44)
);
const mixedAspectImages = [portrait, landscape, square, ultraWide, ultraTall];

const pdf = fileFixture("pdf", "session-notes.pdf", "application/pdf", 840_000);
const text = fileFixture("text", "practice.txt", "text/plain", 2_400);
const csv = fileFixture("csv", "vocabulary.csv", "text/csv", 18_000);
const word = fileFixture(
  "word",
  "coaching-plan.docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  340_000
);
const excel = fileFixture(
  "excel",
  "progress.xlsx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  220_000
);
const powerpoint = fileFixture(
  "powerpoint",
  "presentation.pptx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  1_400_000
);

const meta = {
  title: "Chat/Attachments/MessageAttachments",
  component: MessageAttachments,
  tags: ["autodocs"],
  args: {
    images: [landscape],
    authorName: "Alex Morgan",
    mine: false,
  },
  decorators: [
    (Story) => (
      <div className="max-w-message p-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageAttachments>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleLandscape: Story = { args: { images: [landscape] } };
export const SinglePortrait: Story = { args: { images: [portrait] } };
export const SingleSquare: Story = { args: { images: [square] } };
export const SingleUltraWide: Story = { args: { images: [ultraWide] } };
export const SingleUltraTall: Story = { args: { images: [ultraTall] } };
export const TwoImages: Story = { args: { images: [portrait, landscape] } };
export const ThreeImages: Story = { args: { images: [portrait, landscape, square] } };
export const FourImages: Story = { args: { images: [portrait, landscape, square, ultraWide] } };
export const FiveMixedAspectRatios: Story = {
  args: { images: [portrait, landscape, square, ultraWide, ultraTall] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByAltText("Image shared by Alex Morgan")).toHaveLength(5);
    await expect(canvasElement.querySelector('[data-image-layout="wrap"]')).toBeInTheDocument();
  },
};

export const SameAspectRatioCounts: Story = {
  render: (args) => (
    <div className="flex flex-col gap-lg">
      {[1, 2, 3, 4, 5].map((count) => {
        const images = sameAspectImages.slice(0, count);
        return (
          <section key={count} data-story-scenario={`same-count-${count}`} className="flex flex-col gap-xs">
            <h3 className="text-ui-sm text-muted">{count} {count === 1 ? "image" : "images"}</h3>
            <MessageAttachments {...args} images={images} />
          </section>
        );
      })}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-story-scenario^='same-count-']")).toHaveLength(5);
    await expect(canvasElement.querySelectorAll('[data-image-layout="wrap"]')).toHaveLength(4);
    await expect(canvasElement.querySelectorAll('[data-image-layout="single"]')).toHaveLength(1);
  },
};

export const MixedAspectRatioCounts: Story = {
  render: (args) => (
    <div className="flex flex-col gap-lg">
      {[1, 2, 3, 4, 5].map((count) => {
        const images = mixedAspectImages.slice(0, count);
        return (
          <section key={count} data-story-scenario={`mixed-count-${count}`} className="flex flex-col gap-xs">
            <h3 className="text-ui-sm text-muted">{count} {count === 1 ? "image" : "images"}</h3>
            <MessageAttachments {...args} images={images} />
          </section>
        );
      })}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-story-scenario^='mixed-count-']")).toHaveLength(5);
    await expect(canvasElement.querySelectorAll('[data-image-layout="wrap"]')).toHaveLength(4);
    await expect(canvasElement.querySelectorAll('[data-image-layout="single"]')).toHaveLength(1);
  },
};

export const AspectRatioOverview: Story = {
  render: (args) => (
    <div className="flex flex-col gap-lg">
      {[
        { label: "Portrait", image: portrait },
        { label: "Landscape", image: landscape },
        { label: "Square", image: square },
        { label: "Ultra wide", image: ultraWide },
        { label: "Ultra tall", image: ultraTall },
      ].map(({ label, image }) => (
        <section key={label} data-story-scenario={`aspect-${image.id}`} className="flex flex-col gap-xs">
          <h3 className="text-ui-sm text-muted">{label}</h3>
          <MessageAttachments {...args} images={[image]} />
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-story-scenario^='aspect-']")).toHaveLength(5);
    await expect(canvasElement.querySelectorAll('[data-image-layout="single"]')).toHaveLength(5);
  },
};

export const PdfFile: Story = { args: { images: [pdf] } };
export const TextFile: Story = { args: { images: [text] } };
export const CsvFile: Story = { args: { images: [csv] } };
export const WordDocument: Story = { args: { images: [word] } };
export const ExcelWorkbook: Story = { args: { images: [excel] } };
export const PowerPointPresentation: Story = { args: { images: [powerpoint] } };

export const AllSupportedFiles: Story = {
  args: { images: [pdf, text, csv, word, excel, powerpoint] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const file of [pdf, text, csv, word, excel, powerpoint]) {
      await expect(canvas.getByText(file.originalName)).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: `Open ${file.originalName}` })).toBeInTheDocument();
    }
  },
};

export const FileTypeOverview: Story = {
  render: (args) => (
    <div className="flex flex-col gap-sm">
      {[pdf, text, csv, word, excel, powerpoint].map((file) => (
        <section key={file.id} data-story-scenario={`file-${file.id}`}>
          <MessageAttachments {...args} images={[file]} />
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-story-scenario^='file-']")).toHaveLength(6);
  },
};

export const MixedImagesAndFiles: Story = {
  args: { images: [portrait, landscape, pdf, word] },
};

export const Mine: Story = {
  args: { images: [portrait, landscape, square], mine: true, authorName: "You" },
};

export const ImageUnavailable: Story = {
  args: {
    images: [{
      ...landscape,
      id: "unavailable",
      thumbnailUrl: "data:image/png;base64,broken",
      displayUrl: "data:image/png;base64,broken",
    }],
  },
};
