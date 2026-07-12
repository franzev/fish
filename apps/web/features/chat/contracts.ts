import type {
  ChatSearchInput,
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";

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

export interface ReportGifActionState {
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
}

export interface ChatSearchActionState {
  status: "sent" | "notice";
  values: ChatSearchInput | unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  nextCursor?: { createdAt: string; id: string } | null;
  totalCount?: number;
}
