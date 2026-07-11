import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card } from "@/components/ui/card";
import { AppShell } from "./app-shell";

const meta = {
  title: "Product/AppShell",
  component: AppShell,
  tags: ["autodocs"],
  args: {
    displayName: "Eli Ramos",
    role: "client",
    children: (
      <Card>
        <h1 className="mb-sm text-3xl">Today</h1>
        <p>Your coach will place the next step here.</p>
      </Card>
    ),
  },
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClientHome: Story = {};

export const CoachHome: Story = {
  args: {
    displayName: "Coach Maya",
    role: "coach",
    children: (
      <Card>
        <h1 className="mb-sm text-3xl">Clients</h1>
        <p>Three clients are ready for review.</p>
      </Card>
    ),
  },
};
