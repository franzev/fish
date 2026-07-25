import assert from "node:assert/strict";
import test from "node:test";
import {
  QUIET_DURATIONS_SECONDS,
  partitionByQuiet,
  type ConversationMuteRow,
} from "./conversation-mute.ts";

const now = new Date("2026-07-25T12:00:00.000Z");
const client = "11111111-1111-4111-8111-111111111111";
const coach = "22222222-2222-4222-8222-222222222222";

function mute(userId: string, mutedUntil: string | null): ConversationMuteRow {
  return { user_id: userId, muted_until: mutedUntil };
}

test("notifies every recipient when nobody is quiet", () => {
  assert.deepEqual(partitionByQuiet([client, coach], [], now), {
    notified: [client, coach],
    quiet: [],
  });
});

test("moves a recipient whose quiet period is still running to badge-only", () => {
  const mutes = [mute(client, "2026-07-25T13:00:00.000Z")];
  assert.deepEqual(partitionByQuiet([client, coach], mutes, now), {
    notified: [coach],
    quiet: [client],
  });
});

test("moves a recipient who is quiet until they turn it back on to badge-only", () => {
  const mutes = [mute(client, null)];
  assert.deepEqual(partitionByQuiet([client, coach], mutes, now), {
    notified: [coach],
    quiet: [client],
  });
});

test("notifies a recipient whose quiet period has expired", () => {
  const mutes = [mute(client, "2026-07-25T11:59:59.000Z")];
  assert.deepEqual(partitionByQuiet([client, coach], mutes, now), {
    notified: [client, coach],
    quiet: [],
  });
});

test("treats the exact expiry instant as expired", () => {
  const mutes = [mute(client, now.toISOString())];
  assert.deepEqual(partitionByQuiet([client, coach], mutes, now), {
    notified: [client, coach],
    quiet: [],
  });
});

test("ignores rows for people who are not recipients", () => {
  const mutes = [mute("someone-else", null)];
  assert.deepEqual(partitionByQuiet([client, coach], mutes, now), {
    notified: [client, coach],
    quiet: [],
  });
});

test("badges everyone and alerts nobody when the whole conversation is quiet", () => {
  const mutes = [mute(client, null), mute(coach, "2026-07-25T18:00:00.000Z")];
  assert.deepEqual(partitionByQuiet([client, coach], mutes, now), {
    notified: [],
    quiet: [client, coach],
  });
});

test("still alerts when a stored timestamp cannot be read", () => {
  const mutes = [mute(client, "not-a-timestamp")];
  assert.deepEqual(partitionByQuiet([client, coach], mutes, now), {
    notified: [client, coach],
    quiet: [],
  });
});

// The badge count is only right if nobody is dropped between the two halves.
test("accounts for every recipient exactly once", () => {
  const mutes = [mute(client, null)];
  const { notified, quiet } = partitionByQuiet([client, coach], mutes, now);
  assert.deepEqual([...notified, ...quiet].sort(), [client, coach].sort());
});

test("offers exactly the three fixed quiet periods", () => {
  assert.deepEqual([...QUIET_DURATIONS_SECONDS], [3600, 28800, 86400]);
});
