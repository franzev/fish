import { EmptyState } from "@/features/chat";
import { getCurrentProfile } from "@/features/auth/server";
import { getServerServices } from "@/lib/services/runtime/server";
import { authRedirects } from "@/features/auth/redirects";
import { redirect } from "next/navigation";

export default async function MessagesPage() {
  const services = await getServerServices();
  const profile = await getCurrentProfile({
    auth: services.auth,
    profiles: services.database.profiles,
  });
  if (!profile) redirect(authRedirects.signedOut);
  if (profile.role === "coach") redirect(authRedirects.coachHome);

  const result = await services.database.attention.list();
  if (!result.ok) throw result.error;
  const direct = result.data
    .filter((item) => item.surface === "direct" && item.conversationId)
    .sort((left, right) => right.unreadCount - left.unreadCount)[0];
  if (direct?.conversationId) redirect(`/messages/${direct.conversationId}`);

  return (
    <EmptyState
      title="Messages are on their way"
      description="Your coach conversation will appear here once it’s ready."
    />
  );
}
