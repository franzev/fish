import { ChatClient, EmptyState } from "@/features/chat";
import {
  backfillMessagesAction,
  deleteMessageAction,
  editMessageAction,
  loadNewestMessagesAction,
  loadOlderMessagesAction,
  markReadStateAction,
  refreshConversationAction,
  refreshMessagesAction,
  reportGifAction,
  sendMessageAction,
  searchChatMessagesAction,
  toggleReactionAction,
} from "@/features/chat/server";
import { authRedirects } from "@/features/auth/redirects";
import { getChatPageData } from "@/features/chat/server/page-data";
import { friendsFeatureEnabled } from "@/features/friends/server";
import {
  findCommunityChannel,
} from "@/lib/channels";
import { notFound, redirect } from "next/navigation";

// Single-channel milestone: keep UUID links working, but expose the stable,
// readable slug as the canonical URL.
export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { slug } = await params;
  const { message: focusMessageId } = await searchParams;

  const channel = findCommunityChannel(slug);
  if (!channel) {
    notFound();
  }

  if (slug !== channel.slug) {
    redirect(channel.href);
  }

  const data = await getChatPageData(undefined, channel.slug);

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (!data.chat) {
    return (
      <EmptyState
        title="The community is on its way"
        description="Your community space will appear here once it's ready."
      />
    );
  }

  return (
    <ChatClient
      chat={data.chat}
      friendActionsEnabled={friendsFeatureEnabled()}
      focusMessageId={focusMessageId ?? null}
      sendMessageAction={sendMessageAction}
      searchMessagesAction={searchChatMessagesAction}
      editMessageAction={editMessageAction}
      deleteMessageAction={deleteMessageAction}
      toggleReactionAction={toggleReactionAction}
      reportGifAction={reportGifAction}
      markReadStateAction={markReadStateAction}
      refreshMessagesAction={refreshMessagesAction}
      refreshConversationAction={refreshConversationAction}
      loadOlderMessagesAction={loadOlderMessagesAction}
      backfillMessagesAction={backfillMessagesAction}
      loadNewestMessagesAction={loadNewestMessagesAction}
    />
  );
}
