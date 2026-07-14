import { ChatClient, EmptyState, MessagesWorkspace } from "@/features/chat";
import {
  backfillMessagesAction,
  deleteMessageAction,
  editMessageAction,
  loadNewestMessagesAction,
  loadOlderMessagesAction,
  markReadStateAction,
  refreshConversationAction,
  refreshMessagesAction,
  refreshUnreadSummaryAction,
  reportGifAction,
  searchChatMessagesAction,
  sendMessageAction,
  toggleReactionAction,
} from "@/features/chat/server";
import {
  getChatPageData,
  getDirectConversationPreviews,
} from "@/features/chat/server/page-data";
import { authRedirects } from "@/features/auth/redirects";
import { notFound, redirect } from "next/navigation";
import { getServerServices } from "@/lib/services/runtime/server";

export default async function DirectMessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const [{ id }, { message: focusMessageId }] = await Promise.all([params, searchParams]);
  const services = await getServerServices();
  const [data, conversations] = await Promise.all([
    getChatPageData(services, undefined, id),
    getDirectConversationPreviews(services),
  ]);
  if (!data) redirect(authRedirects.signedOut);
  if (!data.chat) {
    return (
      <EmptyState
        title="This conversation isn’t available"
        description="Your messages are still safe. Return to Messages to continue."
      />
    );
  }
  if (data.chat.kind !== "direct") notFound();

  return (
    <MessagesWorkspace chat={data.chat} conversations={conversations}>
      <ChatClient
        chat={data.chat}
        focusMessageId={focusMessageId ?? null}
        sendMessageAction={sendMessageAction}
        searchMessagesAction={searchChatMessagesAction}
        editMessageAction={editMessageAction}
        deleteMessageAction={deleteMessageAction}
        toggleReactionAction={toggleReactionAction}
        reportGifAction={reportGifAction}
        markReadStateAction={markReadStateAction}
        refreshUnreadSummaryAction={refreshUnreadSummaryAction}
        refreshMessagesAction={refreshMessagesAction}
        refreshConversationAction={refreshConversationAction}
        loadOlderMessagesAction={loadOlderMessagesAction}
        backfillMessagesAction={backfillMessagesAction}
        loadNewestMessagesAction={loadNewestMessagesAction}
      />
    </MessagesWorkspace>
  );
}
