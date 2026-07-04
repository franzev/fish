# Feature Research

**Domain:** Coach-led English-learning ChatHub for neurodivergent professionals (many with ADHD) — milestone v1.1 "The Coaching Loop"
**Researched:** 2026-07-04
**Confidence:** HIGH for the four in-scope capabilities (internal design law + prior GAP analysis + external ND/UX best practice all converge). MEDIUM only where external sources assume choice-rich UX that FISH deliberately inverts.

> Scope note for the roadmapper: v1.0 (auth, roles, `profiles` + `coach_clients` schema with recursion-safe RLS, UI kit, a **presentational** chat kit, a validation-only send-message stub) is already shipped. This document covers only the four v1.1 foundations: **client profiles, data-driven onboarding, tracker engine, real 1-on-1 chat**. Everything is scored against the six non-negotiable design rules (one primary action; assigned-never-chosen; 56px targets; visual progress never a grade; reward-only never a resetting streak; copy never scolds). The single most important cross-cutting finding: **general ND-accessibility literature says "give users lots of customization"; FISH's product law says "remove choices." Where they conflict, FISH wins — default to the system/OS setting, expose at most a tiny set of toggles, never a settings buffet.**

---

## Feature Landscape

The four capabilities are treated as four sub-landscapes. Each has its own table-stakes / differentiator / anti-feature breakdown so the roadmapper can slice per feature.

### A. CLIENT PROFILES

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Identity fields (display name, locale, timezone) | Any profile has these; timezone drives cadence/entry display correctly | LOW | `display_name` already exists on `profiles`. Timezone as IANA string; validate format, don't offer a giant dropzone picker — prefill from browser `Intl.DateTimeFormat().resolvedOptions().timeZone`. |
| Language goal / role context (free text or short structured) | The whole service personalizes on "why are you learning English" | LOW–MED | Keep as 1–2 short-text fields, not a plan picker. Sketch 003 winner ("Essentials") explicitly keeps profile to identity + coach + settings; metrics live in Progress. |
| Current English level (CEFR A1–C2 or coarser) | Coach-led language platforms universally capture a starting level (Speexx/Preply pattern) | LOW | Store the value; **the client should not self-grade via a scored test here** — capture it as a plain field or defer level-setting to onboarding/coach. Level is data, never displayed back as a grade. |
| Client edits own SAFE fields only | Users expect to fix their own basics | MED | RLS already models `is_client_of`/`is_coach_of`. Safe = display name, locale, timezone, accessibility prefs, the goal text. **Unsafe = `role`, coach assignment, level-as-set-by-coach.** Role self-escalation is already DB-guarded; extend the same discipline to any coach-owned field. |
| Coach reads assigned client's profile (read-only detail view) | Coach needs context to coach; GAP-007 | MED | Route from the existing coach client list → detail. RLS-scoped; no cross-client leakage; empty/partial states must be calm, not "incomplete!" |
| Accessibility preferences (minimal) | This IS the audience — not a nice-to-have (GAP-034 calls it P0) | MED | See the dedicated block below. The trap is scope. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Consent metadata captured as fields (not a flow) | Lets the future privacy milestone land without re-migrating; trust signal | LOW | v1.1 captures consent *fields* only (e.g. `consented_at`, `consent_version`) — **not** export/delete/retention tooling (explicitly deferred). One boolean + timestamp + version string. |
| ND accessibility prefs that default to the OS, override sparingly | Respects the audience without adding choice overload — the FISH-native take on a11y personalization | MED | Worth getting right because it's the product's reason to exist; see anti-features for what NOT to do. |
| Coach detail view surfaces onboarding answers + tracker entries in one calm place | Turns "profile" into the coach's single client-context surface | MED | Depends on onboarding + tracker existing; natural convergence point. Keep scan-friendly, one primary action, no editing of unsafe fields. |

#### Accessibility-preference fields worth capturing (ND-specific, MINIMAL)

