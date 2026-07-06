"use client";

import type { ClientChatData, ClientChatMessage } from "@/lib/services";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chatLimits } from "@fish/core/chat";
import { IconSend } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { SendMessageActionState } from "./actions";

type LocalStatus = "sending" | "sent" | "failed";

type LocalMessage = ClientChatMessage & {
  localStatus: LocalStatus;
};

interface ChatClientProps {
  chat: ClientChatData;
  sendMessageAction: (input: unknown) => Promise<SendMessageActionState>;
}

function makeRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}`;
}

function toLocalMessage(message: ClientChatMessage): LocalMessage {
  return { ...message, localStatus: "sent" };
}

export function ChatClient({ chat, sendMessageAction }: ChatClientProps) {
  const initialMessages = useMemo(
    () => chat.messages.map(toLocalMessage),
    [chat.messages]
  );
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);

  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length > 0 && !sendingRequestId;

  async function sendWithRequestId(body: string, clientRequestId: string) {
    setNotice(null);
    setSendingRequestId(clientRequestId);

    const optimistic: LocalMessage = {
      id: clientRequestId,
      conversationId: chat.conversationId,
      senderId: chat.currentUserId,
      senderRole: chat.currentUserRole,
      body,
      clientRequestId,
      createdAt: new Date().toISOString(),
      localStatus: "sending",
    };

    setMessages((current) => {
      const exists = current.some(
        (message) => message.clientRequestId === clientRequestId
      );
      return exists
        ? current.map((message) =>
            message.clientRequestId === clientRequestId ? optimistic : message
          )
        : [...current, optimistic];
    });

    const result = await sendMessageAction({
      conversationId: chat.conversationId,
      body,
      clientRequestId,
    });

    setSendingRequestId(null);

    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That did not send yet. Keep this open and try again.");
      setMessages((current) =>
        current.map((message) =>
          message.clientRequestId === clientRequestId
            ? { ...message, localStatus: "failed" }
            : message
        )
      );
      return;
    }

    setDraft("");
    const sentMessage = result.message;
    setMessages((current) =>
      current.map((message) =>
        message.clientRequestId === clientRequestId
          ? { ...sentMessage, localStatus: "sent" }
          : message
      )
    );
  }

  async function handleSend() {
    if (trimmedDraft.length === 0) {
      setNotice("Add a message before sending.");
      return;
    }

    if (trimmedDraft.length > chatLimits.messageBodyMaxLength) {
      setNotice("This message is a little long. Try sending it in two parts.");
      return;
    }

    await sendWithRequestId(trimmedDraft, makeRequestId());
  }

  return (
    <section
      className="mx-auto flex min-h-chat-container-demo w-full max-w-chat flex-col overflow-hidden rounded-card border border-border bg-bg"
      aria-label={`Conversation with ${chat.participant.displayName}`}
    >
      <header className="border-b border-border bg-surface px-4 py-3">
        <p className="text-ui text-muted">
          {chat.participant.role === "coach" ? "Coach" : "Client"}
        </p>
        <h1 className="font-display text-heading text-foreground">
          {chat.participant.displayName}
        </h1>
      </header>

      <div
        role="log"
        aria-label="Conversation messages"
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full items-center justify-center text-center text-copy text-body">
            No messages yet.
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((message) => {
              const mine = message.senderId === chat.currentUserId;
              return (
                <li
                  key={message.clientRequestId}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div className={cn("max-w-message space-y-1", mine && "items-end")}>
                    <div
                      className={cn(
                        "rounded-card px-4 py-2.5 text-copy break-words",
                        mine
                          ? "rounded-br-control bg-primary text-on-primary"
                          : "rounded-bl-control border border-border bg-surface text-body"
                      )}
                    >
                      {message.body}
                    </div>
                    <div
                      className={cn(
                        "flex min-h-5 items-center gap-2 text-ui-xs text-muted",
                        mine ? "justify-end" : "justify-start"
                      )}
                    >
                      {mine && message.localStatus === "sending" && <span>Sending</span>}
                      {mine && message.localStatus === "sent" && <span>Sent</span>}
                      {mine && message.localStatus === "failed" && (
                        <>
                          <span>Not sent yet</span>
                          <button
                            type="button"
                            className="rounded-control px-2 py-1 text-body underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            onClick={() =>
                              void sendWithRequestId(
                                message.body,
                                message.clientRequestId
                              )
                            }
                          >
                            Retry
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {notice && (
        <div className="border-t border-border px-4 pt-3">
          <Alert tone="notice">{notice}</Alert>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border bg-surface p-3">
        <textarea
          aria-label="Message"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setNotice(null);
          }}
          rows={1}
          className="min-h-control flex-1 resize-none rounded-control border border-border bg-surface px-4 py-3.5 text-copy text-foreground placeholder:text-muted focus:border-primary"
          placeholder="Message"
        />
        <Button
          type="button"
          fullWidth={false}
          disabled={!canSend}
          loading={Boolean(sendingRequestId)}
          onClick={() => void handleSend()}
          className="shrink-0 px-4"
          aria-label="Send message"
        >
          <IconSend size={20} stroke={1.75} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
