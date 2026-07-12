import { BlockedPeopleList } from "@/features/friends";
import {
  friendsFeatureEnabled,
  getBlockedPeoplePageData,
} from "@/features/friends/server";
import { authRedirects } from "@/features/auth/redirects";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function BlockedPeoplePage() {
  if (!friendsFeatureEnabled()) {
    redirect(authRedirects.clientHome);
  }

  const data = await getBlockedPeoplePageData();
  if (!data) {
    redirect(authRedirects.signedOut);
  }
  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  return (
    <div className="mx-auto w-full max-w-content">
      <h1 className="mb-xs text-3xl">Blocked people</h1>
      <p className="mb-lg text-copy text-body">
        Unblock someone when you&apos;re ready to let them find you again.
      </p>
      <BlockedPeopleList initialBlockedPeople={data.blockedPeople} />
      <p className="mt-lg text-center text-ui-sm text-muted">
        <Link href="/friends" className="text-body underline">
          Back to friends
        </Link>
      </p>
    </div>
  );
}
