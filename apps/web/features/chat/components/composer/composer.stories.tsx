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
