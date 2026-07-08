import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmojiPicker, EmojiPickerButton } from "./emoji-picker";

const meta = {
  title: "Chat/EmojiPicker",
  component: EmojiPicker,
  tags: ["autodocs"],
  args: {
    onSelect: () => {},
  },
} satisfies Meta<typeof EmojiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Panel: Story = {};

export const Trigger: StoryObj<typeof EmojiPickerButton> = {
  render: () => (
    <EmojiPickerButton label="Add a reaction" onSelect={() => {}} />
  ),
};
