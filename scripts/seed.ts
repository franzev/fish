// Idempotent local dev seed (D-10, D-11): creates one coach + ~3 pre-verified clients
// through the real Supabase Auth admin API, never a raw SQL insert against the managed
// auth schema, so the DB-01 handle_new_user trigger fires exactly as it does for a real
// signup. Fixed, documented dev credentials — local only, never run against production
// (see docs/deploy-checklist.md).
import { createClient } from "@supabase/supabase-js";
import { buildSeedReactionRows } from "./seed-reaction-randomizer.ts";

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
// exist purely to give the general channel a believable cast of real names instead of
// generic, hard-to-tell-apart placeholders — each one is added to the demo conversation's
// message_reads below so the "demo community members read room profiles" RLS policy
// (0014) lets every viewer resolve their display name instead of falling back to "Member".
const communityExtras = [
  { email: "member1@fish.dev", password: "fish-client-dev", displayName: "Beef Patty" },
  { email: "member2@fish.dev", password: "fish-client-dev", displayName: "Renata Souza" },
  { email: "member3@fish.dev", password: "fish-client-dev", displayName: "Kenji Watanabe" },
  { email: "member4@fish.dev", password: "fish-client-dev", displayName: "Amara Chukwu" },
];

const reactionStressUserCount = 3000;
const reactionStressPassword = "fish-reaction-dev";

const demoCommunityConversationId = "11111111-1111-4111-8111-111111111111";

// Fixed id matching the 0016_channels migration seed — the "general" channel is a
// thin naming layer over the demo community conversation, upserted here because a
// fresh `db reset` runs migrations before any profiles exist (the migration's
// guarded insert no-ops in that case).
const generalChannelId = "22222222-2222-4222-8222-222222222222";

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

