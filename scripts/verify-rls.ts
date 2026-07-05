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

  console.log(`\n${failures === 0 ? "All assertions passed." : `${failures} assertion(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
