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

  // Post-0006 invariant: the is_client_of policy legitimately widens a
  // client's profiles read to include their assigned coach's row, so the
  // client now sees exactly 2 rows (own + assigned coach), not 1. Resolve
  // the assigned coach id the same legitimate way a client can (the 0003
  // "client reads own coach assignment" policy permits this read).
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
  const exactlyOwnAndCoach = rows.length === 2;
  report(
    "DB-03 client boundary: sees exactly two rows (own + assigned coach)",
    exactlyOwnAndCoach,
    `got ${rows.length} rows`,
  );
  // Identity-based leak check: any row whose id is neither our own nor our
  // assigned coach's is a leak (cross-client visibility or a foreign coach).
  const allowedIds = new Set([ownId, coachId]);
  const leaked = rows.some((row) => !allowedIds.has((row as { id?: string }).id ?? ""));
  report("DB-03 client boundary: no other accounts visible", !leaked, leaked ? "row(s) with a foreign id returned" : undefined);
}

async function checkCoachBoundary(): Promise<void> {
  const supabase = await signInAs(coach.email, coach.password);
  const { data, error } = await supabase.from("profiles").select("*");
  checkNoRecursion("DB-03 coach boundary", error);
  if (error) {
    report("DB-03 coach boundary: select succeeds", false, error.message);
    return;
  }
  const rows = data ?? [];
  // Own row + 3 assigned clients = 4.
  report("DB-03 coach boundary: sees own row plus 3 assigned clients", rows.length === 4, `got ${rows.length} rows`);
  const roles = rows.map((row) => (row as { role?: string }).role);
  const coachCount = roles.filter((role) => role === "coach").length;
  const clientCount = roles.filter((role) => role === "client").length;
  report("DB-03 coach boundary: exactly one coach row, three client rows", coachCount === 1 && clientCount === 3, `coach=${coachCount} client=${clientCount}`);
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
    .update({ display_name: "Alex Rivera" })
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

type OnboardingQuestionRow = {
  id: string;
  version_id: string;
  question_order: number;
  answer_type: string;
  config: unknown;
};

type TrackerFieldRow = {
  id: string;
  version_id: string;
  field_order: number;
  field_key: string;
  answer_type: string;
  config: unknown;
};

type TrackerProgressRow = {
  entries_count: number | string;
  milestone_id: string;
  label: string;
  milestone_order: number | string;
  state: string;
  current_step_progress: number | string;
};

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
  client_request_id: string;
  created_at: string;
};

type MessageReadRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_message_id: string | null;
  read_at: string;
};

async function getOwnUserId(label: string, supabase: Awaited<ReturnType<typeof signInAs>>): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    report(`${label}: resolve own user id`, false, error?.message);
    return null;
  }
  return data.user.id;
}

async function getActiveOnboardingQuestions(
  label: string,
  supabase: Awaited<ReturnType<typeof signInAs>>,
): Promise<OnboardingQuestionRow[]> {
  const { data, error } = await supabase
    .from("onboarding_questions")
    .select("id, version_id, question_order, answer_type, config")
    .order("question_order", { ascending: true });
  checkNoRecursion(label, error);
  if (error) {
    report(`${label}: active questions query succeeds`, false, error.message);
    return [];
  }
  return (data ?? []) as OnboardingQuestionRow[];
}

async function checkOnboardingActiveVersionRead(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const questions = await getActiveOnboardingQuestions("ONBD-01 active version read", supabase);
  report("ONBD-01 active version read: six questions returned", questions.length === 6, `got ${questions.length}`);
  const types = new Set(questions.map((question) => question.answer_type));
  for (const type of ["single_select", "multi_select", "scale", "short_text", "long_text", "boolean"]) {
    report(`ONBD-02 active version read: includes ${type}`, types.has(type));
  }
}

async function resetOnboardingVerificationState(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("ONBD setup", supabase);
  if (!clientId) return;

  const { error } = await admin
    .from("onboarding_attempts")
    .delete()
    .eq("client_id", clientId);

  report(
    "ONBD setup: clears prior verification attempt",
    !error,
    error?.message,
  );
}

async function checkOnboardingSelfSaveAnswer(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const questions = await getActiveOnboardingQuestions("ONBD-03 self-save", supabase);
  const firstQuestion = questions[0];
  if (!firstQuestion) {
    report("ONBD-03 self-save: resolve first question", false);
    return;
  }

  const { data, error } = await supabase.rpc("save_onboarding_answer", {
    p_question_id: firstQuestion.id,
    p_answer: { type: "single_select", value: "meetings" },
  });
  checkNoRecursion("ONBD-03 self-save", error);
  if (error) {
    report("ONBD-03 self-save: RPC succeeds", false, error.message);
    return;
  }

  const row = Array.isArray(data) ? data[0] : null;
  report("ONBD-03 self-save: returns attempt id", typeof row?.attempt_id === "string");
  report("ONBD-03 self-save: keeps attempt in progress", row?.status === "in_progress", `status=${row?.status ?? "missing"}`);
  report("ONBD-03 self-save: advances resume pointer", typeof row?.current_question_id === "string");
}

