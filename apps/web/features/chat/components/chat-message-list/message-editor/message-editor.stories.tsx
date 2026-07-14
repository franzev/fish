import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { chatLimits } from "@fish/core/chat";
import { useState } from "react";
import { fn } from "storybook/test";
import { MessageEditor, type MessageEditorProps } from "./message-editor";

function StatefulEditor(args: MessageEditorProps) {
  const [draft, setDraft] = useState(args.draft);
  return <MessageEditor {...args} draft={draft} onChange={setDraft} />;
}

const meta = {
  title: "Chat/MessageEditor",
  component: MessageEditor,
  render: (args) => <StatefulEditor {...args} />,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div className="w-notifications"><Story /></div>],
  args: {
    originalBody: "Let’s practice this tomorrow.",
    draft: "Let’s practice this together tomorrow.",
    notice: null,
    saving: false,
    onChange: fn(),
    onSave: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof MessageEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Changed: Story = {};
export const Unchanged: Story = { args: { draft: "Let’s practice this tomorrow." } };
export const Empty: Story = { args: { draft: "" } };
export const TooLong: Story = {
  args: { draft: "a".repeat(chatLimits.messageBodyMaxLength + 1) },
};
export const Saving: Story = { args: { saving: true } };
export const ErrorNotice: Story = {
  args: { notice: "That edit did not save yet. Your text is still here." },
};
export const Multiline: Story = {
  args: { draft: "First thought\nSecond thought\nA calm final line" },
};
