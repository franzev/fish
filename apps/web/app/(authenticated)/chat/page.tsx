import { EmptyState } from "@/components/chat";
import { authRedirects } from "@/lib/auth/redirects";
import { getChatPageData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { sendMessageAction } from "./actions";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const data = await getChatPageData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (!data.chat) {
    return (
      <EmptyState
        title="No conversation yet"
        description="Your conversation will appear when your coach is ready."
      />
    );
  }

  return <ChatClient chat={data.chat} sendMessageAction={sendMessageAction} />;
}
