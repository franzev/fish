import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import type { BookLessonAction } from "../../contracts";
import { BookingScreen } from "./booking-screen";

const coach = { id: "coach-1", displayName: "Patricia", avatarUrl: null };
const slots = [
  {
    id: "slot-1",
    coachId: coach.id,
    startsAt: "2026-07-21T10:30:00.000Z",
    endsAt: "2026-07-21T11:20:00.000Z",
    durationMinutes: 50,
    bookedByClientId: null,
    bookedAt: null,
  },
  {
    id: "slot-2",
    coachId: coach.id,
    startsAt: "2026-07-22T08:00:00.000Z",
    endsAt: "2026-07-22T08:50:00.000Z",
    durationMinutes: 50,
    bookedByClientId: null,
    bookedAt: null,
  },
];
const idleAction: BookLessonAction = async () => ({ status: "idle" });
const noticeAction: BookLessonAction = async () => ({
  status: "notice",
  notice: "Choose an available lesson time.",
});
const pendingAction: BookLessonAction = async () => new Promise(() => undefined);

const meta = {
  title: "Booking/Booking screen",
  component: BookingScreen,
  tags: ["autodocs"],
  args: {
    coach,
    slots,
    locale: "en-US",
    timeZone: "Asia/Manila",
    timeFormatPref: "12h",
    bookAction: idleAction,
  },
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="min-h-screen"><Story /></div>],
} satisfies Meta<typeof BookingScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Selected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "6:30 PM" })[0]!);
  },
};
export const Pending: Story = {
  args: { bookAction: pendingAction },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "6:30 PM" })[0]!);
    await userEvent.click(canvas.getByRole("button", { name: "Book lesson" }));
  },
};
export const ActionNotice: Story = {
  args: { bookAction: noticeAction },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Book lesson" }));
  },
};
export const NoCoach: Story = { args: { coach: null } };
export const NoSlots: Story = { args: { slots: [] } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
