import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Missing local Supabase environment for booking verification.");
}

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error: liveCallCleanupError } = await admin.from("calls")
  .delete()
  .in("status", ["ringing", "connecting", "active"]);
if (liveCallCleanupError) throw liveCallCleanupError;
const { data: slots, error: slotError } = await admin
  .from("lesson_slots")
  .select("id")
  .order("starts_at")
  .limit(2);
if (slotError) throw slotError;
assert(slots && slots.length === 2, "Expected at least two seeded lesson slots.");

const [clientOne, clientTwo, unassigned, coach] = await Promise.all([
  signedIn("client1@fish.dev", "fish-client-dev"),
  signedIn("client2@fish.dev", "fish-client-dev"),
  signedIn("member1@fish.dev", "fish-client-dev"),
  signedIn("coach@fish.dev", "fish-coach-dev"),
]);

const slotId = slots[0]!.id;
const [first, second] = await Promise.all([
  clientOne.rpc("book_lesson_slot", { p_slot_id: slotId }),
  clientTwo.rpc("book_lesson_slot", { p_slot_id: slotId }),
]);
const winners = [first, second].filter((result) => !result.error);
const losers = [first, second].filter((result) => result.error);
assert(winners.length === 1 && losers.length === 1, "Concurrent booking must have exactly one winner.");

const winner = first.error ? clientTwo : clientOne;
const loser = first.error ? clientOne : clientTwo;
const retry = await winner.rpc("book_lesson_slot", { p_slot_id: slotId });
assert(!retry.error, "Retrying the winning booking should be idempotent.");

const secondBooking = await winner.rpc("book_lesson_slot", { p_slot_id: slots[1]!.id });
assert(Boolean(secondBooking.error), "A client with an upcoming lesson must not book another.");

const { data: winnerRows, error: winnerReadError } = await winner
  .from("lesson_slots")
  .select("id, booked_by_client_id")
  .eq("id", slotId);
if (winnerReadError) throw winnerReadError;
assert(winnerRows?.length === 1 && winnerRows[0]?.booked_by_client_id, "Winner must read their booking.");

const { data: loserRows, error: loserReadError } = await loser
  .from("lesson_slots")
  .select("id")
  .eq("id", slotId);
if (loserReadError) throw loserReadError;
assert(loserRows?.length === 0, "Other clients must not read a booked slot.");

const { data: unassignedRows, error: unassignedError } = await unassigned
  .from("lesson_slots")
  .select("id");
if (unassignedError) throw unassignedError;
assert(unassignedRows?.length === 0, "Unassigned clients must not read coach availability.");

const { data: coachRows, error: coachError } = await coach
  .from("lesson_slots")
  .select("id")
  .eq("id", slotId);
if (coachError) throw coachError;
assert(coachRows?.length === 1, "A coach must read their own lesson slots.");

const clientMediaCheck = await winner.rpc("authorize_lesson_media_check", {
  p_lesson_slot_id: slotId,
});
assert(!clientMediaCheck.error, "The booked client must authorize a private media check.");
const coachMediaCheck = await coach.rpc("authorize_lesson_media_check", {
  p_lesson_slot_id: slotId,
});
assert(!coachMediaCheck.error, "The booked coach must authorize a private media check.");
const unrelatedMediaCheck = await loser.rpc("authorize_lesson_media_check", {
  p_lesson_slot_id: slotId,
});
assert(
  Boolean(unrelatedMediaCheck.error),
  "A client who did not book the lesson must not authorize a media check.",
);

const tooEarly = await winner.rpc("initiate_lesson_call", {
  p_lesson_slot_id: slotId,
  p_client_request_id: crypto.randomUUID(),
});
assert(Boolean(tooEarly.error), "A scheduled lesson call must stay closed before its join window.");

const startsAt = new Date(Date.now() + 5 * 60_000);
const endsAt = new Date(startsAt.getTime() + 50 * 60_000);
const { data: bookedSlot, error: bookedSlotError } = await admin
  .from("lesson_slots")
  .select("coach_id")
  .eq("id", slotId)
  .single();
