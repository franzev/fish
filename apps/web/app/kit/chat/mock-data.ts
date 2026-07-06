import type { ConversationSummary } from "@/components/chat/conversation-list";
import type { ChatMessageView, ChatParticipantView } from "@/components/chat/types";

/** Static mock data for the /kit/chat showcase. No fetching, no Supabase —
 *  this plan is presentational UI only. */

export const coach: ChatParticipantView = {
  id: "coach-1",
  name: "Priya Nandan",
  online: true,
};

export const client: ChatParticipantView = {
  id: "client-1",
  name: "Jordan Blake",
  online: false,
};

export const mockMessages: ChatMessageView[] = [
  {
    id: "m1",
    author: coach,
    body: "Hey Jordan! Ready to go over your homework from last week?",
    sentAt: new Date("2026-07-01T09:00:00Z"),
    mine: false,
  },
  {
    id: "m2",
    author: client,
    body: "Yes, I finished it this morning.",
    sentAt: new Date("2026-07-01T09:01:00Z"),
    mine: true,
    status: "sending",
  },
  {
    id: "m3",
    author: client,
    body: "Here's the recording you asked for.",
    sentAt: new Date("2026-07-01T09:02:00Z"),
    mine: true,
    status: "sent",
  },
  {
    id: "m4",
    author: client,
    body: "And the notes I took.",
    sentAt: new Date("2026-07-01T09:02:30Z"),
    mine: true,
    status: "delivered",
    attachments: [
      { kind: "file", url: "#", name: "practice-notes.pdf", size: "212 KB" },
    ],
  },
  {
    id: "m5",
    author: coach,
    body: "Great work! I especially liked this line.",
    sentAt: new Date("2026-07-01T09:05:00Z"),
    mine: false,
    replyTo: {
      id: "m3",
      authorName: "Jordan Blake",
      snippet: "Here's the recording you asked for.",
    },
    reactions: [{ emoji: "👍", count: 1, byMe: false }],
  },
  {
    id: "m6",
    author: client,
    body: "Thank you! Here's a photo from the session too.",
    sentAt: new Date("2026-07-01T09:06:00Z"),
    mine: true,
    status: "read",
    attachments: [
      { kind: "image", url: "https://placehold.co/480x320", name: "session photo" },
    ],
    reactions: [{ emoji: "🎉", count: 2, byMe: true }],
  },
  {
    id: "m7",
    author: coach,
    body: "Take a listen to this pronunciation example.",
    sentAt: new Date("2026-07-01T09:08:00Z"),
    mine: false,
    attachments: [
      { kind: "audio", url: "#", name: "pronunciation-example.mp3", duration: "0:18" },
    ],
  },
  {
    id: "m8",
    author: coach,
    body: "And a quick clip covering the same topic.",
    sentAt: new Date("2026-07-01T09:09:00Z"),
    mine: false,
    attachments: [
      {
        kind: "video",
        url: "#",
        name: "topic-overview.mp4",
        duration: "2:04",
      },
    ],
  },
  {
    id: "m9",
    author: coach,
    body: "This video helped me a lot when I was learning to teach this.",
    sentAt: new Date("2026-07-01T09:10:00Z"),
    mine: false,
  },
];

export const conversations: ConversationSummary[] = [
  {
    id: "c1",
    participant: coach,
    lastMessage: "This video helped me a lot when I was learning to teach this.",
    lastMessageAt: "9:10 AM",
    unreadCount: 2,
  },
  {
    id: "c2",
    participant: { id: "coach-2", name: "Sam Okafor", online: false },
    lastMessage: "See you next week!",
    lastMessageAt: "Yesterday",
  },
  {
    id: "c3",
    participant: { id: "coach-3", name: "Ana Torres", online: true },
    lastMessage: "Let's review your notes together.",
    lastMessageAt: "Mon",
    unreadCount: 128,
  },
];
