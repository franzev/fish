# Linear Sample Gap Tickets Draft

Draft status: review only. Do not publish to Linear until Franz approves.
Linear changes made: none.
Last drafted: 2026-07-04.

## Existing Ticket Style Analysis

The strongest existing Linear tickets are `FISH-10` through `FISH-26`. They are written as implementation-ready briefs with a calm product explanation up front and clear technical boundaries below. They generally use:

- `## Overview`
- `## What this gives users`
- `## What is included`
- `## What is not included`
- `## How to review it`
- `## Objective and scope`
- `## Implementation plan`
- `## Technical notes`
- `## Acceptance criteria`
- `## Test cases`
- `## UAT scenarios`
- `## Configuration, migrations, and environment updates`
- `## Dependencies, assumptions, and risks`
- `## Quality considerations`
- `## Rollback strategy`
- `## Definition of Done`

The earlier role-home tickets (`FISH-5` through `FISH-9`) are shorter and useful for small implementation slices, but they omit enough testing, UAT, and scope-exclusion detail that they are weaker for agent execution. For the next production-readiness tickets, use the fuller `FISH-10` style.

## Drafting Rules For New Production Tickets

- Keep the first two sections user-facing and calm, not architectural.
- Keep `What is not included` explicit. This prevents hidden scope and overbuilding.
- Keep one ticket to one outcome. If it needs a schema, function, and UI, split it.
- Add `Priority`, `Complexity`, `Suggested workstream`, and `Project` before publishing.
- Include concrete dependencies by future ticket title first; replace with Linear issue IDs after publishing.
- For learning features, include a validation note: do not build until the coach technique has been proven manually.
- For AI, privacy, security, and data work, require test cases and edge cases. No vibes-only tickets.

## Suggested Linear Setup

- Team: Founders
- Default assignee: Franz, unless delegated later
- Labels to add if missing before publishing: Platform, Web, Data, Auth, Chat, AI, Privacy, Security, QA, Docs
- Projects: Platform, Web, Android, iOS
- Suggested workstream sequence:
  - Client Profiles
  - Data-Driven Onboarding
  - Tracker Engine
  - Real 1-on-1 Chat
  - AI Chat
  - Privacy, Security, and Release Readiness

---

## Pre-Publish Checklist

Do this before creating new Linear issues. These are not tickets.

- Move or close old completed UI tickets so Linear does not make finished work look unfinished.
- Park Android UI tickets until native work is an active priority.
- Keep team docs and internal planning cleanup outside the partner-facing roadmap.
- Confirm the first published tickets start with client profile and onboarding foundations.

---

# Ticket 01: Client Profile Domain Schema

Linear fields:

- Project: Platform
- Suggested workstream: Client Profiles
- Labels: Platform, Data, Auth
- Priority: P0
- Estimated complexity: M
- Status: Draft

## Overview

Expand the current minimal `profiles` foundation into a client profile domain that can support personalization, accessibility preferences, and coach context.

## What this gives users

Clients can have the app remember the basics that make coaching feel personal without being asked to choose plans or browse options.

## What is included

* Profile fields for language goal, current English comfort level, work context, timezone, locale, and accessibility preferences.
* Consent-ready metadata fields for future AI memory and analytics.
* RLS policies so clients can read and update their own safe fields.
* RLS policies so assigned coaches can read assigned client profile context.
* Generated Supabase types and local seed updates.

## What is not included

* No profile UI.
* No coach notes.
* No onboarding questionnaire.
* No AI personalization behavior.
* No client-facing plan or template picker.

## How to review it

Review the migration and RLS tests. Confirm the data model supports personalization without exposing unsafe role changes or cross-client data.

## Objective and scope

Create the data foundation for client profiles while preserving the current server-enforced role boundary.

## Implementation plan

1. Design the profile fields and decide which are nullable.
2. Add a Supabase migration extending `profiles` or creating a related `client_profiles` table.
3. Add RLS policies for client self-read/write and assigned-coach read.
4. Update generated Supabase types.
5. Update seed data with realistic but safe profile values.
6. Extend `scripts/verify-rls.ts` for profile reads and safe updates.

