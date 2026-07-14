import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import { fn, userEvent, within } from "storybook/test";
import { MediaPickerButton } from "./media-picker-button";

const provider: GifProvider = {
  name: "Story GIFs",
  available: true,
  trending: async () => ({ gifs: [], next: null }),
  search: async () => ({ gifs: [], next: null }),
  registerShare: async () => undefined,
};

const meta = {
  title: "Chat/MediaPickerButton",
  component: MediaPickerButton,
  parameters: { layout: "centered" },
  args: {
    onSelectEmoji: fn(),
    onSelectGif: fn(),
    onSelectSticker: fn(),
    gifProvider: provider,
  },
} satisfies Meta<typeof MediaPickerButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const GifAndStickerDisabled: Story = {
  args: { gifDisabled: true, stickerDisabled: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add emoji, GIF, or sticker" }));
  },
};
export const StickerOpen: Story = {
  args: { defaultTab: "sticker" },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add emoji, GIF, or sticker" }));
  },
};
