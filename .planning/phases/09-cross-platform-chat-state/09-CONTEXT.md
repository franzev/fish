# Phase 9: Cross-platform Chat State - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning
**Source:** Conversation context after `$gsd-plan-phase`; user selected "Add chat state phase"

<domain>
## Phase Boundary

Deliver an internal chat-state architecture foundation that keeps the current one-assigned-conversation product behavior but prepares chat for multiple web surfaces and later native clients:

- Extract the durable chat-state rules into a portable TypeScript core module that does not import React, Next.js, Zustand, Supabase browser/server clients, or DOM APIs.
- Refactor the current web chat route from one large `ChatClient` component into focused hooks before moving shared web state into Zustand.
- Introduce Zustand only as the web React adapter/cache for shared chat surfaces. It coordinates state keyed by `conversationId`; it does not become the source of truth for authorization, assignment, or durable persistence.
- Add JSON fixtures and a short protocol document that describe chat-state events and expected results so Android and iOS can implement equivalent native state machines later.
- Add Android/iOS architecture notes only. Native production implementation is explicitly out of scope for this phase.

**Not in this phase:** new chat UI, conversation picker, menus, client plan choices, assignment UI, notifications, offline-first queue, native production chat screens, AI-assisted coaching, learning exercises, gamification, community feed, message attachments, moderation, or database schema changes unless the planner finds a narrow test fixture need.

</domain>

<decisions>
## Implementation Decisions

### Portable chat state
- **D-01:** The "chat brain" is a small portable state machine/event contract, not Zustand. The portable layer owns deterministic merge/status/read/snippet behavior and any reducer-like event transitions that must stay equivalent across web, Android, and iOS.
- **D-02:** Keep platform-specific state containers thin. Web may use Zustand; Android should later use `ViewModel` + `StateFlow`; iOS should later use an observable model. Native clients must not inherit web library choices.
- **D-03:** JSON fixtures are the cross-platform compatibility contract. At minimum, fixtures must cover hydration, optimistic send, send confirmation, send failure, remote message merge, duplicate `clientRequestId` reconciliation, read-state merge, unread count, deleted-message snippet, and reply preview behavior.
- **D-04:** Put portable TypeScript code in `packages/core` or a similarly shared package. Do not put React hooks, Zustand stores, Supabase clients, or Next.js server actions in the portable module.
- **D-05:** Preserve the existing server/Supabase authority boundary. Supabase RLS, Edge Functions, server actions, and database functions still decide auth, assignment, membership, write permission, persistence, and durable read state.

### Web refactor sequence
- **D-06:** Extract hooks before introducing Zustand: messages/read-state logic, realtime subscriptions, presence/typing/recording, and composer/send/edit/delete/reaction behavior should become focused units that can be tested or reasoned about independently.
- **D-07:** Zustand should be introduced after hook boundaries are clear. The web store may hold messages/read states by `conversationId`, drafts, reply/edit targets, local pending/failed send metadata, realtime connection status, and lightweight cached conversation summaries.
- **D-08:** Zustand must not store auth/session truth, role permissions, coach-client assignment decisions, direct Supabase clients, service-role data, or any security-sensitive decision that belongs to RLS/Edge Functions/server actions.
- **D-09:** The existing `ChatClient` route must keep the same visible behavior: one assigned conversation, one primary send action, calm notices, no conversation picker, no extra menus, no lost drafts, no duplicate optimistic messages, and no layout shift regression.
- **D-10:** If package dependencies change, add `zustand` only to `apps/web/package.json` via pnpm. Do not add Redux/Jotai or a second client state library.

### Native readiness
- **D-11:** This phase prepares Android/iOS with protocol docs and fixtures, not production native chat implementation. Native delivery should remain unblocked by web refactor details.
- **D-12:** Android/iOS parity should be expressed as event names, state shape, and fixture expectations rather than generated TypeScript consumption. Kotlin and Swift can later implement the same contract idiomatically.