## Technical notes

* Role remains protected and cannot be user-editable.
* Prefer a related `client_profiles` table if the profile domain becomes large.
* Use RLS as the read authorization boundary.
* Do not add a Node API service.

## Acceptance criteria

- [ ] Client profile fields exist in the database.
- [ ] Clients can read and update only their own safe profile fields.
- [ ] Assigned coaches can read assigned client profile context.
- [ ] Unassigned coaches cannot read client profile context.
- [ ] Role self-escalation remains rejected.
- [ ] Generated types are updated.

## Test cases

* Happy path: client updates accessibility preference and reads it back.
* Negative case: client attempts to update `role` and the write is rejected.
* Boundary case: assigned coach reads profile context but cannot update it.
* Edge case: unassigned coach receives no profile data.

## UAT scenarios

* Scenario: Seeded client has profile context. Expected outcome: the app can read it without exposing unrelated users.
* Scenario: Seeded coach reads an assigned client's context. Expected outcome: only assigned clients are visible.

## Configuration, migrations, and environment updates

* New Supabase migration.
* Regenerated Supabase types.
* Seed and RLS verification script updates.

## Dependencies, assumptions, and risks

* Depends on the existing auth and `coach_clients` foundation.
* Risk: profile fields become a questionnaire by stealth. Mitigation: keep this ticket schema-only and defer UI/onboarding.

## Quality considerations

* Performance: indexes may be needed for coach roster/profile reads.
* Security: RLS must be verified with anon-session clients, not service-role reads.
* Accessibility: preferences should be designed for future low-choice UI.
* Observability: not required yet.

## Rollback strategy

Add a down-migration plan or a forward corrective migration before production deployment. Local development can reset Supabase if needed.

## Definition of Done

* Migration, generated types, seed data, and RLS verification pass.
* The schema can support the client profile UI ticket.
* No client can change role or read another client's profile.

---

# Ticket 02: Data-Driven Onboarding Question Bank

Linear fields:

- Project: Platform
- Suggested workstream: Data-Driven Onboarding
- Labels: Platform, Data, Feature
- Priority: P0
- Estimated complexity: L
- Status: Draft

## Overview

Create the database-backed question bank for onboarding so the app can render assessment questions from data, not hard-coded UI.

## What this gives users

Clients get one guided onboarding flow that can be adjusted by the team without turning into a menu of choices.

## What is included

* Assessment versions.
* Ordered onboarding questions.
* Supported answer types.
* Optional branching metadata.
* Active/inactive publishing state.
* RLS policies for clients to read the active assessment.
* Seed data for the first onboarding assessment.

## What is not included

* No onboarding UI renderer.
* No response storage.
* No coach review screen.
* No AI interpretation.
* No plan/template picker.

## How to review it

Review the schema and seed data. Confirm questions are data-driven and safe to version.

## Objective and scope

Build the data model that future onboarding UI can render one question at a time.

## Implementation plan

1. Define assessment, question, answer type, and option tables.
2. Add constraints for ordering and supported answer types.
3. Add a safe versioning model so used assessments are not edited in place.
4. Add RLS read policy for the active assessment.
5. Seed the first assessment.
6. Add type generation and tests.

## Technical notes

* Questions must be read from the database.
* Avoid broad multi-choice plan selection.
* Branching should be represented safely but can be minimal in the first version.
* Prefer stable IDs/keys for answer mapping.

## Acceptance criteria

- [ ] Active assessment version can be queried.
- [ ] Questions return in stable order.
- [ ] Supported answer types are constrained.
- [ ] Inactive assessment versions are not shown to clients.
- [ ] Seed data includes the first assessment.
- [ ] Generated types are updated.

## Test cases

* Happy path: client reads the active assessment and ordered questions.
* Negative case: inactive assessment is not returned to clients.
* Boundary case: unsupported answer type is rejected.
* Edge case: no active assessment returns a calm empty/error state contract for the future UI.

## UAT scenarios

