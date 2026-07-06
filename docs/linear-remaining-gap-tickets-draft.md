# Linear Remaining Gap Tickets Draft

Draft status: review only. Do not publish to Linear until Franz approves.
Linear changes made: none.
Last drafted: 2026-07-04.

## Scope

This file drafts the remaining production-readiness tickets that were identified in `docs/product-gap-analysis-2026-07-04.md` but were not fully expanded in `docs/linear-sample-gap-tickets-draft.md`.

The sample draft already covers these 8 publishable tickets:

- GAP-005: Client Profile Domain Schema
- GAP-008: Data-Driven Onboarding Question Bank
- GAP-009: Onboarding Response Storage and Resume
- GAP-016: Conversation and Message Schema
- GAP-017: Real Send Message Edge Function
- GAP-018: Web Chat Route With Real Data
- GAP-023: AI Provider Abstraction and Safe Reply Contract
- GAP-035: Privacy, Consent, Export, and Delete Baseline

GAP-001 through GAP-004 are pre-publish cleanup items, not Linear tickets. Keep them as an internal checklist before adding new work to the board.

This file covers the other 36 publishable tickets. Together, the two draft files cover all 44 publishable product/platform tickets identified after the pre-publish cleanup items are removed.

## Publishing Guidance

- Finish the pre-publish cleanup checklist before adding new backlog volume.
- Publish in dependency order, not all at once.
- Replace dependency titles with Linear issue IDs after tickets are created.
- Keep learning features behind coach validation. Do not build unvalidated grammar, vocabulary, pronunciation, exercises, paths, or rewards as client-facing automation.
- Keep client-facing screens calm: one primary action, no plan galleries, no punitive progress language.

## Suggested Sprint Grouping

| Sprint | Outcome | Tickets |
| --- | --- | --- |
| Sprint 1 | Client profile data and client profile UI | GAP-005, GAP-006 |
| Sprint 2 | Coach profile view and onboarding data foundation | GAP-007, GAP-008, GAP-009 |
| Sprint 3 | Onboarding UI and coach review | GAP-010, GAP-011 |
| Sprint 4 | Tracker engine foundation | GAP-012, GAP-013 |
| Sprint 5 | Tracker client and coach loop | GAP-014, GAP-015 |
| Sprint 6 | Real chat foundation | GAP-016, GAP-017, GAP-018 |
| Sprint 7 | Chat reliability and safety | GAP-019, GAP-020, GAP-021, GAP-022 |
| Sprint 8 | AI chat foundation | GAP-023, GAP-024, GAP-025 |
| Sprint 9 | Personalization and validated learning | GAP-026, GAP-027, GAP-028 |
| Sprint 10 | Advanced learning | GAP-029, GAP-030, GAP-031 |
| Sprint 11 | Progress, rewards, accessibility | GAP-032, GAP-033, GAP-034 |
| Sprint 12 | Coach/admin operations | GAP-036, GAP-037, GAP-038 |
| Sprint 13 | Analytics, notifications, operations | GAP-039, GAP-040, GAP-041 |
| Sprint 14 | Security, performance, localization | GAP-042, GAP-043, GAP-044 |
| Sprint 15 | Native scope decision and foundations | GAP-045, GAP-046 |
| Sprint 16 | QA and launch readiness | GAP-047, GAP-048 |

---

## Pre-Publish Checklist

Do this before creating new Linear issues. These are not tickets.

- Clean up old Linear tickets so completed UI work does not look unfinished.
- Park Android UI tickets until native work is an active priority.
- Keep board cleanup and team documentation updates outside the partner-facing roadmap.
- Confirm the first publish batch starts with client profile and onboarding foundations.

---

# Ticket R01: Let Clients View And Update Their Profile

Linear fields:

- Source gap: GAP-006
- Project: Web
- Suggested workstream: Client Profiles
- Suggested sprint: Sprint 1
- Labels: Web, Profiles, Accessibility
- Priority: P1
- Estimated complexity: M
- Execution type: AFK
- Status: Draft

## Description

Give clients a simple profile screen where they can review and update the information that helps FISH support them.

## Business value

Clients can correct the basics that shape their learning support without being asked to choose plans, templates, or learning paths.

## What is included

- A client profile screen.
- Editable fields for safe basics such as name, timezone, language goals, and accessibility preferences.
- Clear save behavior.
- Calm validation messages.
- One primary action.
- Keyboard and screen-reader accessible form controls.

## What is not included

- No role editing.
- No plan or template picker.
- No coach notes editing.
- No AI personalization behavior.

## Technical implementation

1. Load the signed-in client's profile through the approved data-access path.
2. Render safe editable fields using existing UI components.
3. Save through the approved write path.
4. Prevent role, coach assignment, or ownership changes.
5. Add focused tests for validation and authorization.

## Dependencies

- Client Profile Domain Schema.

## Acceptance criteria

- [ ] Client can load their profile.
- [ ] Client can save safe editable fields.
- [ ] Client cannot change role, assigned coach, or protected metadata.
- [ ] Screen has at most one primary action.
- [ ] Error copy is calm and actionable.

## Test cases

- Happy path save.
- Validation failure.
- Attempted role mutation.
- Expired session.
- Keyboard-only save flow.
- Mobile viewport layout.

## UAT scenarios

- Client updates their timezone and accessibility preferences, saves once, and sees the updated profile after refresh.
- Client tries to leave optional fields blank and is not blocked unnecessarily.

## Edge cases

- Long display names.
- Unsupported locale or timezone.
- Missing optional fields from older seed data.
- Network failure during save.

## Definition of Done

- Client profile screen works against real profile data.
- Tests cover validation and protected fields.

---

# Ticket R02: Coach Client Profile View

Linear fields:

- Source gap: GAP-007
- Project: Web
- Suggested workstream: Client Profiles
- Suggested sprint: Sprint 2
- Labels: Web, Profiles, Coach Tools
- Priority: P1
- Estimated complexity: M
- Execution type: AFK
- Status: Draft

## Description

Give coaches a profile detail view for assigned clients so they can understand a client's context before assigning onboarding, trackers, or chat support.

## Business value

Coaches can personalize manually, which protects the coach-first product rule before automation exists.

## What is included

- Assigned-client profile detail route.
- RLS-scoped profile reads.
- Empty and incomplete profile states.
- Clear separation between client-owned fields and coach-only context.
- Navigation from the coach client list or dashboard.

## What is not included

- No unassigned client browsing.
- No unsafe profile edits.
- No coach notes unless already modeled separately.
- No analytics dashboard.

## Technical implementation

1. Add a coach route for assigned client profile details.
2. Load profile data through RLS-scoped services.
3. Handle missing, partial, and deleted profiles.
4. Add authorization and route-guard tests.
5. Keep the UI scan-friendly and sparse.

## Dependencies

- Client Profile Domain Schema.

## Acceptance criteria

- [ ] Coach sees only assigned client profiles.
- [ ] Unassigned coach cannot access another client's profile by URL.
- [ ] Client cannot access coach profile routes.
- [ ] Empty states explain what is missing without blaming the client.

## Test cases

- Assigned coach access.
- Unassigned coach denial.
- Client wrong-door route.
- Missing profile fields.
- Reassignment during navigation.

## UAT scenarios

- Coach opens an assigned client and sees language goals, accessibility preferences, timezone, and onboarding readiness.
- Coach attempts to open an unassigned client URL and is denied.

## Edge cases

- Client deleted after list load.
- Assignment removed while coach is viewing profile.
- Very long free-text goals.

## Definition of Done

- Coach profile view is secure, useful, and ready to connect to onboarding review.

---

# Ticket R03: Data-Driven Onboarding Renderer

Linear fields:

- Source gap: GAP-010
- Project: Web
- Suggested workstream: Data-Driven Onboarding
- Suggested sprint: Sprint 3
- Labels: Web, Onboarding, Accessibility
- Priority: P0
- Estimated complexity: L
- Execution type: AFK
- Status: Draft

## Description

Render onboarding as one calm question at a time from database configuration, saving progress as the client moves through the flow.

## Business value

The app can collect personalization inputs without overwhelming users or hard-coding assessment content.

## What is included

- Protected onboarding route.
- Data-driven question and input rendering.
- Save and resume behavior.
- Visual progress indicator without scores.
- Accessible validation and reduced-motion support.

## What is not included

- No client plan chooser.
- No hard-coded question list in UI.
- No AI-generated onboarding questions.
- No coach review UI.

## Technical implementation

1. Load the active onboarding assessment version.
2. Render supported question types from config.
3. Save each answer through the response service.
4. Resume at the next incomplete step.
5. Add test coverage for supported input types and invalid config.

## Dependencies

- Data-Driven Onboarding Question Bank.
- Onboarding Response Storage and Resume.

## Acceptance criteria

- [ ] Client sees one question at a time.
- [ ] Questions come from database config.
- [ ] Progress is visual and non-judgmental.
- [ ] Client can leave and resume.
- [ ] Unsupported config fails gracefully.

## Test cases

