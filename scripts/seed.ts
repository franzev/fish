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
    const existingId = await findUserIdByEmail(email);
    if (!existingId) {
      throw new Error(`${email} reported as already registered but could not be found via listUsers()`);
    }
    console.log(`Already exists: ${email}`);
    return existingId;
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

type OnboardingQuestionSeed = {
  questionKey: string;
  questionOrder: number;
  prompt: string;
  answerType: "single_select" | "multi_select" | "scale" | "short_text" | "long_text" | "boolean";
  config: Record<string, unknown>;
};

const onboardingQuestions: OnboardingQuestionSeed[] = [
  {
    questionKey: "language_goal",
    questionOrder: 1,
    prompt: "What would you like your English to help with at work?",
    answerType: "single_select",
    config: {
      type: "single_select",
      label: "Choose the closest fit",
      options: [
        { id: "meetings", label: "Speaking in meetings" },
        { id: "writing", label: "Writing clearly" },
        { id: "small_talk", label: "Everyday work conversations" },
      ],
    },
  },
  {
    questionKey: "work_context",
    questionOrder: 2,
    prompt: "What kind of work conversations come up most often?",
    answerType: "short_text",
    config: {
      type: "short_text",
      label: "Work context",
      maxLength: 160,
      placeholder: "Team updates, customer calls, design reviews...",
    },
  },
  {
    questionKey: "confidence_check",
    questionOrder: 3,
    prompt: "How does speaking English at work feel lately?",
    answerType: "scale",
    config: {
      type: "scale",
      label: "Current feeling",
      options: [
        { id: "needs_support", label: "Needs support" },
        { id: "depends_on_day", label: "Depends on the day" },
        { id: "mostly_okay", label: "Mostly okay" },
      ],
    },
  },
  {
    questionKey: "weekly_availability",
    questionOrder: 4,
    prompt: "Do you usually have a little time each week for practice?",
    answerType: "boolean",
    config: {
      type: "boolean",
      label: "Weekly practice time",
      options: [
        { id: "yes", label: "Yes" },
        { id: "not_right_now", label: "Not right now" },
      ],
    },
  },
  {
    questionKey: "support_preferences",
    questionOrder: 5,
    prompt: "What support would feel useful from your coach?",
    answerType: "multi_select",
    config: {
      type: "multi_select",
      label: "Support preferences",
      minSelections: 1,
      maxSelections: 3,
      options: [
        { id: "examples", label: "Clear examples" },
        { id: "practice", label: "Guided practice" },
        { id: "gentle_reminders", label: "Gentle reminders" },
        { id: "slower_pace", label: "A slower pace" },
      ],
    },
  },
  {
    questionKey: "communication_preference",
    questionOrder: 6,
    prompt: "Anything you want your coach to know before you start?",
    answerType: "long_text",
    config: {
      type: "long_text",
      label: "Anything helpful",
      maxLength: 1000,
      placeholder: "You can share context, preferences, or leave this simple.",
    },
  },
];

async function seedOnboardingAssessment(): Promise<void> {
  const { data: assessment, error: assessmentError } = await supabase
    .from("onboarding_assessments")
    .upsert(
      {
        slug: "initial-client-context",
        title: "Initial client context",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (assessmentError || !assessment) throw assessmentError;

  const { data: version, error: versionError } = await supabase
    .from("onboarding_assessment_versions")
    .upsert(
      {
        assessment_id: assessment.id,
        version: 1,
        status: "published",
        is_active: true,
        published_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id,version" },
    )
    .select("id")
    .single();
  if (versionError || !version) throw versionError;

  for (const question of onboardingQuestions) {
    const { error } = await supabase
      .from("onboarding_questions")
      .upsert(
        {
          version_id: version.id,
          question_key: question.questionKey,
          question_order: question.questionOrder,
          prompt: question.prompt,
          answer_type: question.answerType,
          config: question.config,
        },
        { onConflict: "version_id,question_key" },
      );
    if (error) throw error;
  }
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

  await seedOnboardingAssessment();

  console.log("\nSeed complete. Dev credentials (local only):");
  console.log(`  Coach: ${coach.email} / ${coach.password}`);
  console.log(`  Coach (unassigned): ${coach2.email} / ${coach2.password}`);
  for (const client of clients) {
    console.log(`  Client: ${client.email} / ${client.password}`);
  }
  console.log(`\nCoach id: ${coachId}`);
  console.log(`Coach2 id (unassigned): ${coach2Id}`);
  console.log(`Client ids: ${clientIds.join(", ")}`);
}

await main();