async function checkOnboardingResumePosition(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("ONBD-03 resume", supabase);
  if (!clientId) return;

  const { data: attempts, error: attemptError } = await supabase
    .from("onboarding_attempts")
    .select("id, current_question_id, status")
    .eq("client_id", clientId);
  checkNoRecursion("ONBD-03 resume attempt", attemptError);
  if (attemptError) {
    report("ONBD-03 resume: attempt query succeeds", false, attemptError.message);
    return;
  }
  const attempt = (attempts ?? [])[0] as { id: string; current_question_id: string | null; status: string } | undefined;
  report("ONBD-03 resume: one attempt exists", (attempts ?? []).length === 1, `got ${(attempts ?? []).length}`);
  report("ONBD-03 resume: current question persisted", typeof attempt?.current_question_id === "string");

  const { data: answers, error: answerError } = await supabase
    .from("onboarding_answers")
    .select("id, question_key, answer")
    .eq("attempt_id", attempt?.id ?? "");
  checkNoRecursion("ONBD-03 resume answers", answerError);
  if (answerError) {
    report("ONBD-03 resume: answers query succeeds", false, answerError.message);
    return;
  }
  report("ONBD-03 resume: saved answer row persists", (answers ?? []).length >= 1, `got ${(answers ?? []).length}`);
}

async function checkOnboardingAssignedCoachReadsAnswers(): Promise<void> {
  const supabase = await signInAs(coach.email, coach.password);
  const coachId = await getOwnUserId("ONBD-07 assigned coach read", supabase);
  if (!coachId) return;

  const { data: assignment, error: assignmentError } = await supabase
    .from("coach_clients")
    .select("client_id")
    .eq("coach_id", coachId)
    .limit(1)
    .single();
  checkNoRecursion("ONBD-07 assigned coach read: resolve client", assignmentError);
  if (assignmentError || !assignment) {
    report("ONBD-07 assigned coach read: resolve assigned client", false, assignmentError?.message);
    return;
  }

  const { data: attempts, error: attemptError } = await supabase
    .from("onboarding_attempts")
    .select("id, client_id, status")
    .eq("client_id", assignment.client_id);
  checkNoRecursion("ONBD-07 assigned coach read: attempts", attemptError);
  if (attemptError) {
    report("ONBD-07 assigned coach read: attempts query succeeds", false, attemptError.message);
    return;
  }
  const attempt = (attempts ?? [])[0] as { id: string } | undefined;
  report("ONBD-07 assigned coach read: sees assigned attempt", (attempts ?? []).length === 1, `got ${(attempts ?? []).length}`);

  const { data: answers, error: answerError } = await supabase
    .from("onboarding_answers")
    .select("id, question_key, question_prompt, question_config, answer")
    .eq("attempt_id", attempt?.id ?? "");
  checkNoRecursion("ONBD-07 assigned coach read: answers", answerError);
  if (answerError) {
    report("ONBD-07 assigned coach read: answers query succeeds", false, answerError.message);
    return;
  }
  report("ONBD-07 assigned coach read: sees saved answer snapshot", (answers ?? []).length >= 1, `got ${(answers ?? []).length}`);
}

async function checkOnboardingUnassignedCoachDenied(): Promise<void> {
  const unassignedCoach = await signInAs(coach2Unassigned.email, coach2Unassigned.password);
  const clientSession = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("ONBD-07 unassigned coach denied", clientSession);
  if (!clientId) return;

  const { data: attempts, error: attemptError } = await unassignedCoach
    .from("onboarding_attempts")
    .select("*")
    .eq("client_id", clientId);
  checkNoRecursion("ONBD-07 unassigned coach denied", attemptError);
  if (attemptError) {
    report("ONBD-07 unassigned coach denied: select does not error", false, attemptError.message);
    return;
  }
  report("ONBD-07 unassigned coach denied: zero attempts returned", (attempts ?? []).length === 0, `got ${(attempts ?? []).length}`);

  const { data: answers, error: answerError } = await unassignedCoach.from("onboarding_answers").select("*");
  checkNoRecursion("ONBD-07 unassigned coach answers denied", answerError);
  if (answerError) {
    report("ONBD-07 unassigned coach denied: answer select does not error", false, answerError.message);
    return;
  }
  report("ONBD-07 unassigned coach denied: zero answers returned", (answers ?? []).length === 0, `got ${(answers ?? []).length}`);
}

