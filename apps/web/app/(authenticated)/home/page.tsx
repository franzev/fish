import { EmptyState } from "@/components/home/empty-state";
import { authRedirects } from "@/features/auth/redirects";
import { getClientHomeData } from "@/features/auth/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IconSparkles } from "@tabler/icons-react";
import { UpcomingLesson } from "@/features/booking";
import { getUpcomingLessonData } from "@/features/booking/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* Server Component (NOT "use client") — the (authenticated) layout already
   ran getUser(), redirected signed-out visitors, and resolved role/shell.
   This page re-reads getUser() for the user id: Server Components re-execute
   per navigation, so re-reading here is correct, not redundant caching
   (RESEARCH.md Pitfall 5). This page owns only the wrong-door guard (D-03:
   a coach landing here is silently forwarded to /coach) and the client
   content itself. */
export default async function ClientHomePage() {
  const data = await getClientHomeData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  const upcomingLesson = await getUpcomingLessonData();

  return (
    <>
      <h1 className="mb-lg text-heading-sm">Welcome back, {data.firstName}</h1>
      {upcomingLesson ? (
        <UpcomingLesson data={upcomingLesson} />
      ) : (
        <>
          <EmptyState Icon={IconSparkles}>
            {data.coachName ? (
              <p>Your next lesson is ready to book.</p>
            ) : (
              <p>We&apos;re getting things ready for you.</p>
            )}
          </EmptyState>
          {data.coachId && data.coachName && (
            <Link
              href="/book"
              className={cn(buttonVariants({ fullWidth: true }), "mt-lg")}
            >
              Book a lesson
            </Link>
          )}
        </>
      )}
      <p className="mt-lg text-center text-ui-sm text-muted">
        <Link href="/profile" className="text-body underline">
          Your profile
        </Link>
      </p>
    </>
  );
}