The literature (Know About Accessibility, WCAG COGA, accessiBe "calm mode") converges on a small set that genuinely helps ADHD/autistic/dyslexic users. FISH should capture **only** those that (a) can't be fully served by respecting the OS setting and (b) map to something the UI actually changes. Recommended captureset, each a single control, all defaulting to "follow system":

- **Reduced motion** — but the app already respects `prefers-reduced-motion` globally; a stored pref is only needed as an in-app override. **Prefer relying on the OS media query; a stored toggle is a MAYBE, not a must.**
- **Text size / density step** — one 3-value control (comfortable / larger / largest), not a slider. High value for dyslexia + focus.
- **Theme** (light/dark/system) — already have the token ladder + toggle; store the choice.
- **Reduced-motion and theme can live as UI toggles without a DB field**; only persist what must survive devices.

**Explicitly NOT worth capturing in v1.1:** font-family choice, color-scheme customization (monochrome is the product), line-height/letter-spacing sliders, sound controls (no sound), "calm mode" mega-profiles. Each adds a choice the audience is being protected from.

---

### B. DATA-DRIVEN ONBOARDING / INTAKE ASSESSMENT

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Questions read from DB, never hard-coded in UI | Explicit AGENTS build-order rule + GAP-008 | HIGH | Question-bank schema: assessment version → ordered steps → questions → options. UI renders whatever the active version says. This is the single largest piece of the milestone. |
| A small, standard set of answer types | Any intake form needs these; renderer must cover them | MED | Recommended v1.1 set: **single-select, multi-select, scale (Likert/1–5), short text, long text, boolean.** That's the industry-common core; date/file/ranking/matrix are deferrable. Renderer switches on a `type` discriminator. |
| One-question-at-a-time renderer | Core executive-function UX; reduces cognitive load for ADHD | MED | Confirmed by every ND-onboarding source: progressive disclosure, "bare minimum per step," avoid multitasking. One question, one primary action (`Continue`), quiet Back. |
| Save-and-resume (persist response + resume position) | ADHD users leave and return; GAP-009; "close the browser mid-onboarding and resume calmly" | MED | Autosave each answer; store resume index. On return, land exactly where they left, no "you didn't finish" scolding. This is the feature that most directly serves the audience. |
| Calm visual progress with NO score | Design rule 4 + Progress component already exists | LOW | Milestone/step progress bar with meaningful step labels ("Your goals", "How you learn best"). **Never a percentage-as-judgement, never "3/10 correct."** There are no right answers in an intake. |
| Versioning: immutable once used | GAP-008; changing questions under an in-flight response corrupts data | MED | An assessment version becomes immutable once any response references it. Edits create a new version. Responses pin to the version they answered. Prevents "branching loops" / mid-session drift edge cases. |
| Coach review of submitted answers | GAP-011; coach validates strategy manually (coach-first) | MED | Read-only, RLS-scoped, assigned clients only. Clear empty/partial states. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Branching / skip logic (data-driven) | Skips irrelevant questions → shorter flow → less overwhelm | MED–HIGH | Real but a **complexity magnet**. See MVP note: ship linear-first, add show/hide branching as a fast-follow. Branching must be expressed in the config (condition → skip-to / show / complete), never in UI code. Guard against branching loops in validation. |
| Resume that survives a version change gracefully | Edge case GAP-009 flags ("assessment version changes mid-session") | MED | Because responses pin to a version, a mid-flight version bump just means the client finishes the old version; only new clients get the new one. Design the schema so this is automatic, not special-cased. |
| "Ask nothing that can be inferred or assigned" | The UI-UX guideline's core rule applied to intake | LOW | Prefill locale/timezone from the browser; don't ask. Every removed question is a win for this audience. |

#### Anti-Features (this feature)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-question pages / long scrolling form | "Faster to fill" | Cognitive overload; the exact abandonment trigger for ADHD | One question per screen, always. |
| A "score" or "your level is X%" result screen | Feels like a quiz payoff | Violates rule 4; intakes have no right answers; grading shames | Calm "Thanks — your coach will take it from here" completion state. |
| Client choosing which assessment to take | Looks flexible | Assigned-never-chosen; a picker is choice overload | Coach/seed assigns the active assessment; app presents it. |
| Progress bar that implies a deadline / urgency | "Motivates completion" | Fake urgency is a rejected dark pattern; pressures ND users | Neutral step progress; save-and-resume removes any time pressure. |

