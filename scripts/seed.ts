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

type TrackerFieldSeed = {
  fieldKey: string;
  fieldOrder: number;
  prompt: string;
  answerType: "single_select" | "multi_select" | "scale" | "short_text" | "long_text" | "boolean";
  config: Record<string, unknown>;
};

const trackerFields: TrackerFieldSeed[] = [
  {
    fieldKey: "practice_moment",
    fieldOrder: 1,
    prompt: "Did you have a moment for English today?",
    answerType: "boolean",
    config: {
      type: "boolean",
      label: "Practice moment",
      options: [
        { id: "yes", label: "Yes" },
        { id: "not_today", label: "Not today" },
      ],
    },
  },
  {
    fieldKey: "practice_focus",
    fieldOrder: 2,
    prompt: "What did you work with today?",
    answerType: "single_select",
    config: {
      type: "single_select",
      label: "Practice focus",
      options: [
        { id: "speaking", label: "Speaking" },
        { id: "writing", label: "Writing" },
        { id: "listening", label: "Listening" },
      ],
    },
  },
  {
    fieldKey: "support_that_helped",
    fieldOrder: 3,
    prompt: "What support felt useful?",
    answerType: "multi_select",
    config: {
      type: "multi_select",
      label: "Useful support",
      minSelections: 0,
      maxSelections: 2,
      options: [
        { id: "example", label: "A clear example" },
        { id: "repeat", label: "Repeating a phrase" },
        { id: "quiet_time", label: "Quiet time" },
      ],
    },
  },
  {
    fieldKey: "practice_feel",
    fieldOrder: 4,
    prompt: "How did practice feel today?",
    answerType: "scale",
    config: {
      type: "scale",
      label: "Practice feel",
      options: [
        { id: "heavy", label: "Heavy" },
        { id: "steady", label: "Steady" },
        { id: "lighter", label: "Lighter" },
      ],
    },
  },
  {
    fieldKey: "phrase_to_keep",
    fieldOrder: 5,
    prompt: "Is there one phrase you want to keep?",
    answerType: "short_text",
    config: {
      type: "short_text",
      label: "Phrase to keep",
      maxLength: 160,
      placeholder: "A phrase, word, or sentence",
    },
  },
  {
    fieldKey: "reflection",
    fieldOrder: 6,
    prompt: "Anything you want your coach to know?",
    answerType: "long_text",
    config: {
      type: "long_text",
      label: "Reflection",
      maxLength: 1000,
      placeholder: "A thought, question, or context for your coach",
    },
  },
];

async function seedOnboardingAssessment(): Promise<void> {
  const { data: existingAssessment, error: existingAssessmentError } = await supabase
    .from("onboarding_assessments")
    .select("id")
    .eq("slug", "initial-client-context")
    .maybeSingle();
  if (existingAssessmentError) throw existingAssessmentError;

  let assessment = existingAssessment;
  if (!assessment) {
    const { data, error } = await supabase
      .from("onboarding_assessments")
      .insert({
        slug: "initial-client-context",
        title: "Initial client context",
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Could not create onboarding assessment seed.");
    assessment = data;
  }

  const { data: existingVersion, error: existingVersionError } = await supabase
    .from("onboarding_assessment_versions")
    .select("id")
    .eq("assessment_id", assessment.id)
    .eq("version", 1)
    .maybeSingle();
  if (existingVersionError) throw existingVersionError;

  let version = existingVersion;
  if (!version) {
    const { data, error } = await supabase
      .from("onboarding_assessment_versions")
      .insert({
        assessment_id: assessment.id,
        version: 1,
        status: "published",
        is_active: true,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Could not create onboarding assessment version seed.");
    version = data;
  }

  for (const question of onboardingQuestions) {
    const { data: existingQuestion, error: existingQuestionError } = await supabase
      .from("onboarding_questions")
      .select("id")
      .eq("version_id", version.id)
      .eq("question_key", question.questionKey)
      .maybeSingle();
    if (existingQuestionError) throw existingQuestionError;
    if (existingQuestion) continue;

    const { error } = await supabase
      .from("onboarding_questions")
      .insert({
        version_id: version.id,
        question_key: question.questionKey,
        question_order: question.questionOrder,
        prompt: question.prompt,
        answer_type: question.answerType,
        config: question.config,
      });
    if (error) throw error;
  }
}

async function getOrCreateTrackerConfigId(): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from("tracker_configs")
    .select("id")
    .eq("slug", "daily-check-in")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id as string;

  const { data: tracker, error: trackerError } = await supabase
    .from("tracker_configs")
    .insert({
      slug: "daily-check-in",
      title: "Daily check-in",
    })
    .select("id")
    .single();
  if (trackerError || !tracker) throw trackerError;

  return tracker.id as string;
}

async function getOrCreateTrackerVersionId(trackerId: string): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from("tracker_config_versions")
    .select("id")
    .eq("tracker_config_id", trackerId)
    .eq("version", 1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id as string;

  const { data: version, error: versionError } = await supabase
    .from("tracker_config_versions")
    .insert({
      tracker_config_id: trackerId,
      version: 1,
      cadence: "daily",
      status: "published",
      is_active: true,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (versionError || !version) throw versionError;

  return version.id as string;
}

async function seedTrackerConfig(): Promise<string> {
  const trackerId = await getOrCreateTrackerConfigId();
  const versionId = await getOrCreateTrackerVersionId(trackerId);

  for (const field of trackerFields) {
    const { data: existing, error: existingError } = await supabase
      .from("tracker_fields")
      .select("id")
      .eq("version_id", versionId)
      .eq("field_key", field.fieldKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) continue;

    const { error } = await supabase
      .from("tracker_fields")
      .insert({
        version_id: versionId,
        field_key: field.fieldKey,
        field_order: field.fieldOrder,
        prompt: field.prompt,
        answer_type: field.answerType,
        config: field.config,
      });
    if (error) throw error;
  }

  return versionId;
}

async function assignTrackerToClient(
  coachId: string,
  clientId: string,
  versionId: string,
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("tracker_assignments")
    .select("id, coach_id, version_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.coach_id === coachId && existing.version_id === versionId) {
    return;
  }

  if (existing) {
    const { error: endError } = await supabase
      .from("tracker_assignments")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (endError) throw endError;
  }

  const { error } = await supabase.from("tracker_assignments").insert({
    client_id: clientId,
    coach_id: coachId,
    version_id: versionId,
  });
  if (error) throw error;
}

async function seedChatConversations(): Promise<void> {
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
  const trackerVersionId = await seedTrackerConfig();
  const firstClientId = clientIds[0];
  if (!firstClientId) throw new Error("Seed needs at least one client.");
  await assignTrackerToClient(coachId, firstClientId, trackerVersionId);
  await seedChatConversations();

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
