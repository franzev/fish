import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { authRedirects } from "@/features/auth/redirects";
import { getCoachClientDetailData } from "@/features/coach/server";
import { redirect } from "next/navigation";
import { CallEntryAction } from "@/features/calls";

/* Server Component (NOT "use client") -- mirrors coach/page.tsx's wrong-door
   guard + data-fetch + render shape. This is a DYNAMIC segment: `params` is
   async in Next.js 16's App Router, so it must be awaited before use.

   Read-only (PROF-06/D-10/D-11): identity + goal/role-context + level ONLY.
   A11y prefs and consent are the client's personal settings, never shown to
   a coach. Level is a quiet data label. No
   profile editing stays unavailable. The one primary action starts a call
   with this already-assigned client; it does not expose a client picker.

   Deny behavior (T-04-02): `data.client` is null for BOTH "no such client"
   and "not your client" -- RLS (private.is_coach_of) returns zero rows for
   either, so both render the identical calm `Alert tone="notice"`. There is
   no distinguishable error/403, so a coach cannot enumerate client UUIDs. */
export default async function CoachClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCoachClientDetailData(id);

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "client") {
    redirect(authRedirects.clientHome);
  }

  if (!data.client) {
    return (
      <Alert tone="notice">
        We couldn&apos;t find that client. They may not be assigned to you.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="text-3xl">{data.client.displayName}</h1>
      <Card className="flex flex-col gap-md">
        <div className="flex flex-col gap-2xs">
          <span className="text-ui-sm text-muted">Working toward</span>
          <p className="text-foreground">
            {data.client.goal || "No goal recorded yet."}
          </p>
        </div>
        <div className="flex flex-col gap-2xs">
          <span className="text-ui-sm text-muted">Level</span>
          <p className="text-foreground">{data.client.level ?? "Not set yet"}</p>
        </div>
      </Card>
      <CallEntryAction
        recipientId={data.client.id}
        recipientName={data.client.displayName}
        label={`Call ${data.client.displayName}`}
      />
    </div>
  );
}