- Each supported answer type.
- Required answer validation.
- Resume after refresh.
- No active assessment.
- Unsupported field type.
- Keyboard-only completion.

## UAT scenarios

- Client completes onboarding without seeing a menu of plans or templates.
- Client closes the browser mid-flow and returns to the correct step.

## Edge cases

- Branching config points to a missing question.
- Assessment version changes during a session.
- Long question copy on mobile.

## Definition of Done

- Data-driven onboarding is usable end to end for a seeded client.
- The implementation preserves the calm product rules.

---

# Ticket R04: Coach Onboarding Review

Linear fields:

- Source gap: GAP-011
- Project: Web
- Suggested workstream: Data-Driven Onboarding
- Suggested sprint: Sprint 3
- Labels: Web, Onboarding, Coach Tools
- Priority: P1
- Estimated complexity: M
- Execution type: AFK
- Status: Draft

## Description

Show submitted onboarding answers to the assigned coach in a simple review view.

## Business value

Coaches can use onboarding responses to plan manual support before the app automates learning decisions.

## What is included

- Coach-only onboarding review section.
- Assigned-client response reads.
- Complete, partial, and not-started states.
- Plain summaries of answers.
- Version-aware display.

## What is not included

- No editing submitted answers.
- No AI summary generation.
- No automatic plan assignment.
- No unassigned client access.

## Technical implementation

1. Load onboarding responses for assigned clients.
2. Join responses to the assessment version used at submission time.
3. Render answers in a calm, scan-friendly layout.
4. Add authorization tests for assigned and unassigned coaches.
5. Add empty states for incomplete onboarding.

## Dependencies

- Onboarding Response Storage and Resume.
- Coach Client Profile View.

## Acceptance criteria

- [ ] Coach sees onboarding answers only for assigned clients.
- [ ] Partial onboarding has a clear state.
- [ ] Historical question text displays correctly.
- [ ] Client cannot access coach review.

## Test cases

- Complete response set.
- Partial response set.
- Unassigned coach denied.
- Assessment version changed after submission.
- Long free-text response.

## UAT scenarios

- Coach opens a client and can understand their goals, comfort level, and support needs from onboarding answers.

## Edge cases

- Deleted question from old version.
- Client submits duplicate answer.
- Response contains sensitive free text.

## Definition of Done

- Coaches can review onboarding safely and use it for manual planning.

---

# Ticket R05: Tracker Configuration Schema

Linear fields:

- Source gap: GAP-012
- Project: Platform
- Suggested workstream: Tracker Engine
- Suggested sprint: Sprint 4
- Labels: Platform, Data, Tracker
- Priority: P0
- Estimated complexity: L
- Execution type: AFK
- Status: Draft

## Description

Create the database model and validation rules for coach-assigned tracker configurations.

## Business value

This builds the tracker engine before specific templates, keeping the app assigned and coach-led instead of browse-and-choose.

## What is included

- Tracker configuration tables.
- Field definitions, cadence, validation, and display metadata.
- Versioning and retirement behavior.
- RLS policies.
- Generated types and seed examples.

## What is not included

- No client tracker UI.
- No coach assignment command.
- No public tracker gallery.
- No gamification.

## Technical implementation

1. Design tracker config and version tables.
2. Add config validation rules.
3. Add RLS so clients cannot browse all available tracker configs.
4. Seed one or two internal example configs for development.
5. Add tests for valid and invalid configs.

## Dependencies

- Client Profile Domain Schema.

## Acceptance criteria

- [ ] Tracker configs are versioned.
- [ ] Used config versions are immutable.
- [ ] Clients cannot browse or self-select configs.
- [ ] Coach/admin paths can reference assignable configs.

## Test cases

- Valid tracker config.
- Invalid field definition.
- Retired config not assignable.
- Client denied global config browsing.
- Generated types compile.

## UAT scenarios

- Product can define a simple tracker config through seed/admin path and know it can later be assigned to a client.

## Edge cases

- Missing field label.
- Cadence changes after assignment.
- Config version retired while active assignment exists.

## Definition of Done

- Tracker configs are modeled, typed, protected, and ready for assignment work.

---

# Ticket R06: Tracker Assignment Command

Linear fields:

- Source gap: GAP-013
- Project: Platform
- Suggested workstream: Tracker Engine
- Suggested sprint: Sprint 4
- Labels: Platform, Tracker, Coach Tools
- Priority: P0
- Estimated complexity: M
- Execution type: AFK
- Status: Draft

## Description

Add the authorized command path for a coach or admin to assign a tracker to a client.

## Business value

Clients receive one assigned next action instead of browsing choices, which matches the product's focus-support promise.

## What is included

- Edge Function or command-style service for assignment.
- Authorization check for assigned coach or admin.
- Assignment records with status and audit metadata.
- Duplicate and reassignment handling.

## What is not included

- No client tracker renderer.
- No coach assignment UI beyond a minimal invocation path if needed.
- No client self-assignment.

## Technical implementation

1. Create tracker assignment table if not part of the schema ticket.
2. Implement authorized assignment command.
3. Validate tracker config is active and assignable.
4. Write audit record for assignment and reassignment.
5. Add RLS and command authorization tests.

## Dependencies

- Tracker Configuration Schema.
- Coach Client Profile View.

## Acceptance criteria

- [ ] Assigned coach can assign a tracker.
- [ ] Admin can assign a tracker.
- [ ] Unassigned coach cannot assign.
- [ ] Client cannot self-assign.
- [ ] Duplicate active assignment behavior is defined.

## Test cases

- Assign tracker happy path.
- Reassign tracker.
- Duplicate active assignment.
- Retired config.
- Unauthorized coach.
- Client request denied.

## UAT scenarios

- Coach assigns exactly one active tracker to a client and sees the assignment reflected in the client's state.

## Edge cases

- Coach assignment changes during command execution.
- Client already has an active tracker.
- Command retry after network failure.

## Definition of Done

- Tracker assignment is secure, auditable, and ready for client rendering.

---

# Ticket R07: Client Tracker Renderer

Linear fields:

- Source gap: GAP-014
- Project: Web
- Suggested workstream: Tracker Engine
- Suggested sprint: Sprint 5
- Labels: Web, Tracker, Accessibility
- Priority: P1
- Estimated complexity: L
- Execution type: AFK
- Status: Draft

## Description

Render the client's assigned tracker from config and let the client save tracker entries.

## Business value

Clients get a single clear next action that supports learning habits without choice overload.

## What is included

- Client route or home section for the active assigned tracker.
- Config-driven field rendering.
- Entry save and resume behavior.
- Visual progress without grades or judgment.
- Empty state when no tracker is assigned.

## What is not included

- No tracker picker.
- No public template gallery.
- No scoring.
- No coach review timeline.

## Technical implementation

1. Load the active tracker assignment and config version.
2. Render fields using existing form components.
3. Save tracker entries through approved service boundary.
4. Show calm success, draft, and failure states.
5. Add responsive and accessibility tests.

## Dependencies

- Tracker Configuration Schema.
- Tracker Assignment Command.

## Acceptance criteria

- [ ] Client sees only the assigned tracker.
- [ ] Entries persist.
- [ ] Screen has one primary action.
- [ ] Progress is visual and non-judgmental.
- [ ] Empty assignment state is calm.

## Test cases

- Render supported field types.
- Save entry.
- Validation failure.
- No active tracker.
- Config version mismatch.
- Offline draft if local support exists.

## UAT scenarios

- Client opens the app, completes the assigned tracker, and sees a calm confirmation.

## Edge cases

- Assignment expires while form is open.
- Config field removed after assignment.
- Long field labels.
- Slow save.

## Definition of Done

- Client can complete an assigned tracker end to end.

---

# Ticket R08: Coach Tracker Review

Linear fields:

- Source gap: GAP-015
- Project: Web
- Suggested workstream: Tracker Engine
- Suggested sprint: Sprint 5
- Labels: Web, Tracker, Coach Tools
- Priority: P1
- Estimated complexity: M
- Execution type: AFK
- Status: Draft

## Description

Show tracker entries to assigned coaches so they can use client progress in manual coaching decisions.

## Business value

This closes the coach-first feedback loop before automation decides what a client should do next.

## What is included

- Coach review section for assigned client tracker entries.
- Minimal entry timeline.
- Empty, partial, and historical states.
- Timezone-aware display.
- No grading or score language.

## What is not included

- No automated recommendations.
- No broad analytics dashboard.
- No client comparison view.
- No gamified streaks.

## Technical implementation

1. Load tracker entries through assigned-client authorization.
2. Join entries to tracker config/version labels.
3. Render a compact timeline.
4. Add tests for assigned and unassigned access.
5. Keep filters minimal unless a real coach workflow requires them.

## Dependencies

- Client Tracker Renderer.

## Acceptance criteria

- [ ] Coach sees entries for assigned clients.
- [ ] Unassigned coach is denied.
- [ ] No score, grade, or punitive language appears.
- [ ] Empty state supports manual follow-up.

## Test cases

- Assigned coach with entries.
- Assigned coach with no entries.
- Unassigned coach denied.
- Many entries.
- Timezone formatting.