async function checkOnboardingCrossClientDenied(): Promise<void> {
  const clientTwoSession = await signInAs(client2.email, client2.password);
  const clientOneSession = await signInAs(client1.email, client1.password);
  const clientOneId = await getOwnUserId("ONBD-07 cross-client denied", clientOneSession);
  if (!clientOneId) return;

  const { data: attempts, error: attemptError } = await clientTwoSession
    .from("onboarding_attempts")
    .select("*")
    .eq("client_id", clientOneId);
  checkNoRecursion("ONBD-07 cross-client denied", attemptError);
  if (attemptError) {
    report("ONBD-07 cross-client denied: select does not error", false, attemptError.message);
    return;
  }
  report("ONBD-07 cross-client denied: zero attempts returned", (attempts ?? []).length === 0, `got ${(attempts ?? []).length}`);

  const { data: answers, error: answerError } = await clientTwoSession.from("onboarding_answers").select("*");
  checkNoRecursion("ONBD-07 cross-client answers denied", answerError);
  if (answerError) {
    report("ONBD-07 cross-client denied: answer select does not error", false, answerError.message);
    return;
  }
  report("ONBD-07 cross-client denied: zero answers returned", (answers ?? []).length === 0, `got ${(answers ?? []).length}`);
}

async function checkOnboardingUsedVersionImmutable(): Promise<void> {
  const { data: attempt, error: attemptError } = await admin
    .from("onboarding_attempts")
    .select("version_id")
    .limit(1)
    .single();
  if (attemptError || !attempt) {
    report("ONBD-05 used-version immutable: resolve used version", false, attemptError?.message);
    return;
  }

  const { error: versionError } = await admin
    .from("onboarding_assessment_versions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", attempt.version_id);
  report("ONBD-05 used-version immutable: version update rejected", !!versionError, versionError?.message ?? "update succeeded");

  const { data: question, error: questionReadError } = await admin
    .from("onboarding_questions")
    .select("id, prompt")
    .eq("version_id", attempt.version_id)
    .limit(1)
    .single();
  if (questionReadError || !question) {
    report("ONBD-05 used-version immutable: resolve used question", false, questionReadError?.message);
    return;
  }
  const { error: questionError } = await admin
    .from("onboarding_questions")
    .update({ prompt: `${question.prompt} ` })
    .eq("id", question.id);
  report("ONBD-05 used-version immutable: question update rejected", !!questionError, questionError?.message ?? "update succeeded");
}

async function checkOnboardingMalformedConfigRejected(): Promise<void> {
  const { data: version, error: versionError } = await admin
    .from("onboarding_assessment_versions")
    .select("id")
    .eq("is_active", true)
    .single();
  if (versionError || !version) {
    report("ONBD-02 malformed config rejected: resolve active version", false, versionError?.message);
    return;
  }

  const { error } = await admin.from("onboarding_questions").insert({
    version_id: version.id,
    question_key: "malformed_config_probe",
    question_order: 99,
    prompt: "Malformed config probe",
    answer_type: "short_text",
    config: { type: "short_text" },
  });
  report("ONBD-02 malformed config rejected: DB CHECK rejects missing label", !!error, error?.message ?? "insert succeeded");
}

async function checkOnboardingFinalizeLocksWrites(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: finalizeData, error: finalizeError } = await supabase.rpc("finalize_onboarding_attempt");
  checkNoRecursion("ONBD-03 finalize", finalizeError);
  if (finalizeError) {
    report("ONBD-03 finalize: RPC succeeds", false, finalizeError.message);
    return;
  }
  const finalizeRow = Array.isArray(finalizeData) ? finalizeData[0] : null;
  report("ONBD-03 finalize: marks attempt submitted", finalizeRow?.status === "submitted", `status=${finalizeRow?.status ?? "missing"}`);

  const questions = await getActiveOnboardingQuestions("ONBD-03 finalize lock", supabase);
  const secondQuestion = questions[1];
  if (!secondQuestion) {
    report("ONBD-03 finalize lock: resolve second question", false);
    return;
  }

  const { error: saveError } = await supabase.rpc("save_onboarding_answer", {
    p_question_id: secondQuestion.id,
    p_answer: { type: "short_text", value: "after submit" },
  });
  report("ONBD-03 finalize lock: later save is rejected", !!saveError, saveError?.message ?? "save succeeded");
}

