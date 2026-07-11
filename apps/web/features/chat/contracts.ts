import type { ClientChatMessage, ClientChatReadState } from "@/lib/services";

export interface SendMessageActionState {
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  message?: ClientChatMessage;
}

export interface MarkReadStateActionState {
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  readState?: ClientChatReadState;
}
