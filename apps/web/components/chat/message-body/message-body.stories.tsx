import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bubble } from "../bubble";
import { MessageBody } from "./message-body";

const meta = {
  title: "Chat/MessageBody",
  component: MessageBody,
  tags: ["autodocs"],
  args: {
    mine: false,
    body: "Try it once more, a little slower on the middle word.",
  },
  decorators: [
    (Story, context) => (
      <div className="max-w-message p-md">
        <Bubble mine={Boolean(context.args.mine)}>
          <Story />
        </Bubble>
      </div>
    ),
  ],
} satisfies Meta<typeof MessageBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainMultiline: Story = {
  args: {
    body: "First line\nSecond line\n\nA new paragraph after a blank line.",
  },
};

export const Bold: Story = {
  args: { body: "This is **bold** text." },
};

export const Italic: Story = {
  args: { body: "This is *italic* and this is _also italic_." },
};

export const InlineCode: Story = {
  args: { body: "Run `pnpm test` before committing." },
};

export const FencedCode: Story = {
  args: {
    body: "```ts\nfunction greet(name: string) {\n  return `Hi ${name}`;\n}\n```",
  },
};

export const Headings: Story = {
  args: { body: "# Heading one\n## Heading two\n### Heading three" },
};

export const Blockquote: Story = {
  args: { body: "> Keep the pace slow and steady." },
};

export const BulletList: Story = {
  args: { body: "- First step\n- Second step\n  - Nested detail" },
};

export const NumberedList: Story = {
  args: { body: "1. Warm up\n2. Practice\n   1. Slow pass\n   2. Full speed" },
};

export const LinkText: Story = {
  args: { body: "See the [practice guide](https://example.com/guide) for details." },
};

export const MixedFormatting: Story = {
  args: {
    body:
      "## Today's recap\n\nGreat session! Key points:\n- **Pace**: slower on stressed syllables\n- *Tone*: relax the jaw\n\nSee the [notes](https://example.com/notes) for more, and try:\n```\npractice this line\n```",
  },
};

export const Mine: Story = {
  args: {
    mine: true,
    body: "## Nice work\n\nYour **pace** improved. Check `notes.md` and the [recording](https://example.com/rec).",
  },
};

export const MineMixedFormatting: Story = {
  args: {
    mine: true,
    body:
      "Great job today!\n\n- **Pace**: steady\n- *Tone*: relaxed\n\nSee [my notes](https://example.com/notes).",
  },
};