---

### C. TRACKER ENGINE (config/schema-driven practice logs)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Config-driven tracker (fields + validation + versioning), not hard-coded templates | AGENTS build-order: "engine, not templates"; GAP-012 | HIGH | Config schema defines fields (reuse the onboarding answer-type vocabulary where possible: boolean, scale, short text, number), a title, and cadence. Versioned + immutable-once-assigned, same discipline as onboarding. |
| Cadence (daily / weekly) | Habit/practice logs are inherently periodic; standard field across trackers | LOW–MED | Support the two common cases only: `daily` and `weekly`. Skip custom recurrence, "3x/day", specific-weekday configs in v1.1 — real in the market but not needed for a first engine. Timezone from profile drives "which day." |
| Assignment via seed / Edge Function (assigned-never-chosen) | Product law; GAP-013 | MED | No client-facing tracker gallery, ever. Assignment is a service-role write behind an authorization check (assigned coach only; client cannot self-assign). Seed-only is acceptable this milestone; the Edge Function is the durable path. |
| Client renderer from config + entry storage | GAP-014; client sees ONE assigned tracker and logs an entry | MED–HIGH | No picker; one primary action (`Save entry` / `Log today`); optimistic save; resume/draft on failure. Renderer switches on field type — shares machinery with the onboarding renderer. |
| Visual progress, never a grade | Rule 4; GAP-032 | MED | Show movement (milestones / a filling journey), not "80% adherence." Sketch: Progress is a milestone journey, reward-only. |
| Coach entry review | GAP-015; closes the coach-first loop | MED | Entry timeline for an assigned client; minimal filters; **no scoring UI**; RLS-scoped. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One shared field-renderer/validator across onboarding + tracker | Halves the renderer work; consistency for the client | MED | Strong architectural win — the answer-type vocabulary (single-select, scale, short text, boolean, number) is nearly identical. Roadmap should sequence onboarding first so the tracker reuses it. |
| Reward-on-return, never a resetting streak | The audience's #1 abandonment trigger is a broken streak | MED | If any encouragement is shown, it rewards returning after a gap; it never resets to zero or shows "you missed 3 days." Deferred to coach validation before *any* reward UI ships (GAP-033), but the schema should not bake in streak-count semantics. |

#### Anti-Features (this feature)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Tracker template gallery / "pick your habit" | Standard in consumer habit apps | Direct violation of assigned-never-chosen; choice overload | Coach assigns exactly one; app presents it. |
| Streaks / streak counters / "don't break the chain" | Habit-app default; feels motivating | Resetting streak = top abandonment trigger for ND audience (rule 5) | Reward returning; no reset mechanic; schema stores entries, not a fragile streak integer. |
| Adherence %, scores, "you completed 6/7" | Feels like measurable progress | Percentage-as-judgement shames a missed day | Visual milestone journey; coach contextualizes verbally. |
| Client-configurable cadence / reminders in v1.1 | "Let users customize" | Adds choices; reminders/notifications explicitly out of scope | Coach sets cadence in the assigned config. |
| Multiple active trackers with a switcher | "More coaching surface" | Two competing next-actions on a screen | One assigned tracker as the client's next action; if multiple exist later, still surface one primary. |

---

### D. REAL 1-ON-1 CHAT (persistent send/read; realtime DEFERRED)