## UAT scenarios

- Coach opens a client's tracker history and can discuss progress in a session.

## Edge cases

- Tracker deleted or retired.
- Client changes timezone.
- Large history.

## Definition of Done

- Coaches can review tracker progress safely and calmly.

---

# Ticket R09: Realtime, Presence, Typing, And Read State

Linear fields:

- Source gap: GAP-019
- Project: Platform
- Suggested workstream: Real 1-on-1 Chat
- Suggested sprint: Sprint 7
- Labels: Platform, Chat, Realtime
- Priority: P1
- Estimated complexity: L
- Execution type: AFK
- Status: Draft

## Description

Add realtime message updates, quiet typing state, presence, and read state to the real chat experience.

## Business value

Chat feels alive and reliable without adding noisy UI or cognitive load.

## What is included

- Supabase realtime subscriptions for message changes.
- RLS-compatible channel strategy.
- Typing state with calm display.
- Read/unread state.
- Fallback polling or refresh behavior.

## What is not included

- No group chat.
- No public presence indicators outside assigned conversations.
- No push notifications.
- No complex social status UI.

## Technical implementation

1. Define channel names and event payloads.
2. Subscribe from the chat route after authorization.
3. Update message list and read state without refresh.
4. Add reconnect and fallback behavior.
5. Test with two browser sessions.

## Dependencies

- Web Chat Route With Real Data.

## Acceptance criteria

- [ ] New messages appear without page refresh.
- [ ] Typing state is subtle and non-distracting.
- [ ] Read/unread state updates correctly.
- [ ] Reconnect does not duplicate messages.
- [ ] Unauthorized users cannot subscribe to another conversation.

## Test cases

- Two sessions exchange messages.
- Reconnect after temporary network loss.
- Duplicate event handling.
- Permission denial.
- Multiple tabs.

## UAT scenarios

- Coach watches a thread and sees the client's message arrive without refreshing.

## Edge cases

- User goes offline during typing.
- Message arrives while tab is hidden.
- Reassignment happens during subscription.

## Definition of Done

- Realtime chat behavior works reliably and remains quiet.

---

# Ticket R10: Offline Drafts And Retry Queue

Linear fields:

- Source gap: GAP-020
- Project: Web
- Suggested workstream: Real 1-on-1 Chat
- Suggested sprint: Sprint 7
- Labels: Web, Chat, Reliability, Accessibility
- Priority: P1
- Estimated complexity: M
- Execution type: AFK
- Status: Draft

## Description

Preserve unsent chat drafts and provide a safe retry path when sending fails.

## Business value

Users do not lose carefully written messages because of refreshes, route changes, or connection loss.

## What is included

- Local draft persistence per conversation.
- Retry queue keyed by `clientRequestId`.
- Clear sending, failed, and retry states.
- Draft cleanup after successful send.
- Logout-safe handling.

## What is not included

- No full offline app mode.
- No attachment retry unless attachments are already built.
- No background sync beyond the current web app scope.

## Technical implementation

1. Store draft text locally by user and conversation.
2. Assign `clientRequestId` before send.
3. Retry failed sends through the real send-message command.
4. Prevent duplicate persisted messages.
5. Add tests for refresh, offline, retry, and logout.

## Dependencies

- Web Chat Route With Real Data.

## Acceptance criteria

- [ ] Draft survives route change or refresh.
- [ ] Failed message can be retried.
- [ ] Successful retry does not duplicate messages.
- [ ] User sees calm status copy.
- [ ] Drafts are cleared on logout or account switch.

## Test cases

- Write draft, refresh, recover.
- Send while offline.
- Retry after network returns.
- Duplicate `clientRequestId`.
- Local storage unavailable.

## UAT scenarios

- Client writes a message, loses connection, returns, and can send without losing their text.

## Edge cases

- Conversation deleted while draft exists.
- User switches accounts on the same browser.
- Very long draft near message limit.

## Definition of Done

- Chat protects user effort during common connection failures.

---

# Ticket R11: Chat Attachments And Storage Permissions

Linear fields:

- Source gap: GAP-021
- Project: Platform
- Suggested workstream: Real 1-on-1 Chat
- Suggested sprint: Sprint 7
- Labels: Platform, Chat, Storage, Privacy
- Priority: P2
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Add protected file, image, or audio attachment support for chat only if coach validation confirms attachments are needed for the next release stage.

## Business value

Attachments can support pronunciation artifacts and coaching context, but only if they are necessary and safe.

## What is included

- Validation decision record before implementation.
- Storage bucket and object path design.
- Signed upload or authorized upload flow.
- Type, size, and malware-safety checks as appropriate.
- Message attachment records and protected reads.

## What is not included

- No attachment work before validation.
- No public files.
- No broad media library.
- No pronunciation scoring by default.

## Technical implementation

1. Confirm supported attachment types with coach/product review.
2. Create storage bucket and policies.
3. Implement upload command and message attachment records.
4. Add protected download/display behavior.
5. Test unauthorized access, type limits, and interrupted uploads.

## Dependencies

- Conversation And Message Schema.
- Coach validation decision.

## Acceptance criteria

- [ ] Validation decision is documented.
- [ ] Allowed files upload successfully.
- [ ] Unauthorized users cannot read objects.
- [ ] Failed upload explains next step calmly.
- [ ] File limits are enforced server-side.

## Test cases

- Supported file upload.
- Unsupported type rejection.
- Oversized file rejection.
- Unauthorized object read.
- Interrupted upload.

## UAT scenarios

- Client attaches a supported audio or image file and the assigned coach can access it.

## Edge cases

- Object uploaded but message insert fails.
- Message deleted while object remains.
- Mobile browser capture behavior differs by device.

## Definition of Done

- Attachment support is validated, protected, and tied to real chat messages.

---

# Ticket R12: Chat Moderation And Safety Escalation

Linear fields:

- Source gap: GAP-022
- Project: Platform
- Suggested workstream: Real 1-on-1 Chat
- Suggested sprint: Sprint 7
- Labels: Platform, Chat, Safety, Privacy
- Priority: P1
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Add moderation and safety handling for abusive content, self-harm signals, PII overexposure, and unsafe AI output paths.

## Business value

FISH serves vulnerable users and coaches. Safety behavior must be designed before real AI chat or public beta.

## What is included

- Safety policy definitions.
- Pre-send or post-send checks where appropriate.
- Manual escalation queue or review state.
- Audit trail.
- Calm client-facing copy.
- False-positive handling.

## What is not included

- No punitive user scoring.
- No broad surveillance dashboard.
- No unsupervised AI escalation without human review.

## Technical implementation

1. Define safety categories and handling rules.
2. Add moderation checks to message and AI reply paths.
3. Persist review/escalation state.
4. Notify or surface items to coach/admin according to policy.
5. Add tests for flagged, allowed, and failed moderation paths.

## Dependencies

- Real Send Message Edge Function.
- Grammar Correction Pipeline, if correction output shares safety handling.

## Acceptance criteria

- [ ] Unsafe content paths are handled predictably.
- [ ] Client-facing copy is non-scolding.
- [ ] Coach/admin can review escalated items.
- [ ] Audit records exist.
- [ ] False positives can be resolved.

## Test cases

- Flagged message.
- Allowed sensitive-but-safe message.
- Moderation provider failure.
- Bypass attempt.
- Audit log creation.

## UAT scenarios

- Reviewer sees a flagged message in a clear state and can decide the next action.

## Edge cases

- Quoted unsafe text used for learning.
- Mixed-language messages.
- AI provider returns unsafe content.
- Moderation system is unavailable.

## Definition of Done

- Real chat has a documented and tested safety path.

---

# Ticket R13: AI Conversation Orchestrator

Linear fields:

- Source gap: GAP-024
- Project: Platform
- Suggested workstream: AI Chat
- Suggested sprint: Sprint 8
- Labels: Platform, AI, Chat, Safety
- Priority: P0
- Estimated complexity: XL
- Execution type: HITL
- Status: Draft

## Description

Build the server-side pipeline that creates safe AI replies for coach-approved English practice conversations.

## Business value

This is the core AI-powered ChatHub capability: helpful English practice inside the chat experience.

## What is included

- Prompt and response contract.
- Conversation windowing.
- User context injection.
- Safety rules.
- AI response persistence.
- Evaluation hooks.
- Feature flag or disable switch.

## What is not included

- No client-side model calls.
- No unbounded memory.
- No automatic learning-path assignment.
- No replacement for coach judgment.

## Technical implementation

1. Define the AI reply request and response schema.
2. Build an orchestrator that gathers bounded conversation context.
3. Apply safety and FISH voice rules before persistence.
4. Persist AI replies as messages with clear metadata.
5. Add eval fixtures for common conversation scenarios.

## Dependencies

- AI Provider Abstraction and Safe Reply Contract.
- Conversation And Message Schema.
- Chat Moderation And Safety Escalation.

## Acceptance criteria

