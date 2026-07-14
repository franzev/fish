// Idempotent local dev seed (D-10, D-11): creates one coach + ~3 pre-verified clients
// through the real Supabase Auth admin API, never a raw SQL insert against the managed
// auth schema, so the DB-01 handle_new_user trigger fires exactly as it does for a real
// signup. Fixed, documented dev credentials — local only, never run against production
// (see docs/deploy-checklist.md).
import { createClient } from "@supabase/supabase-js";
import { chatStickerIds, type ChatStickerId } from "../packages/core/src/chat.ts";
import { buildSeedReactionRows } from "./seed-reaction-randomizer.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const friendsEnabled =
  process.env.FRIENDS_ENABLED?.trim().toLowerCase() === "true";

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

/** Keeps the local database gate aligned with the web rollout switch. */
async function syncLocalFeatureFlags(): Promise<void> {
  const { error } = await supabase
    .from("feature_flags")
    .update({ enabled: friendsEnabled, updated_at: new Date().toISOString() })
    .eq("key", "friends");
  if (error) throw error;
}

// Fixed, documented dev credentials (D-10). Local only.
const coach = {
  email: "coach@fish.dev",
  password: "fish-coach-dev",
  displayName: "Patty Cake",
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
  { email: "client1@fish.dev", password: "fish-client-dev", displayName: "Franz Eva", level: "A2" },
  { email: "client2@fish.dev", password: "fish-client-dev", displayName: "Sam Okafor", level: "B1" },
  { email: "client3@fish.dev", password: "fish-client-dev", displayName: "Priya Nair", level: "A2" },
];

// Community-only profiles (QAG-seed follow-up): never assigned via coach_clients, so the
// scripts/verify-rls.ts "coach sees exactly 3 assigned clients" fixture stays true. These
// exist purely to give the community channels a believable cast of real names instead of
// generic, hard-to-tell-apart placeholders. Each is added to every seeded room.
const communityExtras = [
  { email: "member1@fish.dev", password: "fish-client-dev", displayName: "Beef Patty" },
  { email: "member2@fish.dev", password: "fish-client-dev", displayName: "Renata Souza" },
  { email: "member3@fish.dev", password: "fish-client-dev", displayName: "Kenji Watanabe" },
  { email: "member4@fish.dev", password: "fish-client-dev", displayName: "Amara Chukwu" },
];

const demoCommunityConversationId = "11111111-1111-4111-8111-111111111111";

type CommunityChannelSeed = {
  id: string;
  slug: string;
  name: string;
  conversationId: string;
  conversationClientMemberIndex: number;
  conversationCoachMemberIndex: number;
};

const communityChannelSeeds: CommunityChannelSeed[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "general",
    name: "general",
    conversationId: demoCommunityConversationId,
    conversationClientMemberIndex: 2,
    conversationCoachMemberIndex: 1,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "introductions",
    name: "introduce yourself",
    conversationId: "44444444-4444-4444-8444-444444444444",
    conversationClientMemberIndex: 3,
    conversationCoachMemberIndex: 1,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    slug: "announcements",
    name: "announcements",
    conversationId: "66666666-6666-4666-8666-666666666666",
    conversationClientMemberIndex: 4,
    conversationCoachMemberIndex: 1,
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    slug: "small-wins",
    name: "small wins",
    conversationId: "70707070-7070-4070-8070-707070707070",
    conversationClientMemberIndex: 5,
    conversationCoachMemberIndex: 1,
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    slug: "how-do-i-say-this",
    name: "how do I say this?",
    conversationId: "80808080-8080-4080-8080-808080808080",
    conversationClientMemberIndex: 6,
    conversationCoachMemberIndex: 1,
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    slug: "meeting-prep",
    name: "meeting prep",
    conversationId: "90909090-9090-4090-8090-909090909090",
    conversationClientMemberIndex: 7,
    conversationCoachMemberIndex: 1,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    slug: "tone-check",
    name: "tone check",
    conversationId: "a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0",
    conversationClientMemberIndex: 8,
    conversationCoachMemberIndex: 1,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    slug: "after-the-meeting",
    name: "after the meeting",
    conversationId: "b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b0b0",
    conversationClientMemberIndex: 5,
    conversationCoachMemberIndex: 0,
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    slug: "words-from-work",
    name: "words from work",
    conversationId: "c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0",
    conversationClientMemberIndex: 6,
    conversationCoachMemberIndex: 0,
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    slug: "quiet-practice",
    name: "quiet practice",
    conversationId: "d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0",
    conversationClientMemberIndex: 7,
    conversationCoachMemberIndex: 0,
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    slug: "ask-a-coach",
    name: "ask a coach",
    conversationId: "e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0",
    conversationClientMemberIndex: 8,
    conversationCoachMemberIndex: 0,
  },
  {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    slug: "communication-repairs",
    name: "communication repairs",
    conversationId: "f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0",
    conversationClientMemberIndex: 1,
    conversationCoachMemberIndex: 2,
  },
  {
    id: "12121212-1212-4212-8212-121212121212",
    slug: "returning-today",
    name: "returning today",
    conversationId: "16161616-1616-4616-8616-161616161616",
    conversationClientMemberIndex: 1,
    conversationCoachMemberIndex: 3,
  },
  {
    id: "13131313-1313-4313-8313-131313131313",
    slug: "celebrate-someone",
    name: "celebrate someone",
    conversationId: "17171717-1717-4717-8717-171717171717",
    conversationClientMemberIndex: 1,
    conversationCoachMemberIndex: 4,
  },
  {
    id: "14141414-1414-4414-8414-141414141414",
    slug: "coworker-culture",
    name: "coworker culture",
    conversationId: "18181818-1818-4818-8818-181818181818",
    conversationClientMemberIndex: 1,
    conversationCoachMemberIndex: 5,
  },
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


