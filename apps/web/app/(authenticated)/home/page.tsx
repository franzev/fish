import { EmptyState } from "@/components/home/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { authRedirects } from "@/lib/auth/redirects";
import { getClientHomeData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IconSparkles } from "@tabler/icons-react";

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

  const openOnboarding =
    data.onboarding && data.onboarding.status !== "submitted"
      ? data.onboarding
      : null;
  const onboardingLabel =
    openOnboarding?.status === "not_started"
      ? "Start onboarding"
      : "Continue onboarding";

  return (
    <>
      <h1 className="mb-6 text-3xl">Welcome back, {data.firstName}</h1>
      <EmptyState Icon={IconSparkles}>
        {openOnboarding ? (
          <div className="flex flex-col items-center gap-4">
            <p>
              {data.coachName
                ? `Your coach ${data.coachName} has one setup step for you.`
                : "One setup step is ready for you."}
            </p>
            <Link
              href="/onboarding"
              className={buttonVariants({ fullWidth: true })}
            >
              {onboardingLabel}
            </Link>
          </div>
        ) : data.tracker ? (
          <div className="flex flex-col items-center gap-4">
            <p>
              {data.coachName
                ? `Your coach ${data.coachName} has a check-in ready for you.`
                : "Your check-in is ready."}
            </p>
            <Link href="/tracker" className={buttonVariants({ fullWidth: true })}>
              Open tracker
            </Link>
          </div>
        ) : data.coachName ? (
          <p>Your coach {data.coachName} is setting things up.</p>
        ) : (
          <p>We&apos;re getting things ready for you.</p>
        )}
      </EmptyState>
      {/* D-05: a quiet link, not a primary button -- the minimal /profile
          route this phase, ahead of the full bottom-nav shell. */}
      <p className="mt-6 text-center text-ui-sm text-muted">
        <Link href="/profile" className="text-body underline">
          Your profile
        </Link>
      </p>
    </>
  );
}
