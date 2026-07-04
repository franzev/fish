import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuotedMessage } from "./quoted-message";

const meta = {
  title: "Chat/QuotedMessage",
  component: QuotedMessage,
  tags: ["autodocs"],
  args: {
    authorName: "Eli Ramos",
    snippet: "I can present the update in the meeting.",
  },
} satisfies Meta<typeof QuotedMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongSnippet: Story = {
  args: {
    snippet:
      "I can present the quarterly update in the meeting without rushing through the last sentence.",
  },
};
