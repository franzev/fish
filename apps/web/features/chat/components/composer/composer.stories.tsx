import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Composer } from "./composer";

const meta = {
  title: "Chat/Composer",
  component: Composer,
  tags: ["autodocs"],
  args: {
    channelName: "general",
    draft: "",
    canSend: false,
    onDraftChange: fn(),
    onSend: fn(),
    onKeyDown: fn(),
    onBlur: fn(),
    onSelectEmoji: fn(),
  },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const ReadyToSend: Story = {
  args: {
    draft: "Practice felt easier today.",
    canSend: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await expect(args.onSend).toHaveBeenCalledOnce();
  },
};

export const GifSelected: Story = {
  args: {
    canSend: true,
    selectedGif: {
      provider: "klipy",
      providerId: "JIX9t2j0ZTN9S",
      title: "Typing cat",
      description: "A cat typing quickly",
      sourceUrl: "https://giphy.com/gifs/JIX9t2j0ZTN9S",
      posterUrl: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200_s.gif",
      previewUrl: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.mp4",
      mediaUrl: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.mp4",
      width: 480,
      height: 270,
    },
    onRemoveGif: fn(),
  },
};
