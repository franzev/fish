import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
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

export const ClientHome: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const logo = canvas.getByRole("img", { name: "FISH" });

    await waitFor(() => {
      expect(logo).toHaveProperty("complete", true);
      expect(logo).toHaveProperty("naturalWidth");
      expect((logo as HTMLImageElement).naturalWidth).toBeGreaterThan(0);
    });

    expect(getComputedStyle(canvas.getByText("Your coach will place the next step here.")).fontFamily)
      .toContain("Lexend");
    expect(getComputedStyle(canvas.getByRole("heading", { name: "Today" })).fontFamily)
      .toContain("Fraunces");
  },
};

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
