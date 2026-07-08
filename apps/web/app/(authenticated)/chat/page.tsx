import { redirect } from "next/navigation";

// Chat consolidated under /channels. The seed channel is `general`.
export default function ChatPage() {
  redirect("/channels/22222222-2222-4222-8222-222222222222");
}
