import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { A11yPrefs } from "./a11y-prefs";

const meta = {
  title: "Product/AccessibilityPreferences",
  component: A11yPrefs,
  tags: ["autodocs"],
  args: {
    themePref: null,
    textSizePref: null,
    reducedMotionPref: null,
    timeFormatPref: null,
  },
} satisfies Meta<typeof A11yPrefs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SystemDefaults: Story = {};

export const ExplicitPreferences: Story = {
  args: {
    themePref: "dark",
    textSizePref: "large",
    reducedMotionPref: true,
    timeFormatPref: "24h",
  },
};
