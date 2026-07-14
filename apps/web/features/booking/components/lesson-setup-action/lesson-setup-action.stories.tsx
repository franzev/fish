import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LessonSetupAction } from "./lesson-setup-action";

const meta = {
  title: "Booking/Lesson setup action",
  component: LessonSetupAction,
  tags: ["autodocs"],
  args: {
    lessonId: "slot-1",
    startsAt: "2026-07-21T10:30:00.000Z",
    endsAt: "2026-07-21T11:20:00.000Z",
    joinWindowMinutes: 10,
    initialNow: "2026-07-21T10:00:00.000Z",
  },
  decorators: [(Story) => <div className="w-notifications"><Story /></div>],
} satisfies Meta<typeof LessonSetupAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BeforeJoinWindow: Story = {};
export const Joinable: Story = { args: { initialNow: "2026-07-21T10:20:00.000Z" } };
export const Ended: Story = { args: { initialNow: "2026-07-21T11:20:00.000Z" } };