async function getActiveTrackerFields(
  label: string,
  supabase: Awaited<ReturnType<typeof signInAs>>,
): Promise<TrackerFieldRow[]> {
  const { data, error } = await supabase
    .from("tracker_fields")
    .select("id, version_id, field_order, field_key, answer_type, config")
    .order("field_order", { ascending: true });
  checkNoRecursion(label, error);
  if (error) {
    report(`${label}: active fields query succeeds`, false, error.message);
    return [];
  }
  return (data ?? []) as TrackerFieldRow[];
}

async function getActiveTrackerVersionId(label: string): Promise<string | null> {
  const { data, error } = await admin
    .from("tracker_config_versions")
    .select("id")
    .eq("is_active", true)
    .single();
  if (error || !data) {
    report(`${label}: resolve active tracker version`, false, error?.message);
    return null;
  }
  return data.id;
}

async function resetTrackerVerificationState(): Promise<void> {
  const clientSession = await signInAs(client1.email, client1.password);
  const coachSession = await signInAs(coach.email, coach.password);
  const clientId = await getOwnUserId("TRAK setup", clientSession);
  const coachId = await getOwnUserId("TRAK setup", coachSession);
  const versionId = await getActiveTrackerVersionId("TRAK setup");
  if (!clientId || !coachId || !versionId) return;

  const { data: assignments, error: assignmentReadError } = await admin
    .from("tracker_assignments")
    .select("id")
    .eq("client_id", clientId);
  report(
    "TRAK setup: reads prior assignments",
    !assignmentReadError,
    assignmentReadError?.message,
  );
  if (assignmentReadError) return;

  const assignmentIds = (assignments ?? []).map((row) => row.id as string);
  if (assignmentIds.length > 0) {
    const { error: draftDeleteError } = await admin
      .from("tracker_entry_drafts")
      .delete()
      .in("assignment_id", assignmentIds);
    report(
      "TRAK setup: clears prior verification drafts",
      !draftDeleteError,
      draftDeleteError?.message,
    );
    if (draftDeleteError) return;

    const { error: entryDeleteError } = await admin
      .from("tracker_entries")
      .delete()
      .in("assignment_id", assignmentIds);
    report(
      "TRAK setup: clears prior verification entries",
      !entryDeleteError,
      entryDeleteError?.message,
    );
    if (entryDeleteError) return;

    const { error: milestoneDeleteError } = await admin
      .from("tracker_milestones")
      .delete()
      .in("assignment_id", assignmentIds);
    report(
      "TRAK setup: clears prior verification milestones",
      !milestoneDeleteError,
      milestoneDeleteError?.message,
    );
    if (milestoneDeleteError) return;
  }

  const { error: assignmentDeleteError } = await admin
    .from("tracker_assignments")
    .delete()
    .eq("client_id", clientId);
  report(
    "TRAK setup: clears prior verification assignment",
    !assignmentDeleteError,
    assignmentDeleteError?.message,
  );
  if (assignmentDeleteError) return;

  const { error: insertError } = await admin.from("tracker_assignments").insert({
    client_id: clientId,
    coach_id: coachId,
    version_id: versionId,
  });
  report(
    "TRAK setup: inserts active assignment fixture",
    !insertError,
    insertError?.message,
  );
}

async function checkTrackerActiveVersionRead(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const fields = await getActiveTrackerFields("TRAK-01 active version read", supabase);
  report("TRAK-01 active version read: six fields returned", fields.length === 6, `got ${fields.length}`);
  const types = new Set(fields.map((field) => field.answer_type));
  for (const type of ["single_select", "multi_select", "scale", "short_text", "long_text", "boolean"]) {
    report(`TRAK-01 active version read: includes ${type}`, types.has(type));
  }
}

