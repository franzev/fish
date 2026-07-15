import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IconArchive, IconDots, IconX } from "@tabler/icons-react";
import { fn } from "storybook/test";
import { IconButton } from "../icon-button";
import {
  ActionMenuItem,
  ActionMenuPopup,
  ActionMenuRoot,
  ActionMenuTrigger,
} from "./action-menu";

function ActionMenuStory() {
  return (
    <ActionMenuRoot>
      <ActionMenuTrigger
        render={
          <IconButton
            label="Conversation actions"
            appearance="ghost"
            icon={<IconDots aria-hidden="true" />}
          />
        }
      />
      <ActionMenuPopup>
        <ActionMenuItem onClick={fn()}>
          <IconArchive aria-hidden="true" />
          Archive
        </ActionMenuItem>
        <ActionMenuItem onClick={fn()}>
          <IconX aria-hidden="true" />
          Close
        </ActionMenuItem>
      </ActionMenuPopup>
    </ActionMenuRoot>
  );
}

const meta = {
  title: "UI/Action menu",
  component: ActionMenuStory,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ActionMenuStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
