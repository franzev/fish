import { Button } from "@/components/ui/button";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SettingsRow } from "./settings-row";

const meta = {
  title: "Product/SettingsRow",
  component: SettingsRow,
  tags: ["autodocs"],
  args: {
    label: "Time format",
    control: <span className="text-ui-sm text-muted">System</span>,
  },
} satisfies Meta<typeof SettingsRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnlyValue: Story = {};

export const WithAction: Story = {
  args: {
    label: "Your agreement",
    control: <Button variant="secondary">Review &amp; accept</Button>,
  },
};
