import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConsentRow } from "./consent-row";

const meta = {
  title: "Product/ConsentRow",
  component: ConsentRow,
  tags: ["autodocs"],
  args: {
    consented: false,
    consentVersion: null,
  },
} satisfies Meta<typeof ConsentRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NeedsReview: Story = {};

export const Accepted: Story = {
  args: {
    consented: true,
    consentVersion: "2026-07",
  },
};
