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
        <h1 className="text-3xl">{data.friend.friend.displayName}</h1>
      </div>
      <p className="mb-lg text-ui-sm text-muted">
        @{data.friend.friend.username}
      </p>
      <FriendSafetyActions friend={data.friend.friend} />
      <p className="mt-lg text-center text-ui-sm text-muted">
        <Link href="/friends" className="text-body underline">
          Back to friends
        </Link>
      </p>
    </div>
  );
}
