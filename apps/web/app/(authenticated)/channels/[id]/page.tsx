import { EmptyState } from "@/components/chat";
import { authRedirects } from "@/lib/auth/redirects";
import { getChatPageData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import {
  backfillMessagesAction,
  deleteMessageAction,
  editMessageAction,
  loadNewestMessagesAction,
  loadOlderMessagesAction,
  markReadStateAction,
  refreshConversationAction,
  refreshMessagesAction,
  sendMessageAction,
  toggleReactionAction,
} from "../../chat/actions";
import { ChatClient } from "../../chat/chat-client";

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
      editMessageAction={editMessageAction}
      deleteMessageAction={deleteMessageAction}
      toggleReactionAction={toggleReactionAction}
      markReadStateAction={markReadStateAction}
      refreshMessagesAction={refreshMessagesAction}
      refreshConversationAction={refreshConversationAction}
      loadOlderMessagesAction={loadOlderMessagesAction}
      backfillMessagesAction={backfillMessagesAction}
      loadNewestMessagesAction={loadNewestMessagesAction}
    />
  );
}
