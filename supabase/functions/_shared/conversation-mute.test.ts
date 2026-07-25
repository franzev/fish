import assert from "node:assert/strict";
import test from "node:test";
import {
  QUIET_DURATIONS_SECONDS,
  unmutedRecipients,
  type ConversationMuteRow,
} from "./conversation-mute.ts";

const now = new Date("2026-07-25T12:00:00.000Z");
const client = "11111111-1111-4111-8111-111111111111";
const coach = "22222222-2222-4222-8222-222222222222";

function mute(userId: string, mutedUntil: string | null): ConversationMuteRow {
  return { user_id: userId, muted_until: mutedUntil };
}

test("keeps every recipient when nobody is quiet", () => {
  assert.deepEqual(unmutedRecipients([client, coach], [], now), [client, coach]);
});

test("drops a recipient whose quiet period is still running", () => {
  const mutes = [mute(client, "2026-07-25T13:00:00.000Z")];
  assert.deepEqual(unmutedRecipients([client, coach], mutes, now), [coach]);
});

test("drops a recipient who is quiet until they turn it back on", () => {
  const mutes = [mute(client, null)];
  assert.deepEqual(unmutedRecipients([client, coach], mutes, now), [coach]);
});

test("keeps a recipient whose quiet period has expired", () => {
  const mutes = [mute(client, "2026-07-25T11:59:59.000Z")];
  assert.deepEqual(unmutedRecipients([client, coach], mutes, now), [client, coach]);
});

test("treats the exact expiry instant as expired", () => {
  const mutes = [mute(client, now.toISOString())];
  assert.deepEqual(unmutedRecipients([client, coach], mutes, now), [client, coach]);
});

test("ignores rows for people who are not recipients", () => {
  const mutes = [mute("someone-else", null)];
  assert.deepEqual(unmutedRecipients([client, coach], mutes, now), [client, coach]);
});

test("returns nothing when every recipient is quiet", () => {
  const mutes = [mute(client, null), mute(coach, "2026-07-25T18:00:00.000Z")];
  assert.deepEqual(unmutedRecipients([client, coach], mutes, now), []);
});

test("still notifies when a stored timestamp cannot be read", () => {
  const mutes = [mute(client, "not-a-timestamp")];
  assert.deepEqual(unmutedRecipients([client, coach], mutes, now), [client, coach]);
});

test("offers exactly the three fixed quiet periods", () => {
  assert.deepEqual([...QUIET_DURATIONS_SECONDS], [3600, 28800, 86400]);
});
