// Per-conversation quiet. Deliberately dependency-free so the rules that
// decide whether someone gets a push can be unit tested without a Deno
// runtime, a Supabase client, or a network.

/**
 * The quiet periods a member may choose. `null` (quiet until turned back on)
 * is expressed by omitting a duration, not by a value here. Mirrored by the
 * allowlist in `set_conversation_mute` so a bad value is rejected at both the
 * command boundary and the database.
 */
export const QUIET_DURATIONS_SECONDS: readonly number[] = [3600, 28800, 86400];

export type ConversationMuteRow = {
  user_id: string;
  muted_until: string | null;
};

export type QuietPartition = {
  /** Gets the full alerting push. */
  notified: string[];
  /** Gets a badge-only push, so the count stays right without a banner. */
  quiet: string[];
};

/**
 * Splits recipients by whether their quiet period for this conversation is
 * still in force. A row with a null `muted_until` stays quiet until the member
 * turns it back on; any other row stops applying once its timestamp passes,
 * which is why expired rows never need sweeping.
 *
 * One pass produces both halves, so the two lists can never disagree about a
 * recipient or drop one between them.
 */
export function partitionByQuiet(
  recipientIds: string[],
  mutes: ConversationMuteRow[],
  now: Date,
): QuietPartition {
  const silenced = new Set(
    mutes
      .filter((mute) => {
        if (mute.muted_until === null) return true;
        const until = new Date(mute.muted_until);
        // An unreadable timestamp notifies rather than silences: a stuck quiet
        // period is worse than one extra alert.
        return !Number.isNaN(until.getTime()) && until > now;
      })
      .map((mute) => mute.user_id),
  );

  const partition: QuietPartition = { notified: [], quiet: [] };
  for (const recipientId of recipientIds) {
    if (silenced.has(recipientId)) {
      partition.quiet.push(recipientId);
    } else {
      partition.notified.push(recipientId);
    }
  }
  return partition;
}
