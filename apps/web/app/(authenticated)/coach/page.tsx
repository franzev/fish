import { ClientList } from "@/features/coach";
import { EmptyState } from "@/components/ui/empty-state";
import { authRedirects } from "@/features/auth/redirects";
import { getCoachHomeData } from "@/features/coach/server";
import { redirect } from "next/navigation";
import { IconUsers } from "@tabler/icons-react";

/* Server Component (NOT "use client") — the (authenticated) layout already
   ran getUser(), redirected signed-out visitors, and resolved role/shell.
   This page re-reads getUser() for the user id: Server Components re-execute
   per navigation, so re-reading here is correct, not redundant caching
   (RESEARCH.md Pitfall 5). This page owns only the wrong-door guard (D-03:
   a client landing here is silently forwarded to /home) and the coach
   content itself. */
export default async function CoachHomePage() {
  const data = await getCoachHomeData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "client") {
    redirect(authRedirects.clientHome);
  }

  return (
    <>
      <h1 className="mb-lg text-heading-sm">Your clients</h1>
      {data.clients.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          appearance="surface"
          fill={false}
          title={null}
          description="Clients assigned to you will show up here."
        />
      ) : (
        <ClientList clients={data.clients} />
      )}
    </>
  );
}
