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
import { redirect } from "next/navigation";

// Single-channel milestone: [id] is accepted for URL stability, but the only
// channel is `general`, resolved through the existing demo-community data path.
export default async function ChannelPage() {
  const data = await getChatPageData();

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