* Scenario: Product reviews seeded onboarding questions. Expected outcome: questions can be revised in data before UI work begins.
* Scenario: Developer reviews the schema. Expected outcome: it is clear how to render each question type.

## Configuration, migrations, and environment updates

* New Supabase migration.
* Seed script update.
* Generated Supabase types.

## Dependencies, assumptions, and risks

* Depends on Client Profile Domain Schema for user context.
* Risk: branching becomes too complex early. Mitigation: support only the minimum branching needed for the first manual-coach-validated assessment.

## Quality considerations

* Performance: question reads should be small and cacheable.
* Security: clients can read question config but not admin-only drafts.
* Accessibility: answer types must be renderable with large controls and keyboard support.
* Observability: not required yet.

## Rollback strategy

Disable the active assessment version or reset local migrations before production.

## Definition of Done

* Question bank schema, seed, RLS, and generated types are complete.
* The future onboarding renderer can be implemented without hard-coded questions.
* Scope remains assessment data only.

---

# Ticket 03: Onboarding Response Storage and Resume

Linear fields:

- Project: Platform
- Suggested workstream: Data-Driven Onboarding
- Labels: Platform, Data, Feature
- Priority: P0
- Estimated complexity: M
- Status: Draft

## Overview

Persist onboarding responses and resume state so clients can leave and return without losing progress.

## What this gives users

Clients do not have to finish onboarding in one sitting. The app quietly remembers where they left off.

## What is included

* Response tables keyed by user and assessment version.
* Per-question answer storage.
* Completion state and timestamps.
* Resume position.
* RLS policies for client self-write and assigned-coach read after submission.
* Verification coverage for partial and completed assessments.

## What is not included

* No onboarding UI renderer.
* No coach review UI.
* No AI summary.
* No scoring or grading.

## How to review it

Run RLS verification and inspect saved partial responses. Confirm clients can resume and coaches cannot see unrelated users.

## Objective and scope

Create the persistence layer for an executive-function-friendly onboarding flow.

## Implementation plan

1. Add response and answer tables.
2. Add constraints preventing duplicate answers for the same question/version/user.
3. Add completion and resume metadata.
4. Add RLS policies for client writes and assigned-coach reads.
5. Add service-layer repository methods.
6. Add RLS and repository tests.

## Technical notes

* Save partial progress without requiring completion.
* Store answers as typed structured data where possible.
* Keep free-text answers protected as sensitive client data.

## Acceptance criteria

- [ ] Client can save partial responses.
- [ ] Client can read their own saved progress.
- [ ] Client can mark onboarding complete.
- [ ] Assigned coach can read completed responses.
- [ ] Unassigned coach cannot read responses.
- [ ] Duplicate answer writes are deterministic.

## Test cases

* Happy path: client answers two questions, refreshes, and resumes.
* Negative case: another client cannot read the responses.
* Boundary case: client resubmits the same question and the latest answer is stored safely.
* Edge case: assessment version changes while a client has a partial response.

## UAT scenarios

* Scenario: Client starts onboarding and closes the browser. Expected outcome: returning to onboarding resumes at the next incomplete step.
* Scenario: Coach opens a completed onboarding record. Expected outcome: only assigned client responses are visible.

## Configuration, migrations, and environment updates

* New Supabase migration.
* Generated Supabase types.
* Service repository methods.

## Dependencies, assumptions, and risks

* Depends on Data-Driven Onboarding Question Bank.
* Risk: storing free-text answers creates privacy obligations. Mitigation: treat responses as sensitive data and include them in future export/delete work.

## Quality considerations

* Performance: reads should fetch one user's current response efficiently.
* Security: strict RLS required.
* Accessibility: resume state supports executive-function needs.
* Observability: add later when onboarding UI emits events.

## Rollback strategy

Before production, use corrective migrations. In local development, reset Supabase if schema changes are still in flux.

## Definition of Done

* Onboarding responses persist and resume safely.
* RLS verification covers client, assigned coach, and unassigned coach cases.
* The UI renderer can be built against the repository methods.

---

# Ticket 04: Conversation and Message Schema

