import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentProfile } from "@/features/auth/server";
import { getServerServices } from "@/lib/services/runtime/server";
import { authRedirects } from "@/features/auth/redirects";
import { redirect } from "next/navigation";
import { getDirectConversationPreviews } from "@/features/chat/server/page-data";

export default async function MessagesPage() {
  const services = await getServerServices();
  const profile = await getCurrentProfile({
    auth: services.auth,
    profiles: services.database.profiles,
  });
  if (!profile) redirect(authRedirects.signedOut);
  if (profile.role === "coach") redirect(authRedirects.coachHome);

  const direct = (await getDirectConversationPreviews(services))[0];
  if (direct) redirect(`/messages/${direct.conversationId}`);

  return (
    <EmptyState
      title="Messages are on their way"
      description="Your direct conversations will appear here once they’re ready."
    />
  );
}