async function checkTrackerMilestonesReadable(): Promise<void> {
  const clientSession = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("TRAK-05 assignment milestones client read", clientSession);
  if (!clientId) return;

  const { data: clientRows, error: clientError } = await clientSession.rpc("get_tracker_progress");
  checkNoRecursion("TRAK-05 assignment milestones client read", clientError);
  if (clientError) {
    report("TRAK-05 assignment milestones client read: RPC succeeds", false, clientError.message);
    return;
  }

  const clientMilestones = (Array.isArray(clientRows) ? clientRows : []) as TrackerProgressRow[];
  report("TRAK-05 assignment milestones client read: rows returned", clientMilestones.length >= 3, `got ${clientMilestones.length}`);
  const ordered = clientMilestones.every(
    (row, index, rows) => index === 0 || Number(rows[index - 1]!.milestone_order) < Number(row.milestone_order),
  );
  report("TRAK-05 assignment milestones client read: ordered by milestone", ordered);
  report(
    "TRAK-05 assignment milestones client read: labels are plain text",
    clientMilestones.every((row) => typeof row.label === "string" && row.label.length > 0),
  );
  const allowedStates = new Set(["done", "now", "up_next"]);
  report(
    "TRAK-05 assignment milestones client read: states are known",
    clientMilestones.every((row) => allowedStates.has(row.state)),
  );
  report(
    "TRAK-05 assignment milestones client read: progress values are bounded",
    clientMilestones.every((row) => {
      const progress = Number(row.current_step_progress);
      return progress >= 0 && progress <= 100;
    }),
  );

  const coachSession = await signInAs(coach.email, coach.password);
  const { data: coachRows, error: coachError } = await coachSession.rpc(
    "get_coach_tracker_progress",
    { p_client_id: clientId },
  );
  checkNoRecursion("TRAK-05 assignment milestones coach read", coachError);
  if (coachError) {
    report("TRAK-05 assignment milestones coach read: RPC succeeds", false, coachError.message);
    return;
  }
  report(
    "TRAK-05 assignment milestones coach read: assigned coach sees same milestones",
    (coachRows ?? []).length === clientMilestones.length,
    `coach=${(coachRows ?? []).length} client=${clientMilestones.length}`,
  );
}

async function checkTrackerEntrySelfSave(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const fields = await getActiveTrackerFields("TRAK-03 self-save", supabase);
  const booleanField = fields.find((field) => field.answer_type === "boolean");
  if (!booleanField) {
    report("TRAK-03 self-save: resolve boolean field", false);
    return;
  }

  const { data, error } = await supabase.rpc("save_tracker_entry", {
    p_field_id: booleanField.id,
    p_answer: { type: "boolean", value: true },
  });
  checkNoRecursion("TRAK-03 self-save", error);
  if (error) {
    report("TRAK-03 self-save: RPC succeeds", false, error.message);
    return;
  }

  const row = Array.isArray(data) ? data[0] : null;
  report("TRAK-03 self-save: returns assignment id", typeof row?.assignment_id === "string");
  report("TRAK-03 self-save: returns entry id", typeof row?.entry_id === "string");
  report("TRAK-03 self-save: keeps assignment active", row?.status === "active", `status=${row?.status ?? "missing"}`);

  const { data: entries, error: entryError } = await supabase
    .from("tracker_entries")
    .select("id, field_key, answer")
    .eq("id", row?.entry_id ?? "");
  checkNoRecursion("TRAK-03 self-save entries", entryError);
  if (entryError) {
    report("TRAK-03 self-save: entry select succeeds", false, entryError.message);
    return;
  }
  report("TRAK-03 self-save: saved entry row persists", (entries ?? []).length === 1, `got ${(entries ?? []).length}`);
}

