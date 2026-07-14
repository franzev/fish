import { BookingConfirmationScreen } from "@/features/booking";
import { getBookingConfirmationData } from "@/features/booking/server";
import { redirect } from "next/navigation";

export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getBookingConfirmationData(id);
  if (!data) redirect("/sign-in");
  if (data.role !== "client") redirect("/coach");

  return (
    <BookingConfirmationScreen
      coach={data.coach}
      lesson={data.lesson}
      locale={data.locale}
      timeZone={data.timeZone}
      timeFormatPref={data.timeFormatPref}
    />
  );
}