Linear fields:

- Project: Platform
- Suggested workstream: Real 1-on-1 Chat
- Labels: Platform, Data, Chat, Security
- Priority: P0
- Estimated complexity: L
- Status: Draft

## Overview

Add the database foundation for real 1-on-1 coach-client conversations and messages.

## What this gives users

Clients and coaches can share a real conversation instead of seeing mock chat UI.

## What is included

* Conversations table for assigned coach-client pairs.
* Messages table for text messages.
* Sender role and membership constraints.
* Client request id for idempotent sends.
* Message status/read-state foundation.
* RLS policies for assigned client and coach reads.
* Seed data for one sample conversation.

## What is not included

* No AI replies.
* No realtime subscriptions.
* No file uploads or media storage.
* No edit/delete/reaction behavior.
* No web route integration.

## How to review it

Run RLS verification as seeded client and coach. Confirm both can read their shared conversation and nobody else can.

## Objective and scope

Create the secure data model that the real send-message Edge Function and web chat route will use.

## Implementation plan

1. Design `conversations`, `conversation_participants` if needed, and `messages`.
2. Add constraints tying conversations to valid coach-client assignments.
3. Add idempotency support through `client_request_id`.
4. Add RLS policies for client and coach membership.
5. Add indexes for conversation message ordering.
6. Regenerate types and extend `verify-rls.ts`.

## Technical notes

* Direct Supabase reads are acceptable only under RLS.
* Command-style writes belong in Edge Functions.
* Message body max length should reuse `chatLimits.messageBodyMaxLength`.
* Avoid unsafe rich text; store plain text first.

## Acceptance criteria

- [ ] Conversations can be created for assigned coach-client pairs.
- [ ] Client can read only their own conversation.
- [ ] Coach can read only assigned-client conversations.
- [ ] Unassigned coach cannot read conversation or messages.
- [ ] Message ordering is stable.
- [ ] Generated types are updated.

## Test cases

* Happy path: seeded client and coach read the same message list.
* Negative case: unassigned coach reads zero rows.
* Boundary case: empty conversation returns no messages but still authorizes.
* Edge case: duplicate `client_request_id` cannot create duplicate messages.

## UAT scenarios

* Scenario: Seeded client opens the future conversation data. Expected outcome: only their coach conversation is visible.
* Scenario: Seeded coach opens assigned conversations. Expected outcome: only assigned clients are visible.

## Configuration, migrations, and environment updates

* New Supabase migration.
* Generated Supabase types.
* Seed and RLS verification updates.

## Dependencies, assumptions, and risks

* Depends on Client Profile Domain Schema and existing coach-client assignments.
* Risk: reassignment rules affect historical chat access. Mitigation: explicitly decide whether old coaches retain historical access before production.

## Quality considerations

* Performance: index by conversation and created time.
* Security: RLS is launch-critical.
* Accessibility: not directly applicable, but data model must support future calm UI states.
* Observability: add audit fields where helpful for support.

## Rollback strategy

Use forward corrective migrations before production. No production data should exist when this first lands.

## Definition of Done

* Conversation and message tables exist with verified RLS.
* Real send-message implementation can persist to this schema.
* UI-only chat work remains separate from this data layer.

---

# Ticket 05: Real Send Message Edge Function

Linear fields:

- Project: Platform
- Suggested workstream: Real 1-on-1 Chat
- Labels: Platform, Chat, Security
- Priority: P0
- Estimated complexity: L
- Status: Draft

## Overview

Replace the current validation-only `send-message` Edge Function with a real authorized write path for chat messages.

## What this gives users

When a client or coach sends a message, it is saved safely and becomes visible to the other person in the conversation.

## What is included

* Authenticated request handling.
* Conversation membership check.
* Plain-text message insertion.
* Idempotency with `clientRequestId`.
* Calm validation errors for empty and overlong messages.
* Basic rate-limit or abuse guard placeholder.
* Tests for authorization and persistence.

## What is not included

* No AI reply generation.
* No realtime broadcast work.
* No attachments.
* No reactions, edit, delete, or forwarding.
* No notification sending.

