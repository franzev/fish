import type {
  Attachment,
  ChatMessageView,
  ChatParticipantView,
  Reaction,
} from "./types";

export const coach: ChatParticipantView = {
  id: "coach-maya",
  name: "Maya Santos",
  online: true,
};

export const client: ChatParticipantView = {
  id: "client-eli",
  name: "Eli Ramos",
  online: false,
};

export const reactions: Reaction[] = [
  { emoji: "👍", count: 2, byMe: true },
  { emoji: "💬", count: 1, byMe: false },
];

export const attachments: Attachment[] = [
  {
    kind: "image",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='white'/%3E%3Crect x='80' y='72' width='480' height='216' rx='24' fill='black'/%3E%3Ctext x='320' y='190' text-anchor='middle' font-family='Arial' font-size='28' fill='white'%3EPractice card%3C/text%3E%3C/svg%3E",
    name: "practice-card.png",
  },
  {
    kind: "video",
    url: "/practice-check.mp4",
    name: "practice-check.mp4",
    duration: "1:24",
  },
  {
    kind: "file",
    url: "/sentence-notes.pdf",
    name: "sentence-notes.pdf",
    size: "240 KB",
    mime: "application/pdf",
  },
  {
    kind: "audio",
    url: "/voice-note.m4a",
    name: "voice-note.m4a",
    duration: "0:18",
  },
];

export const linkPreview = {
  url: "https://example.com/practice-video",
  title: "Two-minute pronunciation practice for work conversations",
  source: "example.com",
  thumbnailUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='black'/%3E%3Ccircle cx='320' cy='180' r='48' fill='white'/%3E%3C/svg%3E",
};

export const messages: ChatMessageView[] = [
  {
    id: "m1",
    author: coach,
    body: "Start with the sentence we practiced yesterday.",
    sentAt: "2026-07-04T06:05:00.000Z",
    mine: false,
  },
  {
    id: "m2",
    author: client,
    body: "I can present the update in the meeting.",
    sentAt: "2026-07-04T06:07:00.000Z",
    mine: true,
    status: "read",
    reactions,
  },
  {
    id: "m3",
    author: coach,
    body: "Nice. Try it once more, a little slower on 'present'.",
    sentAt: "2026-07-04T06:09:00.000Z",
    mine: false,
    replyTo: {
      id: "m2",
      authorName: "Eli Ramos",
      snippet: "I can present the update in the meeting.",
    },
  },
  {
    id: "m4",
    author: client,
    body: "Here is my second recording.",
    sentAt: "2026-07-04T06:12:00.000Z",
    mine: true,
    status: "delivered",
    attachments: [attachments[3]],
  },
];

export const conversations = [
  {
    id: "c1",
    participant: coach,
    lastMessage: "Try it once more, a little slower.",
    lastMessageAt: "10:12 AM",
    unreadCount: 2,
  },
  {
    id: "c2",
    participant: {
      id: "coach-lee",
      name: "Jordan Lee",
      online: true,
    },
    lastMessage: "Your check-in is ready.",
    lastMessageAt: "Yesterday",
  },
  {
    id: "c3",
    participant: {
      id: "coach-ana",
      name: "Ana Cruz",
      online: false,
    },
    lastMessage: "We will use the same script next time.",
    lastMessageAt: "Mon",
    unreadCount: 104,
  },
];
