/** Minimal shape needed to decide whether two adjacent messages present as
 *  one continuous visual block (shared avatar/author meta) or start a fresh
 *  one. Structurally compatible with `ClientChatMessage` — callers pass the
 *  real message type directly. */
export interface GroupableMessage {
  senderId: string;
  createdAt: string;
}

/** A same-sender run only stays visually grouped for this long. Past the
 *  gap — or across a calendar-day boundary — identity (avatar) and time
 *  (MessageMeta) reappear, so a long same-sender run never hides who is
 *  speaking or when. Closes WR-02: grouping used to compare senderId alone
 *  and could suppress avatar/time indefinitely. */
export const MESSAGE_GROUP_GAP_MS = 5 * 60 * 1000;

/** True only when `current` continues the same visual block as `previous`:
 *  same sender, same calendar day, and within the short grouping gap above.
 *  Pure and order-sensitive — `previous` must genuinely precede `current`. */
export function belongsToSameMessageGroup(
  previous: GroupableMessage | null | undefined,
  current: GroupableMessage
): boolean {
  if (!previous || previous.senderId !== current.senderId) {
    return false;
  }

  const previousDay = new Date(previous.createdAt).toDateString();
  const currentDay = new Date(current.createdAt).toDateString();
  if (previousDay !== currentDay) {
    return false;
  }

  const elapsedMs = Date.parse(current.createdAt) - Date.parse(previous.createdAt);
  return elapsedMs >= 0 && elapsedMs <= MESSAGE_GROUP_GAP_MS;
}
