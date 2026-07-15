import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FloatingFormNotice } from "./floating-form-notice";

const meta = {
  title: "UI/Floating form notice",
  component: FloatingFormNotice,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="relative mt-xl w-auth-card">
        <Story />
        <div className="h-control rounded-control bg-surface-2" />
      </div>
    ),
  ],
  args: { children: "Sent again. Check your inbox.", tone: "success" },
} satisfies Meta<typeof FloatingFormNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};
export const Warning: Story = {
  args: { children: "That didn’t send. Give it a minute and try again.", tone: "warning" },
};