- [ ] AI can reply in a bounded conversation.
- [ ] Output follows FISH voice and non-scolding correction rules.
- [ ] Unsafe outputs are blocked or escalated.
- [ ] Provider failures produce calm retry states.
- [ ] AI behavior can be disabled.

## Test cases

- Normal English-practice reply.
- User asks for grammar help.
- Unsafe user input.
- Long conversation window.
- Provider timeout.
- Malformed model output.

## UAT scenarios

- Client sends a practice message and receives a helpful, calm English-learning reply.
- Coach reviews a sample AI conversation and agrees it stays within approved behavior.

## Edge cases

- Model invents an assignment.
- Model over-corrects and overwhelms the client.
- Mixed-language input.
- Conversation contains sensitive personal context.

## Definition of Done

- AI replies work safely in non-production and are ready for controlled coach review.

---

# Ticket R14: Conversation Memory And Summaries

Linear fields:

- Source gap: GAP-025
- Project: Platform
- Suggested workstream: AI Chat
- Suggested sprint: Sprint 8
- Labels: Platform, AI, Memory, Privacy
- Priority: P0
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Store consented conversation summaries and safe user facts so AI can personalize future chat without rereading unlimited history.

## Business value

Clients get continuity while privacy, deletion, and consent remain explicit.

## What is included

- Memory and summary tables.
- Consent-aware memory writes.
- Rolling conversation summary job or function.
- Sensitive-data classification rules.
- Export and delete hooks.
- Coach-visible inspection path if needed.

## What is not included

- No covert memory.
- No unlimited message replay.
- No memory use when consent is absent.
- No client-facing personalization claims before validation.

## Technical implementation

1. Model memories, summaries, source references, and consent state.
2. Add summarization function using the AI provider abstraction.
3. Enforce RLS and delete behavior.
4. Add memory retrieval to the AI orchestrator only after consent checks.
5. Add tests for create, update, export, delete, and opt-out.

## Dependencies

- AI Conversation Orchestrator.
- Privacy, Consent, Export, and Delete Baseline.

## Acceptance criteria

- [ ] Summaries update from conversation history.
- [ ] Memory writes require consent.
- [ ] Client data export includes memory and summaries.
- [ ] Delete removes or anonymizes memory according to policy.
- [ ] AI can run without memory if disabled.

## Test cases

- Summary creation.
- Summary update after new messages.
- Consent denied.
- Delete cascade.
- RLS denial for unassigned coach.

## UAT scenarios

- Returning client sees AI remember a safe preference after giving consent.
- Client revokes memory consent and future AI replies stop using stored memory.

## Edge cases

- Incorrect memory needs correction.
- Stale facts conflict with new onboarding responses.
- Sensitive fact should not be stored.

## Definition of Done

- Memory is useful, consented, inspectable, and deletable.

---

# Ticket R15: Learning Personalization Profile

Linear fields:

- Source gap: GAP-026
- Project: Platform
- Suggested workstream: AI Chat
- Suggested sprint: Sprint 9
- Labels: Platform, AI, Personalization, Coach Tools
- Priority: P0
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Create a derived learning personalization profile from onboarding, coach context, tracker entries, and consented memory.

## Business value

The app can adapt practice without asking clients to pick from overwhelming choices.

## What is included

- Derived profile service.
- Confidence and source fields.
- Coach override path.
- Audit trail for changes.
- Bounded AI context export.

## What is not included

- No client plan picker.
- No automatic learning path assignment.
- No hidden grade exposed to the client.
- No personalization from non-consented memory.

## Technical implementation

1. Define the personalization profile schema or view.
2. Pull bounded signals from onboarding, tracker data, coach input, and memory.
3. Add source and confidence metadata.
4. Support coach override or correction.
5. Provide a safe context object for AI prompts.

## Dependencies

- Data-Driven Onboarding Renderer.
- Coach Tracker Review.
- Conversation Memory And Summaries.

## Acceptance criteria

- [ ] Profile can be generated with partial inputs.
- [ ] AI receives bounded personalization only.
- [ ] Coach can inspect sources.
- [ ] Coach override is audited.
- [ ] Client is not shown hidden scoring.

## Test cases

- Complete data.
- Missing onboarding.
- Missing tracker data.
- Conflicting coach override.
- Privacy opt-out.

## UAT scenarios

- Coach sees why the app is adapting practice and can correct an inaccurate assumption.

## Edge cases

- Contradictory preferences.
- Low confidence profile.
- Client changes accessibility preference.

## Definition of Done

- Personalization is explainable, bounded, and coach-correctable.

---

# Ticket R16: Grammar Correction Pipeline

Linear fields:

- Source gap: GAP-027
- Project: Platform
- Suggested workstream: Validated Learning Features
- Suggested sprint: Sprint 9
- Labels: Platform, AI, Learning, Safety
- Priority: P1
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Detect grammar issues in chat and produce gentle corrections in a coach-approved style.

## Business value

Grammar correction is a core English-learning outcome, but it must feel supportive rather than judgmental.

## What is included

- Coach-approved correction style.
- Correction schema with original text, suggestion, explanation, and confidence.
- AI extraction and validation.
- Storage contract.
- UI contract for future display.
- Disable or hide behavior.

## What is not included

- No correction UI until style is validated.
- No red error styling.
- No score, grade, or shame language.
- No correction of every possible issue by default.

## Technical implementation

1. Validate correction examples with a coach.
2. Define correction schema and safety rules.
3. Add AI extraction using the provider abstraction.
4. Store corrections linked to source messages.
5. Add tests for no issue, simple issue, ambiguity, and unsafe content.

## Dependencies

- AI Conversation Orchestrator.
- Coach validation of correction style.

## Acceptance criteria

- [ ] Coach-approved correction style exists.
- [ ] Correction includes original, suggestion, explanation, and confidence.
- [ ] Ambiguous corrections can be skipped.
- [ ] Output avoids scolding language and alarming colors.
- [ ] Coach or product can disable the feature.

## Test cases

- No grammar issue.
- One grammar issue.
- Multiple issues.
- Ambiguous dialect/variant.
- Unsafe source text.
- Provider failure.

## UAT scenarios

- Client receives one gentle correction and understands how to improve without feeling graded.

## Edge cases

- Slang or dialect is incorrectly flagged.
- Code-switching.
- User asks not to be corrected.
- Message is too short to evaluate.

## Definition of Done

- Grammar correction is validated, safe, and ready for a limited UI slice.

---

# Ticket R17: Vocabulary Extraction And Review Queue

Linear fields:

- Source gap: GAP-028
- Project: Platform
- Suggested workstream: Validated Learning Features
- Suggested sprint: Sprint 9
- Labels: Platform, AI, Learning, Coach Tools
- Priority: P1
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Extract useful vocabulary from conversations and route suggestions through a coach review queue.

## Business value

Conversation practice can turn into retained learning without making clients manage a complex word list.

## What is included

- Vocabulary term and phrase tables.
- Source message/context reference.
- Deduplication and merge behavior.
- Coach approve, edit, or remove states.
- Future client review UI contract.

## What is not included

- No automatic client-facing vocabulary deck before validation.
- No public dictionary.
- No spaced repetition engine yet.
- No extraction from private content without consent.

## Technical implementation

1. Define vocabulary item schema and review states.
2. Add extraction job or command using bounded chat context.
3. Merge duplicates and keep source context.
4. Add coach review endpoints or service methods.
5. Test extraction, dedupe, approval, and removal.

## Dependencies

- AI Conversation Orchestrator.
- Learning Personalization Profile.

## Acceptance criteria

- [ ] Useful terms can be suggested from chat.
- [ ] Duplicates merge predictably.
- [ ] Coach can approve, edit, or remove suggestions.
- [ ] Sensitive terms can be suppressed.
- [ ] Client does not see unapproved suggestions.

## Test cases

- Single useful term.
- Phrase extraction.
- Duplicate term.
- Proper noun suppression.
- Sensitive word suppression.
- Unassigned coach denied.

## UAT scenarios

- Coach reviews suggested vocabulary from a chat and approves one phrase for later practice.

## Edge cases

- Word has multiple meanings.
- User intentionally uses incorrect word.
- Extracted term contains PII.

## Definition of Done

- Vocabulary suggestions are captured safely and remain coach-controlled.

---

# Ticket R18: Pronunciation Feedback Pipeline

Linear fields:

- Source gap: GAP-029
- Project: Platform
- Suggested workstream: Validated Learning Features
- Suggested sprint: Sprint 10
- Labels: Platform, AI, Learning, Audio, Privacy
- Priority: P2
- Estimated complexity: XL
- Execution type: HITL
- Status: Draft

## Description

Add voice capture, speech-to-text, and pronunciation feedback only after the coaching technique has been manually validated.

## Business value

Pronunciation feedback can support spoken English confidence, but it carries privacy, bias, and accessibility risk if built too early.

## What is included

- Validation decision before implementation.
- Audio upload or recording path.
- Speech-to-text provider integration.
- Pronunciation feedback schema.
- Privacy and retention handling for audio.
- Bias review for dialect and noise sensitivity.

## What is not included

