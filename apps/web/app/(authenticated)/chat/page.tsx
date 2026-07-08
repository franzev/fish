import { EmptyState } from "@/components/chat";
import { authRedirects } from "@/lib/auth/redirects";
import { getChatPageData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import {
  deleteMessageAction,
  editMessageAction,
  markReadStateAction,
  refreshConversationAction,
  refreshMessagesAction,
  sendMessageAction,
  toggleReactionAction,
} from "./actions";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
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
    />
  );
}