## How to review it

Call the Edge Function as seeded client and coach. Confirm authorized sends persist and unauthorized sends fail.

## Objective and scope

Turn `send-message` from a stub into the command boundary for text message writes.

## Implementation plan

1. Parse and validate the command body.
2. Resolve the authenticated user from the request JWT.
3. Check conversation membership under the service role or a secure RPC.
4. Insert the message with idempotency protection.
5. Return the saved message payload.
6. Add tests or scripted verification for success and denial cases.

## Technical notes

* Edge Function writes may use service role only after explicit authorization checks.
* Do not trust `senderRole` from the client.
* Keep copy calm and non-scolding.
* Use the shared `chatLimits` contract.

## Acceptance criteria

- [ ] Authenticated client can send to their own conversation.
- [ ] Authenticated coach can send to assigned-client conversation.
- [ ] Unassigned user cannot send.
- [ ] Empty and overlong messages are rejected.
- [ ] Duplicate `clientRequestId` returns or preserves the original message without duplication.
- [ ] Function returns the persisted message.

## Test cases

* Happy path: client sends a normal message.
* Negative case: user sends to a conversation they do not belong to.
* Boundary case: message body exactly at max length succeeds.
* Edge case: retry with same `clientRequestId` does not duplicate.

## UAT scenarios

* Scenario: Client sends "Hi coach" through the function. Expected outcome: the message appears in the database once.
* Scenario: Another client tries the same conversation id. Expected outcome: the request is rejected with calm copy.

## Configuration, migrations, and environment updates

* Existing Edge Function updated.
* May require local Supabase function serve/test instructions.
* No new environment variables expected.

## Dependencies, assumptions, and risks

* Depends on Conversation and Message Schema.
* Risk: service-role misuse could bypass RLS. Mitigation: authorization check is explicit and tested before insert.

## Quality considerations

* Performance: function should return quickly for text sends.
* Security: command boundary is critical.
* Accessibility: returned errors should be usable by current chat UI states.
* Observability: include request/correlation logging without message body leakage.

## Rollback strategy

Revert function code to validation-only behavior before production, or disable the route if persistence is unsafe.

## Definition of Done

* Function persists authorized text messages.
* Unauthorized writes are rejected.
* Idempotency and validation are verified.

---

# Ticket 06: Web Chat Route With Real Data

Linear fields:

- Project: Web
- Suggested workstream: Real 1-on-1 Chat
- Labels: Web, Chat, Feature
- Priority: P0
- Estimated complexity: L
- Status: Draft

## Overview

Wire the existing web chat component library to real conversation and message data.

## What this gives users

Clients and coaches can open the app and actually exchange messages in a calm 1-on-1 chat.

## What is included

* Product chat route using authenticated layout.
* Real conversation list or single assigned conversation entry.
* Message loading from Supabase under RLS.
* Send behavior through the Edge Function.
* Optimistic send state, failed-send state, and retry path.
* Empty and loading states using existing chat components.

## What is not included

* No AI replies.
* No attachments.
* No notifications.
* No realtime typing/presence unless already available.
* No message edit/delete/reactions as behavior.

## How to review it

Log in as seeded client and coach in two browser sessions. Send a message from one and confirm the other can see it after refresh or available update.

## Objective and scope

Move chat from `/kit/chat` mock showcase into a real protected product route.

## Implementation plan

1. Choose the product route shape from the navigation sketch direction.
2. Add server-side data loading for authorized conversations.
3. Map database rows to `apps/web/components/chat` view models.
4. Wire `ChatInput` to the real send-message command.
5. Add optimistic, loading, empty, and failure states.
6. Add focused tests for route guards, view mapping, and send behavior.

## Technical notes

* `/kit/chat` remains a dev showcase.
* Product route must not import mock data.
* Send is the only primary action in the chat view.
* Avoid giving clients conversation or plan choices beyond assigned conversations.

## Acceptance criteria

