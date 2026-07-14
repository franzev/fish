import { BookingScreen } from "@/features/booking";
import { bookLessonAction, getBookingPageData } from "@/features/booking/server";
import { redirect } from "next/navigation";

export default async function BookingPage() {
  const data = await getBookingPageData();
  if (!data) redirect("/sign-in");
  if (data.role !== "client") redirect("/coach");

  return (
    <BookingScreen
      coach={data.coach}
      slots={data.slots}
      upcomingLesson={data.upcomingLesson}
      locale={data.locale}
      timeZone={data.timeZone}
      timeFormatPref={data.timeFormatPref}
      bookAction={bookLessonAction}
    />
  );
}