### Verification
- **D-13:** Existing chat tests must remain green, and new reducer/fixture/store tests must prove optimistic-send reconciliation, read-state status, failure preservation, and fixture compatibility.
- **D-14:** Required gates include `pnpm --filter @fish/web test` or focused chat tests, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. If planner narrows verification to focused commands during implementation, final release verification still runs the repo gates from AGENTS.md.

### the agent's Discretion
- Exact hook file names and whether the portable reducer is one module or a small folder, provided dependency boundaries remain strict.
- Exact Zustand selector shape, provided components subscribe narrowly enough to avoid avoidable full-chat rerenders.
- Exact fixture JSON schema, provided it is simple for Kotlin/Swift to consume and includes expected output, not just input events.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and phase scope
- `.planning/ROADMAP.md` section "Phase 9: Cross-platform Chat State" - phase goal, dependencies, and requirement IDs.
- `.planning/REQUIREMENTS.md` section "Cross-platform Chat State (CSTATE)" - CSTATE-01 through CSTATE-06 acceptance scope.
- `.planning/PROJECT.md` sections "Core Value", "Constraints", and "Key Decisions" - coach-first rule, choice-free UI, Supabase boundary, and native/web scope.
- `.planning/STATE.md` "Accumulated Context" - existing cross-phase decisions including chat write boundary and layout stability.
- `AGENTS.md` - product rule, design rules, package manager, web/native stack, Supabase API boundary, and build commands.

### Existing chat implementation
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - current web state, subscriptions, optimistic send lifecycle, and UI behavior to preserve.
- `apps/web/app/(authenticated)/chat/chat-state.ts` - current pure helpers that should move toward the portable core.
- `apps/web/app/(authenticated)/chat/realtime.ts` - Supabase realtime adapter that should remain platform/web-specific.
- `apps/web/app/(authenticated)/chat/actions.ts` - server-action/Edge Function boundary; Zustand must not bypass it.
- `apps/web/app/(authenticated)/chat/chat-state.test.ts` - current helper behavior tests.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - current interaction/regression tests.
- `apps/web/e2e/chat-send.spec.ts` - browser send behavior that must remain valid.
- `packages/core/src/chat.ts` - current shared chat limits and DTO surface.
- `packages/supabase/src/database.types.ts` - generated database row aliases and persistence contracts.

### Native platform context
- `apps/android` - Android project skeleton and existing quick-task preview work; native chat implementation is out of scope.
- `apps/ios/FISH.xcodeproj` and `apps/ios` - iOS project foundation; native chat implementation is out of scope.
- `.planning/quick/260704-dn2-go-with-option-1-implement-native-androi/260704-dn2-SUMMARY.md` - Android preview history if native context is needed.
- `.planning/quick/260705-amu-bootstrap-the-ios-project-and-configure-/260705-amu-SUMMARY.md` - iOS foundation history if native context is needed.

</canonical_refs>

<specifics>
## Specific Ideas

- Prefer event names such as `hydrateConversation`, `draftChanged`, `sendOptimisticMessage`, `confirmSentMessage`, `markMessageFailed`, `mergeRemoteMessage`, `mergeReadState`, `setReplyTarget`, `setEditTarget`, and `clearComposer`.
- Store shape should be normalized by `conversationId`, but the UI should still present only the assigned conversation until a later product phase explicitly validates more surfaces.
- Add a dependency-boundary test or lint-style test if feasible: portable chat state must not import React, Next.js, Supabase clients, Zustand, or app route modules.
- Keep `chat-state.ts` as a compatibility shim or move consumers carefully so tests prove no behavior changed.

</specifics>

<deferred>
## Deferred Ideas

- Multi-conversation inbox, conversation picker, notification center, coach assignment UI, offline-first send queue, native production chat screens, AI-assisted coaching, and learning mechanics.
- Native-generated shared code pipeline. For now, JSON fixtures and a written protocol are the stable cross-platform contract.
- Realtime product expansion beyond preserving current subscriptions and state handling.

</deferred>

---

*Phase: 09-cross-platform-chat-state*
*Context gathered: 2026-07-07*