> Alignment with what's built: the presentational kit at `apps/web/components/chat/` already renders bubbles, a conversation list, input, empty/skeleton states, **and** `MessageStatus = "sending" | "sent" | "delivered" | "read"`, reactions, attachments, presence, typing, voice. v1.1 wires **only** the persistent-send/read subset onto live data. The kit's `delivered`/`read`/presence/typing/reactions/attachments components exist but stay **unwired** this milestone (they belong to the deferred realtime + attachments work, GAP-019/020/021). The core contract (`ChatMessage`, `SendMessageCommand` with `clientRequestId`, `chatLimits.messageBodyMaxLength = 4000`) already exists in `packages/core`.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Conversation + message + read-state schema with RLS for the pair | GAP-016; turns the mock into a product | HIGH | Tables: `conversations` (client+coach), `messages` (immutable body), read-state. RLS: only the assigned pair reads/writes; outsiders denied; messages immutable except allowed metadata (read marker). |
| Real send-message Edge Function replacing the stub | GAP-017; the stub only returns `accepted: true` | HIGH | JWT verify → membership check → insert. Must be **idempotent** on `clientRequestId` (already in `SendMessageCommand`): store the key with the row in one transaction, return the stored result on retry. Reject empty/oversized (>4000) with calm copy, not red. |
| Optimistic send with explicit lifecycle | Every chat app; the kit already models it | MED | Lifecycle for v1.1: **`sending` → `sent`** (persisted) **/ `failed`** (retry). Message appears immediately; on error, roll back to a retryable `failed` state, never silently drop. `delivered`/`read`-as-realtime are deferred. |
| Persistent read (thread loads real history) | GAP-018; "no mock data in product route" | MED | Server-load the thread + conversation list from live tables via RLS. Both client and coach read the same thread. |
| Empty / oversized / send-failed handling, all calm | Rules 6 + kit already has empty/skeleton | LOW–MED | Empty conversation = calm assigned-state copy. Oversized = "This message is a little long. Try sending it in two parts." (already the stub's tone). Failed = "That did not send. Give it a minute and try again." with a retry affordance. |
| One primary action in the composer | Rule 1 | LOW | Send is the one action. No attach/emoji/voice buttons wired this milestone (kit components stay dormant). |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Idempotent send that survives retry/double-tap | Prevents duplicate messages — a real anxiety source for ND users on flaky connections | MED | The `clientRequestId` plumbing is already in the contract; the Edge Function must honor it. This is a correctness win that's cheap now and expensive to retrofit. |
| Draft preserved on failure (no silent loss) | GAP-020 rationale: "loses connection, returns without losing text" | MED | Even without the full offline queue (deferred), keep the composer text on a failed send so nothing is lost. Minimal viable slice of GAP-020. |
| Gentle-correction message idiom (quoted reply) | Sketch 002 winner; how coaching correction appears without scolding | LOW (UI only) | Not a new feature — it's a coach using a normal quoted reply to correct, never red. The `quoted-message` component already exists. No special data needed beyond a `replyTo` reference (kit already models `replyTo`); wiring it is optional this milestone. |

#### Anti-Features (this feature)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Realtime / presence / typing / read-receipts | "Modern chat feels alive" | Explicitly deferred (GAP-019); adds channel/subscription complexity + more moving status indicators for ND users | Ship persistent send/read; add realtime as the next chat layer. Kit components stay dormant. |
| Attachments / voice notes | Kit has the components | Deferred (GAP-021); needs storage buckets, virus/type/size checks, moderation | Text-only chat in v1.1; revisit after coach validation. |
| Reactions, edit, delete | Common in messengers | Extra choices + immutability/audit questions; not needed to hold a coaching conversation | Messages immutable; no reaction bar wired. |
| Group chat / multi-participant | "Community feel" | Community feed is explicitly barred; breaks the 1-on-1 RLS model | Strictly the assigned client↔coach pair. |
| Message search / filters (client side) | "Findability" | Choice/complexity the client doesn't need; coach surfaces can add later | Chronological thread; defer search to coach tooling if ever. |
| AI replies / auto-correction | "It's an English tutor" | AGENTS coach-first: no AI until coach-validated; explicitly out of scope | Human coach only in v1.1. |

---

## Feature Dependencies

```
Client Profiles (schema: goals, level, locale, tz, a11y prefs, consent fields)
    ├──requires──> v1.0 profiles + coach_clients + RLS helpers (SHIPPED)
    └──enables───> Coach client-detail view (the convergence surface)

Data-Driven Onboarding
    ├──requires──> Client Profiles schema (to store/link responses to a client)
    ├──builds────> shared field-answer vocabulary + one-at-a-time renderer + save/resume
    └──enables───> Coach onboarding review

Tracker Engine
    ├──requires──> Client Profiles (timezone for cadence; assignment relationship)
    ├──reuses────> Onboarding's field-renderer + validator  ◄── sequence onboarding FIRST
    ├──requires──> assignment path (seed / Edge Function, assigned-never-chosen)
    └──enables───> Coach entry review + (later, validated) reward-only progress

Real 1-on-1 Chat
    ├──requires──> coach_clients pair (SHIPPED) for RLS scoping
    ├──requires──> conversation/message/read-state schema + real send Edge Function
    ├──reuses────> presentational chat kit (SHIPPED, currently mock)
    └──independent of──> onboarding/tracker (can be built in parallel)

Reward-only progress / any gamification ──BLOCKED BY──> coach validation (do NOT build in v1.1)
Realtime, attachments, offline queue    ──DEFERRED──> next milestone
```

### Dependency Notes

- **Onboarding before Tracker:** both need a config-driven, one-field-at-a-time renderer + validator over the same answer-type vocabulary (single-select, multi-select, scale, short/long text, boolean, number). Building onboarding first lets the tracker reuse it — a large de-duplication. If the roadmapper sequences them the other way, flag the duplicated renderer as waste.
- **Profiles underpin everything else:** onboarding responses, tracker assignments, and chat all hang off the client identity + the `coach_clients` pair. Profiles first.
- **Chat is parallelizable:** it depends only on the shipped pair relationship + new chat tables, not on onboarding/tracker. It can run alongside them if capacity allows, but it carries the most backend risk (schema + Edge Function + RLS + idempotency).
- **Versioning discipline is shared:** onboarding assessments and tracker configs both need "immutable once used, edits create a new version, responses/entries pin to their version." Design it once, apply twice.
- **Assignment is seed-only this milestone** but the schema must carry the relationship so the later assignment UI (GAP-036) drops in without migration.

---

## MVP Definition

### Launch With (v1.1 — the minimal slice of each that still respects the design law)

- [ ] **Client profile schema + client edit of safe fields + coach read-only detail** — identity, goal text, level (as data), locale/tz (prefilled), 1–2 a11y toggles, consent fields. One primary action on the edit form; role/coach fields unsafe. *(GAP-005/006/007)*
- [ ] **Onboarding: linear one-question-at-a-time renderer from DB config, 6 answer types, autosave + resume, versioned/immutable assessment, calm no-score progress, coach read of answers.** Branching **deferred** to fast-follow. *(GAP-008/009/010/011 minus branching)*
- [ ] **Tracker engine: config schema (fields + daily/weekly cadence + versioning), seed/Edge-Function assignment, single-tracker client renderer + entry save, coach entry review, visual progress.** No reward UI (needs validation). *(GAP-012/013/014/015)*
- [ ] **Real chat: conversation/message/read-state schema + RLS, real idempotent send-message Edge Function, web chat route on live data with optimistic send + `sending/sent/failed` lifecycle + calm empty/oversized/failed handling, coach reads same thread.** Text-only. *(GAP-016/017/018)*

### Add After Validation (v1.x — clear triggers)

- [ ] **Onboarding branching / skip-logic** — trigger: a validated assessment actually needs conditional paths. Ship linear first.
- [ ] **Reward-only progress / return rewards** — trigger: a coach validates the tracking + reward technique manually (coach-first, GAP-033). Never a resetting streak.
- [ ] **Chat draft-preserve-on-failure → full offline retry queue** — trigger: real flaky-connection reports. Minimal draft-preserve can land in v1.1; the queue is v1.x (GAP-020).
- [ ] **Assignment UI (coach/admin)** — trigger: volume outgrows seed-only (GAP-036).

### Future Consideration (v2+ / explicitly deferred)

- [ ] **Realtime, presence, typing, read-receipts** — next chat layer (GAP-019). Kit components already exist, dormant.
- [ ] **Attachments / voice notes / pronunciation** — needs storage + moderation (GAP-021/029).
- [ ] **AI replies, memory, personalization, grammar/vocab pipelines** — coach-validated first (GAP-023+).
- [ ] **Full privacy tooling (export/delete/retention/audit)** — v1.1 captures consent *fields* only; the privacy milestone precedes public launch (GAP-035).
- [ ] **Native iOS/Android, analytics, notifications, admin UI** — out of this milestone.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Client profile schema + RLS (safe/unsafe fields) | HIGH | MEDIUM | P1 |
| Client profile edit (safe fields, one primary action) | HIGH | MEDIUM | P1 |
| Coach client-detail read view | HIGH | MEDIUM | P1 |
| Minimal ND a11y prefs (default-to-system, ≤3 toggles) | HIGH | MEDIUM | P1 |
| Onboarding question-bank schema (versioned, immutable) | HIGH | HIGH | P1 |
| Onboarding one-at-a-time renderer + 6 answer types | HIGH | MEDIUM | P1 |
| Onboarding autosave + resume | HIGH | MEDIUM | P1 |
| Onboarding calm no-score progress | HIGH | LOW | P1 |
| Coach onboarding review | MEDIUM | MEDIUM | P1 |
| Onboarding branching / skip logic | MEDIUM | HIGH | P2 |
| Tracker config schema (fields, cadence, versioning) | HIGH | HIGH | P1 |
| Tracker assignment (seed / Edge Function) | HIGH | MEDIUM | P1 |
| Tracker client renderer + entry save (shared with onboarding) | HIGH | MEDIUM | P1 |
| Coach tracker entry review | MEDIUM | MEDIUM | P1 |
| Reward-only tracker progress | MEDIUM | MEDIUM | P2 (needs coach validation) |
| Conversation/message/read-state schema + RLS | HIGH | HIGH | P1 |
| Real idempotent send-message Edge Function | HIGH | HIGH | P1 |
| Web chat route on live data + optimistic `sending/sent/failed` | HIGH | MEDIUM | P1 |
| Draft-preserve on failed send | MEDIUM | LOW–MED | P2 |
| Realtime / presence / typing / read-receipts | MEDIUM | HIGH | P3 (deferred) |
| Chat attachments / voice | LOW (now) | HIGH | P3 (deferred) |
| Consent metadata as fields | MEDIUM | LOW | P1 (captured, not tooled) |

**Priority key:** P1 = must have for v1.1 launch · P2 = should have / fast-follow with a clear trigger · P3 = future / deferred.

---

## Cross-Feature Anti-Feature Summary (the choice-averse ND lens)

The single reusable rule for the roadmapper: **for a client-facing screen, if a feature adds a choice, a score, a streak, or a scold, it is an anti-feature in FISH regardless of how standard it is elsewhere.** Concretely, do NOT build for clients:

- Plan pickers, template galleries, "choose your habit/assessment/tracker" menus → assigned-never-chosen.
- Scores, percentages-as-judgement, quiz results, adherence % → visual progress only.
- Streaks, "don't break the chain," reset-to-zero counters → reward returning, never punish a gap; don't even store a fragile streak integer.
- Multi-question pages, long scrolling forms, fake-urgency progress → one question/action per screen, save-and-resume.
- Settings buffets / accessibility mega-menus → default to OS/system, expose ≤3 toggles.
- Red/alarming error copy, "you didn't finish!" nudges → calm notice tone, helpful next step.
- Realtime status theater (typing dots, presence, read receipts) in v1.1 → deferred; fewer moving indicators is calmer.
- AI replies / auto-grading → coach-first, not this milestone.

Coach-facing surfaces may use lists, filters, and detail tables (the guideline permits this) — the choice-removal law is a **client-facing** law.

---

## Competitor / Prior-Art Feature Analysis

| Feature | Consumer habit/survey apps | Coach-led lang platforms (Speexx/Preply) | FISH v1.1 Approach |
|---------|---------------------------|------------------------------------------|--------------------|
| Onboarding | Multi-field forms, self-serve level tests with scores | CEFR placement + needs analysis, coach-guided | Data-driven, one-at-a-time, **no score**, coach reviews; level as data not grade |
| Trackers | Template galleries, streaks, adherence % | Coach-assigned assignments/plans | Config engine, **assigned single tracker**, no streak, visual progress |
| Progress | Streaks, XP, leaderboards | Level growth reports | Milestone journey, **reward-only, deferred to validation** |
| Chat | Realtime, reactions, presence, read receipts | 1:1 coach messaging + feedback | Persistent send/read, idempotent, **realtime/reactions deferred**, quoted-reply correction |
| A11y | Big customization panels / "calm mode" profiles | Minimal | **Default to OS**, ≤3 toggles — invert the customization-buffet norm |

---

## Sources

- FISH internal: `.planning/PROJECT.md`, `docs/product-gap-analysis-2026-07-04.md` (GAP-005…GAP-022), `docs/ui-ux-agent-guidelines.md`, `AGENTS.md`, `packages/core/src/chat.ts`, `apps/web/components/chat/` (kit + `types.ts`), `.planning/sketches/` (winners: nav D, chat C, profile A). — HIGH confidence (authoritative for this product).
- [UX Onboarding Best Practices — UX Design Institute](https://www.uxdesigninstitute.com/blog/ux-onboarding-best-practices-guide/) — progressive disclosure, bare-minimum-per-step.
- [Onboarding UX guide — Appcues](https://www.appcues.com/blog/onboarding-ux) — progressive onboarding for learning-curve products.
- [5 fixes that make digital spaces calmer — Know About Accessibility](https://knowaboutaccessibility.org/2025/07/17/5-simple-fixes-that-make-digital-spaces-calmer-for-neurodivergent-and-all-users/) — reduced motion, calm defaults.
- [Designing for Neurodivergent Users — accessiBe](https://accessibe.com/blog/knowledgebase/how-to-design-digital-environments-for-people-with-neuro-divergency) — customizable font/color/spacing/"calm mode" (the buffet norm FISH deliberately narrows).
- [CSS media features for a11y — a11y-blog.dev](https://a11y-blog.dev/en/articles/css-media-features-for-a11y/) — `prefers-reduced-motion` and OS-driven prefs (basis for "default to system").
- [Branching Logic — SurveyJS](https://surveyjs.io/survey-creator/documentation/end-user-guide/branching-logic) and [Branching/skip logic — QuestionPro](https://www.questionpro.com/help/branching-skip-logic.html) — skip-to / show-hide / complete branch types.
- [Survey question types — Sawtooth](https://sawtoothsoftware.com/resources/blog/posts/survey-question-types) — standard answer-type taxonomy.
- [ReproSchema (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12299943/) — survey versioning / change-tracking as a schema concern.
- [Habit tracker data model — DEV](https://dev.to/ariansj/building-a-full-stack-habit-tracker-stage-1-from-idea-to-data-model-4enc), [Lunatask habits](https://lunatask.app/docs/features/habits) — habit config fields, once/many cadence.
- [Coaching Intake Form — Co-Active](https://coactive.com/blog/coaching-intake-form/), [Speexx](https://www.speexx.com/digital-language-learning-and-assessment/), [Preply Business](https://preply.com/en/business-language-training) — coach-led intake, CEFR, coach-defined goals (not self-service).
- [AI Chat Interface Pattern — UX Patterns for Developers](https://uxpatterns.dev/patterns/ai-intelligence/ai-chat) — request lifecycle states, optimistic UI, reconcile-after-failure.
- [Idempotency Patterns — BackendBytes](https://backendbytes.com/articles/idempotency-patterns-distributed-systems/) — client idempotency key stored transactionally, return stored result on retry.

---
*Feature research for: FISH v1.1 "The Coaching Loop" — client profiles · data-driven onboarding · tracker engine · real 1-on-1 chat*
*Researched: 2026-07-04*
