# FISH Product Gap Analysis

Date: 2026-07-04
Scope: current implementation, roadmap/planning artifacts, and read-only Linear workspace state.
Linear action taken: none.

## Sources Reviewed

- Implementation: `apps/web`, `apps/android`, `apps/ios`, `packages/core`, `packages/supabase`, `supabase`, `scripts`.
- Roadmap/planning docs: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, archived planning docs, `.planning/quick/*`, `.planning/sketches/*`.
- Docs: `AGENTS.md`, `README.md`, `docs/recent-changes.md`, `docs/deploy-checklist.md`, `docs/linear-*-tickets-draft.md`, `docs/ui-ux-agent-guidelines.md`.
- Linear: team `Founders`; projects `Web`, `Android`, `iOS`, `Platform`; 26 issues `FISH-1` through `FISH-26`; labels; statuses; status updates; documents.

## Verification Run

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm --filter @fish/web test -- --run` passed: 31 files, 227 tests.
- `pnpm build` passed: core, supabase, web production build, 15 routes.
- Android: `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew app:testDebugUnitTest app:lintDebug app:assembleDebug` passed.

## Executive Summary

FISH has a solid foundation but is not yet a functional AI-powered English-learning chat hub. The implemented product is best described as a calm auth-and-role foundation plus a presentational chat design system. It supports account creation, email verification, password recovery, role-aware routing, seeded coach-client relationships, protected reads with RLS, a web UI kit, Storybook coverage, a web chat component showcase with mock data, and an Android static preview/design-system shell.

The backend does not yet support real chat. There are no conversation tables, message tables, AI provider integration, conversation memory, onboarding assessment, tracker engine, learning personalization, vocabulary tracking, grammar correction, pronunciation feedback, notification system, analytics, settings, or production privacy/ops workflows. `supabase/functions/send-message/index.ts` only validates input and returns `accepted: true`.

The roadmap and Linear are not synchronized. The completed foundation roadmap is archived and mostly matches the implementation, but the current active roadmap is undefined. Implementation has moved beyond the archived roadmap through quick tasks and sketches. Linear has 26 tickets, but many are stale: several open tickets are already implemented locally, several implemented areas have no Linear ticket, and most production-readiness work has no Linear coverage at all. Linear has no initiatives, no status updates, and no documents returned by the connector.

## Coverage Scores

Scoring method: requirement/domain coverage, not story points.

| Area | Coverage |
| --- | ---: |
| Archived foundation roadmap vs implementation | 100% |
| Current active roadmap vs implementation | 0% because no next workstream exists |
| Linear status accuracy vs implementation | about 45% |
| Linear coverage of production-ready AI chat hub | about 20% |
| Functional product coverage for AI-powered English-learning ChatHub | about 15% |
| Release readiness for public launch | 0% |

## Current State Assessment

### Already Implemented

- Web monorepo foundation with pnpm workspaces, Next.js App Router, TypeScript, Tailwind v4 CSS-first config, and tests.
- Web design system: Button, Input, Card, Progress, Alert, theme toggle, global tokens, contrast/focus/icon-source tests.
- Web auth loop: signup, check inbox, confirmation route, login, forgot password, reset password, logout, signed-in redirects.
- Supabase schema foundation: `profiles`, `coach_clients`, hardened signup trigger, role guard, RLS helpers, generated database types.
- Seed and RLS verification scripts for local development.
- Role-aware authenticated shell, client home, coach home, wrong-door redirects, and coach assigned-client list.
- Service abstraction layer under `apps/web/lib/services` with a TSX boundary test preventing direct Supabase imports from UI code.
- Presentational web chat kit under `apps/web/components/chat`, `/kit/chat`, and Storybook stories.
- Android Gradle/Compose foundation, token/theme primitives, Button/TextField, static auth-preview app, launcher/splash assets.
- Foundation archive and audit with verified closeout.
- Design sketches for navigation shell and an untracked chat-interior sketch.

### Partially Implemented

- Client profiles: only `display_name`, `role`, and email-backed profile reads exist; no user-editable client profile, preferences, goals, language level, accessibility preferences, or consent fields.
- Coach tools: coach can view seeded assigned clients only; no assignment UI, client detail view, notes, moderation, or admin operations.
- Chat: UI kit exists, but real chat storage, realtime, permissions, send behavior, conversation list data, retries, attachments, and AI are missing.
- Android: static preview/design-system shell exists; no auth, Supabase, real navigation, chat, offline state, or backend integration.
- Storybook/UI verification: good component coverage, but not a substitute for product routes, live data, or browser/device UAT.
- Deployment: checklist exists, but hosted Supabase/project/env/email-template setup is not executed.
- Accessibility: strong UI floor, but no completed ADHD/autism/dyslexia/executive-function product audit across live workflows.

### Missing

- Active roadmap/requirements for the next workstream.
- Linear initiatives/status updates that express MVP, beta, production, and public launch.
- Current `.planning/REQUIREMENTS.md`; `.planning/PROJECT.md` points to it, but it does not exist.
- Real chat database, RLS policies, send/read/retry/edit/delete behavior, realtime, and moderation.
- AI orchestration, model/provider config, prompts, safety rules, memory, personalization, evaluation, and observability.
- Onboarding assessment and tracker engine from the required build order.
- Vocabulary, grammar, pronunciation, exercises/quizzes, adaptive learning paths, XP/rewards, progress tracking, and coach validation gates.
- Teacher/admin tooling, analytics, notifications, settings, i18n, privacy/export/delete, security hardening, performance budgets, and production ops.
- iOS implementation; `apps/ios` contains only `.DS_Store`.

### Technical Debt

- From the foundation audit: Input missing `aria-describedby`/`aria-invalid`; Alert lacks component-level live-region default; icon-source regex can miss dynamic/subpath imports; `--shadow-card` relies on current Lightning CSS behavior; Tailwind packages use independent caret ranges; stale local seed password drift; two hardcoded `/home` redirects bypass the single-source `authRedirects` convention.
- `AGENTS.md` design-token section still describes old color tokens, while planning docs say the product moved to pure monochrome.
- `README.md` says open port 3000, but web dev script uses port 3001.
- Android tests include source-text assertions; Compose behavior tests are still needed.
- Linear draft follow-ups exist locally but were not published.
- Several Linear tickets are status-stale relative to code.

### Blockers

- No active next workstream.
- No production environment has been stood up.
- No real chat backend.
- No AI architecture or compliance/privacy model.
- No validated onboarding/tracker/learning technique artifacts.
- No release-stage Linear structure.

### Duplicate Or Obsolete Work

- `FISH-5` through `FISH-8` are open in Linear but the role-aware home work is implemented and verified.
- `FISH-9` is obsolete: role-aware home planning is done, yet the ticket remains In Progress.
- `FISH-11`, `FISH-13`, `FISH-14`, `FISH-15`, `FISH-19`, `FISH-20`, `FISH-21` are Web chat UI tickets still in Backlog, while the web chat component kit exists and builds/tests pass.
- `FISH-25` overlaps with already-performed web chat test/review work, but still needs a formal final accessibility/responsive UAT ticket if kept.
- Android chat UI tickets are valid backlog but not supported by an active roadmap workstream.

## Roadmap Alignment

### Roadmap Alignment

| Roadmap Item | Implementation | Linear |
| --- | --- | --- |
| Foundation design system | Complete | Partly represented by `FISH-1` through `FISH-4`, Done |
| Foundation auth/database | Complete | Mostly missing from Linear |
| Foundation role-aware home | Complete | `FISH-5` through `FISH-9` exist but statuses are stale |
| Client profiles | Missing/partial | No Linear ticket |
| Data-driven onboarding | Missing | No Linear ticket |
| Tracker engine | Missing | No Linear ticket |
| 1-on-1 real chat | Missing; UI-only web kit exists | Linear covers UI-only chat, not real chat |
| Shared UI kit | Complete/ongoing | Partly represented |
| Native parity | Android preview partial; iOS missing | Android UI tickets exist; iOS project exists but no tickets |

### Linear Project Alignment

| Linear Project | Current State | Gap |
| --- | --- | --- |
| Web | Contains design, role-home, and chat UI tickets | Missing real chat, onboarding, tracker, AI, analytics, settings, release QA |
| Android | Contains chat UI tickets | No active roadmap workstream; no auth/backend tickets; no production Android roadmap |
| iOS | Exists with no issues | No code and no backlog |
| Platform | Only shared chat UI map ticket | Missing database/chat/AI/security/privacy/ops/platform roadmap |

### Roadmap Items Without Tickets

- Client profile schema, UI, and coach profile view.
- Data-driven onboarding assessment.
- Tracker engine and assigned tracker instances.
- Real 1-on-1 chat backend, web integration, and realtime.
- AI provider orchestration, memory, personalization, evaluations, and safety.
- Vocabulary, grammar, pronunciation, exercises, adaptive learning paths.
- Reward-only progress/achievements and no-reset return rewards.
- Teacher/admin tools, analytics, notifications, settings, i18n, offline/resume, privacy/security/performance/observability.
- Production deployment, staging, CI/CD, environment management, UAT, release readiness, and support runbooks.

### Tickets Without A Current Roadmap Goal

- `FISH-10` through `FISH-26` are not mapped to an active roadmap workstream. They are plausible chat-prep work, but the official roadmap says the next workstream is undefined.
- Android chat UI tickets come before client profiles, onboarding, tracker engine, and real 1-on-1 chat in the AGENTS build order. This is acceptable only if explicitly treated as UI exploration, not product delivery.

### Sequencing Issues

- The required build order says client profiles → onboarding → tracker engine → 1-on-1 chat. Linear currently jumps to chat UI before defining profiles/onboarding/tracker.
- AI/gamification/streak work must not be built before coach validation. Missing validation-gate tickets create risk of building speculative learning mechanics.
- Real chat requires platform/data/security work before UI can become product.
- Production launch needs hosted Supabase, observability, analytics, privacy, QA, and support before any public release.

## Functional Gap Analysis

| Capability | Current State | Gap |
| --- | --- | --- |
| Authentication & onboarding | Auth implemented; onboarding absent | Need data-driven onboarding and resume |
| User profiles | Minimal profiles | Need client/coach profile domains and preferences |
| AI chat experience | No AI | Need provider, orchestration, prompts, safety, UI wiring |
| Conversation memory | None | Need summaries, facts, retrieval, consent/delete |
| Learning personalization | None | Need level/goals/preferences model |
| Vocabulary tracking | None | Need extraction, review queue, coach override |
| Grammar correction | Sketch only | Need correction pipeline, copy rules, storage |
| Pronunciation feedback | None | Need audio capture, STT/scoring, calm feedback |
| Progress tracking | UI component only | Need domain model and visual progress steps |
| XP, achievements, streaks | None | Need reward-only validation; no reset/punishment |
| Adaptive learning paths | None | Need coach-assigned path engine |
| Exercises & quizzes | None | Need data model/rendering/grading |
| Teacher/admin tools | Seed-only assignment and coach list | Need roster, assignment, notes, moderation, admin |
| Analytics | None | Need privacy-safe event taxonomy |
| Notifications | None | Need preferences and reminders |
| Accessibility | Strong UI floor | Need workflow-level ADHD/autism/dyslexia audit and preferences |
| Offline/resume | None | Need drafts, retry, onboarding resume, offline indicators |
| Settings & preferences | None | Need account, accessibility, notification, privacy settings |
| Performance | Build/test health | Need budgets, load/perf tests, realtime scaling checks |
| Security | RLS foundation | Need threat model, AI/data/storage/Edge Function hardening |
| Privacy | Local deploy checklist only | Need consent, retention, export/delete, audit logging |
| Internationalization | None | Need i18n architecture and locale strategy |

Conclusion: the project cannot yet support a fully functional AI-powered chat hub. It can support a calm authenticated shell and presentational chat prototypes.

## Linear Tickets To Create After Review

Format: Priority P0 urgent, P1 high, P2 medium, P3 low. Complexity S/M/L/XL.

### Pre-Publish Checklist, Not Linear Tickets

Do these before creating new Linear issues:

- Clean up stale existing tickets so completed UI work does not look unfinished.
- Park Android UI tickets until native work is an active priority.
- Keep team documentation and internal planning cleanup outside the partner-facing roadmap.
- Confirm the first published tickets start with client profile and onboarding foundations.

### Profiles And Onboarding

#### GAP-005 — Client Profile Domain Schema
- Project: Platform. Workstream: Client Profiles. Priority: P0. Complexity: M.
- Description: Add profile fields for language goals, role context, locale, timezone, accessibility preferences, and consent metadata.
- Business value: Enables personalization without asking clients to choose plans.
- Technical implementation: Supabase migration, RLS policies, generated types, seed update.
- Dependencies: pre-publish cleanup checklist.
- Acceptance criteria: client reads/updates own safe fields; coach reads assigned client profile; role remains protected.
- Test cases: RLS verification for self, assigned coach, unassigned coach, role escalation.
- UAT: client can have a profile that guides coaching without exposing choices.
- Edge cases: missing optional fields, deleted coach assignment, malformed locale/timezone.

#### GAP-006 — Client Profile Web Experience
- Project: Web. Workstream: Client Profiles. Priority: P1. Complexity: M.
- Description: Build calm profile read/edit flow for client-owned safe fields.
- Business value: Lets clients correct basics and accessibility preferences.
- Technical implementation: Server data load, form actions or service calls, validation, one primary action, non-scolding errors.
- Dependencies: GAP-005.
- Acceptance criteria: profile loads; safe fields save; role cannot change; one primary action.
- Test cases: happy save, validation, unauthorized role mutation, keyboard/focus.
- UAT: client updates preferences without seeing plan/template choices.
- Edge cases: network failure, stale session, long names, empty optional fields.

#### GAP-007 — Coach Client Profile View
- Project: Web. Workstream: Client Profiles. Priority: P1. Complexity: M.
- Description: Give coaches an assigned-client profile detail view.
- Business value: Coaches can personalize assignments manually.
- Technical implementation: Route from client list, RLS-scoped read, no cross-client leakage, empty states.
- Dependencies: GAP-005.
- Acceptance criteria: coach sees only assigned clients; client cannot access coach view; rows link deliberately.
- Test cases: assigned/unassigned coach, client wrong-door, empty profile.
- UAT: coach opens a client and sees useful context without editing unsafe fields.
- Edge cases: reassignment during navigation, missing display name, deleted client.

#### GAP-008 — Onboarding Question Bank Schema
- Project: Platform. Workstream: Data-Driven Onboarding. Priority: P0. Complexity: L.
- Description: Store onboarding questions, steps, answer types, branching, and versioning in DB.
- Business value: Meets AGENTS build order and keeps onboarding coach-controlled/data-driven.
- Technical implementation: migrations for assessment versions/questions/options; RLS; admin seed path.
- Dependencies: GAP-005.
- Acceptance criteria: active assessment can be read by clients; no hard-coded questions in UI; versions are immutable once used.
- Test cases: active/inactive assessment reads, malformed config rejection, RLS.
- UAT: coach/product can change question text via seed/admin path without code changes.
- Edge cases: no active assessment, version migration, branching loops.

#### GAP-009 — Onboarding Response Storage And Resume
- Project: Platform. Workstream: Data-Driven Onboarding. Priority: P0. Complexity: M.
- Description: Persist responses, completion state, timestamps, and resume position.
- Business value: Supports executive-function needs by letting clients leave and return.
- Technical implementation: response tables, unique constraints, RLS, server helpers.
- Dependencies: GAP-008.
- Acceptance criteria: client saves progress; coach reads assigned client's completed responses; partial resume works.
- Test cases: autosave, reload, duplicate submit, unassigned coach denied.
- UAT: client can close the browser mid-onboarding and resume calmly.
- Edge cases: assessment version changes mid-session, empty answer, slow connection.

#### GAP-010 — Data-Driven Onboarding Renderer
- Project: Web. Workstream: Data-Driven Onboarding. Priority: P0. Complexity: L.
- Description: Render one calm onboarding question at a time from DB config.
- Business value: Collects personalization inputs without choice overload.
- Technical implementation: protected route, step renderer, input components, save/resume, progress visual, no scores.
- Dependencies: GAP-008, GAP-009.
- Acceptance criteria: one primary action; data-driven fields; progress visual; accessible error handling.
- Test cases: each answer type, validation, resume, reduced motion, keyboard.
- UAT: client completes onboarding without seeing a menu of plans.
- Edge cases: missing config, unsupported field type, long question copy.

#### GAP-011 — Coach Onboarding Review
- Project: Web. Workstream: Data-Driven Onboarding. Priority: P1. Complexity: M.
- Description: Show submitted onboarding answers to the assigned coach.
- Business value: Lets coaches validate learning strategy manually before automation.
- Technical implementation: coach route section, summaries, RLS-scoped reads, no edits initially.
- Dependencies: GAP-009, GAP-007.
- Acceptance criteria: coach sees only assigned responses; empty/incomplete states are clear.
- Test cases: complete, partial, unassigned access denied.
- UAT: coach can plan a session from onboarding answers.
- Edge cases: changed assessment version, deleted answer, long free text.

### Tracker Engine And Assignments

#### GAP-012 — Tracker Configuration Schema
- Project: Platform. Workstream: Tracker Engine. Priority: P0. Complexity: L.
- Description: Define tracker config, fields, cadence, visual progress, validation, and versioning.
- Business value: Builds the engine before templates, honoring coach-first rules.
- Technical implementation: migrations, type contracts, RLS, config validation.
- Dependencies: GAP-005.
- Acceptance criteria: tracker configs are versioned; clients cannot browse configs; coach/admin can assign a config.
- Test cases: valid/invalid config, RLS, version immutability.
- UAT: product can define a tracker without code hard-coding.
- Edge cases: retired config, missing field, incompatible version.

#### GAP-013 — Tracker Assignment Command
- Project: Platform. Workstream: Tracker Engine. Priority: P0. Complexity: M.
- Description: Add Edge Function for coach/admin assigning a tracker to a client.
- Business value: Preserves assigned-never-chosen product rule.
- Technical implementation: Edge Function, service-role write, authorization check, audit row.
- Dependencies: GAP-012, GAP-007.
- Acceptance criteria: assigned coach can assign; unassigned coach cannot; client cannot self-assign.
- Test cases: auth, RLS, duplicate assignment, reassignment.
- UAT: coach assigns exactly one next tracker to a client.
- Edge cases: client already has active tracker, config retired, function retry.

#### GAP-014 — Client Tracker Renderer
- Project: Web. Workstream: Tracker Engine. Priority: P1. Complexity: L.
- Description: Render the assigned tracker from config and save entries.
- Business value: Gives clients one next action without templates/galleries.
- Technical implementation: data load, field renderer, entry storage, progress visual, optimistic save.
- Dependencies: GAP-012, GAP-013.
- Acceptance criteria: no tracker picker; one primary action; visual progress only; entries persist.
- Test cases: field types, empty assignment, save failure, resume.
- UAT: client sees and completes the assigned tracker calmly.
- Edge cases: expired assignment, config version mismatch, offline draft.

#### GAP-015 — Coach Tracker Review
- Project: Web. Workstream: Tracker Engine. Priority: P1. Complexity: M.
- Description: Show tracker entries to coaches and support manual coaching decisions.
- Business value: Closes coach-first feedback loop.
- Technical implementation: assigned-client detail section, entry timeline, filters kept minimal.
- Dependencies: GAP-014.
- Acceptance criteria: coach sees assigned client entries; client privacy boundaries hold; no scoring UI.
- Test cases: assigned/unassigned, empty, long history.
- UAT: coach can discuss tracker progress in session.
- Edge cases: deleted tracker, many entries, timezone display.

### Real Chat Foundation

#### GAP-016 — Conversation And Message Schema
- Project: Platform. Workstream: Real 1-on-1 Chat. Priority: P0. Complexity: L.
- Description: Add conversations, messages, participants, message status, and read-state tables.
- Business value: Turns chat from UI mock to product foundation.
- Technical implementation: Supabase migrations, RLS for client/coach pairs, generated types, seed data.
- Dependencies: GAP-005.
- Acceptance criteria: assigned client and coach can read their conversation; outsiders cannot; messages are immutable except allowed metadata.
- Test cases: client/coach read, unassigned denial, role escalation, status updates.
- UAT: seeded client and coach can see the same conversation.
- Edge cases: reassignment, deleted user, empty conversation, duplicate client request id.

#### GAP-017 — Real Send Message Edge Function
- Project: Platform. Workstream: Real 1-on-1 Chat. Priority: P0. Complexity: L.
- Description: Replace validation-only `send-message` with authorized persistence.
- Business value: Enables actual conversation.
- Technical implementation: JWT verification, conversation membership check, insert message, idempotency, rate limits, calm errors.
- Dependencies: GAP-016.
- Acceptance criteria: sends persist; unauthorized sends rejected; long/empty messages rejected; idempotent retries.
- Test cases: happy path, unauthorized, duplicate `clientRequestId`, RLS, rate limit.
- UAT: client sends message and coach can read it.
- Edge cases: network retry, deleted conversation, concurrent sends.

#### GAP-018 — Web Chat Route With Live Data
- Project: Web. Workstream: Real 1-on-1 Chat. Priority: P0. Complexity: L.
- Description: Wire the web chat UI kit to real conversations/messages.
- Business value: Delivers the first usable ChatHub experience.
- Technical implementation: `/messages` or selected route, server load, send action, optimistic UI, error/retry states.
- Dependencies: GAP-016, GAP-017.
- Acceptance criteria: conversation list and thread load real data; send works; one primary action; no mock data in product route.
- Test cases: empty, loaded, send fail/retry, unauthorized route, long messages.
- UAT: client and coach exchange messages in browser.
- Edge cases: realtime lag, duplicate messages, slow initial load.

#### GAP-019 — Realtime, Presence, Typing, And Read State
- Project: Platform. Workstream: Real 1-on-1 Chat. Priority: P1. Complexity: L.
- Description: Implement Supabase realtime subscriptions for message updates and quiet presence.
- Business value: Makes chat feel alive without clutter.
- Technical implementation: channel naming, RLS-compatible subscriptions, typing events, read receipts, fallback polling.
- Dependencies: GAP-018.
- Acceptance criteria: new messages appear without refresh; typing/read states are calm; fallback works.
- Test cases: two browser sessions, reconnect, permission denial.
- UAT: coach sees client message appear while viewing thread.
- Edge cases: duplicate events, offline reconnect, multiple tabs.

#### GAP-020 — Offline Drafts And Retry Queue
- Project: Web. Workstream: Real 1-on-1 Chat. Priority: P1. Complexity: M.
- Description: Preserve unsent messages and retry failed sends.
- Business value: Supports executive-function needs and reduces anxiety after connection loss.
- Technical implementation: local draft state, retry queue keyed by `clientRequestId`, clear status copy.
- Dependencies: GAP-018.
- Acceptance criteria: draft survives route change/refresh; failed sends can retry; no silent loss.
- Test cases: offline send, refresh with draft, duplicate retry.
- UAT: client writes a message, loses connection, returns without losing text.
- Edge cases: stale conversation, logout, local storage unavailable.

#### GAP-021 — Chat Attachments And Storage Permissions
- Project: Platform. Workstream: Real 1-on-1 Chat. Priority: P2. Complexity: L.
- Description: Add file/image/audio attachment upload if coach validation says it is needed for MVP.
- Business value: Supports voice notes/pronunciation artifacts when validated.
- Technical implementation: storage buckets, signed upload flow, virus/type/size checks, message attachment rows.
- Dependencies: GAP-016, validation decision.
- Acceptance criteria: allowed files upload; unauthorized reads denied; failed upload explains calmly.
- Test cases: type/size limits, unauthorized access, storage failure.
- UAT: client attaches a supported audio/image and coach can access it.
- Edge cases: interrupted upload, deleted object, unsupported file.

#### GAP-022 — Chat Moderation And Safety Escalation
- Project: Platform. Workstream: Real 1-on-1 Chat. Priority: P1. Complexity: L.
- Description: Add moderation checks for abuse, self-harm, PII overexposure, and unsafe AI output paths.
- Business value: Protects vulnerable users and coaches.
- Technical implementation: policy definitions, pre/post-send checks, manual escalation queue, audit log.
- Dependencies: GAP-017, GAP-027.
- Acceptance criteria: unsafe content is handled; coach/admin can review; client copy is non-scolding.
- Test cases: flagged message, false positive, bypass attempt, audit log.
- UAT: reviewer sees a calm blocked/review state.
- Edge cases: multilingual content, quoted unsafe text, AI/tool failure.

### AI Learning System

#### GAP-023 — AI Provider Abstraction And Secrets
- Project: Platform. Workstream: AI Chat. Priority: P0. Complexity: M.
- Description: Create provider-neutral AI service layer and environment configuration.
- Business value: Enables AI work without coupling UI to one model.
- Technical implementation: Edge Function/service adapter, secret management, timeout/retry/error contracts.
- Dependencies: GAP-016.
- Acceptance criteria: provider calls happen server-side only; no secrets in browser; errors normalize.
- Test cases: success, timeout, malformed response, missing env.
- UAT: test prompt returns a safe structured response in non-prod.
- Edge cases: provider outage, rate limit, partial output.

#### GAP-024 — AI Conversation Orchestrator
- Project: Platform. Workstream: AI Chat. Priority: P0. Complexity: XL.
- Description: Build AI reply pipeline for coach-approved English practice conversations.
- Business value: Core AI-powered chat capability.
- Technical implementation: prompt templates, user context, conversation windowing, safety rules, response persistence, evaluation hooks.
- Dependencies: GAP-023, GAP-016, GAP-022.
- Acceptance criteria: AI can reply in a bounded conversation; output follows FISH voice; unsafe output blocked; coach mode can be disabled.
- Test cases: normal reply, correction request, unsafe input, long conversation, provider failure.
- UAT: client receives a helpful non-scolding English-practice reply.
- Edge cases: hallucinated assignments, overlong response, mixed-language text.

#### GAP-025 — Conversation Memory And Summaries
- Project: Platform. Workstream: AI Chat. Priority: P0. Complexity: L.
- Description: Store consented long-term memory, rolling summaries, and user facts.
- Business value: Lets AI personalize without rereading unlimited chat history.
- Technical implementation: memory tables, summarization job/function, RLS, delete/export hooks.
- Dependencies: GAP-024, GAP-035.
- Acceptance criteria: summaries update; sensitive data classification exists; client can delete/export later.
- Test cases: summary creation, update, RLS, deletion.
- UAT: returning client sees AI remember a safe preference.
- Edge cases: incorrect memory correction, stale facts, privacy opt-out.

#### GAP-026 — Learning Personalization Profile
- Project: Platform. Workstream: AI Chat. Priority: P0. Complexity: L.
- Description: Combine onboarding, coach notes, tracker data, and memory into a personalization profile.
- Business value: Makes learning adaptive without giving clients overwhelming choices.
- Technical implementation: derived profile service, confidence fields, coach override, audit trail.
- Dependencies: GAP-010, GAP-015, GAP-025.
- Acceptance criteria: AI receives bounded personalization; coach can inspect/override; no hidden grading exposed to client.
- Test cases: missing inputs, coach override, stale data.
- UAT: coach sees why AI is adapting practice.
- Edge cases: contradictory preferences, low confidence, opt-out.

#### GAP-027 — Grammar Correction Pipeline
- Project: Platform. Workstream: AI Learning Features. Priority: P1. Complexity: L.
- Description: Detect grammar issues and produce gentle corrections in an approved style.
- Business value: Key English-learning outcome.
- Technical implementation: correction schema, AI extraction, storage, UI contract, safety copy.
- Dependencies: GAP-024, coach validation of correction style.
- Acceptance criteria: correction includes original, suggestion, explanation, confidence; never red/scolding; coach can disable.
- Test cases: no issue, multiple issues, ambiguous text, unsafe text.
- UAT: client receives a correction that feels encouraging.
- Edge cases: dialect/variant differences, code-switching, slang.

#### GAP-028 — Vocabulary Extraction And Review Queue
- Project: Platform. Workstream: AI Learning Features. Priority: P1. Complexity: L.
- Description: Track useful vocabulary from chats and coach assignments.
- Business value: Turns conversations into retained learning.
- Technical implementation: vocabulary tables, extraction job, review status, coach approval, client review UI later.
- Dependencies: GAP-024, GAP-026.
- Acceptance criteria: terms captured with context; duplicates merge; coach can approve/remove.
- Test cases: duplicate terms, phrase vs word, RLS.
- UAT: coach sees suggested vocabulary from a chat.
- Edge cases: proper nouns, sensitive words, mistranslation.

#### GAP-029 — Pronunciation Feedback Pipeline
- Project: Platform. Workstream: AI Learning Features. Priority: P2. Complexity: XL.
- Description: Add voice capture/STT/pronunciation feedback after manual validation.
- Business value: Supports spoken English improvement.
- Technical implementation: audio upload, STT provider, scoring rubric, feedback schema, privacy handling.
- Dependencies: GAP-021, GAP-023, validation decision.
- Acceptance criteria: audio feedback is calm, actionable, and optional; files are protected.
- Test cases: clear audio, noisy audio, unsupported file, provider failure.
- UAT: client records a phrase and receives gentle feedback.
- Edge cases: dialect bias, silence, background speech.

#### GAP-030 — Exercise And Quiz Engine
- Project: Platform. Workstream: Exercises. Priority: P2. Complexity: XL.
- Description: Build coach-assigned exercise configs and response evaluation without client browsing.
- Business value: Enables practice beyond chat.
- Technical implementation: exercise schema, assignment, renderer contracts, grading/correction storage.
- Dependencies: GAP-012, GAP-026.
- Acceptance criteria: coach assigns; client completes; no public exercise gallery; feedback is non-scolding.
- Test cases: multiple exercise types, save/resume, validation.
- UAT: client completes one assigned exercise calmly.
- Edge cases: partial completion, answer ambiguity, stale exercise version.

#### GAP-031 — Adaptive Learning Path Planner
- Project: Platform. Workstream: AI Learning Features. Priority: P2. Complexity: XL.
- Description: Generate suggested next steps for coaches from profile, chat, tracker, and exercise data.
- Business value: Speeds coach work while keeping coach in control.
- Technical implementation: planner service, recommendations table, coach approve/reject, audit.
- Dependencies: GAP-026, GAP-030.
- Acceptance criteria: suggestions are coach-facing only; client never browses paths; coach approval required.
- Test cases: missing data, conflicting data, unsafe suggestion.
- UAT: coach reviews and assigns an AI-suggested next step.
- Edge cases: over-personalization, outdated recommendation, low confidence.

### Progress, Rewards, And Accessibility

#### GAP-032 — Visual Progress Model
- Project: Platform. Workstream: Progress. Priority: P1. Complexity: L.
- Description: Model progress steps without percentages-as-judgement.
- Business value: Helps users see movement without shame.
- Technical implementation: progress-step tables, derived progress service, UI contracts.
- Dependencies: GAP-014, GAP-030.
- Acceptance criteria: progress renders visually; no score/grade language; coach can contextualize.
- Test cases: no progress, partial, completed, reset not allowed.
- UAT: client sees progress as encouraging, not evaluative.
- Edge cases: long gap, reassigned tracker, archived exercise.

#### GAP-033 — Reward-Only Achievements And Return Rewards
- Project: Platform. Workstream: Progress. Priority: P2. Complexity: L.
- Description: Add achievements/XP only after coach validation, with no punishing streak resets.
- Business value: Encourages return without abandonment triggers.
- Technical implementation: reward events, display rules, no-reset streak alternative, validation docs.
- Dependencies: GAP-032, coach validation.
- Acceptance criteria: no broken streak display; returning after a gap is rewarded; feature flag available.
- Test cases: consecutive days, long gap, timezone change.
- UAT: client returns after a week and sees encouragement, not failure.
- Edge cases: DST/timezone, duplicate events, disabled rewards.

#### GAP-034 — Neurodivergent Accessibility Audit And Preferences
- Project: Web. Workstream: Accessibility. Priority: P0. Complexity: L.
- Description: Audit and implement preferences for ADHD, autism, dyslexia, and executive-function support.
- Business value: This is the core audience, not a nice-to-have.
- Technical implementation: audit live flows, add preferences such as reduced motion, density, text size where validated, update tokens/components.
- Dependencies: GAP-006, GAP-010, GAP-018.
- Acceptance criteria: audit findings logged; critical issues fixed; preferences persist; no extra choice overload.
- Test cases: keyboard, screen reader labels, reduced motion, long text, small screens.
- UAT: target users can complete auth/onboarding/chat without overload.
- Edge cases: preference defaults, reset preferences, system setting conflicts.

#### GAP-035 — Privacy, Consent, Export, And Delete
- Project: Platform. Workstream: Privacy. Priority: P0. Complexity: XL.
- Description: Implement privacy controls for profiles, conversations, AI memory, audio, and analytics.
- Business value: Required for trust and launch.
- Technical implementation: consent records, retention policies, export/delete flows, memory deletion, audit logs.
- Dependencies: GAP-016, GAP-025, GAP-043.
- Acceptance criteria: user can request/export/delete data; memory respects consent; policy docs exist.
- Test cases: export completeness, delete cascade, RLS after delete.
- UAT: user can understand and exercise privacy controls.
- Edge cases: legal hold, coach notes, deleted coach/client relationship.

### Teacher/Admin, Analytics, Notifications

#### GAP-036 — Coach Assignment Management
- Project: Web. Workstream: Coach Tools. Priority: P1. Complexity: L.
- Description: Replace seed-only assignment with vetted coach/admin assignment UI or command.
- Business value: Enables real operations beyond local seed.
- Technical implementation: Edge Function, coach/admin authorization, simple roster UI, audit.
- Dependencies: GAP-007.
- Acceptance criteria: assignment/reassignment works; no self-service client selection; RLS verifies.
- Test cases: assign, reassign, unauthorized, duplicate.
- UAT: admin assigns a client to a coach and both views update.
- Edge cases: existing active chat/tracker, deleted user, concurrent reassignment.

#### GAP-037 — Coach Dashboard And Client Work Queue
- Project: Web. Workstream: Coach Tools. Priority: P1. Complexity: L.
- Description: Build coach dashboard showing assigned clients, unread messages, onboarding/tracker status, and next action.
- Business value: Helps coaches work efficiently without clutter.
- Technical implementation: aggregated server reads, minimal list UI, no broad filters unless needed.
- Dependencies: GAP-011, GAP-015, GAP-018.
- Acceptance criteria: coach sees only assigned clients; states are scan-friendly; one primary action per view.
- Test cases: empty, many clients, unread, missing data.
- UAT: coach chooses the next client to support quickly.
- Edge cases: stale unread state, reassigned client, large roster.

#### GAP-038 — Admin Role And Vetting Workflow
- Project: Platform. Workstream: Admin. Priority: P1. Complexity: L.
- Description: Add admin role/tools for coach creation, role changes, and operational support.
- Business value: Removes unsafe manual DB edits while preserving coach vetting.
- Technical implementation: role model extension, admin-only functions, audit log, minimal admin UI.
- Dependencies: GAP-035.
- Acceptance criteria: only admins can promote coaches; all role changes audited; clients cannot self-escalate.
- Test cases: admin/non-admin, audit records, failed promotion.
- UAT: Franz promotes a vetted coach without SQL.
- Edge cases: demotion, orphaned assignments, admin lockout.

#### GAP-039 — Privacy-Safe Analytics Event Taxonomy
- Project: Platform. Workstream: Analytics. Priority: P1. Complexity: M.
- Description: Define and implement minimal product analytics without sensitive language content.
- Business value: Measures adoption and abandonment risks.
- Technical implementation: event schema, client/server emitters, consent, dashboards/runbook.
- Dependencies: GAP-035.
- Acceptance criteria: no raw message bodies; consent respected; key funnels tracked.
- Test cases: event validation, opt-out, anonymous aggregation.
- UAT: team can see auth/onboarding/chat funnel without reading private content.
- Edge cases: offline event buffering, duplicate events, deleted user.

#### GAP-040 — Technical Observability And Error Tracking
- Project: Platform. Workstream: Operations. Priority: P0. Complexity: M.
- Description: Add structured logs, error tracking, and health checks for web, Edge Functions, Supabase, and AI.
- Business value: Production issues become diagnosable.
- Technical implementation: logger, request ids, function error reports, alert thresholds, dashboards.
- Dependencies: GAP-023.
- Acceptance criteria: errors have correlation ids; AI/provider failures are visible; no secrets logged.
- Test cases: simulated function failure, provider timeout, auth error.
- UAT: operator can find why a send failed.
- Edge cases: high volume, log sampling, PII redaction.

#### GAP-041 — Notification Preferences And Reminder System
- Project: Platform. Workstream: Notifications. Priority: P2. Complexity: L.
- Description: Add opt-in reminders for assigned work and unread coach messages.
- Business value: Helps clients return without pressure.
- Technical implementation: preferences table, email/push architecture, scheduled function, unsubscribe.
- Dependencies: GAP-035, GAP-039.
- Acceptance criteria: reminders are opt-in/configurable; copy is non-scolding; unsubscribe works.
- Test cases: opt-in/out, delivery failure, timezone.
- UAT: client receives one calm reminder and can turn it off.
- Edge cases: quiet hours, multiple reminders, email bounce.

### Security, Performance, Native, Release

#### GAP-042 — Security Threat Model And RLS Audit
- Project: Platform. Workstream: Security. Priority: P0. Complexity: L.
- Description: Audit auth, RLS, Edge Functions, storage, AI, analytics, and admin paths.
- Business value: Protects user data and launch readiness.
- Technical implementation: threat model, policy review, automated RLS tests, dependency/secrets review.
- Dependencies: GAP-016, GAP-023, GAP-035.
- Acceptance criteria: all tables have RLS; command writes authorize; secrets not exposed; findings triaged.
- Test cases: cross-user reads/writes, service-role misuse, storage access.
- UAT: reviewer signs off on no known P0/P1 security gaps.
- Edge cases: deleted users, reassignment, admin override.

#### GAP-043 — Performance Budgets And Load Tests
- Project: Platform. Workstream: Performance. Priority: P1. Complexity: M.
- Description: Define budgets and tests for auth, onboarding, chat, realtime, AI latency, and mobile.
- Business value: Keeps calm UI from feeling sluggish or unstable.
- Technical implementation: Lighthouse/Playwright budgets, function timing, DB query checks, Android baseline.
- Dependencies: GAP-018, GAP-024.
- Acceptance criteria: budgets documented; CI or manual gate exists; regressions fail.
- Test cases: long conversation, many clients, slow AI, mobile viewport.
- UAT: chat stays usable on typical low-end/mobile conditions.
- Edge cases: provider latency, large message history, flaky network.

#### GAP-044 — Internationalization Architecture
- Project: Platform. Workstream: i18n. Priority: P2. Complexity: M.
- Description: Add i18n strategy for UI copy and English-learning content.
- Business value: Prevents hard-coded English UI from blocking future learners/coaches.
- Technical implementation: message catalog, locale detection/preference, date/time formatting, content rules.
- Dependencies: GAP-006.
- Acceptance criteria: new UI copy uses catalog; user locale stored; date/time stable.
- Test cases: default locale, unsupported locale, long translated strings.
- UAT: interface can switch to a pilot locale without layout breakage.
- Edge cases: RTL future, mixed-language learning content, fallback copy.

#### GAP-045 — Android Auth And Backend Integration
- Project: Android. Workstream: Native MVP. Priority: P2. Complexity: XL.
- Description: Connect Android preview app to real auth, profiles, and role-aware navigation.
- Business value: Starts native app parity.
- Technical implementation: Supabase Kotlin or approved client, auth screens, session storage, RLS reads, navigation.
- Dependencies: GAP-005, production native priority decision.
- Acceptance criteria: Android can login/logout and show role home with real data.
- Test cases: auth success/failure, session restore, role guard, offline.
- UAT: seeded client logs into Android and sees calm home.
- Edge cases: expired session, deep links, device rotation.

#### GAP-046 — iOS Project Bootstrap
- Project: iOS. Workstream: Native MVP. Priority: P3. Complexity: XL.
- Description: Create real SwiftUI iOS project foundation or update docs if iOS is deferred.
- Business value: Aligns repo claims with reality.
- Technical implementation: Xcode project, token constants, basic shell, tests/previews, CI notes.
- Dependencies: native priority decision.
- Acceptance criteria: `apps/ios/FISH.xcodeproj` exists or docs state iOS deferred; build instructions work.
- Test cases: clean build, preview, lint if available.
- UAT: iOS foundation opens in Xcode.
- Edge cases: signing, asset parity, font licensing.

#### GAP-047 — End-to-End UAT And Regression Suite
- Project: Platform. Workstream: QA. Priority: P0. Complexity: L.
- Description: Add Playwright/UAT coverage for auth, onboarding, tracker, chat, privacy, and role boundaries.
- Business value: Prevents regressions across launch-critical flows.
- Technical implementation: Playwright setup, seeded test users, CI/local scripts, UAT scripts.
- Dependencies: GAP-018, GAP-010, GAP-014.
- Acceptance criteria: critical flows automated; manual UAT scripts exist; failures are actionable.
- Test cases: signup/verify, login, onboarding, tracker, chat send, wrong-door.
- UAT: Franz can run a release checklist and know pass/fail.
- Edge cases: email link expiry, mobile viewport, reduced motion.

#### GAP-048 — Production Environment And Launch Runbooks
- Project: Platform. Workstream: Release Readiness. Priority: P0. Complexity: L.
- Description: Execute hosted Supabase/deploy setup and create operational runbooks.
- Business value: Enables real users safely.
- Technical implementation: hosted Supabase link, env vars, email templates, deploy platform, backup/restore, incident/support runbooks.
- Dependencies: GAP-035, GAP-040, GAP-042.
- Acceptance criteria: staging/prod exist; migrations applied; auth emails work; rollback/support documented.
- Test cases: staging signup email, reset email, RLS verify, backup restore drill.
- UAT: invited user can sign up in staging from a real email.
- Edge cases: email deliverability, migration failure, secret rotation.

## Release Readiness

### MVP

Not ready. MVP blockers: no active workstream, no client profiles beyond display name, no onboarding, no tracker engine, no real chat backend, no production environment, no privacy baseline.

Minimum MVP should include profiles, data-driven onboarding, tracker engine, real 1-on-1 coach/client chat, hosted staging, privacy baseline, and UAT.

### Beta

Not ready. Beta blockers: no AI architecture, no memory/personalization, no coach tools beyond seeded list, no analytics, no notifications/preferences, no security audit, no performance budgets, no production observability.

### Production

Not ready. Production blockers: no public environment, no support/incident runbooks, no privacy export/delete, no admin/vetting workflow, no threat model, no load/performance validation, no release QA matrix.

### Public Launch

Not ready. Public launch blockers: everything above plus onboarding scale, coach operations, moderation/safety, analytics, legal/privacy artifacts, support process, and a validated learning loop.

## Recommended Implementation Order

1. Finish pre-publish cleanup outside Linear: stale ticket cleanup, Android parking, and team instruction cleanup.
2. Build client profiles: GAP-005 through GAP-007.
3. Build data-driven onboarding: GAP-008 through GAP-011.
4. Build tracker engine: GAP-012 through GAP-015.
5. Build real 1-on-1 chat: GAP-016 through GAP-022.
6. Add AI chat and memory: GAP-023 through GAP-026.
7. Add learning features only after coach validation: GAP-027 through GAP-033.
8. Add accessibility/privacy/ops/security/performance release gates: GAP-034 through GAP-044.
9. Decide native scope: GAP-045 and GAP-046.
10. Complete release QA and production runbooks: GAP-047 and GAP-048.

## Critical Path To Launch

Board cleanup → client profile model → onboarding data model/renderer → tracker config/assignment/renderer → conversation/message schema → real send Edge Function → web chat route → AI provider/orchestrator → memory/personalization → privacy/security/observability → UAT/performance → staging/prod deploy → beta cohort → production launch.

## Final Assessment

The codebase is healthy and well-tested for what it currently is. The risk is not code quality; the risk is product/backlog illusion. The UI and planning artifacts make the app feel closer to a ChatHub than it is. The actual production path still needs the data model, command functions, AI system, privacy/security/ops, and coach-validated learning loops.

No Linear changes should be made until the proposed GAP tickets are reviewed and grouped into a clear workstream structure.
