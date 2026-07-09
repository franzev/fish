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

/* ---- Long/formatted/edge-case seeds (260709-p06) ----
   Exercises the MessageBody renderer across every supported feature plus a
   few edge cases, and gives the kit three distinctly-sized conversations
   (short / long / super-long) so wrapping, scroll, and formatting legibility
   can be compared side by side on both bubble variants. Bodies stay plain
   strings — MessageBody does the parsing. */

export const shortMessages: ChatMessageView[] = [
  {
    id: "sm1",
    author: coach,
    body: "Quick check — how did today's practice go?",
    sentAt: new Date("2026-07-08T09:00:00Z"),
    mine: false,
  },
  {
    id: "sm2",
    author: client,
    body: "Good! Just two sentences today.",
    sentAt: new Date("2026-07-08T09:01:00Z"),
    mine: true,
    status: "read",
  },
];

export const longMessages: ChatMessageView[] = [
  {
    id: "lm1",
    author: coach,
    body:
      "Before we start today, I want to walk through why we keep coming back to word stress: in English, moving the stress to a different syllable can change the whole meaning of a sentence, and listeners often rely on it more than the individual sounds to follow what you're saying, so a few extra minutes of slow, deliberate practice here pays off a lot more than it feels like it should in the moment.",
    sentAt: new Date("2026-07-08T09:05:00Z"),
    mine: false,
  },
  {
    id: "lm2",
    author: coach,
    body: 'Remember: **stress the second syllable** in "photograph".',
    sentAt: new Date("2026-07-08T09:06:00Z"),
    mine: false,
  },
  {
    id: "lm3",
    author: client,
    body: "Got it — should it sound *slightly* softer, or _gentler_ overall?",
    sentAt: new Date("2026-07-08T09:07:00Z"),
    mine: true,
    status: "read",
  },
  {
    id: "lm4",
    author: coach,
    body: "Try saying it like this: `fə-TOG-rə-fee`.",
    sentAt: new Date("2026-07-08T09:08:00Z"),
    mine: false,
  },
  {
    id: "lm5",
    author: coach,
    body: "Here's the drill script — read it exactly as written:\n```\nShe asked for a photograph of the garden.\nHe took a photograph before the rain started.\n```",
    sentAt: new Date("2026-07-08T09:09:00Z"),
    mine: false,
  },
  {
    id: "lm6",
    author: coach,
    body: "Here's what to focus on this week:\n- Word stress\n- Linking sounds\n- Pace",
    sentAt: new Date("2026-07-08T09:10:00Z"),
    mine: false,
  },
  {
    id: "lm7",
    author: coach,
    body: "Steps for today's drill:\n1. Read the sentence aloud\n2. Record yourself\n3. Compare with the example",
    sentAt: new Date("2026-07-08T09:11:00Z"),
    mine: false,
  },
  {
    id: "lm8",
    author: coach,
    body: "## This week's focus\n\nWe'll work on rhythm and stress, a little each day.",
    sentAt: new Date("2026-07-08T09:12:00Z"),
    mine: false,
  },
  {
    id: "lm9",
    author: coach,
    body: '> "Practice like it\'s real conversation, not a performance."\n\nKeep that in mind next time.',
    sentAt: new Date("2026-07-08T09:13:00Z"),
    mine: false,
  },
  {
    id: "lm10",
    author: coach,
    body: "Here's the recording again: [listen here](https://example.com/audio/session-12)",
    sentAt: new Date("2026-07-08T09:14:00Z"),
    mine: false,
  },
  {
    id: "lm11",
    author: coach,
    body:
      "## Recap\n\nGreat session today! Two things to remember:\n- **Slow down** on multi-syllable words\n- Keep breathing steady\n\nFull notes: [session notes](https://example.com/notes/12)",
    sentAt: new Date("2026-07-08T09:15:00Z"),
    mine: false,
  },
  {
    id: "lm12",
    author: coach,
    body:
      "Practice plan:\n- Warm-up\n  - Breathing (1 min)\n  - Humming (1 min)\n- Drill sets\n  1. Set A — slow\n  2. Set B — normal speed\n     1. Repeat twice\n     2. Record last attempt",
    sentAt: new Date("2026-07-08T09:16:00Z"),
    mine: false,
  },
  {
    id: "lm13",
    author: client,
    body:
      "Full report here, sorry it's one long link: https://example.com/very/long/path/that/keeps/going/without/any/spaces/or/breaks/to/test/overflow/handling/1234567890abcdefghijklmnopqrstuvwxyz",
    sentAt: new Date("2026-07-08T09:17:00Z"),
    mine: true,
    status: "delivered",
  },
  {
    id: "lm14",
    author: coach,
    body:
      "Use `pnpm test -- message-body` to check — see **CI status** here: [dashboard](https://example.com/ci).",
    sentAt: new Date("2026-07-08T09:18:00Z"),
    mine: false,
  },
  {
    id: "lm15",
    author: client,
    body: "Got it 👍",
    sentAt: new Date("2026-07-08T09:19:00Z"),
    mine: true,
    status: "sent",
  },
  {
    id: "lm16",
    author: client,
    body:
      "One more thing before I go — I've been trying to fit in a short practice block every morning before work starts, even if it's only five or six minutes, and it's made a noticeable difference in how relaxed I feel reading out loud by the time we get to our sessions, so thank you for pushing me to build that habit instead of only practicing right before we meet.",
    sentAt: new Date("2026-07-08T09:20:00Z"),
    mine: true,
    status: "read",
  },
];

