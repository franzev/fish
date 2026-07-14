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

console.log("Booking verification passed: RLS, concurrency, idempotency, and one-upcoming guard.");