/** Per-client direct-message conversation id, returned so seedDirectMessages() can target it. */
type DirectConversation = { clientId: string; conversationId: string };

async function seedChatConversations(
  coachId: string,
  coach2Id: string,
  clientIds: string[],
  extraIds: string[],
): Promise<DirectConversation[]> {
  const { data: assignments, error: assignmentError } = await supabase
    .from("coach_clients")
    .select("coach_id, client_id");
  if (assignmentError) throw assignmentError;

  const directConversations: DirectConversation[] = [];

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

    directConversations.push({ clientId: conversation.client_id, conversationId: conversation.id });

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

  const communityMemberIds = [coachId, coach2Id, ...clientIds, ...extraIds];

  for (const channel of communityChannelSeeds) {
    const conversationClientId =
      communityMemberIds[channel.conversationClientMemberIndex];
    const conversationCoachId =
      communityMemberIds[channel.conversationCoachMemberIndex];
    if (!conversationClientId || !conversationCoachId) {
      throw new Error(`Missing conversation pair for #${channel.slug}`);
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .upsert(
        {
          id: channel.conversationId,
          client_id: conversationClientId,
          coach_id: conversationCoachId,
        },
        { onConflict: "id" },
      )
      .select("id")
      .single();
    if (conversationError || !conversation) throw conversationError;

    const { error: channelError } = await supabase.from("channels").upsert(
      {
        id: channel.id,
        slug: channel.slug,
        name: channel.name,
        conversation_id: conversation.id,
      },
      { onConflict: "id" },
    );
    if (channelError) throw channelError;

    const { error: channelMemberError } = await supabase
      .from("channel_members")
      .upsert(
        communityMemberIds.map((userId) => ({
          channel_id: channel.id,
          user_id: userId,
        })),
        { onConflict: "channel_id,user_id" },
      );
    if (channelMemberError) throw channelMemberError;

    const readRows = communityMemberIds.map((userId) => ({
      conversation_id: conversation.id,
      user_id: userId,
      last_read_message_id: null,
    }));
    const { error: readStateError } = await supabase
      .from("message_reads")
      .upsert(readRows, { onConflict: "conversation_id,user_id" });
    if (readStateError) throw readStateError;
  }

  return directConversations;
}

/**
 * Realistic 1-on-1 coaching threads (D-seed-02: more chat volume for testing) for each of
 * the coach's real assigned clients. Unlike the community essays below, these read like an
 * actual back-and-forth chat — short turns, quick corrections, scheduling — since that's the
 * shape of a real coaching conversation and the demo data had none of this before.
 */
async function seedDirectMessages(
  coachId: string,
  directConversations: DirectConversation[],
  clientIds: { alex: string; sam: string; priya: string },
): Promise<void> {
  const threads: Record<string, { sender: "coach" | "client"; body: string }[]> = {
    [clientIds.alex]: [
      { sender: "coach", body: "Hi Alex! How did the mock interview practice go yesterday?" },
      { sender: "client", body: `It went okay! I got stuck on "I have work there for two years" — I think it should be "worked"?` },
      { sender: "coach", body: `Exactly right. Past simple for a finished period: "I worked there for two years." Nice catch.` },
      { sender: "client", body: "Thank you! I keep mixing up have + past tense." },
      { sender: "coach", body: "That's really common. Quick rule: if you say WHEN something happened (yesterday, in 2019, for two years and it's over now), use past simple. If you don't say exactly when, use present perfect." },
      { sender: "client", body: "Okay, that helps a lot." },
      { sender: "coach", body: `Want to try one more? "Tell me about a project you finished last year."` },
      { sender: "client", body: "I finish a big project last year for my team. We built new dashboard." },
      { sender: "coach", body: `Close! "I finished a big project last year." — small fix on finish -> finished. Everything else was clear and easy to follow.` },
      { sender: "client", body: "I finished a big project last year for my team." },
      { sender: "coach", body: "Perfect." },
      { sender: "client", body: "Can we practice more interview questions on Thursday?" },
      { sender: "coach", body: "Yes, let's do a full 10 minute mock interview then." },
      { sender: "client", body: "Sounds good. A little nervous but ready." },
      { sender: "coach", body: "That's completely normal. Nervous and prepared can be true at the same time." },
      { sender: "client", body: "I like that." },
      { sender: "coach", body: "See you Thursday!" },
      { sender: "client", body: "Just wanted to say thank you, the interview went well today!" },
      { sender: "coach", body: "That's wonderful news, Alex! How did the past tense practice feel in the moment?" },
      { sender: "client", body: "It felt automatic actually, I didn't even think about it." },
      { sender: "coach", body: "That's the goal exactly — the grammar becomes invisible once it's practiced enough." },
      { sender: "client", body: "Should we start something new next week?" },
      { sender: "coach", body: "Let's talk Thursday about what's next. For now, enjoy this win." },
      { sender: "client", body: "Will do." },
    ],
    [clientIds.sam]: [
      { sender: "coach", body: "Hi Sam, how's the narrating-out-loud exercise going?" },
      { sender: "client", body: "Honestly it felt silly for the first few days but I kept going." },
      { sender: "coach", body: "That's exactly the reaction most people have. What have you noticed so far?" },
      { sender: "client", body: "I think I am translating less in my head before I talk now." },
      { sender: "coach", body: "That's a big shift. How did it show up this week specifically?" },
      { sender: "client", body: "In standup yesterday I answered right away instead of waiting to translate first." },
      { sender: "coach", body: "That's fantastic. How did that feel in the moment?" },
      { sender: "client", body: "Fast! A little scary but good." },
      { sender: "coach", body: "Fast and a little scary is a great sign — it means you're not over-planning every sentence anymore." },
      { sender: "client", body: "Should I keep doing the narrating exercise?" },
      { sender: "coach", body: "Yes, keep it up for two more weeks, then we'll switch to something new." },
      { sender: "client", body: `Okay. Also, quick question — is "I am agree" correct?` },
      { sender: "coach", body: `Close! In English "agree" is a verb on its own: "I agree" (no "am"). "I am agreeing" would only work for something happening right now, which is rare for this word.` },
      { sender: "client", body: `Ah, I always add "am" before it.` },
      { sender: "coach", body: `Very common mix-up from languages that use "to be" + adjective for this. Just "I agree" from now on.` },
      { sender: "client", body: "Got it, thank you." },
      { sender: "coach", body: "How's the Slack message speed going?" },
      { sender: "client", body: "Much better, maybe 2 minutes instead of 10." },
      { sender: "coach", body: "That's a huge improvement. What changed?" },
      { sender: "client", body: "I stopped writing it in my language first." },
      { sender: "coach", body: "That's the whole exercise working exactly as intended. Well done, Sam." },
      { sender: "client", body: "Thank you! Can we work on emails next?" },
      { sender: "coach", body: "Yes, let's make that the focus for our next session." },
      { sender: "client", body: "Perfect, see you then." },
    ],
    [clientIds.priya]: [
      { sender: "coach", body: "Hi Priya, congrats again on the mock interview yesterday!" },
      { sender: "client", body: "Thank you! I was very nervous before." },
      { sender: "coach", body: "That's totally normal. What felt hardest going in?" },
      { sender: "client", body: "I was scared I will forget the words." },
      { sender: "coach", body: `Small fix: "I was scared I would forget the words." But you did great regardless — what surprised you once it started?` },
      { sender: "client", body: "I didn't forget as much as I thought." },
      { sender: "coach", body: "That's usually how it goes. The fear is bigger than the reality almost every time." },
      { sender: "client", body: "Yes! Can we do another one before my real interview?" },
      { sender: "coach", body: "Absolutely, let's schedule one for next week." },
      { sender: "client", body: `Thank you. Also I have a question about "will" vs "going to".` },
      { sender: "coach", body: `Good question — quick version: "going to" for plans you already decided, "will" for decisions you're making right now or predictions.` },
      { sender: "client", body: `So "I am going to apply next month" because I already decide?` },
      { sender: "coach", body: `Exactly right, and small fix: "already decided" not "decide" there. But the going to / will choice was perfect.` },
      { sender: "client", body: `Okay! I will practice that this week — wait, is "will" correct there?` },
      { sender: "coach", body: "Yes! You're deciding that right now, so \"will\" fits perfectly." },
      { sender: "client", body: "Haha okay, I think I'm starting to feel this one." },
      { sender: "coach", body: "That's exactly what it should feel like eventually — a feeling, not a rule you're calculating." },
      { sender: "client", body: "Can we review my resume language too sometime?" },
      { sender: "coach", body: "Yes, let's spend 10 minutes on it in our next session." },
      { sender: "client", body: "Thank you so much." },
      { sender: "coach", body: "Of course. You're doing really well, Priya." },
      { sender: "client", body: "That means a lot, thank you." },
      { sender: "coach", body: "See you next week for the mock interview." },
      { sender: "client", body: "See you then!" },
    ],
  };

  let totalSeeded = 0;
  for (const direct of directConversations) {
    const thread = threads[direct.clientId];
    if (!thread) continue;

    const rows = thread.map((turn, index) => ({
      conversation_id: direct.conversationId,
      sender_id: turn.sender === "coach" ? coachId : direct.clientId,
      sender_role: turn.sender,
      body: turn.body,
      client_request_id: `seed-dm-${direct.clientId}-${String(index + 1).padStart(2, "0")}`,
    }));

    const { error } = await supabase
      .from("messages")
      .upsert(rows, { onConflict: "conversation_id,client_request_id" });
    if (error) throw error;
    totalSeeded += rows.length;
  }

  console.log(`Seeded ${totalSeeded} direct messages across ${directConversations.length} 1-on-1 conversations.`);
}

/** Adds an idempotent image-only message for checking the three-image gallery locally. */
async function seedThreeImageMessage(
  directConversations: DirectConversation[],
  clientId: string,
): Promise<void> {
  const direct = directConversations.find((conversation) => conversation.clientId === clientId);
  if (!direct) return;

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .upsert(
      {
        conversation_id: direct.conversationId,
        sender_id: clientId,
        sender_role: "client",
        body: "",
        client_request_id: "seed-dm-three-image-gallery",
      },
      { onConflict: "conversation_id,client_request_id" },
    )
    .select("id")
    .single();
  if (messageError || !message) throw messageError;

  const fixtures = [
    "UklGRhIAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
    "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
    "UklGRkoAAABXRUJQVlA4ID4AAADQAgCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA/v56QAAAAA==",
  ].map((fixture) => Buffer.from(fixture, "base64"));

  const attachments = [];
  for (let index = 0; index < fixtures.length; index += 1) {
    const imageNumber = index + 1;
    const image = fixtures[index]!;
    const rootPath = `${direct.conversationId}/seed-three-image-gallery/${imageNumber}`;
    const displayPath = `${rootPath}/display.webp`;
    const thumbnailPath = `${rootPath}/thumbnail.webp`;

    for (const path of [displayPath, thumbnailPath]) {
      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(path, image, { contentType: "image/webp", upsert: true });
      if (uploadError) throw uploadError;
    }

    attachments.push({
      id: `33000000-0000-4000-8000-${String(imageNumber).padStart(12, "0")}`,
      conversation_id: direct.conversationId,
      message_id: message.id,
      uploader_id: clientId,
      kind: "image",
      status: "ready",
      client_upload_id: `seed-three-image-gallery-${imageNumber}`,
      position: index,
      staging_path: `${rootPath}/staging.webp`,
      display_path: displayPath,
      thumbnail_path: thumbnailPath,
      original_name: `gallery-sample-${imageNumber}.webp`,
      source_mime_type: "image/webp",
      stored_mime_type: "image/webp",
      source_byte_size: image.byteLength,
      stored_byte_size: image.byteLength,
      width: 1,
      height: 1,
      expires_at: "2126-01-01T00:00:00.000Z",
    });
  }

  const { error: attachmentError } = await supabase
    .from("message_attachments")
    .upsert(attachments, { onConflict: "uploader_id,client_upload_id" });
  if (attachmentError) throw attachmentError;

  console.log("Seeded a three-image gallery message in the first client conversation.");
}

type CommunitySeedMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "client" | "coach";
  body: string;
  client_request_id: string;
  created_at: string;
  sticker_id?: ChatStickerId;
  pinned_at?: string | null;
  pinned_by?: string | null;
};

