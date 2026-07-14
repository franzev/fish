import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { MediaDeviceSelect } from "./media-device-select";

const options = [
  { id: "default", label: "MacBook microphone" },
  { id: "headset", label: "USB headset microphone" },
];

const meta = {
  title: "UI/Media device select",
  component: MediaDeviceSelect,
  tags: ["autodocs"],
  args: {
    label: "Microphone",
    options,
    value: "default",
    onValueChange: fn(),
  },
  parameters: { layout: "centered" },
  decorators: [(Story) => <div className="w-notifications"><Story /></div>],
} satisfies Meta<typeof MediaDeviceSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Camera: Story = {
  args: {
    label: "Camera",
    options: [
      { id: "camera", label: "Built-in camera" },
      { id: "desk", label: "Desk camera with a long device name" },
    ],
    value: "desk",
  },
};
export const Disabled: Story = { args: { disabled: true } };
