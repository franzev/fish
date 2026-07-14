import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { StickerPicker } from "./sticker-picker";

const meta = {
  title: "Chat/StickerPicker",
  component: StickerPicker,
  parameters: { layout: "centered" },
  args: {
    onSelect: () => undefined,
    className: "h-gif-panel-h w-gif-panel bg-surface",
  },
} satisfies Meta<typeof StickerPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AquaticSamples: Story = {};

export const SearchResult: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole("searchbox", { name: "Search stickers" }), "octopus");
  },
};

export const NoResults: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole("searchbox", { name: "Search stickers" }), "spaceship");
  },
};