function communityMessageBody(
  channelSlug: string,
  index: number,
  senderName: string,
  searchUsername: string,
): string {
  if (channelSlug === "general") {
    const fixtures = [
      "Welcome to the general channel! Share a question, a small win, or something you want help saying.",
      `Search target https://example.com @${searchUsername}`,
      "Search target plain",
      "Does anyone have tips for phone calls? They move quickly and I sometimes lose the thread.",
      "Small win: I asked a follow-up question in a meeting today.",
      "I used ‘Let me rephrase that’ instead of starting my explanation again.",
      "How would you make this status update sound calmer and clearer?",
      "Today I paused before answering instead of translating every word first.",
      "Reminder that simple words are professional when they make the message clear.",
      "What phrase helps when you need someone to repeat a question?",
    ];
    return `${fixtures[index % fixtures.length]}${index < fixtures.length ? "" : ` — ${senderName}`}`;
  }

  if (channelSlug === "introductions") {
    const roles = [
      "software developer",
      "project coordinator",
      "data analyst",
      "product designer",
      "customer support specialist",
    ];
    const goals = [
      "speaking more clearly in meetings",
      "writing shorter workplace messages",
      "feeling calmer during phone calls",
      "asking follow-up questions",
      "preparing for interviews",
    ];

    if (index % 2 === 1) {
      return "Welcome! It is good to have you here.";
    }

    return `Hi, I’m ${senderName}. I work as a ${roles[index % roles.length]}, and I’m practicing ${goals[index % goals.length]}.`;
  }

  if (channelSlug === "announcements") {
    const announcements = [
      "Community coaching hours are posted for this week.",
      "The next group practice session will focus on concise meeting updates.",
      "There is no live session on Thursday; the regular schedule resumes Monday.",
      "A new workplace phrasing guide is available in the community resources.",
      "Friday’s optional practice room will stay open for 30 minutes.",
      "This week’s coach prompt is about asking for clarification calmly.",
      "The monthly community check-in is scheduled for next Tuesday.",
      "Coaches will answer submitted workplace-language questions tomorrow.",
      "The interview practice room has moved to Wednesday afternoon.",
      "Today’s session notes are now available for anyone who could not attend.",
    ];
    return announcements[index % announcements.length];
  }

  const fixturesByChannel: Record<string, string[]> = {
    "small-wins": [
      "{name} asked one clear follow-up question in today’s meeting.",
      "{name} sent a workplace message without translating it first.",
      "{name} paused, found a simpler word, and kept speaking.",
      "{name} gave a concise stand-up update this morning.",
      "{name} asked for clarification instead of guessing.",
    ],
    "how-do-i-say-this": [
      "How do I say that I need one more day without sounding defensive?",
      "What is a calm way to ask someone to repeat the last point?",
      "How can I disagree with this idea while keeping the message warm?",
      "What is a concise way to explain that I am blocked?",
      "How do I ask my manager which task is most important today?",
    ],
    "meeting-prep": [
      "My main update is: the draft is ready, and I need feedback on one section.",
      "I want to ask: what outcome should we prioritize this week?",
      "My opening sentence is: I found the cause and I am testing the fix now.",
      "I need to explain one risk: the current timeline leaves little review time.",
      "My closing question is: who should I send the revised version to?",
    ],
    "tone-check": [
      "Could you check whether this sounds clear and warm: I can finish this tomorrow.",
      "Does this sound too direct: I need the final numbers before I continue?",
      "Is this professional: I have a different view and would like to explain why?",
      "Can you soften this message: Please confirm which version is current.",
      "Does this sound calm: I may have misunderstood the last instruction?",
    ],
    "after-the-meeting": [
      "One part that felt clear was the project update at the beginning.",
      "I lost the thread when the topic changed quickly near the end.",
      "Next time I want to ask for a short pause before answering.",
      "I understood the decision, but I am still unsure who owns the next step.",
      "A phrase that helped today was: let me check that I understood.",
    ],
    "words-from-work": [
      "Today’s phrase is ‘circle back,’ which means return to a topic later.",
      "‘Heads-up’ is a short advance notice about something important.",
      "A ‘blocker’ is something preventing work from moving forward.",
      "‘Take this offline’ means discuss it separately after the current meeting.",
      "‘On my radar’ means I know about it and am keeping it in mind.",
    ],
    "quiet-practice": [
      "Today I am practicing one sentence: I need a moment to think.",
      "My short update: the first part is complete, and the second is in review.",
      "A useful question for me: could you give me an example?",
      "My repair phrase today: let me say that a different way.",
      "One sentence I want to say slowly: the deadline has not changed.",
    ],
    "ask-a-coach": [
      "Why do I forget familiar words when someone asks me a question suddenly?",
      "How can I practice speaking without turning it into another large task?",
      "When should I correct a grammar mistake and when should I keep talking?",
      "What can I say when I need more time to answer in a meeting?",
      "How can I make my written updates shorter without leaving out context?",
    ],
    "communication-repairs": [
      "I may have explained that unclearly. Let me try one more time.",
      "I think I misunderstood your question. Are you asking about the timeline?",
      "That was not the word I meant. I was referring to the earlier version.",
      "Let me check that I understood: you need the draft by Wednesday.",
      "I missed the last part. Could you repeat it a little more slowly?",
    ],
    "returning-today": [
      "{name} is back today and starting with one small message.",
      "Welcome back, {name}. Nothing needs to be caught up all at once.",
      "{name} returned after a break and joined the conversation again.",
      "Today is a fresh visit for {name}, with no streak to repair.",
      "{name} is easing back in by reading one useful discussion.",
    ],
    "celebrate-someone": [
      "{name} helped make a confusing phrase easier to understand.",
      "Thank you to {name} for asking the question others were wondering about.",
      "{name} gave thoughtful, calm feedback to another community member.",
      "Celebrating {name} for trying a difficult workplace conversation.",
      "{name} welcomed someone back without making the gap feel important.",
    ],
    "coworker-culture": [
      "When someone says ‘interesting,’ context and tone may show whether they agree.",
      "‘Do you have a minute?’ often introduces a short request, not exactly sixty seconds.",
      "A request phrased as ‘Could we revisit this?’ usually means the topic is still open.",
      "Small talk before a meeting can be a transition, not a test of fluency.",
      "‘Let’s park that’ usually means save the topic for later, not reject it forever.",
    ],
  };
  const fixtures = fixturesByChannel[channelSlug];
  if (!fixtures) throw new Error(`No message fixtures for #${channelSlug}`);
  return fixtures[index % fixtures.length].replaceAll("{name}", senderName);
}

