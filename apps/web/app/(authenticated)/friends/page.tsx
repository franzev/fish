import { FriendsScreen } from "@/features/friends";
import {
  friendsFeatureEnabled,
  getFriendsPageData,
} from "@/features/friends/server";
import { authRedirects } from "@/features/auth/redirects";
import { redirect } from "next/navigation";

/* Client-only surface: a coach landing here is silently forwarded (D-03).
   The pilot flag hides the whole surface until the coach-validated rollout. */
export default async function FriendsPage() {
  if (!friendsFeatureEnabled()) {
    redirect(authRedirects.clientHome);
  }

  const data = await getFriendsPageData();
  if (!data) {
    redirect(authRedirects.signedOut);
  }
  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  return (
    <>
      <h1 className="mb-lg text-heading-sm">Friends</h1>
      <FriendsScreen
        userId={data.userId}
        initialFriends={data.friends}
        initialNextCursor={data.nextCursor}
        initialIncomingRequestCount={data.incomingRequestCount}
        initialAcceptedNotifications={data.acceptedNotifications}
      />
    </>
  );
}
