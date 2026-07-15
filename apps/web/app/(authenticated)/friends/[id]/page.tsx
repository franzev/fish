import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FriendConversationActions } from "@/features/friends";
import {
  friendsFeatureEnabled,
  getFriendDetailData,
} from "@/features/friends/server";
import { authRedirects } from "@/features/auth/redirects";
import { redirect } from "next/navigation";
import { Avatar } from "@/features/chat";
import { PresenceSummary } from "@/features/presence/components/presence-summary/presence-summary";
import { CallEntryAction } from "@/features/calls";
import { IconArrowLeft, IconMessage } from "@tabler/icons-react";

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
      <div className="mx-auto flex w-full max-w-form flex-col gap-lg">
        <Alert tone="notice">This person isn&apos;t in your friends.</Alert>
        <Button href="/friends" variant="primary" fullWidth>
          <span className="inline-flex items-center gap-xs">
            <IconArrowLeft size={20} stroke={1.75} aria-hidden="true" />
            Back to friends
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-lg">
      <header className="flex items-center justify-between gap-md">
        <Button href="/friends" variant="ghost" className="-ml-md">
          <span className="inline-flex items-center gap-xs">
            <IconArrowLeft size={20} stroke={1.75} aria-hidden="true" />
            Friends
          </span>
        </Button>
        <FriendConversationActions
          friend={data.friend.friend}
          className="-mr-sm"
        />
      </header>

      <section
        aria-labelledby="friend-profile-name"
        className="flex flex-col items-center text-center"
      >
        <Avatar
          profileId={data.friend.friend.id}
          src={data.friend.friend.avatarUrl ?? undefined}
          name={data.friend.friend.displayName}
          size="profile"
          alt=""
        />
        <h1
          id="friend-profile-name"
          className="mt-md max-w-full text-balance text-heading-sm"
        >
          {data.friend.friend.displayName}
        </h1>
        <p className="mt-2xs max-w-full truncate text-ui-sm text-muted">
          @{data.friend.friend.username}
        </p>
        <div className="mt-xs text-ui-sm">
          <PresenceSummary userId={data.friend.friend.id} showLastSeen />
        </div>
      </section>

      <div className="mt-md flex flex-col gap-md">
        {data.conversationId && (
          <Button
            href={`/messages/${data.conversationId}`}
            aria-label={`Message ${data.friend.friend.displayName}`}
            variant="primary"
            fullWidth
          >
            <span className="inline-flex items-center gap-xs">
              <IconMessage size={20} stroke={1.75} aria-hidden="true" />
              Message
            </span>
          </Button>
        )}
        <CallEntryAction
          recipientId={data.friend.friend.id}
          recipientName={data.friend.friend.displayName}
          label="Audio call"
          variant="secondary"
          presentation="paired"
        />
      </div>
    </div>
  );
}
