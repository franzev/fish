import type {
  BackfillMessagesInput,
  ChatCommandService,
  ChatMessageCommand,
  ChatOperationResult,
  ClientChatMessage,
  ClientChatReadState,
  ConversationInput,
  LoadNewestMessagesInput,
  LoadOlderMessagesInput,
  MarkReadStateInput,
  RefreshMessagesInput,
  ReportGifInput,
  SendMessageInput,
} from "../contracts";
import {
  sendNotice,
  toClientReadState,
  type MessageResponseRow,
  type ReadStateResponseRow,
} from "./chat-mapping";
import {
  isLocalBackendUnavailable,
  postBackendCommand,
} from "./edge-function-transport";
import {
  backfillMessagesViaLocalRpc,
  commandMessageViaLocalRpc,
  loadNewestMessagesViaLocalRpc,
  loadOlderMessagesViaLocalRpc,
  markReadStateViaLocalRpc,
  refreshConversationViaLocalRpc,
  refreshMessagesViaLocalRpc,
  reportGifViaLocalRpc,
  sendMessageViaLocalRpc,
  toClientChatMessagesWithSenders,
  getLocalFallbackContext,
} from "./local-chat-commands";
import type { AppSupabaseClient } from "./types";

type EdgePayload = Record<string, unknown> & { error?: string };

export class SupabaseChatCommandService implements ChatCommandService {
  constructor(private readonly client: AppSupabaseClient) {}

  private async localContext() {
    return getLocalFallbackContext(this.client);
  }

  private async accessToken(): Promise<string | null> {
    try {
      const result = await this.client.auth.getSession();
      return result && !result.error
        ? result.data.session?.access_token ?? null
        : null;
    } catch {
      return null;
    }
  }

  private async post(
    functionName: "send-message" | "chat-command",
    body: unknown
  ): Promise<{ response: Response; payload: EdgePayload | null } | null> {
    const accessToken = await this.accessToken();
    if (!accessToken) return null;

    const response = await postBackendCommand(
      functionName,
      accessToken,
      body
    ).catch(() => null);
    if (!response || isLocalBackendUnavailable(response)) return null;

    const payload = (await response.json().catch(() => null)) as
      | EdgePayload
      | null;
    return { response, payload };
  }

  async sendMessage(
    input: SendMessageInput
  ): Promise<ChatOperationResult<ClientChatMessage>> {
    const edge = await this.post(
      "send-message",
      input.replyToMessageId
        ? input
        : {
            conversationId: input.conversationId,
            body: input.body,
            clientRequestId: input.clientRequestId,
            ...(input.attachmentIds?.length ? { attachmentIds: input.attachmentIds } : {}),
            ...(input.gif ? { gif: input.gif } : {}),
            ...(input.stickerId ? { stickerId: input.stickerId } : {}),
          }
    );
    if (!edge) return sendMessageViaLocalRpc(input, await this.localContext());

    const messageValue = edge.payload?.message;
    const message = Array.isArray(messageValue)
      ? messageValue[0]
      : messageValue;
    if (!edge.response.ok || !message) {
      return {
        ok: false,
        notice:
          typeof edge.payload?.error === "string"
            ? edge.payload.error
            : sendNotice,
      };
    }
    const [mapped] = await toClientChatMessagesWithSenders([message as MessageResponseRow]);
    return { ok: true, data: mapped };
  }

  async executeMessageCommand(
    command: ChatMessageCommand
  ): Promise<ChatOperationResult<ClientChatMessage>> {
    const wireCommand =
      command.kind === "edit"
        ? {
            action: "edit-message",
            messageId: command.messageId,
            body: command.body,
          }
        : command.kind === "delete"
          ? { action: "delete-message", messageId: command.messageId }
          : {
              action: "set-reaction",
              messageId: command.messageId,
              emoji: command.emoji,
              active: command.active,
            };
    const edge = await this.post("chat-command", wireCommand);
    if (!edge) return commandMessageViaLocalRpc(command, await this.localContext());

    const messageValue = edge.payload?.message;
    const message = Array.isArray(messageValue)
      ? messageValue[0]
      : messageValue;
    if (!edge.response.ok || !message) {
      return {
        ok: false,
        notice:
          typeof edge.payload?.error === "string"
            ? edge.payload.error
            : sendNotice,
      };
    }
    const [mapped] = await toClientChatMessagesWithSenders([message as MessageResponseRow]);
    return { ok: true, data: mapped };
  }