- [ ] Client can open their assigned conversation.
- [ ] Coach can open assigned-client conversation.
- [ ] Product route does not use mock data.
- [ ] Sending a message persists through the Edge Function.
- [ ] Failed send can be retried without losing typed text.
- [ ] Signed-out and wrong-role access remain protected.

## Test cases

* Happy path: seeded client loads messages and sends one.
* Negative case: signed-out user redirects to login.
* Boundary case: empty conversation shows calm empty state.
* Edge case: failed send leaves draft available for retry.

## UAT scenarios

* Scenario: Client sends a message to coach. Expected outcome: message appears as sent and persists after refresh.
* Scenario: Coach opens the same thread. Expected outcome: coach sees the client's message and can reply.

## Configuration, migrations, and environment updates

None beyond dependencies.

## Dependencies, assumptions, and risks

* Depends on Conversation and Message Schema.
* Depends on Real Send Message Edge Function.
* Risk: chat route could introduce extra navigation choices. Mitigation: follow the selected navigation-shell sketch and one-primary-action rule.

## Quality considerations

* Performance: message list should not layout-shift during loading.
* Security: all reads rely on RLS and all writes go through Edge Function authorization.
* Accessibility: preserve keyboard focus, screen-reader labels, and reduced-motion behavior from chat kit.
* Observability: send failures should be loggable without exposing message bodies.

## Rollback strategy

Hide the product chat route and keep `/kit/chat` available as a dev-only showcase.

## Definition of Done

* Real web chat route works for seeded client and coach.
* Tests cover loading, empty, send, failure, and access control.
* No mock data is used in product chat.

---

# Ticket 07: AI Provider Abstraction and Safe Reply Contract

Linear fields:

- Project: Platform
- Suggested workstream: AI Chat
- Labels: Platform, AI, Security
- Priority: P0
- Estimated complexity: L
- Status: Draft

## Overview

Create the server-side AI service boundary and response contract before adding AI replies to chat.

## What this gives users

Clients eventually receive helpful English practice replies, but the app first gets a safe, testable AI foundation instead of a fragile direct model call.

## What is included

* Server-side AI provider interface.
* Environment and secret handling.
* Timeout, retry, and error normalization.
* Structured response contract for a chat reply.
* FISH voice and safety constraints in the prompt contract.
* Test fixtures for provider success, failure, timeout, and malformed output.

## What is not included

* No production AI replies in user chat yet.
* No long-term memory.
* No grammar correction pipeline.
* No pronunciation feedback.
* No client-facing AI settings.

## How to review it

Run the provider contract tests and inspect the sample structured response. Confirm no browser code can access provider secrets.

## Objective and scope

Build the AI boundary that later chat orchestration can depend on safely.

## Implementation plan

1. Define provider-agnostic request and response types in the service layer.
2. Add server-only environment validation for provider secrets.
3. Implement one provider adapter behind the interface.
4. Add timeout and error normalization.
5. Add structured response validation.
6. Add fixtures and tests for normal and broken provider responses.

## Technical notes

* AI calls must happen server-side only.
* Do not expose secrets through `NEXT_PUBLIC_*`.
* Do not store raw prompts or message bodies in logs.
* Keep this as infrastructure; chat orchestration is a separate ticket.

## Acceptance criteria

- [ ] AI provider secrets are server-only.
- [ ] Provider interface has typed request and response contracts.
- [ ] Success, timeout, rate-limit, and malformed-output cases normalize to service results.
- [ ] Structured reply contract can represent a calm FISH response.
- [ ] Tests prove browser code cannot import provider secrets.

## Test cases

* Happy path: provider returns a structured reply.
* Negative case: provider returns malformed output and the service rejects it.
* Boundary case: provider times out and returns a recoverable error.
* Edge case: missing environment variable fails safely at service construction.

## UAT scenarios

* Scenario: Developer runs the test provider fixture. Expected outcome: a FISH-style structured reply is returned.
* Scenario: Provider key is missing locally. Expected outcome: the app reports a clear server-side configuration error, not a browser crash.

## Configuration, migrations, and environment updates

* New server-only environment variable names for the selected AI provider.
* No database migration.

## Dependencies, assumptions, and risks

