import { Alert } from "@/components/ui/alert";
import { FriendRequestReview } from "@/features/friends";
import {
  friendsFeatureEnabled,
  getFriendRequestDetailData,
} from "@/features/friends/server";
import { authRedirects } from "@/features/auth/redirects";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FriendRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!friendsFeatureEnabled()) {
    redirect(authRedirects.clientHome);
  }

  const { id } = await params;
  const data = await getFriendRequestDetailData(id);
  if (!data) {
    redirect(authRedirects.signedOut);
  }
  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  return (
    <div className="mx-auto w-full max-w-form">
      <h1 className="mb-lg text-heading-sm">Friend request</h1>
      {data.request ? (
        <FriendRequestReview request={data.request} />
      ) : (
        <div className="flex flex-col gap-md">
          <Alert tone="notice">
            This request isn&apos;t waiting anymore.
          </Alert>
          <p className="text-center text-ui-sm text-muted">
            <Link href="/friends/requests" className="text-body underline">
              Back to requests
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
