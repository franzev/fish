import { LessonSetupScreen } from "@/features/booking";
import { getBookingConfirmationData } from "@/features/booking/server";
import { redirect } from "next/navigation";

export default async function LessonSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getBookingConfirmationData(id);
  if (!data) redirect("/sign-in");
  if (data.role !== "client") redirect("/coach");

  return (
    <LessonSetupScreen
      coach={data.coach}
      lesson={data.lesson}
      locale={data.locale}
      timeZone={data.timeZone}
      timeFormatPref={data.timeFormatPref}
      joinWindowMinutes={data.joinWindowMinutes}
      initialNow={new Date().toISOString()}
    />
  );
}
