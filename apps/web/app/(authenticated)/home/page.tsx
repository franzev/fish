import { EmptyState } from "@/components/home/empty-state";
import { authRedirects } from "@/lib/auth/redirects";
import { getClientHomeData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
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

  return (
    <>
      <h1 className="mb-6 text-3xl">Welcome back, {data.firstName}</h1>
      <EmptyState Icon={IconSparkles}>
        {data.coachName ? (
          <p>Your coach {data.coachName} is setting things up.</p>
        ) : (
          <p>We&apos;re getting things ready for you.</p>
        )}
      </EmptyState>
    </>
  );
}