- No pronunciation scoring before validation.
- No punitive grades.
- No public audio sharing.
- No permanent audio retention unless policy explicitly allows it.

## Technical implementation

1. Validate the manual pronunciation coaching flow with real examples.
2. Add protected audio upload using the attachment/storage path.
3. Integrate STT or pronunciation provider through the AI service layer.
4. Store feedback, confidence, and audio retention metadata.
5. Add tests for provider failure, silence, unsupported files, and access boundaries.

## Dependencies

- Chat Attachments And Storage Permissions.
- AI Provider Abstraction and Safe Reply Contract.
- Coach validation decision.

## Acceptance criteria

- [ ] Coach validation decision is documented.
- [ ] Audio files are protected by authorization and retention policy.
- [ ] Feedback is calm, actionable, and optional.
- [ ] Dialect bias risks are reviewed.
- [ ] Provider errors do not lose user work.

## Test cases

- Clear audio.
- Noisy audio.
- Silence.
- Unsupported file.
- Oversized file.
- Provider timeout.
- Unauthorized audio access.

## UAT scenarios

- Client records or uploads a short phrase and receives gentle feedback that helps them try again.
- Coach reviews sample feedback and confirms it matches the approved coaching style.

## Edge cases

- Background speech is captured.
- User has a speech pattern the provider misreads.
- Audio upload succeeds but feedback generation fails.
- User requests deletion of audio.

## Definition of Done

- Pronunciation feedback is validated, privacy-safe, and ready for limited beta testing.

---

# Ticket R19: Exercise And Quiz Engine

Linear fields:

- Source gap: GAP-030
- Project: Platform
- Suggested workstream: Exercises
- Suggested sprint: Sprint 10
- Labels: Platform, Learning, Exercises, Tracker
- Priority: P2
- Estimated complexity: XL
- Execution type: HITL
- Status: Draft

## Description

Build a coach-assigned exercise and quiz engine that supports configured practice activities without giving clients a browsing gallery.

## Business value

Exercises give clients focused practice beyond chat while preserving the assigned, low-choice product model.

## What is included

- Exercise configuration schema.
- Exercise assignment model.
- Response storage and resume.
- Evaluation/correction storage.
- Renderer contracts for future web UI.
- Versioning and retirement.

## What is not included

- No public exercise library.
- No client self-selection.
- No competitive scoring.
- No AI-generated exercise assignment without coach approval.

## Technical implementation

1. Define exercise types and response schema.
2. Add assignment tables and authorization rules.
3. Store attempts, completion, and feedback.
4. Support versioned exercise configs.
5. Add tests for assignment, response save, evaluation, and access boundaries.

## Dependencies

- Tracker Configuration Schema.
- Learning Personalization Profile.
- Coach validation for first exercise types.

## Acceptance criteria

- [ ] Coach/admin can assign an exercise.
- [ ] Client can complete an assigned exercise.
- [ ] Client cannot browse all exercises.
- [ ] Feedback copy is non-scolding.
- [ ] Partial completion can resume.

## Test cases

- Assigned exercise happy path.
- Unassigned exercise denied.
- Partial save and resume.
- Version changed after assignment.
- Ambiguous answer.
- Evaluation failure.

## UAT scenarios

- Coach assigns one focused exercise and client completes it without seeing unrelated options.

## Edge cases

- Client starts exercise before it is retired.
- Exercise has no valid questions.
- User submits duplicate attempt.
- Long translated copy in future locale.

## Definition of Done

- Exercise engine supports one validated assigned practice flow end to end.

---

# Ticket R20: Adaptive Learning Path Planner

Linear fields:

- Source gap: GAP-031
- Project: Platform
- Suggested workstream: Exercises
- Suggested sprint: Sprint 10
- Labels: Platform, AI, Learning, Coach Tools
- Priority: P2
- Estimated complexity: XL
- Execution type: HITL
- Status: Draft

## Description

Generate suggested next steps for coaches from onboarding, tracker, chat, vocabulary, grammar, and exercise signals.

## Business value

The planner can reduce coach prep time while keeping the coach in control of what the client actually receives.

## What is included

- Recommendation service.
- Recommendation table with source evidence and confidence.
- Coach approve, reject, or edit workflow.
- Audit trail.
- Safety and stale-data checks.

## What is not included

- No client-facing path browser.
- No automatic assignments without coach approval.
- No opaque grading.
- No planner until enough underlying data exists.

## Technical implementation

1. Define recommendation inputs and output schema.
2. Build a planner service that produces coach-facing suggestions only.
3. Store source evidence, confidence, and expiration.
4. Add coach review actions.
5. Add tests for missing data, unsafe suggestions, and stale recommendations.

## Dependencies

- Learning Personalization Profile.
- Exercise And Quiz Engine.
- Coach validation of recommendation style.

## Acceptance criteria

- [ ] Suggestions are visible only to coaches/admins.
- [ ] Coach approval is required before client assignment.
- [ ] Recommendation source evidence is inspectable.
- [ ] Low-confidence suggestions are suppressed or clearly marked.
- [ ] Stale suggestions expire.

## Test cases

- Complete data recommendation.
- Missing data.
- Conflicting signals.
- Unsafe suggestion.
- Coach reject.
- Expired suggestion.

## UAT scenarios

- Coach reviews an AI-suggested next step, edits it, and assigns it manually.

## Edge cases

- Planner over-personalizes from sensitive data.
- Recommendation repeats something already completed.
- User opted out of memory or analytics.

## Definition of Done

- Adaptive recommendations are coach-facing, explainable, and never client-assigned automatically.

---

# Ticket R21: Visual Progress Model

Linear fields:

- Source gap: GAP-032
- Project: Platform
- Suggested workstream: Progress And Accessibility
- Suggested sprint: Sprint 11
- Labels: Platform, Progress, Accessibility
- Priority: P1
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Model client progress as visual progress steps and gentle completion states without scores, grades, or punitive reset language.

## Business value

Clients can see movement and continuity without feeling judged.

## What is included

- Progress step model.
- Derived progress service.
- UI contract for visual progress.
- Coach context notes.
- Rules that prevent reset-to-zero streak behavior.

## What is not included

- No percentage-as-judgment UI.
- No grades.
- No competitive leaderboard.
- No punitive streak reset.

## Technical implementation

1. Define progress sources from trackers, exercises, chat participation, and coach assignments.
2. Model progress steps as qualitative states.
3. Add derived progress service and tests.
4. Document copy and UI constraints.
5. Validate examples with coach/product review.

## Dependencies

- Client Tracker Renderer.
- Exercise And Quiz Engine.

## Acceptance criteria

- [ ] Progress can be derived from completed work.
- [ ] UI contract avoids grades and judgment.
- [ ] Long gaps do not reset progress to zero.
- [ ] Coach can contextualize progress.
- [ ] Progress model handles missing data.

## Test cases

- No progress yet.
- Partial tracker completion.
- Completed exercise.
- Long gap.
- Reassigned tracker.
- Archived exercise.

## UAT scenarios

- Client returns after time away and sees encouraging progress continuity.

## Edge cases

- User has activity in chat but no tracker entries.
- Assignment is deleted.
- Timezone affects completion dates.

## Definition of Done

- Progress is modeled in a way that supports motivation without shame.

---

# Ticket R22: Reward-Only Achievements And Return Rewards

Linear fields:

- Source gap: GAP-033
- Project: Platform
- Suggested workstream: Progress And Accessibility
- Suggested sprint: Sprint 11
- Labels: Platform, Progress, Learning
- Priority: P2
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Add reward-only achievements or XP after validation, with explicit rules that returning after a gap is rewarded rather than punished.

## Business value

Rewards can encourage return behavior without triggering abandonment from broken streaks or failure states.

## What is included

- Coach/product validation for reward mechanics.
- Reward event model.
- Display rules.
- Feature flag.
- No-reset streak alternative if validated.
- Tests for gap and timezone behavior.

## What is not included

- No broken-streak UI.
- No loss of XP.
- No leaderboard.
- No pressure notifications.

## Technical implementation

1. Validate reward concepts with coaches and target users.
2. Model reward events and display eligibility.
3. Add feature flag and safe defaults.
4. Implement return-after-gap reward logic.
5. Add tests for consecutive use, gaps, and timezone changes.

## Dependencies

- Visual Progress Model.
- Coach validation.

## Acceptance criteria

- [ ] Reward mechanic is validated before build.
- [ ] No UI punishes missed days.
- [ ] Returning after a gap can be rewarded.
- [ ] Feature can be disabled.
- [ ] Duplicate reward events are prevented.

## Test cases

- Consecutive activity.
- Long gap.
- Timezone change.
- Duplicate event.
- Feature flag off.
- User returns after missed days.

## UAT scenarios

- Client returns after a week and sees encouragement instead of failure.

## Edge cases

- Daylight saving time shift.
- User travels across timezones.
- Offline activity syncs late.

## Definition of Done

- Rewards are additive, validated, and safe for the audience.

---

# Ticket R23: Neurodivergent Accessibility Audit And Preferences

