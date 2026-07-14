import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PresenceDisplayStatus } from "../../model/presentation";
import { presenceLabels } from "../../model/presentation";
import { PresenceIndicator } from "./presence-indicator";

const statuses: PresenceDisplayStatus[] = [
  "online",
  "idle",
  "away",
  "busy",
  "offline",
  "invisible",
];

const meta = {
  title: "Product/PresenceIndicator",
  component: PresenceIndicator,
  tags: ["autodocs"],
  args: { status: "online", label: "Online" },
  render: () => (
    <div className="flex max-w-form flex-col gap-sm rounded-card bg-surface p-md">
      {statuses.map((status) => (
        <div key={status} className="flex min-h-control items-center gap-sm text-foreground">
          <PresenceIndicator status={status} />
          <span>{presenceLabels[status]}</span>
        </div>
      ))}
    </div>
  ),
} satisfies Meta<typeof PresenceIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = {
  decorators: [(Story) => <div style={{ colorScheme: "dark" }}><Story /></div>],
};

export const Light: Story = {
  decorators: [(Story) => <div style={{ colorScheme: "light" }}><Story /></div>],
};
