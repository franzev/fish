import { Alert } from "@/components/ui/alert";
import { FriendSafetyActions } from "@/features/friends";
import {
  friendsFeatureEnabled,
  getFriendDetailData,
} from "@/features/friends/server";
import { authRedirects } from "@/features/auth/redirects";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/features/chat";
import { PresenceSummary } from "@/features/presence/components/presence-summary/presence-summary";
import { CallEntryAction } from "@/features/calls";

export default async function FriendDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!friendsFeatureEnabled()) {
    redirect(authRedirects.clientHome);
  }

  const { id } = await params;
  const data = await getFriendDetailData(id);
  if (!data) {
    redirect(authRedirects.signedOut);
  }
  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  if (!data.friend) {
    return (
      <div className="mx-auto flex w-full max-w-form flex-col gap-md">
        <Alert tone="notice">This person isn&apos;t in your friends.</Alert>
        <p className="text-center text-ui-sm text-muted">
          <Link href="/friends" className="text-body underline">
            Back to friends
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-form">
      <div className="mb-xs flex items-center gap-sm">
        <Avatar
          profileId={data.friend.friend.id}
          src={data.friend.friend.avatarUrl ?? undefined}
          name={data.friend.friend.displayName}
          size="lg"
          alt=""
        />
        <span className="flex min-w-0 flex-col gap-3xs">
          <h1 className="text-heading-sm">{data.friend.friend.displayName}</h1>
          <PresenceSummary
            userId={data.friend.friend.id}
            showLastSeen
          />
        </span>
      </div>
      <p className="mb-lg text-ui-sm text-muted">
        @{data.friend.friend.username}
      </p>
      <div className="flex flex-col gap-lg">
        <CallEntryAction
          recipientId={data.friend.friend.id}
          recipientName={data.friend.friend.displayName}
          label={`Call ${data.friend.friend.displayName}`}
        />
        <FriendSafetyActions friend={data.friend.friend} />
      </div>
      <p className="mt-lg text-center text-ui-sm text-muted">
        <Link href="/friends" className="text-body underline">
          Back to friends
        </Link>
      </p>
    </div>
  );
}
