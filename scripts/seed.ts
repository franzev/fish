// Idempotent local dev seed (D-10, D-11): creates one coach + ~3 pre-verified clients
// through the real Supabase Auth admin API, never a raw SQL insert against the managed
// auth schema, so the DB-01 handle_new_user trigger fires exactly as it does for a real
// signup. Fixed, documented dev credentials — local only, never run against production
// (see docs/deploy-checklist.md).
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run `supabase start`, then copy apps/web/.env.example to apps/web/.env.local and fill it from `supabase status`.",
  );
  process.exit(1);
}

// Service-role client: bypasses RLS, admin-only. Never expose this key to the browser.
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Fixed, documented dev credentials (D-10). Local only.
const coach = {
  email: "coach@fish.dev",
  password: "fish-coach-dev",
  displayName: "Coach Dana",
};

// A second coach, promoted but never assigned any clients (04-01 Task 1) — the
// negative verify:rls fixtures need a genuine unassigned-coach relationship;
// without this account there is no real "unassigned coach" case to test against.
const coach2 = {
  email: "coach2@fish.dev",
  password: "fish-coach-dev",
  displayName: "Coach Jordan",
};

const clients = [
  { email: "client1@fish.dev", password: "fish-client-dev", displayName: "Alex Rivera", level: "A2" },
  { email: "client2@fish.dev", password: "fish-client-dev", displayName: "Sam Okafor", level: "B1" },
  { email: "client3@fish.dev", password: "fish-client-dev", displayName: "Priya Nair", level: "A2" },
];

const demoCommunityConversationId = "11111111-1111-4111-8111-111111111111";

/** Pages through admin.listUsers() until it finds the given email — never assumes page 1. */
async function findUserIdByEmail(email: string): Promise<string | null> {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found.id;
    if (data.users.length === 0) return null;
    page += 1;
  }
}

/** Creates a pre-verified user via the real auth API, or returns the existing id (idempotent). */
async function upsertUser(email: string, password: string, displayName: string): Promise<string> {
  const existingId = await findUserIdByEmail(email);
  if (existingId) {
    console.log(`Already exists: ${email}`);
    return existingId;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pre-verified — seed accounts need no email round-trip
    user_metadata: { display_name: displayName },
  });

  if (!error) {
    console.log(`Created ${email}`);
    return data.user.id;
  }

  if (error.message.includes("already been registered")) {
    const raceExistingId = await findUserIdByEmail(email);
    if (!raceExistingId) {
      throw new Error(`${email} reported as already registered but could not be found via listUsers()`);
    }
    console.log(`Already exists: ${email}`);
    return raceExistingId;
  }

  throw error;
}

/** Promotes a profile to coach via service-role update (bypasses the escalation guard by design). */
async function promoteToCoach(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role: "coach" }).eq("id", userId);
  if (error) throw error;
}

/** Assigns a client to the coach — idempotent replace (D-12: reassignment replaces). */
async function assignClient(coachId: string, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("coach_clients")
    .upsert({ coach_id: coachId, client_id: clientId }, { onConflict: "client_id" });
  if (error) throw error;
}

/**
 * Backfills/sets the seeded `level` on a client's client_profiles row (04-01 Task 1).
 * The 0007 auto-provision trigger already inserts the row on signup with `level`
 * left null; this upsert sets the seeded level (level is coach-owned reference data — D-10)
 * and also backfills any pre-migration accounts that signed up before 0007 existed.
 * Modeled on assignClient(): idempotent upsert via the service-role client.
 */
async function backfillClientProfile(clientId: string, level: string): Promise<void> {
  const { error } = await supabase
    .from("client_profiles")
    .upsert({ id: clientId, level }, { onConflict: "id" });
  if (error) throw error;
}


async function seedChatConversations(
  coachId: string,
  coach2Id: string,
  clientIds: string[]
): Promise<void> {
  const { data: assignments, error: assignmentError } = await supabase
    .from("coach_clients")
    .select("coach_id, client_id");
  if (assignmentError) throw assignmentError;

  for (const assignment of assignments ?? []) {
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .upsert(
        {
          client_id: assignment.client_id,
          coach_id: assignment.coach_id,
        },
        { onConflict: "client_id,coach_id" },
      )
      .select("id, client_id, coach_id")
      .single();
    if (conversationError || !conversation) throw conversationError;

    const { error: readStateError } = await supabase
      .from("message_reads")
      .upsert(
        [
          {
            conversation_id: conversation.id,
            user_id: conversation.client_id,
            last_read_message_id: null,
          },
          {
            conversation_id: conversation.id,
            user_id: conversation.coach_id,
            last_read_message_id: null,
          },
        ],
        { onConflict: "conversation_id,user_id" },
      );
    if (readStateError) throw readStateError;
  }

  const demoClientId = clientIds[0];
  if (!demoClientId) {
    return;
  }

  const { data: demoConversation, error: demoConversationError } =
    await supabase
      .from("conversations")
      .upsert(
        {
          id: demoCommunityConversationId,
          client_id: demoClientId,
          coach_id: coach2Id,
        },
        { onConflict: "id" },
      )
      .select("id")
      .single();
  if (demoConversationError || !demoConversation) {
    throw demoConversationError;
  }

  const demoReadRows = [coachId, coach2Id, ...clientIds].map((userId) => ({
    conversation_id: demoConversation.id,
    user_id: userId,
    last_read_message_id: null,
  }));

  const { error: demoReadStateError } = await supabase
    .from("message_reads")
    .upsert(demoReadRows, { onConflict: "conversation_id,user_id" });
  if (demoReadStateError) throw demoReadStateError;
}

async function main(): Promise<void> {
  const coachId = await upsertUser(coach.email, coach.password, coach.displayName);

  // ORDER MATTERS: promote the coach BEFORE any coach_clients insert — the
  // enforce_coach_client_roles trigger (0003) rejects assignment until the coach's
  // profile.role is already 'coach'.
  await promoteToCoach(coachId);

  // 04-01 Task 1: promote coach2 as well, but never call assignClient() for it —
  // an unassigned coach fixture for checkUnassignedCoachDenied(). Every coach is
  // promoted before any assignment (same ORDER MATTERS discipline as above).
  const coach2Id = await upsertUser(coach2.email, coach2.password, coach2.displayName);
  await promoteToCoach(coach2Id);

  const clientIds: string[] = [];
  for (const client of clients) {
    const clientId = await upsertUser(client.email, client.password, client.displayName);
    clientIds.push(clientId);
    await assignClient(coachId, clientId);
    await backfillClientProfile(clientId, client.level);
  }

  await seedChatConversations(coachId, coach2Id, clientIds);

  console.log("\nSeed complete. Dev credentials (local only):");
  console.log(`  Coach: ${coach.email} / ${coach.password}`);
  console.log(`  Coach (unassigned): ${coach2.email} / ${coach2.password}`);
  for (const client of clients) {
    console.log(`  Client: ${client.email} / ${client.password}`);
  }
  console.log(`\nCoach id: ${coachId}`);
  console.log(`Coach2 id (unassigned): ${coach2Id}`);
  console.log(`Client ids: ${clientIds.join(", ")}`);
  console.log(`Demo community conversation id: ${demoCommunityConversationId}`);
}

await main();
