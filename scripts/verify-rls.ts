// Scripted RLS/escalation boundary check (DB-03, DB-04) — review MEDIUM: a service-role
// Studio session silently bypasses RLS and proves nothing about the real boundary. Every
// assertion here logs in with the PUBLISHABLE (anon) key via signInWithPassword(), so RLS
// is genuinely in force for every query. Exits non-zero on any failure — a real gate, not
// advisory.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SERVICE_ROLE_KEY. Run `supabase start`, then copy apps/web/.env.example to apps/web/.env.local and fill it from `supabase status`.",
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Same fixed dev credentials seeded by scripts/seed.ts (D-10). Run `pnpm seed` first.
const coach = { email: "coach@fish.dev", password: "fish-coach-dev" };
const client1 = { email: "client1@fish.dev", password: "fish-client-dev" };
// 04-01 Task 3: the unassigned second coach and client2 negative-path fixtures (D-15).
const coach2Unassigned = { email: "coach2@fish.dev", password: "fish-coach-dev" };
const client2 = { email: "client2@fish.dev", password: "fish-client-dev" };
const demoCommunityConversationId = "11111111-1111-4111-8111-111111111111";
const generalChannelId = "22222222-2222-4222-8222-222222222222";

let failures = 0;

function report(label: string, ok: boolean, detail?: string): void {
  const line = `${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`;
  console.log(line);
  if (!ok) failures += 1;
}