async function checkTrackerDraftPrivacyAndCommit(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const fields = await getActiveTrackerFields("TRAK-03 draft privacy", supabase);
  const booleanField = fields.find((field) => field.answer_type === "boolean");
  if (!booleanField) {
    report("TRAK-03 draft privacy: resolve boolean field", false);
    return;
  }

  const { data: draftData, error: draftError } = await supabase.rpc("save_tracker_draft", {
    p_field_id: booleanField.id,
    p_answer: { type: "boolean", value: false },
  });
  checkNoRecursion("TRAK-03 draft privacy: save draft", draftError);
  if (draftError) {
    report("TRAK-03 draft privacy: draft RPC succeeds", false, draftError.message);
    return;
  }

  const draftRow = Array.isArray(draftData) ? draftData[0] : null;
  const draftId = draftRow?.draft_id as string | undefined;
  report("TRAK-03 draft privacy: returns draft id", typeof draftId === "string");
  if (!draftId) return;

  const { data: clientDrafts, error: clientDraftError } = await supabase
    .from("tracker_entry_drafts")
    .select("id")
    .eq("id", draftId);
  checkNoRecursion("TRAK-03 draft privacy: client read", clientDraftError);
  if (clientDraftError) {
    report("TRAK-03 draft privacy: client draft select succeeds", false, clientDraftError.message);
    return;
  }
  report("TRAK-03 draft privacy: client sees own draft", (clientDrafts ?? []).length === 1, `got ${(clientDrafts ?? []).length}`);

  const coachSession = await signInAs(coach.email, coach.password);
  const { data: coachDrafts, error: coachDraftError } = await coachSession
    .from("tracker_entry_drafts")
    .select("id")
    .eq("id", draftId);
  checkNoRecursion("TRAK-03 draft privacy: coach read", coachDraftError);
  if (coachDraftError) {
    report("TRAK-03 draft privacy: assigned coach draft select does not error", false, coachDraftError.message);
    return;
  }
  report("TRAK-03 draft privacy: assigned coach sees zero drafts", (coachDrafts ?? []).length === 0, `got ${(coachDrafts ?? []).length}`);

  const unassignedCoachSession = await signInAs(coach2Unassigned.email, coach2Unassigned.password);
  const { data: unassignedCoachDrafts, error: unassignedCoachDraftError } = await unassignedCoachSession
    .from("tracker_entry_drafts")
    .select("id")
    .eq("id", draftId);
  checkNoRecursion("TRAK-03 draft privacy: unassigned coach read", unassignedCoachDraftError);
  if (unassignedCoachDraftError) {
    report("TRAK-03 draft privacy: unassigned coach draft select does not error", false, unassignedCoachDraftError.message);
    return;
  }
  report("TRAK-03 draft privacy: unassigned coach sees zero drafts", (unassignedCoachDrafts ?? []).length === 0, `got ${(unassignedCoachDrafts ?? []).length}`);

  const clientTwoSession = await signInAs(client2.email, client2.password);
  const { data: crossClientDrafts, error: crossClientDraftError } = await clientTwoSession
    .from("tracker_entry_drafts")
    .select("id")
    .eq("id", draftId);
  checkNoRecursion("TRAK-03 draft privacy: cross-client read", crossClientDraftError);
  if (crossClientDraftError) {
    report("TRAK-03 draft privacy: cross-client draft select does not error", false, crossClientDraftError.message);
    return;
  }
  report("TRAK-03 draft privacy: another client sees zero drafts", (crossClientDrafts ?? []).length === 0, `got ${(crossClientDrafts ?? []).length}`);

  const { error: entryError } = await supabase.rpc("save_tracker_entry", {
    p_field_id: booleanField.id,
    p_answer: { type: "boolean", value: false },
  });
  checkNoRecursion("TRAK-03 draft privacy: commit draft", entryError);
  if (entryError) {
    report("TRAK-03 draft privacy: commit RPC succeeds", false, entryError.message);
    return;
  }

  const { data: remainingDrafts, error: remainingDraftError } = await supabase
    .from("tracker_entry_drafts")
    .select("id")
    .eq("id", draftId);
  checkNoRecursion("TRAK-03 draft privacy: draft deleted after commit", remainingDraftError);
  if (remainingDraftError) {
    report("TRAK-03 draft privacy: post-commit draft select succeeds", false, remainingDraftError.message);
    return;
  }
  report("TRAK-03 draft privacy: commit deletes matching draft", (remainingDrafts ?? []).length === 0, `got ${(remainingDrafts ?? []).length}`);
}

async function checkTrackerProgressUsesAssignmentMilestones(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data, error } = await supabase.rpc("get_tracker_progress");
  checkNoRecursion("TRAK-05 assignment progress", error);
  if (error) {
    report("TRAK-05 assignment progress: RPC succeeds", false, error.message);
    return;
  }

  const rows = (Array.isArray(data) ? data : []) as TrackerProgressRow[];
  report("TRAK-05 assignment progress: milestone rows returned", rows.length >= 3, `got ${rows.length}`);
  report("TRAK-05 assignment progress: entry count is present", Number(rows[0]?.entries_count ?? 0) >= 1);
  const states = new Set(rows.map((row) => row.state));
  report(
    "TRAK-05 assignment progress: at least one milestone is active or done",
    states.has("now") || states.has("done"),
    `states=${[...states].join(",")}`,
  );
  report(
    "TRAK-05 assignment progress: progress values are bounded",
    rows.every((row) => {
      const progress = Number(row.current_step_progress);
      return progress >= 0 && progress <= 100;
    }),
  );
}

async function checkTrackerActiveAssignmentGate(): Promise<void> {
  const supabase = await signInAs(client2.email, client2.password);
  const fields = await getActiveTrackerFields("TRAK-03 active assignment gate", supabase);
  const field = fields[0];
  if (!field) {
    report("TRAK-03 active assignment gate: resolve field", false);
    return;
  }

  const { error } = await supabase.rpc("save_tracker_entry", {
    p_field_id: field.id,
    p_answer: { type: "boolean", value: true },
  });
  report("TRAK-03 active assignment gate: client without active assignment is rejected", !!error, error?.message ?? "save succeeded");
}