async function ensureReactionStressUsers(): Promise<string[]> {
  const existingByEmail = new Map<string, string>();
  let page = 1;
  const perPage = 1000;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) existingByEmail.set(user.email, user.id);
    }
    if (data.users.length === 0) break;
    page += 1;
  }

  const users: string[] = [];
  for (let index = 1; index <= reactionStressUserCount; index += 1) {
    const padded = String(index).padStart(4, "0");
    const email = `reaction-${padded}@fish.dev`;
    const existingId = existingByEmail.get(email);
    if (existingId) {
      users.push(existingId);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: reactionStressPassword,
      email_confirm: true,
      user_metadata: { display_name: `Reaction tester ${padded}` },
    });
    if (error) throw error;
    users.push(data.user.id);
  }

  console.log(`Ensured ${users.length} reaction stress users.`);
  return users;
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

  const demoClientId = clientIds[0];
  if (!demoClientId) {
    return directConversations;
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

  const { error: generalChannelError } = await supabase
    .from("channels")
    .upsert(
      {
        id: generalChannelId,
        slug: "general",
        name: "general",
        conversation_id: demoConversation.id,
      },
      { onConflict: "id" },
    );
  if (generalChannelError) throw generalChannelError;

  const demoReadRows = [coachId, coach2Id, ...clientIds, ...extraIds].map((userId) => ({
    conversation_id: demoConversation.id,
    user_id: userId,
    last_read_message_id: null,
  }));

  const { error: demoReadStateError } = await supabase
    .from("message_reads")
    .upsert(demoReadRows, { onConflict: "conversation_id,user_id" });
  if (demoReadStateError) throw demoReadStateError;

  const { error: channelMemberError } = await supabase
    .from("channel_members")
    .upsert(
      demoReadRows.map((row) => ({
        channel_id: generalChannelId,
        user_id: row.user_id,
      })),
      { onConflict: "channel_id,user_id" },
    );
  if (channelMemberError) throw channelMemberError;

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

/** Stable fixtures used by chat-search integration and Playwright coverage. */
async function seedSearchFilterMessages(
  coachId: string,
  clientId: string,
): Promise<void> {
  const { data: clientProfile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", clientId)
    .single();
  if (profileError || !clientProfile) throw profileError;

  const { error } = await supabase.from("messages").upsert(
    [
      {
        id: "90000000-0000-4000-8000-000000000001",
        conversation_id: demoCommunityConversationId,
        sender_id: coachId,
        sender_role: "coach",
        body: `Search target https://example.com @${clientProfile.username}`,
        client_request_id: "search-filter-fixture-1",
        pinned_at: "2026-07-11T10:00:00.000Z",
        pinned_by: coachId,
        created_at: "2026-07-11T10:00:00.000Z",
      },
      {
        id: "90000000-0000-4000-8000-000000000002",
        conversation_id: demoCommunityConversationId,
        sender_id: clientId,
        sender_role: "client",
        body: "Search target plain",
        client_request_id: "search-filter-fixture-2",
        created_at: "2026-07-12T10:00:00.000Z",
      },
    ],
    { onConflict: "id" },
  );
  if (error) throw error;
}

/**
 * Real, long-form community discussion posts for the general channel (QAG-seed).
 * Inserted directly into public.messages via the service-role client — bypasses
 * the send_chat_message RPC on purpose, since that RPC requires a real
 * auth.uid() session the service-role client never has (T-qag-01: local-only,
 * documented, no new key exposure). Each body respects the messages CHECK
 * constraints (non-blank, <=4000 chars) and every sender_role below matches
 * the identity's real seeded role (T-qag-02).
 */
async function seedCommunityMessages(
  coachId: string,
  coach2Id: string,
  clientIds: string[],
  extraIds: string[],
): Promise<void> {
  const welcome = `Welcome to the general channel! This is where we share wins, ask questions, and practice writing in a low-pressure space. Say hello and tell us one thing you're working on this week.`;

  const alexIntro = `Hi everyone, I'm Alex. This week I'm working on past tense verbs for my job interviews.`;

  const countableTip = `Quick tip from today's session: when you're not sure if a word is _count_ or _non-count_, ask "can I say 'many' in front of it?" If yes, it's countable. **Many advices** sounds wrong because "advice" is non-count — you'd say "a lot of advice" instead. It's a *tiny* rule but it comes up constantly in status updates.`;

  const emailTip = `If you want to check your writing before you send an email, try reading it out loud first. It catches missing words that your eyes skip over. Also \`Ctrl+Shift+E\` opens the built-in spell checker in most editors, if that helps.

Here's a link to a short article on email tone: [Keeping work email calm and clear](https://example.com/calm-email-tone)`;

  const goodEnoughEssay = `> "I used to think I had to sound perfect before I could speak up in meetings. Turns out being understood matters way more than being flawless."

That's a note one of you sent me privately, and I wanted to share it here (with permission) because so many of us carry that same fear. So here's a longer post on it.

# Why "good enough" English is the actual goal

A lot of the professionals I coach are already excellent at their jobs. The English isn't the blocker to being competent — it's the blocker to being *heard*. Those are different problems, and they need different fixes.

## The three things that actually move the needle

1. **Clarity over correctness.** A grammatically imperfect sentence that's easy to follow beats a "correct" one that's tangled. If your listener has to replay your sentence in their head, that's the bug to fix — not the missing article.
2. **Pace, not vocabulary.** Most miscommunication in meetings isn't a vocabulary gap. It's speed. Slowing down by even 10% gives your brain time to retrieve the right word and gives the listener time to process it.
3. **Repair phrases.** Having 3-4 go-to phrases for "let me say that differently" or "what I mean is" removes the panic when a sentence doesn't land. You're not failing — you're repairing, which is a completely normal part of any conversation, in any language.

### A small script you can steal

Here's a fenced snippet with three repair phrases I ask every client to memorize this week:

\`\`\`text
1. "Let me put that another way."
2. "Sorry, what I mean is..."
3. "I'll come back to that in a second."
\`\`\`

None of these are apologies for your English. They're just normal conversational tools that native speakers use constantly — you're just using them on purpose instead of by accident.

## What this looks like day to day

- Before a meeting: write down the one sentence you most want to land, and practice saying it slowly, twice.
- During the meeting: if you lose the thread, use one of the three repair phrases above instead of going silent.
- After the meeting: don't replay every sentence you said. Replay whether the *message* landed. That's the only metric that matters here.

If this resonates, reply with which of the three points feels hardest right now — pace, clarity, or repair phrases — and we'll dig into that one together this week.

## One more thing worth naming

A lot of you have told me, in one-on-one sessions, that you assume everyone else in a meeting is silently judging your grammar. In four years of coaching, I have never once had a client's manager bring up grammar as a concern. Not once. The feedback I hear about, over and over, is about confidence, pacing, and whether someone spoke up at all — never about a missing article or a wrong preposition.

That doesn't mean grammar doesn't matter. It means it matters far less than the story you're telling yourself about how much it matters. Redirecting even 20% of the energy you currently spend worrying about correctness toward just *finishing your sentence at a normal pace* will change more meetings than another six months of grammar review would.

### For next week

Pick one meeting on your calendar. Before it starts, write down the single sentence you most want to say clearly. Say it out loud twice beforehand, at a pace that feels almost too slow. Then say it in the meeting at that same "too slow" pace. Report back here on how it felt — most people say it felt slower to them than it sounded to everyone else, which is exactly the calibration we're trying to build.`;

  const translatingReflection = `> Something I noticed after three months of these check-ins: I stopped translating in my head before I spoke. It just... started coming out in English first.

I wanted to write this down somewhere because I almost didn't notice it happening, and I think other people here might be close to the same shift without realizing it.

## Where I started

Six months ago I would draft every important Slack message in my first language, translate it, then double-check the translation before sending. A two-sentence message could take me ten minutes. Meetings were worse — I'd compose a reply in my head, translate it, and by the time it was "ready" the conversation had already moved three topics ahead. I'd either interrupt with something outdated or just stay quiet, which felt awful because I *did* have something useful to say.

## The turning point

My coach had me do a strange exercise for two weeks: narrate small everyday tasks out loud in English, alone, with no audience and no stakes. Making coffee. Walking to the train. Reading a spam email. It felt silly at first — genuinely, I almost skipped it. But something about removing the social pressure let my brain build the habit of *thinking* in English for low-stakes moments, which turned out to be the actual bottleneck, not vocabulary or grammar.

## What changed at work

1. Slack messages that used to take ten minutes now take one or two.
2. In standups, I catch myself mid-sentence instead of going silent when a word doesn't come immediately — I just pause, say "let me rephrase," and keep going.
3. I laughed at an actual joke in a meeting for the first time last week, in real time, not two seconds late once I'd finished translating it.

None of this means my English is "perfect" — it isn't, and it doesn't need to be. It means the *effort* moved from translation to just communicating, and that's the part that was draining me.

If you're in the translating-in-your-head stage right now: it is temporary, even though it doesn't feel that way. Keep doing the small, low-stakes practice your coach gives you. It compounds quietly and then one day you notice it's gone.

## Why I think the "silly" exercise actually worked

I've thought about this a lot since, and I think the narrating-out-loud exercise worked precisely *because* it was silly and low-stakes. Every other time I used English, there was an audience, a deadline, or a judgment attached to it — a manager reading my message, a teammate waiting for my answer, an interviewer evaluating me. My brain treated every single use of English as a small performance review, which is exhausting and, it turns out, exactly the wrong condition for building a new automatic habit.

Narrating my coffee routine had zero stakes. Nobody was listening. Nothing depended on it. That let my brain build the "think first in English" pathway without also fighting a stress response at the same time. Once the pathway existed for low-stakes situations, it was just... there, waiting, when a real meeting needed it.

### If you want to try this yourself

- Pick one small daily routine (making tea, tidying your desk, walking somewhere familiar).
- Narrate it out loud in English, alone, for two minutes.
- Do it for two weeks before you judge whether it's "working."
- Don't correct yourself mid-sentence. Let it be messy. Nobody is listening, and that's the entire point.

It felt pointless for the first several days. I almost quit twice. I'm glad I didn't.`;

  const phrasingSwaps = `A few small phrasing swaps that make requests sound calmer without changing the meaning:

- Instead of "You need to send this today" -> "Could you send this today?"
- Instead of "This is wrong" -> "I think there might be a small issue here"
- Instead of "I don't understand" -> "Could you say that a different way?"

Try one of these in a real message this week and see how it feels.`;

  const homework = `Homework for anyone who wants it before Friday's session:

1. Record yourself explaining your current project in 60 seconds
2. Listen back once, no judging, just notice
3. Pick one sentence you'd like to say more smoothly
4. Practice just that one sentence five times

That's it. Small and specific beats big and vague every time.`;

  const congrats = `Congrats to everyone who did a mock interview this week. That takes real courage regardless of the language you're doing it in.`;

  const grammarDrillsEssay = `Someone asked me privately why we don't do grammar drills in these sessions, so posting the answer here since it probably helps more than one person.

# Why we skip most grammar drills

Grammar drills test whether you can *recognize* a correct sentence sitting still with time to think. Real conversations never give you that. You need the sentence to come out while someone is looking at you, waiting, and the clock is running. Those are two different skills, and drilling one barely transfers to the other.

## What we do instead

- **Roleplay under mild time pressure.** Not to stress anyone out — just enough pressure to simulate a real meeting, so the skill you build is the one you'll actually use.
  - Two-minute impromptu explanations of your current project
  - A single "difficult conversation" reenacted with a partner
- **Error tolerance training.** We practice noticing a mistake, deciding it's not worth stopping for, and continuing. This is the single highest-leverage skill for fluency and it's almost never taught.
- **Real content, not textbook sentences.** You practice explaining *your* actual project, *your* actual disagreement with a coworker, *your* actual question for your manager. Textbook sentences don't stick because there's no real stake attached to them.

## A quick example

Textbook drill: "Fill in the blank: She ___ (go) to the office yesterday."
Real practice: "Tell me about the last time a meeting went badly for you, and what you'd do differently."

The second one is harder, messier, and infinitely more useful. You'll make more mistakes doing it — and that's the point. Every mistake you make in a low-stakes practice room is one you won't make for the first time in a real, high-stakes meeting.

If you want more of this style of practice between sessions, reply here and I'll put together a short list of prompts you can run through on your own.

## One caution about error tolerance

The hardest part of this approach for most people isn't the practice itself — it's giving yourself permission to keep talking after you notice a mistake. Every client I've worked with has, at some point, stopped mid-sentence to go back and "fix" a small grammar slip that nobody else even registered. That pause is usually far more noticeable, and far more disruptive to the flow of a conversation, than the original mistake ever was.

So the actual skill isn't "make fewer mistakes." It's "notice a mistake, briefly decide it doesn't matter, and keep your sentence moving forward." That's a decision you can practice on purpose, the same way you'd practice any other habit — small reps, low stakes, repeated often enough that it becomes automatic under real pressure.

### A short drill for this specific skill

\`\`\`text
1. Say any sentence out loud, on purpose making one small error.
2. Notice it.
3. Keep talking for one more sentence without correcting it.
4. Repeat with a new sentence.
\`\`\`

It feels strange the first few times — you're deliberately doing something "wrong" and then not fixing it. That discomfort is exactly the muscle we're training. Try it for five minutes before our next session and let's talk about how it felt.`;

  const noSessionReminder = `Reminder: no session Thursday this week, back to normal schedule next Monday.`;

  const wrapUpChecklist = `Wrapping up the week — here's a tiny code-style checklist some of you asked for, for writing calm, clear status updates:

\`\`\`text
- What I did
- What's blocked (if anything)
- What I need from someone else (if anything)
\`\`\`

Three lines. That's the whole template. No need to write more than that unless the situation truly needs it.`;

  // Shorter, ordinary chat turns (D-seed-02) from a wider cast — including the community-only
  // extras — so the channel reads like a real, busy room instead of a handful of essays.
  const [beefPatty, renata, kenji, amara] = extraIds;

  const shortRows = [
    { sender_id: beefPatty, sender_role: "client", body: "Hi everyone! I'm Beef Patty, new here. Working on speaking up more in group meetings." },
    { sender_id: coachId, sender_role: "coach", body: "Welcome, Beef Patty! Great to have you." },
    { sender_id: renata, sender_role: "client", body: "Hi all, excited to be here." },
    { sender_id: clientIds[1], sender_role: "client", body: "Welcome Renata!" },
    { sender_id: beefPatty, sender_role: "client", body: "Quick win: I asked a follow-up question in a meeting today instead of staying quiet." },
    { sender_id: coach2Id, sender_role: "coach", body: "That's a great win, congrats!" },
    { sender_id: kenji, sender_role: "client", body: "Does anyone have tips for phone calls? They're the hardest for me." },
    { sender_id: coachId, sender_role: "coach", body: "Great question — I'll write a longer post on this soon. Short version: it's completely normal to ask someone to repeat themselves once." },
    { sender_id: clientIds[2], sender_role: "client", body: "Phone calls are hard for me too, you're not alone." },
    { sender_id: amara, sender_role: "client", body: "Just joined, hello everyone." },
    { sender_id: beefPatty, sender_role: "client", body: "Welcome Amara!" },
    { sender_id: clientIds[0], sender_role: "client", body: "Anyone else practicing for interviews this week?" },
    { sender_id: renata, sender_role: "client", body: "Yes! Good luck to everyone." },
    { sender_id: coachId, sender_role: "coach", body: "Good luck to everyone with interviews this week — you're more ready than you feel." },
    { sender_id: clientIds[1], sender_role: "client", body: "Small win: answered a question in standup without translating first." },
    { sender_id: coach2Id, sender_role: "coach", body: "Love that. That's exactly the goal." },
    { sender_id: kenji, sender_role: "client", body: "How long did it take people to feel comfortable speaking up in meetings?" },
    { sender_id: coachId, sender_role: "coach", body: "It's different for everyone, but most people notice a real shift around two to three months of consistent small practice." },
    { sender_id: clientIds[2], sender_role: "client", body: "For me it was around two months." },
    { sender_id: beefPatty, sender_role: "client", body: "Still working on it here, but definitely improving." },
    { sender_id: amara, sender_role: "client", body: "This channel already feels supportive, thank you all." },
    { sender_id: coach2Id, sender_role: "coach", body: "That's exactly what we want it to be." },
    { sender_id: clientIds[0], sender_role: "client", body: "Does anyone want to practice mock interviews together sometime?" },
    { sender_id: renata, sender_role: "client", body: "I'd be up for that." },
    { sender_id: beefPatty, sender_role: "client", body: "Me too!" },
    { sender_id: coachId, sender_role: "coach", body: "Love this idea — I'll set up an optional group practice slot next week." },
    { sender_id: clientIds[1], sender_role: "client", body: "Count me in." },
    { sender_id: kenji, sender_role: "client", body: "Same here, sign me up." },
  ];

  const rows = [
    { sender_id: coachId, sender_role: "coach", body: welcome, client_request_id: "seed-msg-01" },
    { sender_id: clientIds[0], sender_role: "client", body: alexIntro, client_request_id: "seed-msg-02" },
    { sender_id: coachId, sender_role: "coach", body: countableTip, client_request_id: "seed-msg-03" },
    { sender_id: coach2Id, sender_role: "coach", body: emailTip, client_request_id: "seed-msg-04" },
    { sender_id: coachId, sender_role: "coach", body: goodEnoughEssay, client_request_id: "seed-msg-05" },
    { sender_id: clientIds[1], sender_role: "client", body: translatingReflection, client_request_id: "seed-msg-06" },
    { sender_id: coach2Id, sender_role: "coach", body: phrasingSwaps, client_request_id: "seed-msg-07" },
    { sender_id: coachId, sender_role: "coach", body: homework, client_request_id: "seed-msg-08" },
    { sender_id: clientIds[2], sender_role: "client", body: congrats, client_request_id: "seed-msg-09" },
    { sender_id: coachId, sender_role: "coach", body: grammarDrillsEssay, client_request_id: "seed-msg-10" },
    { sender_id: coach2Id, sender_role: "coach", body: noSessionReminder, client_request_id: "seed-msg-11" },
    { sender_id: coachId, sender_role: "coach", body: wrapUpChecklist, client_request_id: "seed-msg-12" },
    ...shortRows.map((row, index) => ({
      ...row,
      client_request_id: `seed-msg-${String(index + 13).padStart(2, "0")}`,
    })),
  ].map((row) => ({ conversation_id: demoCommunityConversationId, ...row }));

  const { error } = await supabase
    .from("messages")
    .upsert(rows, { onConflict: "conversation_id,client_request_id" });
  if (error) throw error;

  console.log(`Seeded ${rows.length} community messages into the general channel.`);
}

/**
 * Stress-test community history for message rendering. This intentionally appends
 * to the existing hand-written seed rows instead of replacing them: the older
 * seed data stays readable, while this deterministic set gives the chat UI
 * enough volume and edge cases to exercise grouping, dates, replies, edits,
 * deletes, reactions, and the small markdown renderer.
 */
async function seedCommunityStressMessages(
  coachId: string,
  coach2Id: string,
  clientIds: string[],
  extraIds: string[],
): Promise<void> {
  const participants = [
    { id: coachId, role: "coach", name: "Patty Cake" },
    { id: coach2Id, role: "coach", name: "Coach Jordan" },
    { id: clientIds[0], role: "client", name: "Alex" },
    { id: clientIds[1], role: "client", name: "Sam" },
    { id: clientIds[2], role: "client", name: "Priya" },
    { id: extraIds[0], role: "client", name: "Beef Patty" },
    { id: extraIds[1], role: "client", name: "Renata" },
    { id: extraIds[2], role: "client", name: "Kenji" },
    { id: extraIds[3], role: "client", name: "Amara" },
  ].filter((participant) => participant.id);

  const dayVolumes = [
    4, 3, 52, 7, 41, 2, 65, 8, 36, 5, 72, 3, 58, 6, 49,
    2, 80, 9, 34, 4, 61, 7, 45, 3, 69, 6, 37, 5, 59, 56,
  ];

  const shortBodies = [
    "Yes.",
    "Got it",
    "Same here",
    "Thank you",
    "Makes sense",
    "Will try",
    "Tiny win",
    "I agree",
    "Good point",
    "Noted",
    "Helpful",
    "Love this",
    "Me too",
    "Okay",
    "Clear now",
    "Almost there",
  ];

  const mediumBodies = [
    "I practiced the repair phrase twice today. It felt awkward, but I stayed in the conversation instead of going quiet.",
    "Phone calls still feel fast for me. I can understand the first sentence, then I lose the thread when the topic changes.",
    "I used the calmer request wording in a Slack message today, and my teammate replied quickly. Small but nice.",
    "Could we practice explaining blockers next week? I know the technical details, but I freeze when I need to summarize them.",
    "I noticed I write much more clearly when I start with the action first. The context can come after that.",
    "My meeting update was shorter today. I said what changed, what is blocked, and what I need next.",
    "The two-minute narration exercise is starting to feel less strange. I caught myself thinking in English while making coffee.",
    "I still mix up \"I worked\" and \"I have worked\" when I am nervous. Seeing examples in real messages helps.",
    "Today I asked someone to repeat the question instead of pretending I understood. That was a good moment.",
    "I want to sound natural, but I also want to stop over-editing every sentence. That balance is hard.",
  ];

  const longBodies = [
    `I tried the meeting sentence exercise today.

Before the call, I wrote one sentence I wanted to land clearly. I said it out loud twice, slowly, and then used almost the same sentence in the meeting.

It felt too slow in my head, but nobody seemed impatient. I actually think they understood me faster because I did not rush.`,
    `Longer reflection from this week:

I thought my main problem was vocabulary, but I am starting to think the bigger problem is panic. When I feel calm, I can explain most things with simple words. When I feel watched, even easy sentences disappear.

So this week I am practicing one boring skill: pausing for one second before I answer. Not a dramatic pause, just enough time to choose the first word instead of grabbing the first translation.`,
    `Something clicked for me in the mock interview.

The interviewer asked about a project that failed, and normally I would try to make the answer sound impressive. This time I made it clear instead:

- what happened
- what I learned
- what I changed afterward

It was simpler than my old answer, and honestly much better.`,
    `I want to document a small win because it was easy to miss.

Yesterday I wrote a message to my manager without drafting it in my first language first. It was not perfect, and I changed two words after reading it once, but I did not spend ten minutes translating.

That saved energy for the actual work, which is the whole point.`,
  ];

  const formattedBodies = [
    `**Win:** I answered quickly today.

*Still hard:* follow-up questions after I finish my prepared sentence.`,
    `I used \`let me rephrase that\` in a meeting and it worked 👍`,
    `> Could you say that a different way?

This phrase feels softer than "I don't understand" for me.`,
    `# Practice notes

1. Start with the outcome
2. Add one detail
3. Stop talking before I over-explain`,
    `## Nested list test

- Before the meeting
  - write one sentence
  - say it twice
- During the meeting
  - pause
  - repair if needed`,
    `Here is my tiny script:

\`\`\`text
I looked into it.
The main issue is timing.
I need one more day.
\`\`\``,
    `Mixing **bold**, *italic*, \`code\`, and emoji 🎉 in one message.`,
    `Link test: [calm email tone](https://example.com/calm-email-tone) and [mailto test](mailto:coach@fish.dev).`,
    `Literal unsupported markdown check: ~~strikethrough~~ should stay visible as text.`,
    `Table-ish text, because tables are not a supported renderer feature:

| Goal | Status |
| --- | --- |
| Speak slowly | trying |`,
  ];

  const emojiBodies = [
    "🙂",
    "🎉",
    "🙏",
    "👍",
    "I finally asked the question 🙂",
    "**Small win** 🎉",
    "Not perfect, still progress 👍",
  ];

  const edgeBodies = [
    "https://example.com",
    "a".repeat(240),
    "Line one\n\n\nLine four after empty space",
    ".",
    "@coach I tried this in #general and it stayed readable.",
    "![not rendered as an image](https://example.com/image.png)",
    "javascript link should not become clickable: [bad](javascript:alert(1))",
  ];

  const specialByIndex = new Map<number, Partial<{
    body: string;
    deleted: boolean;
    edited: boolean;
    replyTo: string;
    senderOffset: number;
  }>>();

  specialByIndex.set(24, {
    body: "This parent will be deleted, but replies should still show its placeholder.",
    deleted: true,
    senderOffset: 2,
  });
  specialByIndex.set(25, {
    body: "Replying to a deleted parent should still keep context visible.",
    replyTo: "fish-stress-message-0024",
    senderOffset: 1,
  });
  specialByIndex.set(60, {
    body: "Can several people reply to this same question?",
    senderOffset: 4,
  });
  specialByIndex.set(61, {
    body: "Yes, first reply.",
    replyTo: "fish-stress-message-0060",
    senderOffset: 5,
  });
  specialByIndex.set(62, {
    body: "Second reply from a different voice.",
    replyTo: "fish-stress-message-0060",
    senderOffset: 6,
  });
  specialByIndex.set(63, {
    body: "Third reply, keeping the thread easy to scan.",
    replyTo: "fish-stress-message-0060",
    senderOffset: 7,
  });
  specialByIndex.set(120, {
    body: "Root of a multi-level reply chain.",
    senderOffset: 0,
  });
  specialByIndex.set(121, {
    body: "Level 1 reply.",
    replyTo: "fish-stress-message-0120",
    senderOffset: 2,
  });
  specialByIndex.set(122, {
    body: "Level 2 reply that points at the previous reply.",
    replyTo: "fish-stress-message-0121",
    senderOffset: 3,
  });
  specialByIndex.set(123, {
    body: "Level 3 reply, mostly to test quote stacking behavior.",
    replyTo: "fish-stress-message-0122",
    senderOffset: 1,
  });
  specialByIndex.set(240, {
    body: "   \n\n   ",
    deleted: true,
    senderOffset: 8,
  });
  specialByIndex.set(360, {
    body: "Edited message: I cleaned up the wording after sending.",
    edited: true,
    senderOffset: 2,
  });
  specialByIndex.set(520, {
    body: "**Formatting plus emoji** with `inline code` and a calm finish 🙏",
    edited: true,
    senderOffset: 0,
  });
  specialByIndex.set(700, {
    body: "https://fish.dev",
    senderOffset: 6,
  });

  const rows: Array<{
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_role: string;
    body: string;
    client_request_id: string;
    created_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    reply_to_message_id?: string | null;
  }> = [];

  let globalIndex = 0;
  const start = Date.UTC(2026, 4, 18, 8, 0, 0);

  for (let dayIndex = 0; dayIndex < dayVolumes.length; dayIndex += 1) {
    const volume = dayVolumes[dayIndex];
    for (let dayMessageIndex = 0; dayMessageIndex < volume; dayMessageIndex += 1) {
      globalIndex += 1;
      const id = `00000000-0000-4000-8000-${String(globalIndex).padStart(12, "0")}`;
      const special = specialByIndex.get(globalIndex);
      const participant =
        participants[
          (globalIndex + dayIndex + (special?.senderOffset ?? 0)) % participants.length
        ];
      const createdAt = new Date(
        start +
          dayIndex * 24 * 60 * 60 * 1000 +
          (8 * 60 + dayMessageIndex * 7 + (dayMessageIndex % 5)) * 60 * 1000
      ).toISOString();

      let body: string;
      if (special?.body !== undefined) {
        body = special.body;
      } else if (globalIndex % 97 === 0) {
        body = longBodies[(globalIndex + dayIndex) % longBodies.length];
      } else if (globalIndex % 43 === 0) {
        body = formattedBodies[(globalIndex + dayIndex) % formattedBodies.length];
      } else if (globalIndex % 29 === 0) {
        body = edgeBodies[(globalIndex + dayIndex) % edgeBodies.length];
      } else if (globalIndex % 17 === 0) {
        body = emojiBodies[(globalIndex + dayIndex) % emojiBodies.length];
      } else if (globalIndex % 5 === 0) {
        body = mediumBodies[(globalIndex + dayIndex) % mediumBodies.length];
      } else {
        body = shortBodies[(globalIndex + dayMessageIndex) % shortBodies.length];
      }

      const deletedAt = special?.deleted
        ? new Date(new Date(createdAt).getTime() + 4 * 60 * 1000).toISOString()
        : null;
      const editedAt = special?.edited
        ? new Date(new Date(createdAt).getTime() + 5 * 60 * 1000).toISOString()
        : null;

      rows.push({
        id,
        conversation_id: demoCommunityConversationId,
        sender_id: participant.id,
        sender_role: participant.role,
        body: deletedAt ? "" : body,
        client_request_id: `seed-stress-msg-${String(globalIndex).padStart(4, "0")}`,
        created_at: createdAt,
        edited_at: editedAt,
        deleted_at: deletedAt,
        reply_to_message_id: special?.replyTo
          ? `00000000-0000-4000-8000-${special.replyTo.slice(-4).padStart(12, "0")}`
          : globalIndex > 10 && globalIndex % 31 === 0
            ? `00000000-0000-4000-8000-${String(globalIndex - 1).padStart(12, "0")}`
            : null,
      });
    }
  }

  const { error } = await supabase
    .from("messages")
    .upsert(rows, { onConflict: "conversation_id,client_request_id" });
  if (error) throw error;

  const reactionMessages: Array<{
    id: string;
    conversation_id: string;
    created_at: string;
    deleted_at: string | null;
    body: string;
  }> = [];
  const reactionMessagePageSize = 1000;
  for (let from = 0;; from += reactionMessagePageSize) {
    const { data, error: reactionMessageError } = await supabase
      .from("messages")
      .select("id, conversation_id, created_at, deleted_at, body")
      .eq("conversation_id", demoCommunityConversationId)
      .range(from, from + reactionMessagePageSize - 1);
    if (reactionMessageError) throw reactionMessageError;

    reactionMessages.push(...(data ?? []));
    if ((data ?? []).length < reactionMessagePageSize) break;
  }

  const reactionUsers = [
    ...clientIds,
    coachId,
    coach2Id,
    ...extraIds,
    ...(await ensureReactionStressUsers()),
  ].filter(Boolean);
  const reactionRows = buildSeedReactionRows({
    conversationId: demoCommunityConversationId,
    messages: reactionMessages,
    users: reactionUsers,
    seed: "fish-general-channel-reactions",
  });

  for (let startIndex = 0; startIndex < reactionMessages.length; startIndex += 100) {
    const batch = reactionMessages.slice(startIndex, startIndex + 100).map((row) => row.id);
    const { error: deleteReactionError } = await supabase
      .from("message_reactions")
      .delete()
      .in("message_id", batch);
    if (deleteReactionError) throw deleteReactionError;
  }

  for (let startIndex = 0; startIndex < reactionRows.length; startIndex += 1000) {
    const { error: reactionError } = await supabase
      .from("message_reactions")
      .upsert(reactionRows.slice(startIndex, startIndex + 1000), {
        onConflict: "message_id,user_id,emoji",
      });
    if (reactionError) throw reactionError;
  }

  console.log(
    `Seeded ${rows.length} community stress messages and ${reactionRows.length} active reactions across ${reactionMessages.length} community messages.`,
  );
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
  await seedSearchFilterMessages(coachId, clientIds[0]);
  await seedCommunityMessages(coachId, coach2Id, clientIds, extraIds);
  await seedCommunityStressMessages(coachId, coach2Id, clientIds, extraIds);

  console.log("\nSeed complete. Dev credentials (local only):");
  console.log(`  Coach: ${coach.email} / ${coach.password}`);
  console.log(`  Coach (unassigned): ${coach2.email} / ${coach2.password}`);
  for (const client of clients) {
    console.log(`  Client: ${client.email} / ${client.password}`);
  }
  for (const extra of communityExtras) {
    console.log(`  Community member (unassigned): ${extra.email} / ${extra.password}`);
  }
  console.log(
    `  Reaction stress users: reaction-0001@fish.dev through reaction-${String(reactionStressUserCount).padStart(4, "0")}@fish.dev / ${reactionStressPassword}`,
  );
  console.log(`\nCoach id: ${coachId}`);
  console.log(`Coach2 id (unassigned): ${coach2Id}`);
  console.log(`Client ids: ${clientIds.join(", ")}`);
  console.log(`Demo community conversation id: ${demoCommunityConversationId}`);
}

await main();
