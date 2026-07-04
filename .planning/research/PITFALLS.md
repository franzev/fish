# Pitfalls Research

**Domain:** Coach↔client learning platform (profiles + data-driven onboarding + config-driven tracker + persistent 1-on-1 chat) on Next.js 16 / React 19 / Supabase, for a neurodivergent (ADHD) audience
**Milestone:** v1.1 The Coaching Loop (four new foundations added to a shipped v1.0 auth/RLS base)
**Researched:** 2026-07-04
**Confidence:** HIGH for RLS/SSR-auth/idempotency (Context7-adjacent official Supabase + Postgres + Next.js docs, cross-verified); MEDIUM for React 19 `useOptimistic` reconciliation edge cases (official docs + open React issue #31967); HIGH for ND-UX rules (already codified in AGENTS.md + v1.0 decisions)

Every pitfall below is tied to one of the four features and mapped to a phase. Priority order for the roadmapper: (1) data leak across coach↔client, (2) role/field escalation, (3) duplicate/lost messages, (4) silent design-rule violation.

---

## Critical Pitfalls

### Pitfall 1: New coach/client-scoped RLS policies that bare-SELECT their own table → infinite recursion, OR a `language sql` helper that gets inlined and re-applies RLS

**What goes wrong:**
Every new table in v1.1 (`onboarding_responses`, `tracker_entries`, `conversations`, `messages`, extended `profiles`) needs a policy of the form "the coach assigned to this client can read it." The naive way is an `EXISTS (select … from coach_clients …)` subquery, or worse a subquery back into the same table. Postgres detects the self-reference and throws `infinite recursion detected in policy for relation …`, or (subtler) the policy silently returns the wrong rows. The documented Supabase fix is a `SECURITY DEFINER` helper — v1.0 already ships `private.is_coach_of()` / `private.is_client_of()`. But a further gotcha: **a `LANGUAGE SQL` `SECURITY DEFINER` function can be *inlined* by the planner, and when inlined the definer context is lost and RLS re-applies → recursion returns.**

**Why it happens:**
The v1.0 helpers are `language sql`, which by default is inlinable. It looks like a landmine. **It is not, for FISH specifically** — Postgres will inline a SQL function only if it is *not* `SECURITY DEFINER` *and* has no `SET` clause on `search_path`. The v1.0 helpers are `security definer` **and** `set search_path = ''`; *either* condition alone blocks inlining, so they are safe (this is why `pnpm verify:rls` passes 8/8). The trap is a developer "cleaning up" a new helper by dropping `set search_path = ''` for brevity, or writing a new inline `exists()` directly in a policy on `messages`/`tracker_entries` instead of routing through the definer helper.

**How to avoid:**
- Reuse the existing `private.is_coach_of(client_uuid)` / `private.is_client_of(coach_uuid)` helpers on the new tables. Do **not** hand-write `coach_clients` joins inside the new policies.
- For `conversations` add a `private.is_conversation_member(conv_id)` definer helper (checks the caller is the conversation's `client_id` or `coach_id`); for `messages` derive membership *through* `conversations` via a definer helper, never a bare join in the policy.
- **Every** new helper keeps all four v1.0 hardening elements: `security definer`, `set search_path = ''`, `stable`, `create schema private`/never in an exposed schema. Treat `set search_path = ''` as load-bearing for anti-inlining, not just security.
- Extend `pnpm verify:rls` with live assertions for each new table before the phase is "done."

**Warning signs:**
`infinite recursion detected in policy` in local logs; a new policy that contains `from public.<same_table>` or a raw `coach_clients`/`conversations` join; a new helper missing `set search_path = ''`; `verify:rls` count not growing when tables are added.

**Phase to address:** Every schema phase — Profiles, Onboarding schema, Tracker schema, Chat schema. Make "reuse definer helpers + extend verify:rls" a phase success criterion.

---

### Pitfall 2: Profile UPDATE lets a client edit protected fields (role, level, coach-owned assessment/consent metadata) — because `WITH CHECK` only guards the *row*, not the *columns*

**What goes wrong:**
v1.0's `profiles` UPDATE policy is `using (id = auth.uid()) with check (id = auth.uid())` — it proves you own the row, nothing about *which columns* you changed. v1.1 adds fields where the safe/protected split matters: a client may edit `display_name`, goals, locale/timezone, accessibility prefs; a client must **not** edit `role` (escalation), a coach-assigned `level`, or consent/`assessment`-derived fields. RLS `WITH CHECK` cannot express "column X unchanged" — so a hand-rolled `.update({ role: 'coach', level: 'C2' })` through the service layer would pass RLS.

**Why it happens:**
Developers assume the v1.0 role guard covers all protected fields. It doesn't — `prevent_role_self_escalation` only guards the `role` column. Every *new* protected column added in v1.1 is unprotected until a trigger explicitly freezes it. `WITH CHECK` gives false confidence because it *looks* like validation.

**How to avoid:**
- Extend the pattern that already works: a `BEFORE UPDATE` `SECURITY DEFINER` trigger (mirroring `prevent_role_self_escalation`) that raises if any protected column changed *and* the caller is `authenticated` (service_role bypasses via the `when (auth.role() = 'authenticated')` clause, so seed/coach Edge Functions still work). Guard `role`, coach-owned `level`, and consent-lock fields there.
- Prefer a **column-level GRANT**: `revoke update on public.profiles from authenticated; grant update (display_name, locale, timezone, accessibility_prefs, goals) on public.profiles to authenticated;` — Postgres then rejects any UPDATE touching a non-granted column at the privilege layer, *before* RLS. This is the strongest, cheapest defense and composes with the trigger.
- Split truly coach-owned data into a separate table (`client_coaching_meta`) with its own RLS (`is_coach_of` write, client read-only) rather than mixing coach-writable and client-writable columns in one row.
- Add a `verify:rls` assertion: client attempts to UPDATE each protected column → rejected; client UPDATE of a safe column → succeeds.

**Warning signs:**
A migration adds a column to `profiles` without a matching column-grant or trigger clause; the service layer exposes a generic `updateProfile(fields)` that spreads arbitrary keys; no test asserting "client cannot raise level/role."

**Phase to address:** Client Profiles (schema + service). This is the #2-priority escalation surface — gate the phase on a proven column-scoped write.

---

### Pitfall 3: The real `send-message` Edge Function bypasses RLS with the service role but forgets the membership check → unauthorized send into someone else's conversation

**What goes wrong:**
The stub returns `accepted: true` with no persistence and no auth. The real function must persist, which per the API boundary means an Edge Function doing a privileged INSERT. The trap: a Supabase client built with the **service-role key always bypasses RLS**. If the function inserts the message using the service-role client without first re-verifying that the *caller* (from their JWT) is actually a member of `command.conversationId`, then any authenticated user can POST `{ conversationId: <someone-else's> }` and inject a message into a conversation they don't belong to — RLS won't save you because you turned it off.

**Why it happens:**
`verify_jwt = true` only proves the caller is *some* logged-in user, not that they're *authorized for this conversation*. Developers conflate authentication (who) with authorization (what they may touch). The service-role client is the natural tool for the insert, and it silently disables the very RLS that would have blocked the write.

**How to avoid:**
- Two clients in the function: (a) a **user-scoped** client built from the caller's `Authorization` JWT used only to authorize (or run the membership check under RLS), and (b) the **service-role** client used only for the final insert. Never insert with the service-role client until the membership check on the user-scoped path has passed.
- Authorize by deriving `senderId` from the verified JWT (`getUser()` inside the function), **never** from the request body. Then confirm `senderId` is the `client_id` or `coach_id` of `conversationId` (a single `SELECT` is fine).
- Set `senderRole` server-side from the profile, not from the payload (the payload's `senderRole` in `ChatMessage` must be derived, never trusted).
- Reject cross-conversation sends with a calm 403-equivalent message in the app's voice ("This conversation isn't available right now.") — never a raw "Forbidden."

**Warning signs:**
The function reads `conversationId` and immediately inserts; `senderId`/`senderRole` taken from `command`; only one Supabase client in the function and it's the admin one; no test for "authenticated user sends into a non-member conversation → rejected."

**Phase to address:** Real Chat (Edge Function). #1 data-leak + #3 message-integrity surface — highest-priority test coverage in the milestone.

---

### Pitfall 4: Duplicate messages on retry because `clientRequestId` is carried in the type but never enforced as a unique key

**What goes wrong:**
`SendMessageCommand.clientRequestId` already exists, but the stub ignores it. On flaky mobile networks (the ADHD audience is largely mobile) a client retries a send whose response was lost; without server-side idempotency the message persists twice and both render. Worse with optimistic UI: the optimistic bubble plus two server rows = three visible copies.

**Why it happens:**
Idempotency "looks done" because the field is in the contract. Enforcement requires a DB constraint + an INSERT that treats a duplicate key as success, which is easy to skip. Timestamps or random IDs as the dedupe key are a known anti-pattern (clock skew, no cross-retry stability).

**How to avoid:**
- Add `client_request_id` to the `messages` table and a **partial unique index** `(conversation_id, sender_id, client_request_id)` (partial: `where client_request_id is not null`).
- In the Edge Function, `insert … on conflict (conversation_id, sender_id, client_request_id) do nothing returning *`; if nothing returned, `select` the existing row and return **that** (a retry must return the *same* message, HTTP 200, not an error).
- Require the web client to generate `clientRequestId` (UUIDv7/`crypto.randomUUID()`) once per composed message and reuse it across retries — do not regenerate on retry.
- Make the idempotency test explicit: same `clientRequestId` sent twice → exactly one row, both calls return the same `messageId`.

**Warning signs:**
`messages` has no unique constraint involving `client_request_id`; the retry path generates a fresh id; the function returns an error (not the original message) on a duplicate; two identical bubbles appear after a flaky send in manual testing.

**Phase to address:** Real Chat (schema + Edge Function). #3-priority (message duplication).

---

### Pitfall 5: Trusting `getSession()` / the session's `user` object on the server for authorization

**What goes wrong:**
`getSession()` reads the session from cookies/local storage and returns the embedded `user` **without revalidating the JWT against the Auth server** — it only checks existence and expiry, not that the cookie was signed by Supabase. Using its `user`/`role` to decide "is this a coach?" or "load this client's onboarding" means a forged/stale cookie can drive an authorization decision. v1.0 correctly uses `getUser()` server-side; v1.1 adds many new authed server reads (profile edit page, onboarding renderer, tracker renderer, chat route, coach review views) and each is a fresh opportunity to reach for the cheaper `getSession()`.

**Why it happens:**
`getSession()` is synchronous-feeling and avoids a network round-trip, so it's tempting for "just checking the role." Tutorials mix the two. The danger is invisible in dev where cookies are always valid.

**How to avoid:**
- Server-side authorization uses **`getUser()`** (or `getClaims()` with verified asymmetric JWT) — never the `user` from `getSession()`. Keep this as an explicit rule in the service/auth layer; v1.0 already does it, so the job is "don't regress."
- Read `role` from the `profiles` table under RLS, not from the JWT/session metadata, exactly as v1.0's per-page role recheck does.
- Add a lint/grep tripwire (like the existing icon-source guard) that flags `getSession()` usage in server code.

**Warning signs:**
`getSession()` appears in a Server Component / Server Action / Edge Function branch; role read from `session.user.user_metadata`; a new page guards on `session` instead of `user`.

**Phase to address:** Every phase with a new authed server read (all four). Bake into the shared server-auth helper so leaf routes can't get it wrong.

---

### Pitfall 6: Server Actions / Edge Functions treated as "internal" — missing their own auth+authorization check

**What goes wrong:**
Every `"use server"` Server Action and every Edge Function is a publicly callable POST endpoint. A valid session cookie + `curl` reaches it directly, no UI required. If profile-save, onboarding-answer-save, tracker-entry-save, or tracker-assign rely on the *page* having guarded the user, an attacker calls the action directly with a forged body (e.g. save an onboarding answer for another client, self-assign a tracker, write a tracker entry against someone else's assignment). Middleware/`proxy.ts` is a routing/UX layer, **not** a security boundary.

**Why it happens:**
The action is co-located with a guarded page, so it *feels* protected. The mental model "the button only appears for coaches" ignores that the endpoint is reachable without the button.

**How to avoid:**
- Every write action re-derives identity via `getUser()` and re-checks authorization (ownership/membership/coach-of) **inside the action**, independent of any page guard.
- Prefer routing all *command-style writes* through Edge Functions per the AGENTS.md API boundary (assign tracker, send message, submit onboarding) so the authorization check lives in one audited place; use direct RLS-protected reads for reads only.
- Validate every payload (shape + limits) server-side; never trust client-sent ids for the *actor* (derive from JWT).

**Warning signs:**
A Server Action with no `getUser()` call; authorization implied by "the page already checked"; assign/entry writes that accept a `clientId`/`assignmentId` from the body without verifying the caller owns it.

**Phase to address:** Profiles (save), Onboarding (answer/submit), Tracker (assign + entry), Chat (send). Every write path.

---

### Pitfall 7: Versioned onboarding/tracker configs get mutated in place → in-flight sessions and stored responses reference questions/fields that changed under them

**What goes wrong:**
Onboarding and trackers are "data-driven and versioned." The failure is editing an *in-use* version's questions/options/tracker-fields directly (fix a typo, reorder, delete an option). Consequences: a client mid-onboarding resumes into a question that no longer exists (dead-end / crash); a stored `onboarding_response` points to an option id that was deleted (orphaned answer, unreadable in coach review); a `tracker_entry` written against a field the config no longer has (schema mismatch on read). Branching config adds loops/dead-ends: a "go to Q7" that points back to Q3 creates an infinite loop, or a branch with no terminal step strands the client.

**Why it happens:**
Versioning is modeled as a column but not enforced as immutability. It's far easier to `update` a question row than to publish a new version. "No active assessment" and "version changed mid-session" are unglamorous states that get skipped.

**How to avoid:**
- **Immutable-once-used:** a version becomes read-only the moment any response references it. Enforce with a trigger that blocks `UPDATE/DELETE` on question/option/field rows whose version has responses, and model publishing as insert-a-new-version + flip an `active` pointer. GAP-008 explicitly requires "versions are immutable once used" — make it a DB constraint, not a convention.
- **Pin the version at session start:** an onboarding session and each tracker assignment/entry stores the exact `version_id` it was rendered against; resume and coach-review always read *that* version, even after the active pointer moves. A version change never rewrites an in-flight session.
- **Validate branching at publish time:** reject a version whose branch graph has a cycle or a non-terminal branch or a dangling target (config validation, GAP-012 "malformed config rejection"). Do this in a validator run when activating a version, not at render time.
- **Handle the empty states explicitly:** "no active assessment," "no assigned tracker," "assessment already completed" are first-class calm screens, not error fallbacks.

**Warning signs:**
Question/field edits are `UPDATE`s on live rows; responses store a question *text* copy instead of a stable `version_id + question_id`; resume re-reads the *active* version rather than the session's pinned version; no publish-time branch validator; no "no active assessment" screen.

**Phase to address:** Onboarding schema + renderer; Tracker schema + renderer. Gate each on immutability + version-pinning + a malformed-config rejection test.

---

### Pitfall 8: Tracker config injection / unvalidated config rendered directly → the renderer trusts arbitrary config shape

**What goes wrong:**
A config-driven tracker renders fields from a stored config blob. If the renderer maps config → inputs without validating field types against an allowlist, a bad/retired config (or a future assignment UI, or a seed mistake) can produce an unsupported field type (renderer crash / blank screen), an unbounded field, or config-driven copy that isn't sanitized. Separately, an entry can be written against a *retired* config version (mismatch), and a client could — via a direct action call — submit an entry whose shape doesn't match the assigned config.

**Why it happens:**
"Data-driven" is treated as "render whatever the DB says." Config is trusted because it's internal, but it flows to the client as a contract and to entry-writes as a schema.

**How to avoid:**
- A **closed allowlist** of supported field types in `packages/core`; the renderer refuses (calm empty state) any type not in the allowlist rather than crashing.
- Validate config at publish/activation time against a schema (Zod in `packages/core`), and again defensively at render; reject malformed config (GAP-012 test case).
- Entry writes go through an Edge Function that checks the entry conforms to the **assignment's pinned config version** and that the assignment belongs to the caller; reject entries against retired/mismatched versions with calm copy.
- Never render config-supplied text as HTML; treat all config strings as plain text.

**Warning signs:**
Renderer has an unhandled `default:` case for field type; no config schema validation; entries accepted without checking the pinned version; config strings interpolated into markup.

**Phase to address:** Tracker schema (config validation) + Tracker renderer + entry Edge Function.

---

### Pitfall 9: Message ordering, pagination, and N+1 conversation-list loads

**What goes wrong:**
Ordering messages by `created_at` alone breaks ties when two messages share a timestamp (same-second sends, or DB default precision) → messages render in a non-deterministic or wrong order, and keyset pagination on `created_at` skips or repeats rows at page boundaries. The conversation list (coach with N clients) that loads each conversation's last message / unread count in a per-row query is a classic N+1 that degrades as the roster grows. Loading an entire thread on open doesn't scale as history grows.

**Why it happens:**
`created_at` looks unique enough in testing. Pagination is added late. The coach list starts with 1–2 seeded clients so N+1 is invisible until real rosters.

**How to avoid:**
- Order and paginate by a **stable composite cursor**: `(created_at, id)` with `id` a monotonic UUIDv7 or bigint, and keyset-paginate (`where (created_at, id) < (:cursor_ts, :cursor_id) order by created_at desc, id desc limit N`) rather than `OFFSET`.
- Index `messages (conversation_id, created_at desc, id desc)` — required for both the thread read and the RLS-filtered scan (Supabase's #2 RLS perf rule: index policy/filter columns).
- Conversation list: one aggregated query (lateral join / window function for "last message per conversation" and unread counts), not a query per row. Also add the app-level `.eq('...')` filter alongside RLS (Supabase perf rule #6).
- Load the **last N messages** on open, fetch older on scroll; never `select *` the whole thread. (Realtime is deferred, but build the schema realtime-ready: stable ordering keys make future realtime merges deterministic.)

**Warning signs:**
`order('created_at')` with no secondary key; `OFFSET`-based pagination; the conversation list maps over conversations issuing a query each; no index on `messages(conversation_id, created_at)`; whole-thread fetch on open.

**Phase to address:** Chat schema (indexes + ordering keys) + Chat route (pagination + list query).

---

### Pitfall 10: Empty / whitespace-only / oversized messages, and optimistic UI that never reconciles with the server

**What goes wrong:**
The stub trims and length-checks, but the persisted path can still accept whitespace-only bodies (`"   "` trims to empty only if you re-trim server-side), zero-width chars, or bodies over `chatLimits.messageBodyMaxLength` if the check isn't re-run after normalization. On the client, React 19 `useOptimistic` shows the message instantly but, if the confirmed server row (with real `id`/`createdAt`) isn't merged back by a stable key, you get a duplicate flash (optimistic bubble + server bubble), a message that reverts on transition completion (see React issue #31967 where optimistic state rolls back unexpectedly), or a "sent" message that silently vanishes on error with no retry affordance.

**Why it happens:**
Client and server validation drift (client trims, server doesn't re-check). Optimistic reconciliation is subtle: the optimistic state resolves back to canonical state when the transition completes, so if the canonical list hasn't yet included the server row keyed to the same `clientRequestId`, the bubble disappears or duplicates.

**How to avoid:**
- Server is the source of truth for validation: re-`trim()`, reject empty/whitespace-only and oversized in the Edge Function with the existing calm copy ("Add a message before sending." / "This message is a little long…").
- Reconcile optimistic → server by **`clientRequestId`**: the optimistic bubble carries the same `clientRequestId`; when the server row arrives, replace-by-key rather than append (this is why idempotency and reconciliation share the key). Combined with Pitfall 4's idempotency, one key prevents both server duplicates and UI duplicates.
- On send failure, keep the draft and show a calm retry (GAP-020 spirit) — never silently drop. Run the optimistic update inside a transition (`startTransition`/form action) so rollback semantics are defined.

**Warning signs:**
Server accepts `"   "`; optimistic list appends without a stable key; failed sends disappear; duplicate bubbles after a successful send; length check runs before normalization.

**Phase to address:** Chat Edge Function (validation) + Chat route (optimistic reconciliation + retry).

---

### Pitfall 11: Lost work on refresh/navigation — the executive-function violation

**What goes wrong:**
For an ADHD audience, losing typed work is not a minor annoyance; it's an abandonment trigger and a direct violation of executive-function support. The at-risk surfaces in v1.1: a half-written chat message lost on refresh/route change; onboarding answers lost if the client closes the tab mid-assessment; a partially-filled tracker entry lost on navigation. GAP-009 and GAP-020 explicitly call out "close the browser mid-onboarding and resume calmly" and "loses connection, returns without losing text."

**Why it happens:**
Persistence/resume is unglamorous and easy to defer. Optimistic-only chat drafts live in volatile React state. Onboarding "resume" is treated as a nice-to-have rather than a core requirement.

**How to avoid:**
- **Onboarding:** autosave each answer server-side as it's given (GAP-009), store a resume position, and always resume into the session's *pinned* version (ties to Pitfall 7). Reload mid-onboarding lands on the next unanswered question, not the start.
- **Chat drafts:** persist the in-progress message (local storage keyed by conversation + `clientRequestId`) so a refresh/route change/connection loss restores it; clear only on confirmed send.
- **Tracker entries:** save-in-progress or at minimum warn-before-discard; prefer autosave to match the onboarding pattern.
- Treat "resume after leaving" as a phase acceptance test, not an edge case.

**Warning signs:**
Onboarding answers held only in client state until a final submit; no draft persistence on the chat composer; a tracker form that discards on navigation; no test for "refresh mid-flow → work preserved."

**Phase to address:** Onboarding (resume) + Chat route (draft persistence) + Tracker renderer (entry draft). This is a design-rule (#4-priority: lost work) as much as a feature.

---

### Pitfall 12: Choice overload creeping back in as the surface area grows (menus, pickers, galleries)

**What goes wrong:**
Four new features multiply the temptation to add selection UI: a tracker *picker*, an onboarding *skip/branch menu*, a conversation *list that feels like an inbox to browse*, a profile page with many competing edit affordances, two primary buttons on the coach review screens. Each violates "assigned, never chosen" and "one primary action per screen," and each adds decision load for the exact audience the product exists to protect.

**Why it happens:**
Feature growth naturally suggests options. "Let the coach pick a template" and "let the client choose which tracker" feel helpful. Coach-facing screens (review, list) are where extra buttons sneak in because the coach "needs more control."

**How to avoid:**
- Client never sees a menu of plans/templates/trackers — the assigned tracker is *presented*, singular. Onboarding is one question at a time, no branch chooser. (AGENTS.md "Never": no galleries/pickers for clients.)
- One `Button variant="primary"` per view — enforce on the new profile, onboarding, tracker, and chat screens. The v1.0 AppShell already carries zero primary actions; keep it that way.
- Assignment stays **seed-only** this milestone (PROJECT.md scope) — resist building an assignment picker; the relationship already exists.
- Load the `sketch-findings-fish` skill before building any client-facing screen (per CLAUDE.md) so the settled calm direction is applied, not re-derived.

**Warning signs:**
A `<Select>` of trackers/plans on a client screen; two primary buttons on a review screen; a conversation list styled as a browsable inbox; onboarding offering "skip to section."

**Phase to address:** Every client-facing screen phase (Profile edit, Onboarding renderer, Tracker renderer, Chat route) and coach review screens.

---

### Pitfall 13: Grading/score/percentage language and resettable streaks re-entering via "progress"

**What goes wrong:**
Onboarding and trackers naturally invite a completion percentage, a level score, a "you're 60% done," or a streak. For this audience: percentages-as-judgement read as grades (shame), and a streak that resets to zero on a missed day is the **#1 abandonment trigger** (AGENTS.md rule 5). Tracker review is where a coach-facing "score" or a client-facing "you missed 3 days" easily appears.

**Why it happens:**
Progress bars imply percentages; trackers imply streaks; it's the default mental model for "engagement." The rule is counterintuitive to standard product instincts.

**How to avoid:**
- Progress is **visual, never a grade** — use the `Progress` component / milestone dots for movement, never a number-as-judgement (GAP-032 "no score/grade language"). Onboarding shows "a few questions left," not "40%."
- No streak counters anywhere in v1.1; if any return-reward is added later it must reward returning, never punish a gap (GAP-033), and this milestone doesn't build gamification at all (out of scope).
- Coach review shows entries/answers as *context for a conversation*, not a scored dashboard (GAP-011/GAP-015 "no scoring UI").
- Copy stays calm and non-scolding, soft `notice` tone, never alarming red (AGENTS.md rule 6) — errors explain and guide.

**Warning signs:**
A "%" or "score" in onboarding/tracker UI; a streak/consecutive-days counter; red error styling; coach review framed as a scorecard; "you failed to…" copy.

**Phase to address:** Onboarding renderer, Tracker renderer, both coach review screens. #4-priority (silent design-rule violation).

---

### Pitfall 14: Layout shift on state change (loading→loaded, error, optimistic send)

**What goes wrong:**
For ADHD/autistic users, content that jumps is disorienting and breaks focus. The v1.0 decision to float Alerts as an overlay "so the centered card never moves" shows the standard. v1.1's dynamic screens are shift-prone: chat that reflows when messages load or an optimistic bubble appears; onboarding where a validation notice pushes the question down; a tracker/profile form that resizes as async data resolves.

**Why it happens:**
Async data and inline error/notice insertion change element height. It's invisible on fast local loads and only bites on real latency/mobile.

**How to avoid:**
- Reserve space for async regions (skeletons/min-heights) so loaded content doesn't push layout; keep the primary action anchored.
- Insert notices as overlays or into pre-reserved space (follow the v1.0 Alert-overlay pattern) rather than inline-expanding the form.
- Optimistic message bubbles occupy final layout immediately (same key/size as confirmed), so reconciliation doesn't reflow.
- Respect `prefers-reduced-motion` (already global) for any transition.

**Warning signs:**
Content that visibly jumps when data loads or an error appears; inline notices that expand the card; the composer/primary button moving as messages stream in.

**Phase to address:** All four client-facing renderers. Verify on throttled/mobile conditions, not just local.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store onboarding/tracker answers only in client state until final submit | Simpler forms, no autosave plumbing | Lost work on refresh = executive-function violation + abandonment (Pitfall 11) | Never for this audience — autosave is a requirement, not polish |
| Skip the `client_request_id` unique index, rely on "it rarely retries" | Ships chat faster | Duplicate messages under real mobile networks; hard to dedupe after the fact (Pitfall 4) | Never — the field already exists in the contract; enforce it now |
| Insert with service-role client and let RLS "handle" auth | One client, less code | RLS is *off* under service role → cross-conversation writes (Pitfall 3) | Never — always re-check membership from the JWT before a privileged insert |
| Edit onboarding/tracker config rows in place instead of publishing a new version | No versioning machinery | Orphaned responses, mid-session dead-ends, unreadable coach review (Pitfall 7) | Only for a version with zero references; enforce immutability by trigger |
| `getSession()` for a quick server-side role check | Avoids a network hop | Unrevalidated token drives authorization → escalation (Pitfall 5) | Never in server code; `getUser()`/`getClaims()` only |
| Mix coach-writable and client-writable columns in one `profiles` row | Fewer tables | Column-level protection needed on every new field; easy to miss one (Pitfall 2) | Acceptable if column-grants + freeze-trigger cover every protected column and are tested |
| `OFFSET` pagination + `order by created_at` for chat | Trivial to write | Skips/dupes at boundaries, slow at scale, non-deterministic ties (Pitfall 9) | Never — keyset on `(created_at, id)` from day one |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase service-role in Edge Function | Using it for everything, bypassing RLS silently | Two clients: user-JWT client to authorize, service-role client only for the vetted insert; never trust body-supplied actor ids |
| Supabase SSR (`@supabase/ssr`) | `getSession()` on server; reading role from JWT metadata | `getUser()`/`getClaims()`; read role from `profiles` under RLS (v1.0 pattern) |
| Supabase RLS on new tables | Bare-SELECT/self-join in policy; dropping `set search_path=''` from a new helper | Reuse `is_coach_of`/`is_client_of` + a new `is_conversation_member` definer helper, all with `security definer` + `set search_path=''` + `stable` |
| Supabase migrations | Editing `0002`-style files and expecting the live function to change | `create or replace` in a *new* migration (v1.0 learned this on `handle_new_user`); editing an old file only affects a fresh `db reset` |
| Next.js 16 caching of authed reads | `use cache` / default caching leaking one user's data to another | Authed reads stay dynamic (they call `cookies()`); if caching, key by user id; `cache: 'no-store'` for personalized data |
| React 19 `useOptimistic` | Appending without a stable key; update outside a transition | Reconcile by `clientRequestId`; run the mutation inside a transition/form action |
| Deno Edge Function importing `packages/core` | Version drift between `chatLimits` in core and the function | Import the shared constant (already done); `pnpm build` typechecks core before web |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `auth.uid()`/helper called per-row in RLS | Slow reads that worsen with row count | Wrap as `(select auth.uid())` / `(select private.is_…())` to trigger initPlan caching | Noticeable in the thousands of messages/entries |
| Unindexed RLS filter columns | Seq scans; timeouts on large tables | Index `messages(conversation_id, created_at desc, id)`, `tracker_entries(assignment_id, …)`, FK columns used in policies | ~10k+ rows; 1M rows = timeout |
| N+1 conversation-list / entry-list loads | List latency grows linearly with roster/history | One aggregated query (lateral/window) for last-message + unread; app-level `.eq()` alongside RLS | Real coach rosters (dozens of clients) |
| Whole-thread / whole-history fetch on open | Slow first paint, memory growth | Keyset-paginate last N; fetch older on scroll | Long-running conversations |
| Joins inside RLS policies | Slow policy evaluation | Rewrite `uid() in (select … join)` to `col in (select … where user=uid())`; push into definer helper | Any policy touching a second table on a large table |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service-role insert without membership re-check | Any user injects messages/entries into others' conversations/assignments | Derive actor from JWT; verify membership before privileged write (Pitfall 3) |
| Trusting `getSession()` user / JWT metadata for role | Forged/stale cookie escalates to coach powers | `getUser()`/`getClaims()`; role from `profiles` under RLS (Pitfall 5) |
| Unprotected new `profiles` columns (role/level/consent) | Client self-escalates or edits coach-owned data (Pitfall 2) | Column GRANTs + freeze trigger + separate coach-owned table; test each column |
| Server Action assumed protected by its page | Direct POST bypasses UI guard to mutate others' data (Pitfall 6) | Re-auth + re-authorize inside every action/function |
| Actor/role taken from request body | Impersonation (`senderId`/`senderRole`/`clientId` spoofed) | Derive all actor identity from the verified JWT, never the payload |
| Config/onboarding text rendered as HTML | Stored-content injection via seed/config | Treat all config/response strings as plain text; validate config schema |
| New table shipped without RLS or without `verify:rls` coverage | Silent cross-tenant read | Every table `enable row level security` + policy + a live `verify:rls` assertion (v1.0 discipline) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tracker/plan picker or onboarding branch menu | Choice overload — the exact harm the product prevents | Assigned-never-chosen; present the single assigned item; one question at a time |
| Percentage/score/grade in onboarding or tracker | Reads as judgement → shame → abandonment | Visual progress only ("a few left"), never a number-as-grade |
| Streak / consecutive-days counter | Broken streak = #1 abandonment trigger | No streaks in v1.1; future rewards reward returning, never punish gaps |
| Red / scolding error copy | Alarms an anxious audience | Soft `notice` tone, calm sentence-case guidance (v1.0 Alert pattern) |
| Layout shift on load/error/optimistic send | Disorients, breaks focus | Reserve space, overlay notices, anchor the primary action (v1.0 Alert-overlay decision) |
| Lost draft/answer on refresh or navigation | Executive-function violation; re-typing burden | Autosave onboarding; persist chat draft; resume into pinned version |
| Two primary actions on a review/edit screen | Competing choices = decision load | One `Button variant="primary"` per view |

## "Looks Done But Isn't" Checklist

- [ ] **New table RLS:** Often missing — a live `verify:rls` assertion for coach-read, client-read, unassigned-coach-denied, and *cross-client* denial. Verify each new table extends the 8/8 suite.
- [ ] **Profile UPDATE:** Often missing — column-scoped write protection. Verify a client cannot change `role`/`level`/consent via a direct `update`, and *can* change safe fields.
- [ ] **send-message:** Often missing — membership authorization from the JWT before the service-role insert. Verify a non-member send is rejected with calm copy.
- [ ] **send-message idempotency:** Often missing — the partial unique index + `on conflict do nothing`/return-existing. Verify same `clientRequestId` twice → one row, same id returned.
- [ ] **Onboarding/tracker versioning:** Often missing — immutability trigger + version-pinning on sessions/assignments/entries. Verify editing an in-use version is blocked and resume uses the pinned version.
- [ ] **Config validation:** Often missing — publish-time schema + branch-cycle/dead-end validation and a field-type allowlist. Verify malformed config is rejected, not rendered.
- [ ] **Server-side auth:** Often missing — `getUser()` (not `getSession()`) on every new authed read/action. Verify via a grep tripwire.
- [ ] **Message ordering/pagination:** Often missing — composite `(created_at, id)` ordering + index + keyset pagination. Verify no dupes/skips at page boundaries.
- [ ] **Optimistic reconciliation:** Often missing — replace-by-`clientRequestId`, retry-on-failure, no silent drop. Verify no duplicate bubble after a real send and draft survives refresh.
- [ ] **ND-UX floor:** Often missing — one primary action, no picker, no %/score/streak, calm copy, no layout shift, no lost work. Verify on throttled/mobile conditions.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate messages already persisted (no idempotency) | MEDIUM | Add partial unique index (dedupe existing rows first via a cleanup migration keyed by conversation+sender+body+near-time), then switch INSERT to `on conflict do nothing` and return-existing |
| Config mutated in place, responses orphaned | HIGH | Backfill a `version_id` snapshot per response/entry from history if recoverable; otherwise data is ambiguous — enforce immutability going forward and accept a gap. Cheaper to prevent than recover |
| Cross-conversation writes shipped (service-role, no check) | MEDIUM-HIGH | Add the JWT membership check + audit existing rows for out-of-band inserts; rotate service-role key if it ever reached the client |
| Protected profile column left writable | LOW-MEDIUM | Add column GRANT + freeze trigger in a follow-up migration; audit for illegitimate role/level changes |
| `getSession()` used for authorization | LOW | Swap to `getUser()`/`getClaims()`; add grep tripwire so it can't recur |
| Streak/score shipped to UI | LOW | Remove the counter; replace with visual progress — but reputational cost with the audience if it reached users |
| Lost-work bug (no autosave/draft) | LOW-MEDIUM | Add autosave/draft persistence; low code cost but every occurrence risks losing a user |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. RLS recursion / SQL-fn inlining | Every schema phase | New definer helpers keep `security definer`+`set search_path=''`; `verify:rls` extended per table |
| 2. Profile field/role escalation | Client Profiles | Client cannot UPDATE role/level/consent; can UPDATE safe fields (live test) |
| 3. Unauthorized send (service-role) | Real Chat (Edge Fn) | Non-member send rejected; actor derived from JWT |
| 4. Duplicate messages (idempotency) | Real Chat (schema+Edge Fn) | Same `clientRequestId` twice → one row, same id |
| 5. `getSession()` for authz | All authed-read phases | Grep tripwire; role read from `profiles` under RLS |
| 6. Unguarded Server Actions/Fns | All write phases | Each action re-auths + re-authorizes independently |
| 7. Mutating in-use versions / branching | Onboarding + Tracker schema | Editing in-use version blocked; resume/entry uses pinned version; branch validator rejects cycles |
| 8. Config injection / unvalidated | Tracker schema + renderer | Malformed config rejected; field-type allowlist; entry checked against pinned version |
| 9. Ordering / pagination / N+1 | Chat schema + route | Composite cursor + index; no dupes/skips; one aggregated list query |
| 10. Empty/oversized msg + optimistic | Chat Edge Fn + route | Server rejects empty/whitespace/oversized; reconcile-by-key; retry on failure |
| 11. Lost work on refresh/nav | Onboarding + Chat + Tracker | Refresh mid-flow preserves answers/draft/entry |
| 12. Choice overload | All client-facing phases | No picker/menu/gallery; one primary action per view |
| 13. Grades/scores/streaks | Onboarding + Tracker + reviews | No %/score/streak; visual progress only; calm copy |
| 14. Layout shift | All renderers | No jump on load/error/optimistic send (throttled test) |

## Sources

- Supabase — RLS Performance and Best Practices (wrap `auth.uid()` in `select`, index policy columns, rewrite IN-joins, add app-level filter, `TO authenticated`): https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Supabase — Row Level Security (SECURITY DEFINER helpers to break recursion): https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — Securing Edge Functions / service-role always bypasses RLS: https://supabase.com/docs/guides/functions/auth and https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z
- Supabase — Server-Side Auth for Next.js; never trust `getSession()` on the server, use `getUser()`/`getClaims()`: https://supabase.com/docs/guides/auth/server-side/nextjs and https://supabase.com/docs/guides/auth/server-side/creating-a-client
- PostgreSQL — Inlining of SQL functions (a SQL function is inlined only if NOT `SECURITY DEFINER` and has no `SET`/`search_path`; both block inlining → v1.0 helpers are safe): https://wiki.postgresql.org/wiki/Inlining_of_SQL_functions
- DEV — Infinite recursion in Postgres RLS: a SECURITY DEFINER gotcha (inlining strips definer context for plain SQL fns): https://dev.to/bairescodeai/infinite-recursion-in-postgres-rls-a-security-definer-gotcha-1916
- PostgreSQL — Row Security Policies (USING vs WITH CHECK; WITH CHECK cannot express column-immutability): https://www.postgresql.org/docs/current/ddl-rowsecurity.html and https://www.postgresql.org/docs/current/sql-createpolicy.html
- Next.js — Authentication guide; Server Actions are public POST endpoints requiring their own auth/authorization: https://nextjs.org/docs/app/guides/authentication
- DEV / Makerkit — Next.js 16 Server Action security (proxy/middleware is not a security boundary): https://dev.to/shubhradev/nextjs-16-server-actions-security-the-auth-check-most-developers-miss-1ei1 and https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions
- Next.js — Caching authed data; `cookies()` makes components dynamic; key caches per user to avoid cross-user leakage: https://nextjs.org/docs/app/guides/caching-without-cache-components and vercel/next.js discussion #68067
- React — `useOptimistic` reference (reconcile on transition completion; merge server-confirmed id/timestamp): https://react.dev/reference/react/useOptimistic ; rollback edge case: https://github.com/facebook/react/issues/31967
- Idempotency/ordering — client-generated idempotency key (UUIDv7/ULID), timestamps are an anti-pattern; composite ordering to break ties: https://www.morling.dev/blog/on-idempotency-keys/ and https://ably.com/blog/chat-architecture-reliable-message-ordering
- FISH internal — v1.0 migrations `0001`–`0006` (definer helpers, role guard, `create or replace` migration discipline), `v1.0-MILESTONE-AUDIT.md` (carried tech debt), `docs/product-gap-analysis-2026-07-04.md` (GAP-005..GAP-022 edge/test cases), `AGENTS.md` (design rules + Never list)

---
*Pitfalls research for: FISH v1.1 The Coaching Loop — profiles, data-driven onboarding, config-driven tracker, persistent 1-on-1 chat on Next.js 16 / React 19 / Supabase for a neurodivergent audience*
*Researched: 2026-07-04*
