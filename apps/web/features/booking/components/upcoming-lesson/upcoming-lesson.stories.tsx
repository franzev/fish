import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UpcomingLesson } from "./upcoming-lesson";

const data = {
  coach: { id: "coach-1", displayName: "Patricia", avatarUrl: null },
  lesson: {
    id: "slot-1",
    coachId: "coach-1",
    startsAt: "2026-07-21T10:30:00.000Z",
    endsAt: "2026-07-21T11:20:00.000Z",
    durationMinutes: 50,
    bookedByClientId: "client-1",
    bookedAt: "2026-07-14T00:00:00.000Z",
  },
  locale: "en-US",
  timeZone: "Asia/Manila",
  timeFormatPref: "24h" as const,
  joinWindowMinutes: 10,
};

const meta = {
  title: "Booking/Upcoming lesson",
  component: UpcomingLesson,
  tags: ["autodocs"],
  args: { data, now: new Date("2026-07-21T10:00:00.000Z") },
  parameters: { layout: "centered" },
  decorators: [(Story) => <div className="w-notifications"><Story /></div>],
} satisfies Meta<typeof UpcomingLesson>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BeforeJoinWindow: Story = {};
export const Joinable: Story = { args: { now: new Date("2026-07-21T10:20:00.000Z") } };
export const Ended: Story = { args: { now: new Date("2026-07-21T11:20:00.000Z") } };
export const LongCoachAndTimeZone: Story = {
  args: {
    data: {
      ...data,
      coach: { ...data.coach, displayName: "Alexandria Marie Santos-Rivera" },
      timeZone: "America/Argentina/Buenos_Aires",
    },
  },
};
