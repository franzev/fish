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
  ].map((row) => ({ conversation_id: demoCommunityConversationId, ...row }));

  const { error } = await supabase
    .from("messages")
    .upsert(rows, { onConflict: "conversation_id,client_request_id" });
  if (error) throw error;

  console.log(`Seeded ${rows.length} community messages into the general channel.`);
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
  await seedCommunityMessages(coachId, coach2Id, clientIds);

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