async function seedCommunityChannels(
  coachId: string,
  coach2Id: string,
  clientIds: string[],
  extraIds: string[],
): Promise<void> {
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", [coachId, coach2Id, ...clientIds, ...extraIds]);
  if (profileError) throw profileError;

  const participants = (profiles ?? []).map((profile) => ({
    id: profile.id,
    name: profile.display_name,
    role: profile.id === coachId || profile.id === coach2Id ? "coach" as const : "client" as const,
  }));
  const clientParticipants = participants.filter((participant) => participant.role === "client");
  const coachParticipants = participants.filter((participant) => participant.role === "coach");
  const searchUsername =
    profiles?.find((profile) => profile.id === clientIds[0])?.username ?? "client1";

  for (let channelIndex = 0; channelIndex < communityChannelSeeds.length; channelIndex += 1) {
    const channel = communityChannelSeeds[channelIndex];
    if (!channel) continue;

    const start = Date.UTC(2026, 5, 1 + channelIndex * 7, 8, 0, 0);
    const rows: CommunitySeedMessage[] = Array.from({ length: 100 }, (_, index) => {
      const introductionAuthor = clientParticipants[Math.floor(index / 2) % clientParticipants.length];
      const introductionCoach = coachParticipants[index % coachParticipants.length];
      const defaultAuthor = participants[index % participants.length];
      const author = channel.slug === "announcements"
        ? coachParticipants[index % coachParticipants.length]
        : channel.slug === "introductions"
          ? index % 2 === 0 ? introductionAuthor : introductionCoach
          : defaultAuthor;
      if (!author) throw new Error(`No seed author available for ${channel.slug}`);

      const createdAt = new Date(start + index * 45 * 60 * 1000).toISOString();
      const stickerId = index === 12
        ? chatStickerIds[channelIndex % chatStickerIds.length]
        : undefined;
      return {
        id: `${channel.id.slice(0, 8)}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        conversation_id: channel.conversationId,
        sender_id: author.id,
        sender_role: author.role,
        body: stickerId
          ? ""
          : communityMessageBody(channel.slug, index, author.name, searchUsername),
        client_request_id: `seed-${channel.slug}-${String(index + 1).padStart(3, "0")}`,
        created_at: createdAt,
        ...(stickerId ? { sticker_id: stickerId } : {}),
        ...(channel.slug === "general" && index === 1
          ? { pinned_at: createdAt, pinned_by: coachId }
          : {}),
      };
    });

    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", channel.conversationId);
    if (deleteError) throw deleteError;

    const { error: messageError } = await supabase.from("messages").insert(rows);
    if (messageError) throw messageError;

    const reactionRows = buildSeedReactionRows({
      conversationId: channel.conversationId,
      messages: rows,
      users: participants.map((participant) => participant.id),
      seed: `fish-${channel.slug}-channel-reactions`,
    });
    const reactedMessageCount = new Set(reactionRows.map((reaction) => reaction.message_id)).size;
    if (reactedMessageCount === rows.length) {
      throw new Error(`${channel.slug} seed must include messages without reactions`);
    }

    if (reactionRows.length > 0) {
      const { error: reactionError } = await supabase
        .from("message_reactions")
        .insert(reactionRows);
      if (reactionError) throw reactionError;
    }

    console.log(
      `Seeded ${rows.length} #${channel.slug} messages; ${reactedMessageCount} have reactions and ${rows.length - reactedMessageCount} have none.`,
    );
  }
}

async function main(): Promise<void> {
  await syncLocalFeatureFlags();

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

  // Community-only cast (never assigned via coach_clients — see communityExtras comment above).
  const extraIds: string[] = [];
  for (const extra of communityExtras) {
    extraIds.push(await upsertUser(extra.email, extra.password, extra.displayName));
  }

  const directConversations = await seedChatConversations(coachId, coach2Id, clientIds, extraIds);
  await seedDirectMessages(coachId, directConversations, {
    alex: clientIds[0],
    sam: clientIds[1],
    priya: clientIds[2],
  });
  await seedThreeImageMessage(directConversations, clientIds[0]);
  await seedCommunityChannels(coachId, coach2Id, clientIds, extraIds);

  console.log("\nSeed complete. Dev credentials (local only):");
  console.log(`  Coach: ${coach.email} / ${coach.password}`);
  console.log(`  Coach (unassigned): ${coach2.email} / ${coach2.password}`);
  for (const client of clients) {
    console.log(`  Client: ${client.email} / ${client.password}`);
  }
  for (const extra of communityExtras) {
    console.log(`  Community member (unassigned): ${extra.email} / ${extra.password}`);
  }
  console.log(`\nCoach id: ${coachId}`);
  console.log(`Coach2 id (unassigned): ${coach2Id}`);
  console.log(`Client ids: ${clientIds.join(", ")}`);
  console.log(`Demo community conversation id: ${demoCommunityConversationId}`);
  console.log(`Friends feature: ${friendsEnabled ? "enabled" : "disabled"}`);
}

await main();
