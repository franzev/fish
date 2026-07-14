import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookingConfirmationScreen } from "./booking-confirmation-screen";

const coach = { id: "coach-1", displayName: "Patricia", avatarUrl: null };
const lesson = {
  id: "slot-1",
  coachId: "coach-1",
  startsAt: "2026-07-21T10:30:00.000Z",
  endsAt: "2026-07-21T11:20:00.000Z",
  durationMinutes: 50,
  bookedByClientId: "client-1",
  bookedAt: "2026-07-14T00:00:00.000Z",
};

const meta = {
  title: "Booking/Booking confirmation screen",
  component: BookingConfirmationScreen,
  tags: ["autodocs"],
  args: {
    coach,
    lesson,
    locale: "en-US",
    timeZone: "Asia/Manila",
    timeFormatPref: "12h",
  },
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="min-h-screen"><Story /></div>],
} satisfies Meta<typeof BookingConfirmationScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Booked: Story = {};
export const Unavailable: Story = { args: { lesson: null } };
export const MissingCoach: Story = { args: { coach: null } };
export const TwentyFourHourTime: Story = { args: { timeFormatPref: "24h" } };
export const LongCoachName: Story = {
  args: { coach: { ...coach, displayName: "Alexandria Marie Santos-Rivera" } },
};