Linear fields:

- Source gap: GAP-034
- Project: Web
- Suggested workstream: Progress And Accessibility
- Suggested sprint: Sprint 11
- Labels: Web, Accessibility, QA
- Priority: P0
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Audit core flows and implement validated preferences for ADHD, autism, dyslexia, and executive-function support.

## Business value

Accessibility is central to FISH's audience. The product must reduce overwhelm and support focus by default.

## What is included

- Audit of auth, profile, onboarding, tracker, and chat flows.
- Keyboard and screen-reader review.
- Reduced motion verification.
- Preference model for validated settings.
- Critical issue fixes.
- Regression checklist.

## What is not included

- No large settings menu full of unvalidated choices.
- No cosmetic redesign.
- No accessibility overlay dependency.
- No preference that conflicts with the one-action rule.

## Technical implementation

1. Read the UI/UX agent guidelines before reviewing screens.
2. Audit core flows on desktop and mobile.
3. Identify critical blockers for ADHD, autism, dyslexia, and executive-function support.
4. Implement only validated preferences with calm defaults.
5. Add automated and manual accessibility checks.

## Dependencies

- Client Profile Web Experience.
- Data-Driven Onboarding Renderer.
- Web Chat Route With Real Data.

## Acceptance criteria

- [ ] Audit findings are documented and prioritized.
- [ ] Critical accessibility issues are fixed.
- [ ] Preferences persist if implemented.
- [ ] Keyboard focus is visible and logical.
- [ ] Reduced motion is respected.
- [ ] No added choice overload.

## Test cases

- Keyboard-only auth flow.
- Screen reader labels for forms.
- Reduced-motion setting.
- Long text on mobile.
- Dyslexia-friendly text preference if validated.
- Executive-function interruption and resume.

## UAT scenarios

- Target user completes auth, onboarding, and chat without feeling overloaded by choices.

## Edge cases

- System preference conflicts with app preference.
- User resets preferences.
- Very small mobile viewport.
- Browser zoom at 200 percent.

## Definition of Done

- Core flows meet the accessibility bar for the product's audience.

---

# Ticket R24: Coach Assignment Management

Linear fields:

- Source gap: GAP-036
- Project: Web
- Suggested workstream: Coach Tools
- Suggested sprint: Sprint 12
- Labels: Web, Coach Tools, Admin, Auth
- Priority: P1
- Estimated complexity: L
- Execution type: AFK
- Status: Draft

## Description

Replace seed-only coach/client assignment with an authorized operational path for assigning and reassigning clients.

## Business value

The team can onboard real users without manual database edits while preserving the rule that clients do not choose coaches or plans.

## What is included

- Assignment command or Edge Function.
- Admin/coach authorization checks.
- Simple roster UI if needed.
- Assignment and reassignment audit records.
- RLS verification.

## What is not included

- No client self-selection.
- No public coach directory.
- No complex scheduling.
- No billing or marketplace logic.

## Technical implementation

1. Define who can assign and reassign clients.
2. Implement command path with authorization and audit logging.
3. Add minimal UI or admin command surface.
4. Update dependent views after assignment changes.
5. Test role boundaries and reassignment edge cases.

## Dependencies

- Coach Client Profile View.

## Acceptance criteria

- [ ] Authorized user can assign a client to a coach.
- [ ] Authorized user can reassign a client.
- [ ] Unauthorized user cannot assign.
- [ ] Client cannot choose or change coach.
- [ ] Assignment changes are audited.

## Test cases

- Assign client.
- Reassign client.
- Unauthorized coach attempt.
- Client attempt.
- Duplicate assignment.
- Existing chat/tracker relationship after reassignment.

## UAT scenarios

- Admin assigns a client to a coach and both coach/client views update appropriately.

## Edge cases

- Coach is deactivated.
- Client has active tracker or chat.
- Concurrent reassignment.
- Deleted user.

## Definition of Done

- Coach assignment is operational, secure, and no longer seed-only.

---

# Ticket R25: Coach Dashboard And Client Work Queue

Linear fields:

- Source gap: GAP-037
- Project: Web
- Suggested workstream: Coach Tools
- Suggested sprint: Sprint 12
- Labels: Web, Coach Tools, Chat, Onboarding, Tracker
- Priority: P1
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Build a coach dashboard that shows assigned clients, unread messages, onboarding status, tracker status, and the next useful action.

## Business value

Coaches can support clients efficiently without hunting across screens.

## What is included

- Assigned-client work queue.
- Unread and waiting states.
- Onboarding and tracker status summaries.
- Minimal next-action affordance.
- Empty and large-roster states.

## What is not included

- No broad analytics dashboard.
- No complex filtering until a coach workflow proves it is needed.
- No client comparison leaderboard.
- No automated recommendations unless planner work is complete.

## Technical implementation

1. Define dashboard summary query/service.
2. Load only assigned clients.
3. Render a sparse queue with scan-friendly states.
4. Link to profile, onboarding, tracker, and chat detail views.
5. Add tests for authorization, empty states, and many clients.

## Dependencies

- Coach Onboarding Review.
- Coach Tracker Review.
- Web Chat Route With Real Data.

## Acceptance criteria

- [ ] Coach sees only assigned clients.
- [ ] Dashboard shows unread, onboarding, tracker, and next-action states.
- [ ] Empty state is useful.
- [ ] View remains calm with many clients.
- [ ] One primary action per view is preserved.

## Test cases

- No assigned clients.
- One assigned client.
- Many assigned clients.
- Unread messages.
- Missing onboarding.
- Stale tracker.
- Unassigned access denied.

## UAT scenarios

- Coach opens dashboard and can choose the next client to support within a few seconds.

## Edge cases

- Client reassigned while dashboard is open.
- Unread count is stale.
- Client has no profile details.
- Large roster performance.

## Definition of Done

- Coach dashboard supports daily coaching operations without clutter.

---

# Ticket R26: Admin Role And Vetting Workflow

Linear fields:

- Source gap: GAP-038
- Project: Platform
- Suggested workstream: Admin
- Suggested sprint: Sprint 12
- Labels: Platform, Admin, Auth, Security
- Priority: P1
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Add an admin role and vetted operational workflow for coach creation, role changes, and support actions.

## Business value

The team can operate the product safely without manual SQL edits or unsafe role changes.

## What is included

- Admin role model.
- Admin-only role change command.
- Coach vetting checklist or status.
- Audit log for role changes.
- Minimal admin UI or command surface.

## What is not included

- No self-service coach signup.
- No client role escalation.
- No large back-office system.
- No payment or subscription admin.

## Technical implementation

1. Decide admin role representation and migration path.
2. Implement role-change command with service-role protection.
3. Add vetting status fields if needed.
4. Record audit events for all role changes.
5. Add RLS and command tests for admin/non-admin paths.

## Dependencies

- Privacy, Consent, Export, and Delete Baseline.

## Acceptance criteria

- [ ] Only admins can promote or demote roles.
- [ ] All role changes are audited.
- [ ] Clients cannot self-escalate.
- [ ] Admin lockout risk is handled.
- [ ] Coach vetting state is visible to operators.

## Test cases

- Admin promotes coach.
- Non-admin denied.
- Client escalation attempt denied.
- Demotion.
- Audit record creation.
- Last-admin protection if implemented.

## UAT scenarios

- Franz promotes a vetted coach without writing SQL.

## Edge cases

- Admin account deleted.
- Coach demoted with active clients.
- Role change command partially fails.

## Definition of Done

- Role operations are secure, audited, and usable by the team.

---

# Ticket R27: Privacy-Safe Analytics Event Taxonomy

Linear fields:

- Source gap: GAP-039
- Project: Platform
- Suggested workstream: Analytics
- Suggested sprint: Sprint 13
- Labels: Platform, Analytics, Privacy
- Priority: P1
- Estimated complexity: M
- Execution type: HITL
- Status: Draft

## Description

Define and implement a minimal product analytics taxonomy that measures funnels and reliability without collecting sensitive learning content.

## Business value

The team can understand adoption and abandonment risks without reading private messages or answers.

## What is included

- Event taxonomy.
- Consent and opt-out behavior.
- Client and server emitters.
- No-content payload rules.
- Basic dashboard or query runbook.
- Duplicate/offline handling.

## What is not included

- No raw message bodies.
- No raw onboarding free text.
- No third-party tracking before privacy review.
- No behavioral scoring of clients.

## Technical implementation

1. Define allowed event names and payload fields.
2. Add validation for analytics payloads.
3. Implement emitters at key funnel points.
4. Respect consent and deletion rules.
5. Document queries for auth, onboarding, chat, tracker, and retention.

## Dependencies

- Privacy, Consent, Export, and Delete Baseline.

## Acceptance criteria

- [ ] No sensitive language content is logged.
- [ ] Consent and opt-out are respected.
- [ ] Key funnels are measurable.
- [ ] Events validate against schema.
- [ ] Deleted users are handled according to privacy policy.

## Test cases

- Auth funnel event.
- Onboarding completion event.
- Chat send event without message body.
- Opt-out.
- Duplicate event.
- Deleted user.

