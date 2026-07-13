import { AddFriendForm } from "@/features/friends";
import {
  friendsFeatureEnabled,
  getAddFriendPageData,
} from "@/features/friends/server";
import { authRedirects } from "@/features/auth/redirects";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AddFriendPage() {
  if (!friendsFeatureEnabled()) {
    redirect(authRedirects.clientHome);
  }

  const data = await getAddFriendPageData();
  if (!data) {
    redirect(authRedirects.signedOut);
  }
  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  return (
    <div className="mx-auto w-full max-w-form">
      <h1 className="mb-xs text-heading-sm">Add a friend</h1>
      <p className="mb-lg text-copy text-body">
        Search by exact username to send a request.
      </p>
      <AddFriendForm />
      <p className="mt-lg text-center text-ui-sm text-muted">
        <Link href="/friends" className="text-body underline">
          Back to friends
        </Link>
      </p>
    </div>
  );
}