/** Anon-key client per seeded user — this session IS subject to RLS, unlike the admin key. */
async function signInAs(email: string, password: string) {
  const supabase = createClient(supabaseUrl!, publishableKey!, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword(${email}) failed: ${error.message}`);
  return supabase;
}

async function getCommunityProfileIds(
  supabase: Awaited<ReturnType<typeof signInAs>>,
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("list_channel_member_profiles", {
    p_channel_id: generalChannelId,
  });
  if (error) throw error;
  const safeRows = data ?? [];
  report(
    "DB-03 community directory: exposes display-safe fields only",
    safeRows.every((row) =>
      Object.keys(row).every((key) => ["id", "display_name", "username"].includes(key))
    ),
  );
  const { data: conversationRows, error: conversationError } = await supabase.rpc(
    "list_conversation_member_profiles",
    { p_conversation_ids: [demoCommunityConversationId] },
  );
  if (conversationError) throw conversationError;
  report(
    "DB-03 community hydration: bulk projection stays display-safe",
    (conversationRows ?? []).every((row) =>
      Object.keys(row).every((key) =>
        ["conversation_id", "id", "role", "display_name", "username"].includes(key)
      )
    ),
  );
  return new Set(safeRows.map((row) => row.id));
}

/** Any 42P17 (recursion) anywhere is a hard failure regardless of which assertion hit it. */
function checkNoRecursion(label: string, error: { code?: string; message: string } | null): void {
  if (error?.code === "42P17") {
    report(`${label}: no recursion error`, false, `42P17 — ${error.message}`);
  }
}

async function checkClientBoundary(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("DB-03 client boundary: resolve own user id", false, userError?.message);
    return;
  }
  const ownId = userData.user.id;

  // The base profiles table contains email, so only the user and their direct
  // coach may be visible. Community identities come from the safe RPC above.
  const { data: assignment, error: assignmentError } = await supabase
    .from("coach_clients")
    .select("coach_id")
    .eq("client_id", ownId)
    .single();
  if (assignmentError || !assignment) {
    report("DB-03 client boundary: resolve assigned coach id", false, assignmentError?.message);
    return;
  }
  const coachId = assignment.coach_id;

  const { data, error } = await supabase.from("profiles").select("*");
  checkNoRecursion("DB-03 client boundary", error);
  if (error) {
    report("DB-03 client boundary: select succeeds", false, error.message);
    return;
  }
  const rows = data ?? [];
  const communityIds = await getCommunityProfileIds(supabase);
  const allowedIds = new Set([ownId, coachId]);
  const returnedIds = new Set(rows.map((row) => row.id));
  const exactlyAllowed =
    returnedIds.size === allowedIds.size &&
    Array.from(returnedIds).every((id) => allowedIds.has(id));
  report(
    "DB-03 client boundary: base table exposes only direct profiles",
    exactlyAllowed,
    `got ${rows.length} rows; expected ${allowedIds.size}`,
  );
  const leaked = rows.some((row) => !allowedIds.has((row as { id?: string }).id ?? ""));
  report("DB-03 client boundary: no other accounts visible", !leaked, leaked ? "row(s) with a foreign id returned" : undefined);
  report(
    "DB-03 client boundary: community-only emails stay private",
    rows.every((row) => !communityIds.has(row.id) || allowedIds.has(row.id)),
  );
}

async function checkCoachBoundary(): Promise<void> {
  const supabase = await signInAs(coach.email, coach.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("DB-03 coach boundary: resolve own user id", false, userError?.message);
    return;
  }
  const { data, error } = await supabase.from("profiles").select("*");
  checkNoRecursion("DB-03 coach boundary", error);
  if (error) {
    report("DB-03 coach boundary: select succeeds", false, error.message);
    return;
  }
  const rows = data ?? [];
  const { data: assignments, error: assignmentError } = await supabase
    .from("coach_clients")
    .select("client_id")
    .eq("coach_id", userData.user.id);
  if (assignmentError) {
    report("DB-03 coach boundary: resolve assigned client ids", false, assignmentError.message);
    return;
  }
  const communityIds = await getCommunityProfileIds(supabase);
  const allowedIds = new Set([userData.user.id]);
  for (const assignment of assignments ?? []) allowedIds.add(assignment.client_id);
  const returnedIds = new Set(rows.map((row) => row.id));
  const exactlyAllowed =
    returnedIds.size === allowedIds.size &&
    Array.from(returnedIds).every((id) => allowedIds.has(id));
  report(
    "DB-03 coach boundary: base table exposes only assigned profiles",
    exactlyAllowed,
    `got ${rows.length} rows; expected ${allowedIds.size}`,
  );
  report(
    "DB-03 coach boundary: no profile outside the allowed set",
    rows.every((row) => allowedIds.has(row.id)),
  );
  report(
    "DB-03 coach boundary: community-only emails stay private",
    rows.every((row) => !communityIds.has(row.id) || allowedIds.has(row.id)),
  );
}

async function checkEscalationRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("DB-04 escalation: resolve own user id", false, userError?.message);
    return;
  }
  const ownId = userData.user.id;

  const { error: escalationError } = await supabase.from("profiles").update({ role: "coach" }).eq("id", ownId);
  checkNoRecursion("DB-04 escalation attempt", escalationError);
  report("DB-04 escalation: self-promotion to coach is rejected", !!escalationError, escalationError ? escalationError.message : "update succeeded (should have failed)");

  const { error: safeUpdateError } = await supabase
    .from("profiles")
    .update({ display_name: "Franz Eva" })
    .eq("id", ownId);
  checkNoRecursion("DB-04 safe-field update", safeUpdateError);
  report("DB-04 safe-field update (display_name) succeeds", !safeUpdateError, safeUpdateError?.message);
}

async function checkClientReadsCoachName(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("D-16 client reads coach name: resolve own user id", false, userError?.message);
    return;
  }
  const ownId = userData.user.id;

  // Resolve the assigned coach id the way a client legitimately can — the
  // 0003 "client reads own coach assignment" policy permits this read.
  const { data: assignment, error: assignmentError } = await supabase
    .from("coach_clients")
    .select("coach_id")
    .eq("client_id", ownId)
    .single();
  checkNoRecursion("D-16 client reads coach name: resolve coach id", assignmentError);
  if (assignmentError || !assignment) {
    report("D-16 client reads coach name: resolve assigned coach id", false, assignmentError?.message);
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", assignment.coach_id);
  checkNoRecursion("D-16 client reads coach name", error);
  if (error) {
    report("D-16 client reads coach name: select succeeds", false, error.message);
    return;
  }
  const rows = data ?? [];
  // The count-of-1 IS the scoping proof: the is_client_of policy does not
  // leak any other coach's row alongside the assigned one.
  const exactlyOne = rows.length === 1;
  report(
    "D-16 client reads coach name: returns exactly the assigned coach's row",
    exactlyOne,
    `got ${rows.length} rows`,
  );
  if (exactlyOne) {
    const displayName = (rows[0] as { display_name?: string }).display_name ?? "";
    report("D-16 client reads coach name: display_name is non-empty", displayName.length > 0);
  }
}

// --- 04-01 Task 3: six client_profiles assertions (D-15, PROF-01/02/04/05/06). Every
// assertion signs in via signInAs() (real PostgREST, anon/publishable key) -- NEVER
// manual role switching, which produces a false pass from a table-owning connection (RESEARCH
// Pitfall 1). ---

async function checkClientProfileSelfRead(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("PROF-01 client_profiles self-read: resolve own user id", false, userError?.message);
    return;
  }
  const ownId = userData.user.id;

  const { data, error } = await supabase.from("client_profiles").select("*").eq("id", ownId);
  checkNoRecursion("PROF-01 client_profiles self-read", error);
  if (error) {
    report("PROF-01 client_profiles self-read: select succeeds", false, error.message);
    return;
  }
  const rows = data ?? [];
  report(
    "PROF-01 client_profiles self-read: exactly one own row",
    rows.length === 1,
    `got ${rows.length} rows`,
  );
}

async function checkClientProfileSafeUpdateSucceeds(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("PROF-02/04 client_profiles safe-update: resolve own user id", false, userError?.message);
    return;
  }
  const ownId = userData.user.id;

  const { error } = await supabase
    .from("client_profiles")
    .update({
      goal: "Speak confidently in team meetings",
      consented: true,
      consented_at: new Date().toISOString(),
      consent_version: "v1",
    })
    .eq("id", ownId);
  checkNoRecursion("PROF-02/04 client_profiles safe-update", error);
  report("PROF-02/04 client_profiles safe-update (goal + consent fields) succeeds", !error, error?.message);
}

async function checkLevelFreezeRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("PROF-05 level freeze: resolve own user id", false, userError?.message);
    return;
  }
  const ownId = userData.user.id;

  const { error } = await supabase.from("client_profiles").update({ level: "C2" }).eq("id", ownId);
  checkNoRecursion("PROF-05 level freeze attempt", error);
  // Either the grant layer (42501) or the trigger layer (P0001) is a pass -- do not
  // assert the specific code (RESEARCH Pattern 1: both are independently correct).
  report(
    "PROF-05 level freeze: client's level update is rejected at the database",
    !!error,
    error ? error.message : "update succeeded (should have failed)",
  );
}

async function checkCoachReadsAssignedClientProfile(): Promise<void> {
  const supabase = await signInAs(coach.email, coach.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("PROF-06 coach reads assigned client_profile: resolve own user id", false, userError?.message);
    return;
  }

  // Resolve an assigned client's id the way a coach legitimately can -- the
  // "coach reads own assignments" policy on coach_clients (0004) permits this read.
  const { data: assignment, error: assignmentError } = await supabase
    .from("coach_clients")
    .select("client_id")
    .eq("coach_id", userData.user.id)
    .limit(1)
    .single();
  checkNoRecursion("PROF-06 coach reads assigned client_profile: resolve assigned client id", assignmentError);
  if (assignmentError || !assignment) {
    report("PROF-06 coach reads assigned client_profile: resolve an assigned client id", false, assignmentError?.message);
    return;
  }

  const { data, error } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("id", assignment.client_id);
  checkNoRecursion("PROF-06 coach reads assigned client_profile", error);
  if (error) {
    report("PROF-06 coach reads assigned client_profile: select succeeds", false, error.message);
    return;
  }
  const rows = data ?? [];
  report(
    "PROF-06 coach reads assigned client_profile: exactly one row",
    rows.length === 1,
    `got ${rows.length} rows`,
  );
}

async function checkUnassignedCoachDenied(): Promise<void> {
  const supabase = await signInAs(coach2Unassigned.email, coach2Unassigned.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("PROF-06 unassigned coach denied: resolve own user id", false, userError?.message);
    return;
  }

  // Resolve client1's own id the only legitimate way available: sign in as client1
  // (a separate, throwaway session) and read its own auth.getUser() id. This keeps
  // the assertion self-contained without a service-role lookup.
  const client1Session = await signInAs(client1.email, client1.password);
  const { data: client1UserData, error: client1UserError } = await client1Session.auth.getUser();
  if (client1UserError || !client1UserData.user) {
    report("PROF-06 unassigned coach denied: resolve client1 id", false, client1UserError?.message);
    return;
  }
  const client1Id = client1UserData.user.id;

  const { data, error } = await supabase.from("client_profiles").select("*").eq("id", client1Id);
  checkNoRecursion("PROF-06 unassigned coach denied", error);
  if (error) {
    report("PROF-06 unassigned coach denied: select does not error", false, error.message);
    return;
  }
  const rows = data ?? [];
  // Default-deny returns zero rows, NOT an error -- no enumeration side channel.
  report(
    "PROF-06 unassigned coach denied: zero rows returned (no error, no leak)",
    rows.length === 0,
    `got ${rows.length} rows`,
  );
}

async function checkCrossClientDenied(): Promise<void> {
  const supabase = await signInAs(client2.email, client2.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("PROF-05/06 cross-client denied: resolve own user id", false, userError?.message);
    return;
  }

  const client1Session = await signInAs(client1.email, client1.password);
  const { data: client1UserData, error: client1UserError } = await client1Session.auth.getUser();
  if (client1UserError || !client1UserData.user) {
    report("PROF-05/06 cross-client denied: resolve client1 id", false, client1UserError?.message);
    return;
  }
  const client1Id = client1UserData.user.id;

  const { data, error } = await supabase.from("client_profiles").select("*").eq("id", client1Id);
  checkNoRecursion("PROF-05/06 cross-client denied", error);
  if (error) {
    report("PROF-05/06 cross-client denied: select does not error", false, error.message);
    return;
  }
  const rows = data ?? [];
  report(
    "PROF-05/06 cross-client denied: zero rows returned for another client's row",
    rows.length === 0,
    `got ${rows.length} rows`,
  );
}

type ChatConversationRow = {
  id: string;
  client_id: string;
  coach_id: string;
};

type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  sticker_id?: string | null;
  client_request_id: string;
  created_at: string;
};

type MessageReadRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  last_delivered_message_id: string | null;
  delivered_at: string | null;
  last_read_message_id: string | null;
  read_at: string | null;
};

async function getOwnUserId(label: string, supabase: Awaited<ReturnType<typeof signInAs>>): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    report(`${label}: resolve own user id`, false, error?.message);
    return null;
  }
  return data.user.id;
}

function toChatMessage(data: unknown): ChatMessageRow | null {
  if (Array.isArray(data)) {
    return (data[0] as ChatMessageRow | undefined) ?? null;
  }
  return (data as ChatMessageRow | null) ?? null;
}

async function getClientOneId(label: string): Promise<string | null> {
  const clientSession = await signInAs(client1.email, client1.password);
  return getOwnUserId(label, clientSession);
}

async function queryChatConversationsForClient(
  label: string,
  supabase: Awaited<ReturnType<typeof signInAs>>,
  clientId: string,
): Promise<ChatConversationRow[] | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, client_id, coach_id")
    .eq("client_id", clientId)
    .neq("id", demoCommunityConversationId);
  checkNoRecursion(label, error);
  if (error) {
    report(`${label}: conversation select succeeds`, false, error.message);
    return null;
  }
  return (data ?? []) as ChatConversationRow[];
}

async function getClientOneConversationFixture(label: string): Promise<ChatConversationRow | null> {
  const clientSession = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId(label, clientSession);
  if (!clientId) return null;

  const conversations = await queryChatConversationsForClient(label, clientSession, clientId);
  if (!conversations) return null;
  const conversation = conversations[0];
  report(`${label}: resolve client1 conversation`, conversations.length === 1, `got ${conversations.length}`);
  return conversation ?? null;
}

async function resetChatVerificationState(): Promise<void> {
  const { data: assignments, error: assignmentError } = await admin
    .from("coach_clients")
    .select("coach_id, client_id");
  report("CHAT setup: reads seeded assignments", !assignmentError, assignmentError?.message);
  if (assignmentError) return;

  for (const assignment of assignments ?? []) {
    const { error } = await admin
      .from("conversations")
      .upsert(
        {
          client_id: assignment.client_id,
          coach_id: assignment.coach_id,
        },
        { onConflict: "client_id,coach_id" },
      );
    if (error) {
      report("CHAT setup: upserts seeded conversations", false, error.message);
      return;
    }
  }

  const { data: conversations, error: conversationError } = await admin
    .from("conversations")
    .select("id, client_id, coach_id")
    .neq("id", demoCommunityConversationId);
  report("CHAT setup: reads seeded conversations", !conversationError, conversationError?.message);
  if (conversationError) return;

  const assignmentKeys = new Set(
    (assignments ?? []).map(
      (assignment) => `${assignment.client_id}:${assignment.coach_id}`,
    ),
  );
  const chatConversations = ((conversations ?? []) as ChatConversationRow[]).filter(
    (conversation) =>
      assignmentKeys.has(`${conversation.client_id}:${conversation.coach_id}`),
  );
  report(
    "CHAT setup: one conversation per seeded assignment",
    chatConversations.length === (assignments ?? []).length,
    `conversations=${chatConversations.length} assignments=${(assignments ?? []).length}`,
  );

  const conversationIds = chatConversations.map((conversation) => conversation.id);
  if (conversationIds.length > 0) {
    const { error: resetReadsError } = await admin
      .from("message_reads")
      .update({
        last_delivered_message_id: null,
        delivered_at: null,
        last_read_message_id: null,
        read_at: null,
      })
      .in("conversation_id", conversationIds);
    report("CHAT setup: resets prior verification read markers", !resetReadsError, resetReadsError?.message);
    if (resetReadsError) return;

    const { error: deleteError } = await admin
      .from("messages")
      .delete()
      .in("conversation_id", conversationIds);
    report("CHAT setup: clears prior verification messages", !deleteError, deleteError?.message);
    if (deleteError) return;
  }

  const readRows = chatConversations.flatMap((conversation) => [
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
  ]);

  if (readRows.length > 0) {
    const { error: readStateError } = await admin
      .from("message_reads")
      .upsert(readRows, { onConflict: "conversation_id,user_id" });
    report("CHAT setup: upserts member read-state rows", !readStateError, readStateError?.message);
  }
}

async function checkChatClientReadsConversation(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("CHAT-01 client read", supabase);
  if (!clientId) return;

  const conversations = await queryChatConversationsForClient("CHAT-01 client read", supabase, clientId);
  if (!conversations) return;
  report("CHAT-01 client read: sees exactly one assigned conversation", conversations.length === 1, `got ${conversations.length}`);
  report("CHAT-01 client read: conversation belongs to signed-in client", conversations[0]?.client_id === clientId);
}

async function checkChatCoachReadsConversation(): Promise<void> {
  const supabase = await signInAs(coach.email, coach.password);
  const clientId = await getClientOneId("CHAT-01 coach read");
  if (!clientId) return;

  const conversations = await queryChatConversationsForClient("CHAT-01 coach read", supabase, clientId);
  if (!conversations) return;
  report("CHAT-01 coach read: sees client1 conversation", conversations.length === 1, `got ${conversations.length}`);
}

async function checkChatRpcSendAndIdempotency(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const conversation = await getClientOneConversationFixture("CHAT-04 idempotent send");
  if (!conversation) return;

  const { data: firstData, error: firstError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Verification message",
    p_client_request_id: "verify-chat-client-idempotent",
  });
  checkNoRecursion("CHAT-04 idempotent send", firstError);
  if (firstError) {
    report("CHAT-04 idempotent send: first RPC succeeds", false, firstError.message);
    return;
  }
  const firstMessage = toChatMessage(firstData);
  report("CHAT-04 idempotent send: returns message id", typeof firstMessage?.id === "string");

  const { data: duplicateData, error: duplicateError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Verification message",
    p_client_request_id: "verify-chat-client-idempotent",
  });
  checkNoRecursion("CHAT-04 duplicate send", duplicateError);
  if (duplicateError) {
    report("CHAT-04 idempotent send: duplicate RPC succeeds", false, duplicateError.message);
    return;
  }
  const duplicateMessage = toChatMessage(duplicateData);
  report(
    "CHAT-04 idempotent send: duplicate returns same message id",
    !!firstMessage?.id && duplicateMessage?.id === firstMessage.id,
    `first=${firstMessage?.id ?? "missing"} duplicate=${duplicateMessage?.id ?? "missing"}`,
  );

  const coachSession = await signInAs(coach.email, coach.password);
  const { data: coachData, error: coachError } = await coachSession.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Coach verification reply",
    p_client_request_id: "verify-chat-coach-send",
  });
  checkNoRecursion("CHAT-06 coach send", coachError);
  if (coachError) {
    report("CHAT-06 coach send: assigned coach RPC succeeds", false, coachError.message);
    return;
  }
  const coachMessage = toChatMessage(coachData);
  report("CHAT-06 coach send: sender role is derived as coach", coachMessage?.sender_role === "coach", `role=${coachMessage?.sender_role ?? "missing"}`);
}

async function checkChatUnassignedCoachDenied(): Promise<void> {
  const supabase = await signInAs(coach2Unassigned.email, coach2Unassigned.password);
  const clientId = await getClientOneId("CHAT-06 unassigned coach denied");
  const conversation = await getClientOneConversationFixture("CHAT-06 unassigned coach denied");
  if (!clientId || !conversation) return;

  const conversations = await queryChatConversationsForClient("CHAT-06 unassigned coach denied", supabase, clientId);
  if (!conversations) return;
  report("CHAT-06 unassigned coach denied: zero conversations returned", conversations.length === 0, `got ${conversations.length}`);

  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id);
  checkNoRecursion("CHAT-06 unassigned coach messages denied", messageError);
  if (messageError) {
    report("CHAT-06 unassigned coach denied: message select does not error", false, messageError.message);
    return;
  }
  report("CHAT-06 unassigned coach denied: zero messages returned", (messages ?? []).length === 0, `got ${(messages ?? []).length}`);

  const { error: sendError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Outsider probe",
    p_client_request_id: "verify-chat-unassigned-denied",
  });
  report("CHAT-06 unassigned coach denied: RPC send is rejected", !!sendError, sendError?.message ?? "send succeeded");
}

async function checkChatCrossClientDenied(): Promise<void> {
  const supabase = await signInAs(client2.email, client2.password);
  const clientId = await getClientOneId("CHAT-06 cross-client denied");
  const conversation = await getClientOneConversationFixture("CHAT-06 cross-client denied");
  if (!clientId || !conversation) return;

  const conversations = await queryChatConversationsForClient("CHAT-06 cross-client denied", supabase, clientId);
  if (!conversations) return;
  report("CHAT-06 cross-client denied: zero conversations returned", conversations.length === 0, `got ${conversations.length}`);

  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id);
  checkNoRecursion("CHAT-06 cross-client messages denied", messageError);
  if (messageError) {
    report("CHAT-06 cross-client denied: message select does not error", false, messageError.message);
    return;
  }
  report("CHAT-06 cross-client denied: zero messages returned", (messages ?? []).length === 0, `got ${(messages ?? []).length}`);

  const { error: sendError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Cross-client probe",
    p_client_request_id: "verify-chat-cross-client-denied",
  });
  report("CHAT-06 cross-client denied: RPC send is rejected", !!sendError, sendError?.message ?? "send succeeded");
}

async function checkChatConflictingDuplicateRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const conversation = await getClientOneConversationFixture("CHAT-04 conflicting duplicate");
  if (!conversation) return;

  const { error: firstError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "First conflict probe",
    p_client_request_id: "verify-chat-conflict",
  });
  checkNoRecursion("CHAT-04 conflicting duplicate first send", firstError);
  if (firstError) {
    report("CHAT-04 conflicting duplicate: first RPC succeeds", false, firstError.message);
    return;
  }

  const { error: conflictError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Changed conflict probe",
    p_client_request_id: "verify-chat-conflict",
  });
  report("CHAT-04 conflicting duplicate: changed body is rejected", !!conflictError, conflictError?.message ?? "send succeeded");
}

async function checkChatDirectInsertRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const conversation = await getClientOneConversationFixture("CHAT-06 direct insert rejected");
  if (!conversation) return;

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: conversation.client_id,
    sender_role: "client",
    body: "Direct insert probe",
    client_request_id: "verify-chat-direct-insert",
  });
  checkNoRecursion("CHAT-06 direct insert rejected", error);
  report("CHAT-06 direct insert rejected: authenticated insert fails", !!error, error?.message ?? "insert succeeded");
}

async function checkChatMessageImmutable(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const conversation = await getClientOneConversationFixture("CHAT-06 immutable message");
  if (!conversation) return;

  const originalBody = "Immutable message probe";
  const { data, error } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: originalBody,
    p_client_request_id: "verify-chat-immutable",
  });
  checkNoRecursion("CHAT-06 immutable message send", error);
  if (error) {
    report("CHAT-06 immutable message: setup send succeeds", false, error.message);
    return;
  }
  const message = toChatMessage(data);
  if (!message?.id) {
    report("CHAT-06 immutable message: setup returns message id", false);
    return;
  }

  const { error: updateError } = await supabase
    .from("messages")
    .update({ body: "Changed by direct update" })
    .eq("id", message.id);
  checkNoRecursion("CHAT-06 immutable update rejected", updateError);
  report("CHAT-06 immutable message: authenticated update fails", !!updateError, updateError?.message ?? "update succeeded");

  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("id", message.id);
  checkNoRecursion("CHAT-06 immutable delete rejected", deleteError);
  report("CHAT-06 immutable message: authenticated delete fails", !!deleteError, deleteError?.message ?? "delete succeeded");

  const { data: rows, error: readError } = await supabase
    .from("messages")
    .select("id, body")
    .eq("id", message.id);
  checkNoRecursion("CHAT-06 immutable message readback", readError);
  if (readError) {
    report("CHAT-06 immutable message: readback succeeds", false, readError.message);
    return;
  }
  report("CHAT-06 immutable message: original body remains", rows?.[0]?.body === originalBody);
}

async function checkChatBodyConstraintsRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const conversation = await getClientOneConversationFixture("CHAT-04 body constraints");
  if (!conversation) return;

  const { error: blankError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "   ",
    p_client_request_id: "verify-chat-blank-body",
  });
  checkNoRecursion("CHAT-04 blank body rejected", blankError);
  report("CHAT-04 body constraints: whitespace-only body is rejected", !!blankError, blankError?.message ?? "send succeeded");

  const { error: longError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "x".repeat(4001),
    p_client_request_id: "verify-chat-long-body",
  });
  checkNoRecursion("CHAT-04 long body rejected", longError);
  report("CHAT-04 body constraints: 4001-character body is rejected", !!longError, longError?.message ?? "send succeeded");
}

async function checkChatReadStateOwnRowOnly(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("CHAT-06 read-state ownership", supabase);
  const conversation = await getClientOneConversationFixture("CHAT-06 read-state ownership");
  if (!clientId || !conversation) return;

  const { data: messages, error: messageReadError } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversation.id)
    .limit(1);
  checkNoRecursion("CHAT-06 read-state ownership: resolve message", messageReadError);
  if (messageReadError) {
    report("CHAT-06 read-state ownership: message lookup succeeds", false, messageReadError.message);
    return;
  }
  let messageId = (messages ?? [])[0]?.id as string | undefined;
  if (!messageId) {
    const { data: sendData, error: sendError } = await supabase.rpc("send_chat_message", {
      p_conversation_id: conversation.id,
      p_body: "Read-state probe",
      p_client_request_id: "verify-chat-read-state-message",
    });
    checkNoRecursion("CHAT-06 read-state ownership: setup send", sendError);
    if (sendError) {
      report("CHAT-06 read-state ownership: setup send succeeds", false, sendError.message);
      return;
    }
    messageId = toChatMessage(sendData)?.id;
  }
  if (!messageId) {
    report("CHAT-06 read-state ownership: resolve message id", false);
    return;
  }

  const { data: readRows, error: readError } = await supabase
    .from("message_reads")
    .select("id, conversation_id, user_id, last_read_message_id, read_at")
    .eq("conversation_id", conversation.id);
  checkNoRecursion("CHAT-06 read-state ownership: read rows", readError);
  if (readError) {
    report("CHAT-06 read-state ownership: read-state select succeeds", false, readError.message);
    return;
  }
  const rows = (readRows ?? []) as MessageReadRow[];
  report("CHAT-06 read-state ownership: both member rows are visible", rows.length === 2, `got ${rows.length}`);

  const ownRow = rows.find((row) => row.user_id === clientId);
  const otherRow = rows.find((row) => row.user_id !== clientId);
  if (!ownRow || !otherRow) {
    report("CHAT-06 read-state ownership: resolves own and other member rows", false);
    return;
  }

  const { data: ownUpdate, error: ownUpdateError } = await supabase
    .from("message_reads")
    .update({
      last_read_message_id: messageId,
      read_at: new Date().toISOString(),
    })
    .eq("id", ownRow.id)
    .select("id, last_read_message_id")
    .single();
  checkNoRecursion("CHAT-06 read-state ownership: own update", ownUpdateError);
  report(
    "CHAT-06 read-state ownership: own read-state update succeeds",
    !ownUpdateError && ownUpdate?.last_read_message_id === messageId,
    ownUpdateError?.message,
  );

  const { data: otherUpdate, error: otherUpdateError } = await supabase
    .from("message_reads")
    .update({ read_at: new Date().toISOString() })
    .eq("id", otherRow.id)
    .select("id");
  checkNoRecursion("CHAT-06 read-state ownership: other update", otherUpdateError);
  report(
    "CHAT-06 read-state ownership: other member update affects no row",
    !!otherUpdateError || (otherUpdate ?? []).length === 0,
    otherUpdateError?.message ?? `updated ${(otherUpdate ?? []).length}`,
  );

  const { error: otherInsertError } = await supabase.from("message_reads").insert({
    conversation_id: conversation.id,
    user_id: otherRow.user_id,
    last_read_message_id: messageId,
  });
  checkNoRecursion("CHAT-06 read-state ownership: other insert", otherInsertError);
  report("CHAT-06 read-state ownership: other member insert is rejected", !!otherInsertError, otherInsertError?.message ?? "insert succeeded");
}

async function checkChatDeliveredOnlyReadState(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("CHAT-07 delivered-only read state", supabase);
  const conversation = await getClientOneConversationFixture("CHAT-07 delivered-only read state");
  if (!clientId || !conversation) return;

  const { data: sendData, error: sendError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Delivered-only probe",
    p_client_request_id: "verify-chat-delivered-only",
  });
  checkNoRecursion("CHAT-07 delivered-only read state: setup send", sendError);
  if (sendError) {
    report("CHAT-07 delivered-only read state: setup send succeeds", false, sendError.message);
    return;
  }
  const messageId = toChatMessage(sendData)?.id;
  if (!messageId) {
    report("CHAT-07 delivered-only read state: resolve message id", false);
    return;
  }

  const { error: resetError } = await admin
    .from("message_reads")
    .update({
      last_delivered_message_id: null,
      delivered_at: null,
      last_read_message_id: null,
      read_at: null,
    })
    .eq("conversation_id", conversation.id)
    .eq("user_id", clientId);
  report("CHAT-07 delivered-only read state: resets read marker", !resetError, resetError?.message);
  if (resetError) return;

  const { data, error } = await supabase.rpc("mark_chat_read_state", {
    p_conversation_id: conversation.id,
    p_last_delivered_message_id: messageId,
    p_last_read_message_id: null,
  });
  checkNoRecursion("CHAT-07 delivered-only read state", error);
  if (error) {
    report("CHAT-07 delivered-only read state: RPC succeeds", false, error.message);
    return;
  }

  const row = (Array.isArray(data) ? data[0] : data) as MessageReadRow | null;
  report("CHAT-07 delivered-only read state: delivered id is saved", row?.last_delivered_message_id === messageId);
  report("CHAT-07 delivered-only read state: read marker may stay null", row?.last_read_message_id === null);
}

async function checkChatReadStateMonotonic(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const conversation = await getClientOneConversationFixture("CHAT-07 monotonic read state");
  if (!conversation) return;

  const { data: firstData, error: firstError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Monotonic first",
    p_client_request_id: "verify-chat-monotonic-first",
  });
  const { data: secondData, error: secondError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Monotonic second",
    p_client_request_id: "verify-chat-monotonic-second",
  });
  checkNoRecursion("CHAT-07 monotonic first send", firstError);
  checkNoRecursion("CHAT-07 monotonic second send", secondError);
  const firstId = toChatMessage(firstData)?.id;
  const secondId = toChatMessage(secondData)?.id;
  if (firstError || secondError || !firstId || !secondId) {
    report("CHAT-07 monotonic read state: setup sends succeed", false, firstError?.message ?? secondError?.message);
    return;
  }

  await supabase.rpc("mark_chat_read_state", {
    p_conversation_id: conversation.id,
    p_last_delivered_message_id: secondId,
    p_last_read_message_id: secondId,
  });
  const { data, error } = await supabase.rpc("mark_chat_read_state", {
    p_conversation_id: conversation.id,
    p_last_delivered_message_id: firstId,
    p_last_read_message_id: firstId,
  });
  checkNoRecursion("CHAT-07 monotonic stale read update", error);
  if (error) {
    report("CHAT-07 monotonic read state: stale RPC does not error", false, error.message);
    return;
  }

  const row = (Array.isArray(data) ? data[0] : data) as MessageReadRow | null;
  report("CHAT-07 monotonic read state: stale delivered marker does not move backward", row?.last_delivered_message_id === secondId);
  report("CHAT-07 monotonic read state: stale read marker does not move backward", row?.last_read_message_id === secondId);
}

async function checkChatReactionsSoftDeleteAndIntegrity(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const conversation = await getClientOneConversationFixture("CHAT-08 reactions");
  if (!conversation) return;

  const { data: sendData, error: sendError } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "Reaction probe",
    p_client_request_id: "verify-chat-reaction-message",
  });
  checkNoRecursion("CHAT-08 reactions: setup send", sendError);
  if (sendError) {
    report("CHAT-08 reactions: setup send succeeds", false, sendError.message);
    return;
  }
  const messageId = toChatMessage(sendData)?.id;
  if (!messageId) {
    report("CHAT-08 reactions: resolve message id", false);
    return;
  }

  const { error: addError } = await supabase.rpc("toggle_message_reaction", {
    p_message_id: messageId,
    p_emoji: "👍",
  });
  checkNoRecursion("CHAT-08 reactions: add", addError);
  report("CHAT-08 reactions: add reaction RPC succeeds", !addError, addError?.message);

  const { data: visibleRows, error: visibleError } = await supabase
    .from("message_reactions")
    .select("id, removed_at")
    .eq("message_id", messageId);
  checkNoRecursion("CHAT-08 reactions: select visible", visibleError);
  report("CHAT-08 reactions: active reaction is visible", !visibleError && (visibleRows ?? []).length === 1, visibleError?.message ?? `got ${(visibleRows ?? []).length}`);

  const { error: removeError } = await supabase.rpc("toggle_message_reaction", {
    p_message_id: messageId,
    p_emoji: "👍",
  });
  checkNoRecursion("CHAT-08 reactions: remove", removeError);
  report("CHAT-08 reactions: remove reaction RPC succeeds", !removeError, removeError?.message);

  const { data: hiddenRows, error: hiddenError } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId);
  checkNoRecursion("CHAT-08 reactions: select hidden", hiddenError);
  report("CHAT-08 reactions: removed reaction is hidden by RLS policy", !hiddenError && (hiddenRows ?? []).length === 0, hiddenError?.message ?? `got ${(hiddenRows ?? []).length}`);

  const { data: adminRows, error: adminError } = await admin
    .from("message_reactions")
    .select("id, removed_at")
    .eq("message_id", messageId);
  report("CHAT-08 reactions: removed reaction row is soft-deleted, not hard-deleted", !adminError && (adminRows ?? []).some((row) => row.removed_at), adminError?.message);

  const { error: integrityError } = await admin.from("message_reactions").insert({
    conversation_id: "00000000-0000-4000-8000-000000000000",
    message_id: messageId,
    user_id: conversation.client_id,
    emoji: "👍",
  });
  report("CHAT-08 reactions: mismatched conversation insert is rejected", !!integrityError, integrityError?.message ?? "insert succeeded");
}

async function checkChatGifBoundaries(): Promise<void> {
  const member = await signInAs(client1.email, client1.password);
  const outsider = await signInAs(client2.email, client2.password);
  const conversation = await getClientOneConversationFixture("CHAT-09 GIF boundary");
  if (!conversation) return;

  const { data: sendData, error: sendError } = await member.rpc("send_chat_message", {
    p_conversation_id: conversation.id,
    p_body: "",
    p_client_request_id: "verify-chat-gif-message",
    p_gif: {
      provider: "klipy",
      providerId: "verify-gif",
      title: "Verification GIF",
      description: "A GIF used to verify chat access boundaries",
      sourceUrl: "https://klipy.com/gifs/verify-gif",
      posterUrl: "https://static.klipy.com/verify-gif.jpg",
      previewUrl: "https://static1.klipy.com/verify-gif-preview.mp4",
      mediaUrl: "https://static2.klipy.com/verify-gif.mp4",
      width: 480,
      height: 270,
    },
  });
  checkNoRecursion("CHAT-09 GIF boundary: setup send", sendError);
  if (sendError) {
    report("CHAT-09 GIF boundary: member can send a GIF", false, sendError.message);
    return;
  }
  const messageId = toChatMessage(sendData)?.id;
  if (!messageId) {
    report("CHAT-09 GIF boundary: resolves message id", false);
    return;
  }

  const { data: memberRows, error: memberReadError } = await member
    .from("message_gifs")
    .select("message_id, provider_content_id")
    .eq("message_id", messageId);
  checkNoRecursion("CHAT-09 GIF boundary: member read", memberReadError);
  report(
    "CHAT-09 GIF boundary: conversation member reads the GIF",
    !memberReadError && memberRows?.[0]?.provider_content_id === "verify-gif",
    memberReadError?.message
  );

  const { data: outsiderRows, error: outsiderReadError } = await outsider
    .from("message_gifs")
    .select("message_id")
    .eq("message_id", messageId);
  checkNoRecursion("CHAT-09 GIF boundary: outsider read", outsiderReadError);
  report(
    "CHAT-09 GIF boundary: non-member reads no GIF row",
    !outsiderReadError && (outsiderRows ?? []).length === 0,
    outsiderReadError?.message ?? `got ${(outsiderRows ?? []).length}`
  );

  const { error: reportError } = await member.rpc("report_message_gif", {
    p_message_id: messageId,
  });
  checkNoRecursion("CHAT-09 GIF boundary: member report", reportError);
  report(
    "CHAT-09 GIF boundary: member can report the GIF",
    !reportError,
    reportError?.message
  );

  const { data: reportRows, error: reportReadError } = await member
    .from("message_gif_reports")
    .select("message_id, reason")
    .eq("message_id", messageId);
  checkNoRecursion("CHAT-09 GIF boundary: report read", reportReadError);
  report(
    "CHAT-09 GIF boundary: generic report is classified as other",
    !reportReadError && reportRows?.[0]?.reason === "other",
    reportReadError?.message ?? `reason=${reportRows?.[0]?.reason ?? "missing"}`
  );

  const { error: outsiderReportError } = await outsider.rpc("report_message_gif", {
    p_message_id: messageId,
  });
  report(
    "CHAT-09 GIF boundary: non-member report is rejected",
    !!outsiderReportError,
    outsiderReportError?.message ?? "report succeeded"
  );
}

async function checkChatStickerBoundaries(): Promise<void> {
  const member = await signInAs(client1.email, client1.password);
  const conversation = await getClientOneConversationFixture("CHAT-10 sticker boundary");
  if (!conversation) return;

  const requestId = "verify-chat-sticker-message";
  const sendInput = {
    p_conversation_id: conversation.id,
    p_body: "",
    p_client_request_id: requestId,
    p_sticker_id: "aquatic-hello-otter",
  };
  const { data: sendData, error: sendError } = await member.rpc(
    "send_chat_message",
    sendInput
  );
  checkNoRecursion("CHAT-10 sticker boundary: setup send", sendError);
  const message = toChatMessage(sendData);
  report(
    "CHAT-10 sticker boundary: member can send a sticker-only message",
    !sendError && message?.sticker_id === "aquatic-hello-otter",
    sendError?.message ?? `sticker=${message?.sticker_id ?? "missing"}`
  );
  if (!message) return;

  const { data: retryData, error: retryError } = await member.rpc(
    "send_chat_message",
    sendInput
  );
  const retried = toChatMessage(retryData);
  checkNoRecursion("CHAT-10 sticker boundary: idempotent retry", retryError);
  report(
    "CHAT-10 sticker boundary: identical retry returns the same message",
    !retryError && retried?.id === message.id,
    retryError?.message ?? `id=${retried?.id ?? "missing"}`
  );

  const { error: conflictError } = await member.rpc("send_chat_message", {
    ...sendInput,
    p_sticker_id: "aquatic-awesome-dolphin",
  });
  checkNoRecursion("CHAT-10 sticker boundary: conflicting retry", conflictError);
  report(
    "CHAT-10 sticker boundary: changed sticker with the same request id is rejected",
    !!conflictError,
    conflictError?.message ?? "send succeeded"
  );

  const { error: unknownError } = await member.rpc("send_chat_message", {
    ...sendInput,
    p_client_request_id: "verify-chat-unknown-sticker",
    p_sticker_id: "aquatic-unknown",
  });
  checkNoRecursion("CHAT-10 sticker boundary: unknown sticker", unknownError);
  report(
    "CHAT-10 sticker boundary: unknown catalog id is rejected",
    !!unknownError,
    unknownError?.message ?? "send succeeded"
  );

  const { error: mixedMediaError } = await member.rpc("send_chat_message", {
    ...sendInput,
    p_client_request_id: "verify-chat-mixed-sticker",
    p_gif: {
      provider: "klipy",
      providerId: "verify-sticker-conflict",
      title: "Verification GIF",
      description: "A GIF used to verify sticker exclusivity",
      sourceUrl: "https://klipy.com/gifs/verify-sticker-conflict",
      posterUrl: "https://static.klipy.com/verify-sticker-conflict.jpg",
      previewUrl: "https://static1.klipy.com/verify-sticker-conflict-preview.mp4",
      mediaUrl: "https://static2.klipy.com/verify-sticker-conflict.mp4",
      width: 480,
      height: 270,
    },
  });
  checkNoRecursion("CHAT-10 sticker boundary: mixed media", mixedMediaError);
  report(
    "CHAT-10 sticker boundary: sticker cannot be combined with a GIF",
    !!mixedMediaError,
    mixedMediaError?.message ?? "send succeeded"
  );
}

async function main(): Promise<void> {
  await checkClientBoundary();
  await checkCoachBoundary();
  await checkEscalationRejected();
  await checkClientReadsCoachName();
  await checkClientProfileSelfRead();
  await checkClientProfileSafeUpdateSucceeds();
  await checkLevelFreezeRejected();
  await checkCoachReadsAssignedClientProfile();
  await checkUnassignedCoachDenied();
  await checkCrossClientDenied();
  await resetChatVerificationState();
  await checkChatClientReadsConversation();
  await checkChatCoachReadsConversation();
  await checkChatRpcSendAndIdempotency();
  await checkChatUnassignedCoachDenied();
  await checkChatCrossClientDenied();
  await checkChatConflictingDuplicateRejected();
  await checkChatDirectInsertRejected();
  await checkChatMessageImmutable();
  await checkChatBodyConstraintsRejected();
  await checkChatReadStateOwnRowOnly();
  await checkChatDeliveredOnlyReadState();
  await checkChatReadStateMonotonic();
  await checkChatReactionsSoftDeleteAndIntegrity();
  await checkChatGifBoundaries();
  await checkChatStickerBoundaries();

  console.log(`\n${failures === 0 ? "All assertions passed." : `${failures} assertion(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