* Depends on real chat foundation for eventual use, but can be built once service boundaries are agreed.
* Risk: provider-specific logic leaks into UI. Mitigation: enforce service boundaries and typed adapter contracts.

## Quality considerations

* Performance: timeout must be bounded.
* Security: secrets must remain server-only and logs must avoid sensitive text.
* Accessibility: eventual AI copy must follow non-scolding FISH voice.
* Observability: record provider errors without raw message content.

## Rollback strategy

Disable the AI provider adapter and leave real chat human-only.

## Definition of Done

* AI service boundary exists and passes tests.
* Provider secrets are server-only.
* Future chat orchestration can call the abstraction without UI coupling.

---

# Ticket 08: Privacy, Consent, Export, and Delete Baseline

Linear fields:

- Project: Platform
- Suggested workstream: Privacy, Security, and Release Readiness
- Labels: Platform, Privacy, Security
- Priority: P0
- Estimated complexity: XL
- Status: Draft

## Overview

Define and implement the privacy baseline for profiles, onboarding responses, chat messages, AI memory, audio, and analytics before beta.

## What this gives users

Clients can trust that sensitive language-learning data is handled deliberately and can be exported or deleted.

## What is included

* Consent records for AI memory and analytics.
* Data retention decisions.
* Export path for profile, onboarding, tracker, chat, and memory data.
* Delete path for user-owned data where legally allowed.
* Audit log for sensitive admin/coach actions.
* Documentation of what is stored and why.

## What is not included

* No legal policy drafting beyond technical data inventory.
* No third-party analytics implementation unless separately approved.
* No AI memory implementation if the AI memory ticket has not landed.

## How to review it

Review the data inventory, consent model, and export/delete behavior against the current schema.

## Objective and scope

Create the minimum privacy foundation required for beta and production readiness.

## Implementation plan

1. Inventory all user data tables and future sensitive data categories.
2. Add consent and retention tables or fields.
3. Implement export service for current user data.
4. Implement delete/deactivation flow for user-owned data.
5. Add audit logging for privileged actions.
6. Add verification tests for export completeness and delete boundaries.

## Technical notes

* Include future AI memory in the design even if memory is not yet built.
* Do not log raw chat content in operational logs.
* Preserve RLS after deletion/deactivation.
* Coordinate with hosted Supabase backup/restore plans before production.

## Acceptance criteria

- [ ] Data inventory exists.
- [ ] Consent model exists for AI memory and analytics.
- [ ] User data export includes all current user-owned data.
- [ ] Delete/deactivation path removes or anonymizes appropriate data.
- [ ] Privileged privacy-affecting actions are audited.
- [ ] Tests cover export and delete behavior.

## Test cases

* Happy path: user export contains profile, onboarding, tracker, and chat data that exists.
* Negative case: user export does not include another user's data.
* Boundary case: deleted user no longer appears in normal coach/client reads.
* Edge case: reassigned coach cannot export former client data.

## UAT scenarios

* Scenario: Client requests an export. Expected outcome: export is complete and understandable.
* Scenario: Client requests deletion. Expected outcome: user data is removed or anonymized according to the documented retention decision.

## Configuration, migrations, and environment updates

* Likely new migration for consent and audit tables.
* May require storage/export bucket configuration later.

## Dependencies, assumptions, and risks

* Depends on the core profile/chat/onboarding data model.
* Risk: privacy work lands too late and forces schema rewrites. Mitigation: design consent and retention before AI memory and analytics launch.

## Quality considerations

* Performance: export can be asynchronous if data grows.
* Security: strict user scoping and audit logs are required.
* Accessibility: export/delete UI copy must be plain and calm.
* Observability: privacy operations should be traceable without leaking content.

## Rollback strategy

Do not launch beta until privacy baseline passes. If a privacy migration is wrong, fix forward before production.

## Definition of Done

* Privacy data inventory, consent model, export, delete, and audit baseline are implemented or explicitly documented as deferred blockers.
* Tests prove no cross-user export leakage.
* Beta release readiness can reference this baseline.
