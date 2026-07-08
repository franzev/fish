import { generalChannelHref } from "@/lib/channels";
import { redirect } from "next/navigation";

// Chat consolidated under /channels. The seed channel is `general`.
export default function ChatPage() {
  redirect(generalChannelHref);
}
