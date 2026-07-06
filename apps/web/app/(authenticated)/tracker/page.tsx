import { EmptyState } from "@/components/chat";
import { authRedirects } from "@/lib/auth/redirects";
import { getClientTrackerData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { saveTrackerDraftAction, saveTrackerEntryAction } from "./actions";
import { TrackerClientFlow } from "./tracker-client-flow";

export default async function TrackerPage() {
  const data = await getClientTrackerData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  if (!data.tracker) {
    return (
      <EmptyState
        title="No tracker yet"
        description="Your coach will add a check-in when it is ready."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6">
      <div className="space-y-2">
        <h1 className="font-display text-heading text-foreground">
          Today&apos;s check-in
        </h1>
        <p className="text-copy text-body">
          A quiet note for your next coaching step.
        </p>
      </div>
      <TrackerClientFlow
        tracker={data.tracker}
        saveDraftAction={saveTrackerDraftAction}
        saveEntryAction={saveTrackerEntryAction}
      />
    </div>
  );
}
