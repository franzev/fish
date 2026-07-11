import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { FiltersDialog } from "./filters-dialog";

const meta = {
  title: "Chat/FiltersDialog",
  component: FiltersDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: fn(),
    members: [
      { id: "1", displayName: "Yoshibro", username: "yoshibro5019" },
      { id: "2", displayName: "Sir Regan", username: "reganspor" },
      { id: "3", displayName: "stellostuds", username: "juststello" },
    ],
    channels: [
      { id: "general", name: "general", slug: "general", conversationId: "community" },
    ],
    onApply: fn(),
  },
} satisfies Meta<typeof FiltersDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