export const superLongMessages: ChatMessageView[] = [
  ...longMessages,
  {
    id: "slm1",
    author: coach,
    body: "Nice work this week. Let's keep going a bit longer today.",
    sentAt: new Date("2026-07-08T09:21:00Z"),
    mine: false,
  },
  {
    id: "slm2",
    author: coach,
    body:
      "Second pass — same drills, but this time try to keep your pace even across the whole sentence instead of speeding up toward the end, which is the most common pattern I hear when someone is reading something they've already seen once and starts to relax a little too early before the sentence actually finishes.",
    sentAt: new Date("2026-07-08T09:22:00Z"),
    mine: false,
  },
  {
    id: "slm3",
    author: client,
    body: "Makes sense.",
    sentAt: new Date("2026-07-08T09:23:00Z"),
    mine: true,
    status: "sent",
  },
  {
    id: "slm4",
    author: coach,
    body: "Extra vocabulary for this round:\n- Rhythm\n- Cadence\n- Intonation\n- Emphasis",
    sentAt: new Date("2026-07-08T09:24:00Z"),
    mine: false,
  },
  {
    id: "slm5",
    author: client,
    body: "Could you send another *slow* example, please?",
    sentAt: new Date("2026-07-08T09:25:00Z"),
    mine: true,
    status: "read",
  },
  {
    id: "slm6",
    author: coach,
    body: "Sure — here's a longer one:\n```\nThe committee reviewed the proposal carefully before the final vote.\n```",
    sentAt: new Date("2026-07-08T09:26:00Z"),
    mine: false,
  },
  {
    id: "slm7",
    author: coach,
    body:
      "### One more note\n\nIf a sentence ever feels too long to say in one breath, that's a signal to find the natural pause point — usually right after the subject, or right before a connecting word like \"because\" or \"so\" — rather than pushing through it and running out of air halfway.",
    sentAt: new Date("2026-07-08T09:27:00Z"),
    mine: false,
  },
  {
    id: "slm8",
    author: client,
    body: "That helps a lot, thank you.",
    sentAt: new Date("2026-07-08T09:28:00Z"),
    mine: true,
    status: "delivered",
  },
  {
    id: "slm9",
    author: coach,
    body: "See you next week — same time works for both of us?",
    sentAt: new Date("2026-07-08T09:29:00Z"),
    mine: false,
  },
  {
    id: "slm10",
    author: client,
    body: "Yes, works for me!",
    sentAt: new Date("2026-07-08T09:30:00Z"),
    mine: true,
    status: "read",
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
  {
    id: "c-short",
    participant: coach,
    lastMessage: "Good! Just two sentences today.",
    lastMessageAt: "9:01 AM",
  },
  {
    id: "c-long",
    participant: coach,
    lastMessage: "Got it 👍",
    lastMessageAt: "9:19 AM",
    unreadCount: 3,
  },
  {
    id: "c-super-long",
    participant: coach,
    lastMessage: "Yes, works for me!",
    lastMessageAt: "9:30 AM",
    unreadCount: 12,
  },
];