  async reportGif(input: ReportGifInput): Promise<ChatOperationResult<void>> {
    const edge = await this.post("chat-command", {
      action: "report-gif",
      messageId: input.messageId,
    });
    if (!edge) return reportGifViaLocalRpc(input, await this.localContext());
    if (!edge.response.ok || edge.payload?.reported !== true) {
      return {
        ok: false,
        notice: typeof edge.payload?.error === "string"
          ? edge.payload.error
          : "That report did not send yet. Try again.",
      };
    }
    return { ok: true, data: undefined };
  }

  async markReadState(
    input: MarkReadStateInput
  ): Promise<ChatOperationResult<ClientChatReadState>> {
    const edge = await this.post("chat-command", {
      action: "mark-read-state",
      conversationId: input.conversationId,
      lastDeliveredMessageId: input.lastDeliveredMessageId,
      lastReadMessageId: input.lastReadMessageId,
    });
    if (!edge) return markReadStateViaLocalRpc(input, await this.localContext());

    const readState = edge.payload?.readState;
    if (!edge.response.ok || !readState) {
      return {
        ok: false,
        notice:
          typeof edge.payload?.error === "string"
            ? edge.payload.error
            : sendNotice,
      };
    }
    return {
      ok: true,
      data: toClientReadState(readState as ReadStateResponseRow),
    };
  }

  async refreshMessages(
    input: RefreshMessagesInput
  ): Promise<ChatOperationResult<ClientChatMessage[]>> {
    const edge = await this.post("chat-command", {
      action: "refresh-messages",
      messageIds: Array.from(new Set(input.messageIds)),
    });
    if (!edge) return refreshMessagesViaLocalRpc(input, await this.localContext());

    const messages = edge.payload?.messages;
    if (!edge.response.ok || !Array.isArray(messages)) {
      return {
        ok: false,
        notice:
          typeof edge.payload?.error === "string"
            ? edge.payload.error
            : sendNotice,
      };
    }
    return {
      ok: true,
      data: await toClientChatMessagesWithSenders(
        messages as MessageResponseRow[]
      ),
    };
  }

  async refreshConversation(
    input: ConversationInput
  ): Promise<
    ChatOperationResult<{
      messages: ClientChatMessage[];
      readStates: ClientChatReadState[];
    }>
  > {
    const edge = await this.post("chat-command", {
      action: "refresh-conversation",
      conversationId: input.conversationId,
    });
    if (!edge) return refreshConversationViaLocalRpc(input, await this.localContext());

    const messages = edge.payload?.messages;
    const readStates = edge.payload?.readStates;
    if (
      !edge.response.ok ||
      !Array.isArray(messages) ||
      !Array.isArray(readStates)
    ) {
      return {
        ok: false,
        notice:
          typeof edge.payload?.error === "string"
            ? edge.payload.error
            : sendNotice,
      };
    }
    return {
      ok: true,
      data: {
        messages: await toClientChatMessagesWithSenders(
          messages as MessageResponseRow[]
        ),
        readStates: (readStates as ReadStateResponseRow[]).map(
          toClientReadState
        ),
      },
    };
  }

  async loadOlderMessages(input: LoadOlderMessagesInput) {
    return loadOlderMessagesViaLocalRpc(input, await this.localContext());
  }

  async backfillMessages(input: BackfillMessagesInput) {
    return backfillMessagesViaLocalRpc(input, await this.localContext());
  }

  async loadNewestMessages(input: LoadNewestMessagesInput) {
    return loadNewestMessagesViaLocalRpc(input, await this.localContext());
  }
}
