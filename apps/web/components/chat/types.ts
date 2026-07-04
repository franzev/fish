/** Presentational view models for the chat kit. These are NOT Supabase or
 *  @fish/core types — the kit is UI-only in this plan (no data wiring), so
 *  every shape here exists purely for components to render against. A later
 *  data-integration phase maps real Supabase rows onto these shapes. */

/** The four states a sent message can carry, worst-to-best. */
export type MessageStatus = "sending" | "sent" | "delivered" | "read";

/** An emoji reaction pill with an aggregate count. `byMe` marks whether the
 *  current viewer is one of the reactors, for the "you reacted" visual mark. */
export interface Reaction {
  emoji: string;
  count: number;
  byMe: boolean;
}

/** Attachment kinds are a discriminated union on `kind` — each variant only
 *  carries the fields it needs (a video has a poster/duration, a file has a
 *  size, etc). */
export type Attachment =
  | { kind: "image"; url: string; name: string }
  | { kind: "video"; url: string; name: string; poster?: string; duration?: string }
  | { kind: "file"; url: string; name: string; size: string; mime?: string }
  | { kind: "audio"; url: string; name: string; duration?: string };

/** A chat participant as rendered — avatar, name, presence. */
export interface ChatParticipantView {
  id: string;
  name: string;
  avatarUrl?: string;
  online?: boolean;
}

/** A single rendered message row. `mine` decides sent-vs-received alignment;
 *  `status` only applies to messages the viewer sent. */
export interface ChatMessageView {
  id: string;
  author: ChatParticipantView;
  body?: string;
  sentAt: Date | string;
  mine: boolean;
  status?: MessageStatus;
  reactions?: Reaction[];
  attachments?: Attachment[];
  replyTo?: {
    id: string;
    authorName: string;
    snippet: string;
  };
}