## UAT scenarios

- Team can see where users drop from signup to first real chat without exposing private content.

## Edge cases

- Offline event flush after opt-out.
- Event arrives after user deletion.
- Payload accidentally includes free text.

## Definition of Done

- Analytics are useful, minimal, and privacy-safe.

---

# Ticket R28: Technical Observability And Error Tracking

Linear fields:

- Source gap: GAP-040
- Project: Platform
- Suggested workstream: Operations
- Suggested sprint: Sprint 13
- Labels: Platform, Observability, Operations, AI
- Priority: P0
- Estimated complexity: M
- Execution type: AFK
- Status: Draft

## Description

Add structured logs, error tracking, request correlation, and health checks for web, Edge Functions, Supabase operations, and AI providers.

## Business value

Production issues become diagnosable without guessing or asking users to reproduce painful failures.

## What is included

- Structured logger.
- Correlation/request IDs.
- Edge Function error reporting.
- AI provider timing and failure logs.
- Health checks or smoke checks.
- Alert thresholds.
- PII and secret redaction rules.

## What is not included

- No logging of message bodies or sensitive answers.
- No broad data warehouse.
- No noisy alerting before thresholds are defined.

## Technical implementation

1. Define logging fields and redaction rules.
2. Add correlation IDs to command paths.
3. Instrument Edge Functions and AI calls.
4. Add health checks for critical paths.
5. Document incident lookup steps.

## Dependencies

- AI Provider Abstraction and Safe Reply Contract.

## Acceptance criteria

- [ ] Errors include correlation IDs.
- [ ] AI/provider failures are visible.
- [ ] No secrets or sensitive content are logged.
- [ ] Operators can trace a failed send.
- [ ] Alerts exist for critical failures.

## Test cases

- Simulated Edge Function failure.
- AI provider timeout.
- Auth failure.
- Redaction of sensitive fields.
- Log sampling behavior.

## UAT scenarios

- Operator receives a failed-send report and can find the relevant error path using a correlation ID.

## Edge cases

- High-volume error spike.
- Logging provider unavailable.
- Request fails before correlation ID is attached.

## Definition of Done

- Critical production paths are observable without leaking sensitive data.

---

# Ticket R29: Notification Preferences And Reminder System

Linear fields:

- Source gap: GAP-041
- Project: Platform
- Suggested workstream: Notifications
- Suggested sprint: Sprint 13
- Labels: Platform, Notifications, Privacy, Accessibility
- Priority: P2
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Add opt-in reminders for assigned work and unread coach messages, with calm copy and easy opt-out.

## Business value

Reminders can help clients return without creating pressure or shame.

## What is included

- Notification preference model.
- Email and/or push architecture decision.
- Scheduled reminder function.
- Quiet hours and timezone handling.
- Unsubscribe/disable path.
- Non-scolding copy review.

## What is not included

- No default-on pressure campaign.
- No punitive streak reminders.
- No marketing newsletter system.
- No notifications before privacy and consent are ready.

## Technical implementation

1. Validate which reminders are useful and safe.
2. Add notification preferences and consent checks.
3. Implement scheduled reminder generation.
4. Add delivery provider integration if approved.
5. Test timezone, unsubscribe, and delivery failure paths.

## Dependencies

- Privacy, Consent, Export, and Delete Baseline.
- Privacy-Safe Analytics Event Taxonomy.

## Acceptance criteria

- [ ] Reminders are opt-in or explicitly consented.
- [ ] User can turn reminders off.
- [ ] Copy is calm and non-scolding.
- [ ] Quiet hours and timezone are respected.
- [ ] Delivery failures are observable.

## Test cases

- Opt in.
- Opt out.
- Quiet hours.
- Timezone change.
- Delivery failure.
- Unsubscribe link.

## UAT scenarios

- Client receives one gentle reminder about assigned work and can turn it off immediately.

## Edge cases

- User deletes account after reminder is queued.
- Email bounces.
- Multiple reminders would send in the same day.
- User travels across timezones.

## Definition of Done

- Reminder system supports return behavior without pressure.

---

# Ticket R30: Security Threat Model And RLS Audit

Linear fields:

- Source gap: GAP-042
- Project: Platform
- Suggested workstream: Security
- Suggested sprint: Sprint 14
- Labels: Platform, Security, Privacy, QA
- Priority: P0
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Threat-model and audit auth, RLS, Edge Functions, storage, AI, analytics, admin actions, and role boundaries before production release.

## Business value

FISH stores sensitive learning and conversation data. Security must be verified before real users depend on it.

## What is included

- Threat model.
- RLS policy audit.
- Edge Function authorization review.
- Storage access review.
- Secrets and environment review.
- Dependency review.
- Findings triage.

## What is not included

- No formal third-party penetration test unless separately approved.
- No large compliance program.
- No production launch before P0/P1 findings are resolved.

## Technical implementation

1. Inventory data tables, policies, storage buckets, and command paths.
2. Model likely abuse cases and data leakage paths.
3. Add automated RLS tests for cross-user reads and writes.
4. Review service-role usage and secret exposure.
5. Record findings with severity and remediation tickets.

## Dependencies

- Conversation And Message Schema.
- AI Provider Abstraction and Safe Reply Contract.
- Privacy, Consent, Export, and Delete Baseline.

## Acceptance criteria

- [ ] All user data tables have RLS enabled.
- [ ] Command writes authorize server-side.
- [ ] Storage objects are protected.
- [ ] Secrets are not exposed to clients.
- [ ] P0/P1 findings are fixed or explicitly blocked.

## Test cases

- Client reads another client's profile.
- Coach reads unassigned client.
- Client writes protected role field.
- Storage object URL access.
- Service-role misuse.
- Admin-only command as non-admin.

## UAT scenarios

- Reviewer signs off that no known P0/P1 security gaps block beta.

## Edge cases

- Deleted user data remains accessible.
- Reassignment leaks old client access.
- Analytics event contains sensitive text.
- AI prompt includes data without consent.

## Definition of Done

- Security review is documented, tested, and launch blockers are explicit.

---

# Ticket R31: Performance Budgets And Load Tests

Linear fields:

- Source gap: GAP-043
- Project: Platform
- Suggested workstream: Performance
- Suggested sprint: Sprint 14
- Labels: Platform, Performance, QA, Chat
- Priority: P1
- Estimated complexity: M
- Execution type: AFK
- Status: Draft

## Description

Define and verify performance budgets for auth, onboarding, tracker, chat, realtime, AI latency, and mobile conditions.

## Business value

The calm UI must also feel fast and stable. Slowness can create confusion and abandonment.

## What is included

- Web performance budgets.
- Chat and realtime latency expectations.
- AI timeout and fallback budgets.
- Database query checks for core screens.
- Mobile viewport checks.
- CI or manual release gate.

## What is not included

- No premature micro-optimization.
- No native performance suite unless native scope is active.
- No provider-level SLA negotiation.

## Technical implementation

1. Define budgets for page load, interaction, send-message, realtime, and AI reply paths.
2. Add Playwright or Lighthouse checks where useful.
3. Add timing instrumentation to command paths.
4. Test long conversation and many-client scenarios.
5. Document release gate and remediation steps.

## Dependencies

- Web Chat Route With Real Data.
- AI Conversation Orchestrator.

## Acceptance criteria

- [ ] Performance budgets are documented.
- [ ] Critical flows have automated or repeatable checks.
- [ ] Slow AI response has graceful UX.
- [ ] Large chat history remains usable.
- [ ] Mobile viewport remains stable.

## Test cases

- Auth load.
- Onboarding step load.
- Chat initial load.
- Send message latency.
- Long conversation.
- Many coach clients.
- Slow AI provider.

## UAT scenarios

- Client on a typical mobile connection can open chat, send a message, and understand the status while waiting.

## Edge cases

- Provider latency spike.
- Realtime reconnect storm.
- Large message history.
- Low-memory mobile browser.

## Definition of Done

- Performance expectations are measurable and tied to release readiness.

---

# Ticket R32: Internationalization Architecture

Linear fields:

- Source gap: GAP-044
- Project: Platform
- Suggested workstream: Internationalization
- Suggested sprint: Sprint 14
- Labels: Platform, Web, i18n
- Priority: P2
- Estimated complexity: M
- Execution type: HITL
- Status: Draft

## Description

Create an internationalization architecture for UI copy, dates, times, and future English-learning content.

## Business value

The product can support future pilot locales without hard-coded UI copy or broken layouts.

## What is included

- Message catalog strategy.
- Locale preference storage.
- Date/time formatting rules.
- Long-string layout review.
- Guidance for learning content versus interface language.
- Fallback behavior.

## What is not included

- No full translation project.
- No right-to-left launch support unless separately scoped.
- No automatic translation of learning content.

## Technical implementation

1. Choose i18n library or lightweight catalog approach.
2. Add locale preference field if not already present.
3. Move new UI copy into catalog pattern.
4. Define date/time formatting helpers.
5. Test unsupported locales and long strings.

## Dependencies

