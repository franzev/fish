import { CallScreen } from "@/features/calls";
import { ChatClient } from "@/features/chat";
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
  sendMessageAction,
  setReactionAction,
} from "@/features/chat/server";
import { getCallChatData } from "@/features/chat/server/page-data";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chat = await getCallChatData(id);

  return (
    <CallScreen
      callId={id}
      chatSidebar={chat ? (
        <ChatClient
          chat={chat}
          presentation="embedded"
          sendMessageAction={sendMessageAction}
          editMessageAction={editMessageAction}
          deleteMessageAction={deleteMessageAction}
          setReactionAction={setReactionAction}
          reportGifAction={reportGifAction}
          markReadStateAction={markReadStateAction}
          refreshUnreadSummaryAction={refreshUnreadSummaryAction}
          refreshMessagesAction={refreshMessagesAction}
          refreshConversationAction={refreshConversationAction}
          loadOlderMessagesAction={loadOlderMessagesAction}
          backfillMessagesAction={backfillMessagesAction}
          loadNewestMessagesAction={loadNewestMessagesAction}
        />
      ) : undefined}
    />
  );
}
