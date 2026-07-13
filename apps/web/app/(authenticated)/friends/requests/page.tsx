import { FriendRequestsList } from "@/features/friends";
import {
  friendsFeatureEnabled,
  getFriendRequestsPageData,
} from "@/features/friends/server";
import { authRedirects } from "@/features/auth/redirects";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FriendRequestsPage() {
  if (!friendsFeatureEnabled()) {
    redirect(authRedirects.clientHome);
  }

  const data = await getFriendRequestsPageData();
  if (!data) {
    redirect(authRedirects.signedOut);
  }
  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  return (
    <>
      <h1 className="mb-lg text-heading-sm">Friend requests</h1>
      <FriendRequestsList
        userId={data.userId}
        initialRequests={data.requests}
        initialNextCursor={data.nextCursor}
      />
      <p className="mt-lg text-center text-ui-sm text-muted">
        <Link href="/friends" className="text-body underline">
          Back to friends
        </Link>
      </p>
    </>
  );
}
