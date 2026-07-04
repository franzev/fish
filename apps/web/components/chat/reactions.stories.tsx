import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Reactions } from "./reactions";
import { reactions } from "./story-data";

const meta = {
  title: "Chat/Reactions",
  component: Reactions,
  tags: ["autodocs"],
  args: {
    reactions,
  },
} satisfies Meta<typeof Reactions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMine: Story = {};

export const WithoutMine: Story = {
  args: {
    reactions: reactions.map((reaction) => ({ ...reaction, byMe: false })),
  },
};

export const Empty: Story = {
  args: {
    reactions: [],
  },
};
