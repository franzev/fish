import { KitThemeToggle } from "@/components/kit/theme-toggle";
import {
  Attachments,
  Avatar,
  Bubble,
  ChatContainer,
  ChatHeader,
  ChatInput,
  ConversationList,
  EmptyState,
  LinkPreview,
  Message,
  MessageActions,
  MessageStatus,
  NotificationBadge,
  PresenceIndicator,
  QuotedMessage,
  Reactions,
  Skeleton,
  TypingIndicator,
  UnreadDivider,
  VoicePlayer,
} from "@/components/chat";
import { coach, conversations, mockMessages } from "./mock-data";

/* The chat kit's design-system contract page (mirrors /kit's pattern). One
   long calm scroll, no client-facing nav link, KitThemeToggle at the top as
   the only client island at the page level — ConversationList and other
   stateful leaves are their own client islands further down. */
export default function ChatKitPage() {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-12">
      <header className="mb-10">
        <p className="mb-2 text-[14px] uppercase tracking-widest text-muted">FISH</p>
        <h1 className="text-4xl">Chat kit</h1>
        <p className="mt-3 text-body">
          Every chat component and state, rendered with mock data. Dev-only —
          unlinked from client-facing navigation.
        </p>
        <div className="mt-6">
          <KitThemeToggle />
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Primitives</h2>
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Avatar — image / initials / placeholder</p>
            <div className="flex items-center gap-3">
              <Avatar name="Priya Nandan" src="https://placehold.co/64x64" size="lg" />
              <Avatar name="Jordan Blake" size="lg" />
              <Avatar size="lg" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Presence</p>
            <div className="flex items-center gap-4">
              <PresenceIndicator online />
              <PresenceIndicator online={false} />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Message status — sending / sent / delivered / read</p>
            <div className="flex items-center gap-4">
              <MessageStatus status="sending" />
              <MessageStatus status="sent" />
              <MessageStatus status="delivered" />
              <MessageStatus status="read" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Typing indicator</p>
            <TypingIndicator />
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Reactions</p>
            <Reactions
              reactions={[
                { emoji: "👍", count: 3, byMe: true },
                { emoji: "🎉", count: 1, byMe: false },
              ]}
            />
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Quoted message</p>
            <QuotedMessage
              authorName="Jordan Blake"
              snippet="Here's the recording you asked for from this morning's practice session."
            />
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Message actions</p>
            <MessageActions />
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Notification badge — count / capped / hidden at 0</p>
            <div className="flex items-center gap-4">
              <NotificationBadge count={3} />
              <NotificationBadge count={128} />
              <NotificationBadge count={0} />
              <span className="text-[13px] text-muted">(nothing renders above for 0)</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Bubbles &amp; messages</h2>
        <div className="space-y-3">
          <Bubble mine={false}>Hey! Ready to go over your homework?</Bubble>
          <Bubble mine>Yes, I finished it this morning.</Bubble>
          <Message message={mockMessages[4]} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Media &amp; attachments</h2>
        <div className="space-y-4">
          <Attachments
            attachments={[
              { kind: "image", url: "https://placehold.co/480x320", name: "session photo" },
              { kind: "file", url: "#", name: "practice-notes.pdf", size: "212 KB" },
              { kind: "audio", url: "#", name: "pronunciation-example.mp3", duration: "0:18" },
              { kind: "video", url: "#", name: "topic-overview.mp4", duration: "2:04" },
            ]}
          />
          <VoicePlayer />
          <LinkPreview
            url="https://www.youtube.com/watch?v=example"
            title="How to practice pronunciation at home"
            source="youtube.com"
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Input &amp; header</h2>
        <div className="space-y-4 overflow-hidden rounded-card border border-border">
          <ChatHeader participant={coach} />
          <ChatInput />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Full container</h2>
        <div className="h-[520px] overflow-hidden rounded-card border border-border">
          <ChatContainer participant={coach} messages={mockMessages} firstUnreadId="m6" />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Sidebar list</h2>
        <div className="max-w-[360px] rounded-card border border-border p-3">
          <ConversationList conversations={conversations} activeConversationId="c1" />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">States</h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-[14px] text-muted">Empty</p>
            <div className="flex h-48 flex-col rounded-card border border-border">
              <EmptyState />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[14px] text-muted">Skeleton (loading)</p>
            <div className="rounded-card border border-border">
              <Skeleton />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[14px] text-muted">Typing</p>
            <TypingIndicator />
          </div>
          <div className="space-y-2">
            <p className="text-[14px] text-muted">Unread divider</p>
            <UnreadDivider />
          </div>
        </div>
      </section>

      <p className="text-center text-[13px] text-muted">
        Hierarchy before color. If it works in monochrome, it works.
      </p>
    </main>
  );
}