async function checkTrackerAssignedCoachReadsEntries(): Promise<void> {
  const supabase = await signInAs(coach.email, coach.password);
  const coachId = await getOwnUserId("TRAK-06 assigned coach read", supabase);
  if (!coachId) return;

  const { data: assignment, error: assignmentError } = await supabase
    .from("coach_clients")
    .select("client_id")
    .eq("coach_id", coachId)
    .limit(1)
    .single();
  checkNoRecursion("TRAK-06 assigned coach read: resolve client", assignmentError);
  if (assignmentError || !assignment) {
    report("TRAK-06 assigned coach read: resolve assigned client", false, assignmentError?.message);
    return;
  }

  const { data: trackerAssignments, error: trackerAssignmentError } = await supabase
    .from("tracker_assignments")
    .select("id, client_id, status")
    .eq("client_id", assignment.client_id);
  checkNoRecursion("TRAK-06 assigned coach read: assignments", trackerAssignmentError);
  if (trackerAssignmentError) {
    report("TRAK-06 assigned coach read: assignments query succeeds", false, trackerAssignmentError.message);
    return;
  }
  report("TRAK-06 assigned coach read: sees assigned active tracker", (trackerAssignments ?? []).length === 1, `got ${(trackerAssignments ?? []).length}`);

  const { data: entries, error: entryError } = await supabase
    .from("tracker_entries")
    .select("id, field_key, field_prompt, field_config, answer")
    .eq("assignment_id", trackerAssignments?.[0]?.id ?? "");
  checkNoRecursion("TRAK-06 assigned coach read: entries", entryError);
  if (entryError) {
    report("TRAK-06 assigned coach read: entries query succeeds", false, entryError.message);
    return;
  }
  report("TRAK-06 assigned coach read: sees saved tracker entry", (entries ?? []).length >= 1, `got ${(entries ?? []).length}`);
}

async function checkTrackerUnassignedCoachDenied(): Promise<void> {
  const unassignedCoach = await signInAs(coach2Unassigned.email, coach2Unassigned.password);
  const clientSession = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("TRAK-06 unassigned coach denied", clientSession);
  if (!clientId) return;

  const { data: assignments, error: assignmentError } = await unassignedCoach
    .from("tracker_assignments")
    .select("*")
    .eq("client_id", clientId);
  checkNoRecursion("TRAK-06 unassigned coach assignments denied", assignmentError);
  if (assignmentError) {
    report("TRAK-06 unassigned coach denied: assignment select does not error", false, assignmentError.message);
    return;
  }
  report("TRAK-06 unassigned coach denied: zero assignments returned", (assignments ?? []).length === 0, `got ${(assignments ?? []).length}`);

  const { data: entries, error: entryError } = await unassignedCoach.from("tracker_entries").select("*");
  checkNoRecursion("TRAK-06 unassigned coach entries denied", entryError);
  if (entryError) {
    report("TRAK-06 unassigned coach denied: entry select does not error", false, entryError.message);
    return;
  }
  report("TRAK-06 unassigned coach denied: zero entries returned", (entries ?? []).length === 0, `got ${(entries ?? []).length}`);
}

async function checkTrackerCrossClientDenied(): Promise<void> {
  const clientTwoSession = await signInAs(client2.email, client2.password);
  const clientOneSession = await signInAs(client1.email, client1.password);
  const clientOneId = await getOwnUserId("TRAK-06 cross-client denied", clientOneSession);
  if (!clientOneId) return;

  const { data: assignments, error: assignmentError } = await clientTwoSession
    .from("tracker_assignments")
    .select("*")
    .eq("client_id", clientOneId);
  checkNoRecursion("TRAK-06 cross-client assignments denied", assignmentError);
  if (assignmentError) {
    report("TRAK-06 cross-client denied: assignment select does not error", false, assignmentError.message);
    return;
  }
  report("TRAK-06 cross-client denied: zero assignments returned", (assignments ?? []).length === 0, `got ${(assignments ?? []).length}`);

  const { data: entries, error: entryError } = await clientTwoSession.from("tracker_entries").select("*");
  checkNoRecursion("TRAK-06 cross-client entries denied", entryError);
  if (entryError) {
    report("TRAK-06 cross-client denied: entry select does not error", false, entryError.message);
    return;
  }
  report("TRAK-06 cross-client denied: zero entries returned", (entries ?? []).length === 0, `got ${(entries ?? []).length}`);
}

async function checkTrackerSelfAssignRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("TRAK-02 self-assign rejected", supabase);
  const versionId = await getActiveTrackerVersionId("TRAK-02 self-assign rejected");
  if (!clientId || !versionId) return;

  const { error } = await supabase.from("tracker_assignments").insert({
    client_id: clientId,
    coach_id: clientId,
    version_id: versionId,
  });
  report("TRAK-02 self-assign rejected: direct assignment insert is rejected", !!error, error?.message ?? "insert succeeded");
}

async function checkTrackerMalformedAnswerRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const fields = await getActiveTrackerFields("TRAK-04 malformed answer rejected", supabase);
  const booleanField = fields.find((field) => field.answer_type === "boolean");
  if (!booleanField) {
    report("TRAK-04 malformed answer rejected: resolve boolean field", false);
    return;
  }

  const { error } = await supabase.rpc("save_tracker_entry", {
    p_field_id: booleanField.id,
    p_answer: { type: "boolean", value: "yes" },
  });
  report("TRAK-04 malformed answer rejected: DB rejects wrong answer shape", !!error, error?.message ?? "save succeeded");
}

async function checkTrackerMalformedConfigRejected(): Promise<void> {
  const versionId = await getActiveTrackerVersionId("TRAK-04 malformed config rejected");
  if (!versionId) return;

  const { error } = await admin.from("tracker_fields").insert({
    version_id: versionId,
    field_key: "malformed_config_probe",
    field_order: 99,
    prompt: "Malformed config probe",
    answer_type: "short_text",
    config: { type: "short_text" },
  });
  report("TRAK-04 malformed config rejected: DB CHECK rejects missing label", !!error, error?.message ?? "insert succeeded");
}

async function checkTrackerUsedVersionImmutable(): Promise<void> {
  const { data: assignment, error: assignmentError } = await admin
    .from("tracker_assignments")
    .select("version_id")
    .limit(1)
    .single();
  if (assignmentError || !assignment) {
    report("TRAK-04 used-version immutable: resolve used version", false, assignmentError?.message);
    return;
  }

  const { error: versionNoopError } = await admin
    .from("tracker_config_versions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", assignment.version_id);
  report("TRAK-04 used-version immutable: no-op update accepted", !versionNoopError, versionNoopError?.message);

  const { error: versionError } = await admin
    .from("tracker_config_versions")
    .update({ cadence: "weekly" })
    .eq("id", assignment.version_id);
  report("TRAK-04 used-version immutable: config update rejected", !!versionError, versionError?.message ?? "update succeeded");

  const { data: entry, error: entryReadError } = await admin
    .from("tracker_entries")
    .select("field_id, field_prompt")
    .limit(1)
    .single();
  if (entryReadError || !entry) {
    report("TRAK-04 used-field immutable: resolve used field", false, entryReadError?.message);
    return;
  }

  const { error: fieldNoopError } = await admin
    .from("tracker_fields")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", entry.field_id);
  report("TRAK-04 used-field immutable: no-op update accepted", !fieldNoopError, fieldNoopError?.message);

  const { error: fieldError } = await admin
    .from("tracker_fields")
    .update({ prompt: `${entry.field_prompt} ` })
    .eq("id", entry.field_id);
  report("TRAK-04 used-field immutable: field update rejected", !!fieldError, fieldError?.message ?? "update succeeded");
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
    .eq("client_id", clientId);
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
    .select("id, client_id, coach_id");
  report("CHAT setup: reads seeded conversations", !conversationError, conversationError?.message);
  if (conversationError) return;

  const chatConversations = (conversations ?? []) as ChatConversationRow[];
  report(
    "CHAT setup: one conversation per seeded assignment",
    chatConversations.length === (assignments ?? []).length,
    `conversations=${chatConversations.length} assignments=${(assignments ?? []).length}`,
  );

  const conversationIds = chatConversations.map((conversation) => conversation.id);
  if (conversationIds.length > 0) {
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
  await resetOnboardingVerificationState();
  await checkOnboardingActiveVersionRead();
  await checkOnboardingSelfSaveAnswer();
  await checkOnboardingResumePosition();
  await checkOnboardingAssignedCoachReadsAnswers();
  await checkOnboardingUnassignedCoachDenied();
  await checkOnboardingCrossClientDenied();
  await checkOnboardingUsedVersionImmutable();
  await checkOnboardingMalformedConfigRejected();
  await checkOnboardingFinalizeLocksWrites();
  await resetTrackerVerificationState();
  await checkTrackerActiveVersionRead();
  await checkTrackerMilestonesReadable();
  await checkTrackerEntrySelfSave();
  await checkTrackerDraftPrivacyAndCommit();
  await checkTrackerProgressUsesAssignmentMilestones();
  await checkTrackerActiveAssignmentGate();
  await checkTrackerAssignedCoachReadsEntries();
  await checkTrackerUnassignedCoachDenied();
  await checkTrackerCrossClientDenied();
  await checkTrackerSelfAssignRejected();
  await checkTrackerMalformedAnswerRejected();
  await checkTrackerMalformedConfigRejected();
  await checkTrackerUsedVersionImmutable();
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

  console.log(`\n${failures === 0 ? "All assertions passed." : `${failures} assertion(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