- Client Profile Web Experience.

## Acceptance criteria

- [ ] New UI copy has a catalog path.
- [ ] User locale can be stored.
- [ ] Dates and times format consistently.
- [ ] Unsupported locale falls back safely.
- [ ] Long translated strings do not break core layouts.

## Test cases

- Default locale.
- Unsupported locale.
- Long translated string.
- Date/time formatting.
- Missing translation key.
- Mobile layout.

## UAT scenarios

- Interface can switch to a pilot locale for core flows without layout breakage.

## Edge cases

- Mixed-language chat content.
- English-learning examples should stay in English.
- Future right-to-left locale.

## Definition of Done

- i18n foundation exists without forcing a translation launch.

---

# Ticket R33: Android Auth And Backend Integration

Linear fields:

- Source gap: GAP-045
- Project: Android
- Suggested workstream: Native MVP
- Suggested sprint: Sprint 15
- Labels: Android, Auth, Profiles, Native
- Priority: P2
- Estimated complexity: XL
- Execution type: HITL
- Status: Draft

## Description

Connect the Android preview app to real auth, session restore, profiles, and role-aware navigation.

## Business value

This starts native app parity only if native Android is still a launch priority.

## What is included

- Native priority decision.
- Supabase Kotlin or approved client integration.
- Login/logout.
- Session restore.
- Role-aware home with real profile data.
- RLS read verification.
- Basic offline/session failure states.

## What is not included

- No full chat implementation.
- No tracker or onboarding implementation.
- No iOS work.
- No duplicate backend.

## Technical implementation

1. Confirm Android scope for upcoming release.
2. Integrate approved Supabase client.
3. Implement auth screens using existing design tokens.
4. Persist and restore sessions securely.
5. Read profile data and route by role.
6. Add unit/UI tests for auth and role guards.

## Dependencies

- Client Profile Domain Schema.
- Native priority decision.

## Acceptance criteria

- [ ] Android user can log in and log out.
- [ ] Session restores after app restart.
- [ ] Role-aware home uses real backend data.
- [ ] Unauthorized role routes are blocked.
- [ ] Build and tests pass locally.

## Test cases

- Login success.
- Login failure.
- Logout.
- Session restore.
- Expired session.
- Client role route.
- Coach role route.

## UAT scenarios

- Seeded client logs into Android and sees the calm client home with real profile context.

## Edge cases

- Device rotation during login.
- Network loss during auth.
- Deep link opens without session.
- Token refresh failure.

## Definition of Done

- Android has a real auth/profile foundation or is explicitly deferred.

---

# Ticket R34: iOS Project Bootstrap

Linear fields:

- Source gap: GAP-046
- Project: iOS
- Suggested workstream: Native MVP
- Suggested sprint: Sprint 15
- Labels: iOS, Native, Docs
- Priority: P3
- Estimated complexity: XL
- Execution type: HITL
- Status: Draft

## Description

Create a real SwiftUI iOS project foundation or update repo docs to state that iOS is deferred.

## Business value

The repo should not imply an iOS app exists if the project is not actually bootstrapped.

## What is included

- Native priority decision.
- SwiftUI project scaffold if approved.
- Token constants mirroring web.
- Basic app shell.
- Build instructions.
- Tests/previews where feasible.

## What is not included

- No full iOS feature parity.
- No auth integration unless separately scoped.
- No App Store release work.
- No rushed iOS build if web remains the launch focus.

## Technical implementation

1. Decide whether iOS is active or deferred.
2. If active, create `FISH.xcodeproj` and SwiftUI app shell.
3. Add token constants and base screens.
4. Add build instructions and basic verification.
5. If deferred, update docs and avoid publishing iOS feature tickets.

## Dependencies

- Native priority decision.

## Acceptance criteria

- [ ] Either real iOS project exists or docs clearly state iOS is deferred.
- [ ] If project exists, it opens in Xcode.
- [ ] Basic build works.
- [ ] Token constants mirror product style.
- [ ] Future iOS scope is clear.

## Test cases

- Clean Xcode build if active.
- Preview loads if active.
- Docs state deferred status if inactive.
- Asset/font references are valid.

## UAT scenarios

- Franz opens the iOS project in Xcode, or partner sees clear documentation that iOS is intentionally deferred.

## Edge cases

- Signing setup missing.
- Font licensing unclear.
- Asset parity not ready.
- iOS scope competes with web launch.

## Definition of Done

- iOS state is truthful and no longer an invisible repo gap.

---

# Ticket R35: End-to-End UAT And Regression Suite

Linear fields:

- Source gap: GAP-047
- Project: Platform
- Suggested workstream: QA
- Suggested sprint: Sprint 16
- Labels: Platform, QA, UAT, Web
- Priority: P0
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Add automated and manual release coverage for auth, onboarding, tracker, chat, privacy, and role boundaries.

## Business value

Launch-critical flows need repeatable pass/fail checks before beta, production, and public launch.

## What is included

- Playwright or equivalent end-to-end tests.
- Seeded test users.
- Manual UAT scripts.
- Role-boundary scenarios.
- Mobile viewport checks.
- Reduced-motion/accessibility checks.
- Release checklist.

## What is not included

- No exhaustive test automation for every edge case.
- No performance load suite unless linked to performance ticket.
- No native E2E unless native scope is active.

## Technical implementation

1. Define critical user journeys for client, coach, and admin.
2. Create stable seeded users and test data.
3. Add automated regression tests for highest-risk flows.
4. Write manual UAT scenarios for coach validation and accessibility.
5. Add CI or documented local run command.

## Dependencies

- Web Chat Route With Real Data.
- Data-Driven Onboarding Renderer.
- Client Tracker Renderer.

## Acceptance criteria

- [ ] Auth flow has regression coverage.
- [ ] Onboarding flow has regression coverage.
- [ ] Tracker flow has regression coverage.
- [ ] Chat send/read has regression coverage.
- [ ] Wrong-role access is tested.
- [ ] Manual UAT checklist exists.

## Test cases

- Signup or invite flow.
- Login/logout.
- Client onboarding.
- Coach onboarding review.
- Tracker assignment and completion.
- Chat send.
- Client attempts coach route.
- Coach attempts unassigned client.

## UAT scenarios

- Franz runs the release checklist and can mark each critical flow pass/fail.
- Coach validates the first complete client journey from onboarding through chat.

## Edge cases

- Email link expiry.
- Mobile viewport.
- Reduced motion.
- Slow network.
- Seed data drift.

## Definition of Done

- Release-critical behavior is covered by automated tests and human UAT scripts.

---

# Ticket R36: Production Environment And Launch Runbooks

Linear fields:

- Source gap: GAP-048
- Project: Platform
- Suggested workstream: Release Readiness
- Suggested sprint: Sprint 16
- Labels: Platform, Operations, Release, Security
- Priority: P0
- Estimated complexity: L
- Execution type: HITL
- Status: Draft

## Description

Create staging and production environment setup, deployment procedures, backup/restore process, support runbooks, and launch readiness checks.

## Business value

The team can invite real users safely, recover from incidents, and operate the product without improvising.

## What is included

- Hosted Supabase staging and production setup.
- Environment variable and secret management.
- Auth email templates and redirect URLs.
- Deployment platform configuration.
- Migration procedure.
- Backup and restore drill.
- Incident/support runbooks.
- Launch checklist.

## What is not included

- No public launch until privacy, security, observability, and QA blockers are resolved.
- No manual-only production process without documentation.
- No launch marketing plan.

## Technical implementation

1. Create or document staging and production environments.
2. Configure secrets, auth redirects, and email templates.
3. Apply migrations and verify RLS.
4. Document deploy, rollback, backup, restore, and incident steps.
5. Run staging invite UAT with a real email address.

## Dependencies

- Privacy, Consent, Export, and Delete Baseline.
- Technical Observability And Error Tracking.
- Security Threat Model And RLS Audit.

## Acceptance criteria

- [ ] Staging environment exists and is documented.
- [ ] Production environment exists or has a clear creation checklist.
- [ ] Auth emails work in staging.
- [ ] Migrations can be applied repeatably.
- [ ] Backup and restore procedure is documented and tested.
- [ ] Incident/support runbooks exist.

## Test cases

- Staging signup email.
- Password reset email.
- Migration apply.
- RLS verification in staging.
- Backup restore drill.
- Rollback rehearsal.

## UAT scenarios

- Invited user signs up in staging from a real email and reaches the correct role-aware home.
- Operator follows the runbook to diagnose a failed message send.

## Edge cases

- Email deliverability failure.
- Migration fails halfway.
- Secret rotation.
- Supabase outage.
- Rollback after schema change.

## Definition of Done

- The product has documented, tested operational foundations for beta and production launch.

---

## Coverage Check

All 36 remaining publishable gap tickets are drafted in this file. Combined with the 8 sample publishable tickets in `docs/linear-sample-gap-tickets-draft.md`, the current draft backlog covers GAP-005 through GAP-048. GAP-001 through GAP-004 stay as pre-publish cleanup checklist items, not Linear tickets.
