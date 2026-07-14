import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { AvailabilityTable } from "./availability-table";

const slots = [
  ["slot-1", "2026-07-21T01:30:00.000Z"],
  ["slot-2", "2026-07-21T03:00:00.000Z"],
  ["slot-3", "2026-07-23T01:30:00.000Z"],
  ["slot-4", "2026-07-29T02:00:00.000Z"],
].map(([id, startsAt]) => ({
  id: id!,
  coachId: "coach-1",
  startsAt: startsAt!,
  endsAt: new Date(new Date(startsAt!).getTime() + 50 * 60_000).toISOString(),
  durationMinutes: 50,
  bookedByClientId: null,
  bookedAt: null,
}));

const meta = {
  title: "Booking/Availability table",
  component: AvailabilityTable,
  tags: ["autodocs"],
  args: {
    slots,
    selectedId: "",
    locale: "en-US",
    timeZone: "Asia/Manila",
    timeFormatPref: "12h",
    onSelect: () => undefined,
  },
  render: (args) => <AvailabilityPreview {...args} />,
} satisfies Meta<typeof AvailabilityTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
export const Selected: Story = { args: { selectedId: "slot-1" } };
export const TwentyFourHourTime: Story = { args: { timeFormatPref: "24h" } };
export const SparseWeek: Story = { args: { slots: [slots[0]!] } };
export const AlternateLocaleAndZone: Story = {
  args: { locale: "en-GB", timeZone: "Europe/London" },
};
export const Empty: Story = { args: { slots: [] } };

function AvailabilityPreview(args: ComponentProps<typeof AvailabilityTable>) {
  const [selectedId, setSelectedId] = useState(args.selectedId);
  return (
    <div className="w-full max-w-content bg-bg p-md">
      <AvailabilityTable {...args} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  );
}