if (bookedSlotError || !bookedSlot) {
  throw bookedSlotError ?? new Error("The verification booking was not found.");
}
await admin.from("lesson_slots").delete()
  .eq("coach_id", bookedSlot.coach_id)
  .neq("id", slotId)
  .lt("starts_at", endsAt.toISOString())
  .gt("ends_at", startsAt.toISOString());
const { error: openWindowError } = await admin.from("lesson_slots").update({
  starts_at: startsAt.toISOString(),
  ends_at: endsAt.toISOString(),
}).eq("id", slotId);
if (openWindowError) throw openWindowError;

const lessonRequestId = crypto.randomUUID();
const firstLessonCall = await winner.rpc("initiate_lesson_call", {
  p_lesson_slot_id: slotId,
  p_client_request_id: lessonRequestId,
});
const retriedLessonCall = await winner.rpc("initiate_lesson_call", {
  p_lesson_slot_id: slotId,
  p_client_request_id: lessonRequestId,
});
assert(
  !firstLessonCall.error &&
    firstLessonCall.data?.lesson_slot_id === slotId &&
    firstLessonCall.data.kind === "video" &&
    firstLessonCall.data.status === "ringing",
  `The booking must authorize one video lesson call: ${firstLessonCall.error?.message ?? "unknown"}`,
);
assert(
  !retriedLessonCall.error && retriedLessonCall.data?.id === firstLessonCall.data?.id,
  "Retrying a lesson call request must return the canonical call.",
);

const unrelatedLessonCall = await unassigned.rpc("initiate_lesson_call", {
  p_lesson_slot_id: slotId,
  p_client_request_id: crypto.randomUUID(),
});
assert(Boolean(unrelatedLessonCall.error), "An unrelated user must not join a booked lesson.");
const otherClientLessonCall = await loser.rpc("initiate_lesson_call", {
  p_lesson_slot_id: slotId,
  p_client_request_id: crypto.randomUUID(),
});
assert(
  Boolean(otherClientLessonCall.error),
  "A client who did not book the lesson must not join it.",
);

const { error: finishCallError } = await winner.rpc("cancel_call", {
  p_call_id: firstLessonCall.data.id,
});
if (finishCallError) throw finishCallError;

const coachLessonCall = await coach.rpc("initiate_lesson_call", {
  p_lesson_slot_id: slotId,
  p_client_request_id: crypto.randomUUID(),
});
assert(
  !coachLessonCall.error &&
    coachLessonCall.data?.lesson_slot_id === slotId &&
    coachLessonCall.data.initiated_by === bookedSlot.coach_id,
  "The booked coach must be able to start the lesson during its join window.",
);
const { error: finishCoachCallError } = await coach.rpc("cancel_call", {
  p_call_id: coachLessonCall.data.id,
});
if (finishCoachCallError) throw finishCoachCallError;

for (let attempt = 1; attempt < 10; attempt += 1) {
  const allowedCheck = await coach.rpc("authorize_lesson_media_check", {
    p_lesson_slot_id: slotId,
  });
  assert(!allowedCheck.error, `Media check ${attempt + 1} should remain within the limit.`);
}
const rateLimitedCheck = await coach.rpc("authorize_lesson_media_check", {
  p_lesson_slot_id: slotId,
});
assert(Boolean(rateLimitedCheck.error), "The eleventh media check in five minutes must be denied.");

const endedAt = new Date(Date.now() - 60_000);
const endedStartsAt = new Date(endedAt.getTime() - 50 * 60_000);
const { error: endWindowError } = await admin.from("lesson_slots").update({
  starts_at: endedStartsAt.toISOString(),
  ends_at: endedAt.toISOString(),
}).eq("id", slotId);
if (endWindowError) throw endWindowError;
const endedLessonCall = await winner.rpc("initiate_lesson_call", {
  p_lesson_slot_id: slotId,
  p_client_request_id: crypto.randomUUID(),
});
assert(Boolean(endedLessonCall.error), "An ended booking must not authorize another call.");
const endedMediaCheck = await winner.rpc("authorize_lesson_media_check", {
  p_lesson_slot_id: slotId,
});
assert(Boolean(endedMediaCheck.error), "An ended booking must not authorize another media check.");

console.log("Booking verification passed: RLS, concurrency, idempotency, setup timing, and booking-authorized calls.");
