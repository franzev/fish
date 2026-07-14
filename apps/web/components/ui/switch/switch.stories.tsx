import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { useState, type ComponentProps } from "react";
import { Switch } from "./switch";

const meta = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: {
    "aria-label": "Use less data",
    checked: false,
    disabled: false,
    onCheckedChange: fn(),
  },
  render: (args) => <SwitchPreview {...args} />,
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = {
  args: {
    checked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const DisabledOn: Story = {
  args: { checked: true, disabled: true },
};

function SwitchPreview(args: ComponentProps<typeof Switch>) {
  const [checked, setChecked] = useState(args.checked);
  return (
    <Switch
      {...args}
      checked={checked}
      onCheckedChange={(nextChecked) => {
        setChecked(nextChecked);
        args.onCheckedChange(nextChecked);
      }}
    />
  );
}
