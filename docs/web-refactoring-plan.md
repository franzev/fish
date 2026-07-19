# Web Modularity Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the findings of [web-modularity-review.md](./web-modularity-review.md) — split the multi-responsibility files, consolidate the duplicated pipelines, and promote misplaced pure logic into `packages/core`/`model/` — without changing product behavior except where the review found real hazards.

**Architecture:** Every phase follows the repo's established pattern: pure decision logic in `packages/core` (fixture-verified, cross-platform) or feature `model/` modules (table-tested); React glue in `hooks/`; IO in `lib/services/supabase/` adapters; composition in providers/roots. Behavior-preserving moves are separate commits from behavior changes. Tests move with the code they cover.

**Tech stack:** Next.js App Router, TypeScript, Zustand-over-core-reducer, Supabase adapters, vitest.

**Source of truth for "why":** every task references a section of `docs/web-modularity-review.md` (e.g. R3.1). Line numbers are approximate (`~L`) — re-locate symbols before editing.

---

## Standing rules (every task)

- [ ] Gate before **every** commit: `pnpm build` (must pass per AGENTS.md), `pnpm --filter @fish/web typecheck`, and the targeted test command listed in the task.
- [ ] After any structural change (new/moved/deleted component folders or barrels): `pnpm --filter @fish/web exec vitest run tests` (service-boundary + module-boundary suites must stay green).
- [ ] After any change under `packages/core` fixtures: `pnpm ios:chat-vectors:check` and `pnpm chat-media:verify`; regenerate with the matching non-`:check` scripts when vectors legitimately changed, and update `packages/core/docs/chat-state-protocol.md` when the event protocol grows.
- [ ] Commits: small, logical, conventional style matching `git log` (`refactor(chat): …`, `test(chat): …`, `feat(core): …`). No co-author trailers.
- [ ] Pure moves are committed with no edits beyond imports/exports so review works with `git diff --color-moved=zebra`.
- [ ] New components follow the folder convention: `component-name/component-name.tsx` + `index.ts` with `export * from "./component-name"`. Check every barrel on the import path when exports change.
- [ ] **Hot-file coordination:** Phases D and E touch `chat-client.tsx` and `contracts.ts` — the two highest-churn files. Run those phases in a quiet window (no parallel sessions editing chat or services), one PR each.
- [ ] `packages/core` is the reference implementation for the native ports. Any core change ships fixture vectors in the same commit, and anything that *removes* core surface needs a native-usage check first (`grep -r <symbol> apps/android apps/ios packages/core/src/*/fixtures`).

**Out of scope — do not do (R4, R6):** do not split `call-media.ts`, `use-chat-image-uploads.ts`, `call-popover-view.tsx`, `draggable-video-preview.tsx`, `message-actions.tsx`, `app-shell.tsx`, `user-menu.tsx`, `landing-page.tsx`, or the core reducers beyond what a task names. No Result/Either monad library. No functionalizing IO adapters. No new generic abstractions ahead of a third concrete duplicate.

---

## Dependency graph

```
A (dead surface)      — independent, do first
B (pure extractions)  — independent of A; B1 blocks D1, B6 blocks D3
C (core promotions)   — C1 blocks D4; C2–C4 block D5
D (chat hooks + chat-client + test redistribution) — after B1, C1–C4
E (services layer)    — independent of B–D except E5 (contracts) last, quiet window
F (presence promotion) — independent
G (calls trims + test redistribution, shared UI) — independent
```

Phases B, C, E1–E4, F, G can proceed in parallel sessions (disjoint paths). Phase D is single-session work.

---

## Phase A — Delete dead surface (R5.11)

### Task A1: Remove dead chat hook/store surface

**Files:** Modify `apps/web/features/chat/hooks/use-chat-realtime.ts`, `use-chat-messages.ts`, `apps/web/features/chat/model/store/chat-store.ts`, `apps/web/features/chat/components/chat-client/chat-client.tsx`

- [ ] Verify each symbol is dead before deleting: `grep -rn "setMessages\b" apps/web --include="*.ts*"` (the prop threaded into `useChatRealtime` is destructured but never called — confirm); same for `mergeMessage` (export in use-chat-messages), `participantRecording`/`subscribeToConversationVoiceRecording`/`setLocalVoiceRecording` (voice-recording surface), store `clearComposer`.
- [ ] For core-adjacent surface (`setEditTarget` event + store wrapper): `grep -rn "setEditTarget\|editTargetId" apps/android apps/ios packages/core` — if it appears in fixture vectors or native ports, delete **only** the unused web-store wrapper and leave the core event.
- [ ] Delete the dead code paths, including the `setMessages` entry in `useChatRealtime`'s effect dependency array and its prop threading from chat-client.
- [ ] Run: `pnpm --filter @fish/web exec vitest run features/chat` → expect pass; then standing gates.
- [ ] Commit: `refactor(chat): remove dead realtime/store surface`

### Task A2: Delete the unused service container

**Files:** Delete `apps/web/lib/services/container.ts`, `apps/web/lib/services/container.test.ts`

- [ ] Confirm zero production importers: `grep -rn "container" apps/web/lib/services/index.ts apps/web --include="*.ts*" | grep -v test | grep -v node_modules` — expect only the file itself; check `lib/services/index.ts` barrel for a re-export and remove it.
- [ ] Delete both files; standing gates (boundary suite especially).
- [ ] Commit: `refactor(services): delete unused service container abstraction`

### Task A3: Rename the misnamed repository test

**Files:** Rename `apps/web/lib/services/supabase/core.test.ts` → `chat-repository.test.ts`

- [ ] `git mv apps/web/lib/services/supabase/core.test.ts apps/web/lib/services/supabase/chat-repository.test.ts` (it is ~70% chat-repository behavior, R3.3). Keep the small registry/auth describes in place for now — they move in E2 if that task rewrites them.
- [ ] Run: `pnpm --filter @fish/web exec vitest run lib/services/supabase/chat-repository.test.ts` → pass.
- [ ] Commit: `test(services): rename core.test to chat-repository.test`

---

## Phase B — Pure extractions, behavior-preserving (R3.1, R3.10, R3.13, R5)

### Task B1: `createSearchRequest` → `model/search` (R3.1)

**Files:** Create `apps/web/features/chat/model/search/search-request.ts` + test; Modify `model/search/index.ts`, `features/chat/components/chat-client/chat-client.tsx` (~L65–87)

- [ ] Write the failing test first (`search-request.test.ts`): table cases asserting criteria→`ChatSearchInput` mapping — `from`→`senderIds`, `mentions`→`mentionedUserIds`, `in`→`channelIds`, `has`→`contentKinds`, `author`→`authorTypes`, `pinned` find-first, `date`→operator/date/timeZone, offset `(page-1)*limit`.
- [ ] Move the function body verbatim from chat-client; signature `createSearchRequest(conversationId: string, query: string, criteria: ChatFilterCriterion[], page: number, sortDirection: "asc" | "desc", options?: { pageSize?: number; timeZone?: string }): ChatSearchInput` — `timeZone` defaults to the current `Intl` lookup so tests can pin it.
- [ ] Re-export from `model/search/index.ts`; update chat-client import; delete the inline copy. Run new test + `vitest run features/chat/components/chat-client` → pass. Standing gates.
- [ ] Commit: `refactor(chat): move search request builder into model/search`

### Task B2: Split the message-body parser from its renderer (R3.10)

**Files:** Create `apps/web/features/chat/components/message-body/message-body-parser.ts` + `message-body-parser.test.ts`; Modify `message-body/message-body.tsx`

- [ ] Move (verbatim) the pure layer: token type interfaces, the 6 regexes, `EMOJI_ONLY_RE`, `tokenize` (~L120–184), the recursive list parser (~L82–118), and `sanitizeHref` (~L199–202). Export all of them. Renderers and the component stay.
- [ ] Write data-level tests: unclosed fence, indentation nesting, parens-in-URL, emoji-only detection, and the two **security** cases (T-p06-02) asserting `sanitizeHref` neutralizes `javascript:`-style hrefs at the token level. Keep the existing DOM tests untouched — they now cover only element/class mapping.
- [ ] Run: `vitest run features/chat/components/message-body` → all pass. Standing gates.
- [ ] Commit: `refactor(chat): extract message-body parser into pure module`
- [ ] Follow-up check (separate commit only if true): if Android/iOS render the same markup grammar, file a task to promote the token layer to `packages/core` — do not promote speculatively.

### Task B3: Row-presentation derivation + day divider (R3.13)

**Files:** Create `chat-message-list/chat-message-row/row-presentation.ts` + test, `chat-message-list/day-divider/` component folder; Modify `chat-message-row.tsx` (~L118–169, ~L338–421), `chat-message-list/chat-message-list.tsx`

- [ ] Extract `deriveRowPresentation(message, previous, next, ctx)` returning `{ compactSent, showStatus, startsCommunityGroup, showParticipantAvatar, dayDividerLabel, surfaceWidthClass }` — including the 5-deep surface-width ternary as `getMessageSurfaceWidthClass`. Replace the ~L145–150 `toDateString()` comparison with `isSameLocalCalendarDay` from the existing `chat-day-label.ts` (deletes date-logic duplicate #7 of R5).
- [ ] Table-test the derivation (grouping boundaries, day rollover, avatar visibility); move the two contract interfaces `ChatMessageActions`/`ChatMessageEditingState` up to `chat-message-list.tsx`.
- [ ] Extract the day-divider `<li>` into `day-divider/day-divider.tsx` + `index.ts`.
- [ ] Separate commit (small behavior change, R3.13 perf flag): build a `Map<string, LocalMessage>` reply lookup once in `chat-message-list` and pass it down, replacing per-row `messages.find`.
- [ ] Run: `vitest run features/chat/components/chat-message-list` + standing gates (module-boundary suite for the new folder).
- [ ] Commits: `refactor(chat): extract message row presentation derivation` · `perf(chat): build reply lookup once per transcript`

### Task B4: Unread-boundary timestamp helpers (R3.13)

**Files:** Create `chat-message-list/first-unread.ts` + test; Modify `chat-message-list.tsx` (~L53–106)

- [ ] Move `subMillisecondFraction`, `timestampsMatch`, and the `firstLoadedUnreadMessageId` derivation into `findFirstUnreadMessageId(messages, boundary)`; write table tests including the Postgres-microsecond sub-millisecond cases (this is subtle correctness logic with zero direct tests today).
- [ ] Standing gates. Commit: `test(chat): extract and cover first-unread timestamp matching`

### Task B5: Booking schedule grid (R3.13)

**Files:** Create `apps/web/features/booking/components/availability-table/schedule-weeks.ts` + test; Modify `availability-table.tsx` (~L40–136)

- [ ] Move `calendarDate`/`addCalendarDays`/`weekStartKey`/`localTimeKey`/`buildScheduleWeeks` verbatim; table-test week/day/time-row construction across month boundaries and sparse slots.
- [ ] Optional same-PR cleanup: dedupe the slot `Button` markup between desktop table and mobile list into one local `SlotButton`.
- [ ] Run: `vitest run features/booking` + standing gates. Commit: `refactor(booking): extract schedule-week grid builder`

### Task B6: Calls pure extractions (R3.8, R4)

**Files:** Create `features/calls/components/call-provider/apply-call.ts` + test, `features/calls/components/call-provider/permission-notice.ts` + test, `features/calls/client/speaking-level.ts` + test; Modify `call-provider.tsx`, `call-media.ts`, `call-popover-view.tsx`

- [ ] `apply-call.ts`: extract the snapshot→event mapping from `applyCall` (~L181–240) as `planCallEvents(call: ClientCall, state: CallState): { events: CallEvent[]; shouldDisconnect: boolean }` (beside `call-exit.ts`, the file's own precedent). Provider applies the plan. Table-test ringing/connecting/active/terminal paths.
- [ ] `permission-notice.ts`: the permission-result → `{ reason, notice }` table repeated ×3 in `startCall`/`startLessonCall`/`answer`.
- [ ] Dedupe commands in `call-provider.tsx`: one `startCallFlow(kind)` behind `startCall`/`startLessonCall`; one `terminate(command, eventType)` behind `decline`/`cancel`/`end` (~90 duplicated lines).
- [ ] `speaking-level.ts`: extract the DSP math from `call-media.ts` (~L395–435) as pure `smoothSpeakingLevels(previous, measured)` (attack 0.35 / decay 0.12, /0.3 normalization, 0.025 threshold, 250 ms hold, 0.01 floor) — test with plain numbers. Also collapse the teardown block duplicated between `disconnect()` and the Disconnected handler into one private `resetConnectionState()`.
- [ ] `call-popover-view.tsx`: export `getCallCopy` and add `call-popover-view.test.tsx` covering the status→copy map (file currently untested at 395 lines).
- [ ] Run: `vitest run features/calls` + standing gates. Commits: `refactor(calls): extract call snapshot planning and permission notices` · `refactor(calls): dedupe start/terminate command flows` · `refactor(calls): extract speaking-level math` · `test(calls): cover call copy map`

### Task B7: Small shared dedupes (R5.5, R5.8)

**Files:** Create `apps/web/features/chat/components/autosize-textarea.ts`; Modify `composer/composer.tsx` (~L75–82), `chat-message-list/message-editor/message-editor.tsx` (~L25–32)

- [ ] Replace the verbatim-duplicated `resizeComposer`/`resizeEditor` with one exported helper. Export `getSendDisabledReason` from composer and add a direct table test (currently only reachable through tooltip renders).
- [ ] Standing gates. Commit: `refactor(chat): share textarea autosize and cover send-disabled reasons`

### Task B8: Criterion knowledge into `model/search` (R5.8)

**Files:** Modify `apps/web/features/chat/model/search/` (add `makeCriterion` + move `criterionFromSuggestion`/`suggestionValue` from `search-filter-popover.tsx`), `search-filters/search-filter-popover/search-filter-popover.tsx`, `search-filters/filters-dialog/filters-dialog.tsx` (~L62–115)

- [ ] Add `makeCriterion(...)` owning the `` `${kind}:${value}` `` id format (currently rebuilt at ~6 sites); move the two pure suggestion mappers (plus the per-operator suggestion matrix as `suggestionsForToken(token, members, channels)`) into `model/search` beside the parser, with table tests.
- [ ] Collapse the four copy-paste toggles in `filters-dialog.tsx` (`toggleMember`/`toggleChannel`/`toggleContent`/`toggleAuthor`) into one generic `toggleCriterion(draft, matcher, make)` (~50 duplicated lines).
- [ ] Run: `vitest run features/chat/components/search-filters features/chat/model/search` (the shared 276-line search-filters test must stay green). Standing gates.
- [ ] Commit: `refactor(chat): centralize search criterion construction in model/search`

---

## Phase C — Core promotions (fixture vectors first) (R3.6, R3.13, R5.10)

### Task C1: Monotonic read-state guard into the core reducer (R3.6 — real hazard)

**Files:** Modify `packages/core/src/chat-state/reducer.ts` (`mergeReadState` case), `packages/core/src/chat-state/fixtures/chat-state-vectors.json`, `apps/web/features/chat/hooks/use-chat-read-state.ts` (~L57–79)

> A background-task chip for exactly this task was created during the review — check it isn't already in flight before starting.

- [ ] Add fixture vectors FIRST: out-of-order `mergeReadState` events (later `lastReadAt` then earlier one) asserting the earlier event does not regress state. Run `pnpm --filter @fish/web exec vitest run tests/chat-state-fixtures.test.ts` → expect the new vectors to FAIL against the current reducer.
- [ ] Move `isEarlierTimestamp` + `mergeMonotonicReadState` into core (exported from chat-state), apply inside the reducer's `mergeReadState` transition. Fixture test now passes.
- [ ] Shrink `use-chat-read-state.ts`: delete the local guard, dispatch plain `mergeReadState`. Run `vitest run features/chat/hooks/use-chat-read-state.test.tsx` → pass unchanged.
- [ ] Update `packages/core/docs/chat-state-protocol.md` (merge semantics section); run `pnpm ios:chat-vectors` to sync vectors, then `pnpm ios:chat-vectors:check`. Standing gates.
- [ ] Commit: `fix(core): enforce monotonic read-state merges in the reducer`

### Task C2: Unify message normalization (R3.13)

**Files:** Modify `packages/core/src/chat-state/reducer.ts` (export the private `normalizeMessage`) or `selectors.ts`, `apps/web/features/chat/hooks/use-chat-messages.ts` (`toLocalMessage`)

- [ ] Export core's `normalizeMessage`; reimplement `toLocalMessage` as a thin call to it (they are the same null-coalescing + `localStatus` defaulting — verify field-by-field before deleting; any divergence is a bug to surface, not to silently pick a side).
- [ ] Run: `vitest run features/chat tests/chat-state-fixtures.test.ts` + standing gates + vector sync check.
- [ ] Commit: `refactor(core): export message normalization; dedupe web copy`

### Task C3: Promote two web derivations to core selectors (R3.13)

**Files:** Modify `packages/core/src/chat-state/selectors.ts` + vectors; `apps/web/features/chat/hooks/use-chat-messages.ts` (~L325–332), `use-chat-realtime.ts` (~L36–60)

- [ ] Add `selectNewestConfirmedMessage(conversation)` (replaces the reverse scan in `applyGapBackfill`) and `resolveRealtimeSenderName(message, knownMessages, self, participant)` (same reconciliation family as `mergeChatMessage`'s name preservation) with fixture coverage; rewire both hooks.
- [ ] Standing gates + vector sync. Commit: `feat(core): add newest-confirmed and sender-name selectors`

### Task C4: Hydration fingerprint beside the equality helpers (R5.10)

**Files:** Modify `packages/core/src/chat-state/selectors.ts` (or a new `fingerprint.ts` in chat-state), `apps/web/features/chat/model/store/chat-store.ts` (~L89–118)

- [ ] Move `createChatHydrationKey`'s field-enumeration into core next to `areChatMessagesEqual` (third copy of message-shape knowledge; single-sources future field additions). Keep the store exporting the same function name as a re-export so importers don't change.
- [ ] Optional while touching `selectors.ts` (the review's "if touched, split" trigger, R3.13): separate the merge primitives (`mergeChatMessage`, `mergeReadState`, equality helpers — used by the reducer) into `chat-state/merge.ts`, keeping `selectors.ts` for genuine selectors/presentation; pure move, barrel re-export preserves imports.
- [ ] Run: `vitest run features/chat/model/store` + standing gates + vector sync. Commit: `refactor(core): own message fingerprint beside equality helpers`

### Task C5: Notification mark-seen retry as a pure function (R3.11)

**Files:** Create `apps/web/features/notifications/model/mark-seen.ts` + test; Modify `notification-provider.tsx` (~L274–348 area, the 74-line `refreshAndMarkLoadedSeen`)

- [ ] Write the pure function first, TDD: `planMarkSeenOutcome(input: { page, summary, commandResult, attempt }): { nextPage, nextSummary, notice, retry: boolean }` encoding the retry-limit-3, `throughChangeSeq = max(...)`, and optimistic-substitution rules. Table-test the three paths the provider tests currently reach via 3-deep `mockReturnValueOnce` chains (refetch success / refetch fail but `updated >= unseenIds.length` / hard fail).
- [ ] Rewire the provider callback to loop over the pure plan; delete the inline algorithm. Run `vitest run features/notifications` → the existing 9 provider tests stay green.
- [ ] Standing gates. Commit: `refactor(notifications): extract mark-seen reconciliation as pure plan`

---

## Phase D — Chat hooks and chat-client (single-session, quiet window) (R3.1, R3.2, R3.5, R3.6, R3.7, R3.13, R5.1)

### Task D1: Extract `use-chat-search` (R3.1)

**Files:** Create `apps/web/features/chat/hooks/use-chat-search.ts` + `use-chat-search.test.tsx`; Modify `chat-client.tsx`

- [ ] Move, verbatim: the twelve search `useState`s (~L201–214), `updateSearchUrl` (~L403–419), `runSearch` (~L421–475), the popstate/URL-restore effect (~L477–523), `searchSequenceRef`/`restoredUrlRef`. Interface: `useChatSearch({ conversationId, searchEnabled, presentation, searchMembers, searchChannels, searchMessagesAction, closeDetails, setRightSidebar })` returning the state + `runSearch` + bindings chat-client's JSX needs. Do NOT redesign the restore choreography in this move.
- [ ] Port the search-behavior tests out of `chat-client.test.tsx` into `use-chat-search.test.tsx` (renderHook) — identify them by grepping the monolith for `runSearch`/`popstate`/`search` describes; keep one search happy-path in the monolith as integration cover.
- [ ] Run: `vitest run features/chat/hooks/use-chat-search.test.tsx features/chat/components/chat-client` → pass. Standing gates.
- [ ] Commit: `refactor(chat): extract search orchestration into use-chat-search`

### Task D2: Author-identity helper (R3.1)

**Files:** Create `apps/web/features/chat/model/author-identity.ts` + test; Modify `chat-client.tsx` (~L225–244)

- [ ] Extract `resolveMessageAuthor(message, chat, searchMembers): { id, displayName, username?, role, avatarUrl? }` plus the name/avatar single-field variants; table-test community vs direct vs directory-miss fallbacks. Chat-client keeps thin memoized wrappers.
- [ ] Standing gates. Commit: `refactor(chat): extract author identity resolution`

### Task D3: Composer selection + optimistic delete as core events (R3.5)

**Files:** Modify `packages/core/src/chat-state/{types,reducer,selectors}.ts` + vectors + `docs/chat-state-protocol.md`; `apps/web/features/chat/model/store/chat-store.ts`; `use-chat-composer.ts`; `chat-client.tsx`

- [ ] Vectors first (TDD): add composer-selection events — `composerGifSelected` / `composerStickerSelected` (mutually exclusive) / `composerSelectionCleared` — extending `ChatComposerState`, and delete-tombstone events `deleteRequested { messageId, at }` / `deleteFailed { messageId }` with reconciliation against an authoritative `deletedAt`. Encode the conversation-reset and failure-restore semantics the hook currently re-derives with revision counters.
- [ ] Implement in the reducer; sync + check vectors; update the protocol doc (native ports must adopt before their next chat release — call this out in the PR description).
- [ ] Rewire `use-chat-composer.ts` onto the new events: delete the local gif/sticker revision machinery and `optimisticDeletedAtByMessageId`; resolve the edit-state duplication by deleting the loser (local `editSession` vs store `editTargetId` — pick the store/core model now that D-phase owns it end-to-end).
- [ ] Delete the `presentedMessages` overlay in chat-client (~L374–386) — the transcript is single-sourced from the store now.
- [ ] Run: `vitest run features/chat/hooks/use-chat-composer.test.tsx tests/chat-state-fixtures.test.ts features/chat/components/chat-client` → green throughout (the 344-line hook test is the harness; keep it passing at every step).
- [ ] Commit sequence: `feat(core): composer selection and delete-tombstone events` → `refactor(chat): drive composer selection and deletes through core events`

### Task D4: Split the composer hook (R3.5)

**Files:** Create `apps/web/features/chat/hooks/use-send-message.ts`, `use-message-mutations.ts` (+ tests); Modify `use-chat-composer.ts`, `chat-client.tsx`

- [ ] Only after D3. Split by responsibility: `use-send-message` (optimistic send, `sendWithRequestId` — change its 9 positional args to one options object while moving, it is the plan's named outlier), `use-message-mutations` (edit session, delete, reaction toggle, gif report). `use-chat-composer` remains as a thin façade composing them, preserving its external interface to chat-client initially; shrink the façade's return surface (24 members) only as a final, separate commit so wiring changes are reviewable.
- [ ] Redistribute the hook test by concern; run `vitest run features/chat/hooks` after each move.
- [ ] Standing gates. Commits: `refactor(chat): split send and mutation orchestration out of use-chat-composer` → `refactor(chat): narrow composer facade surface`

### Task D5: Shrink read-state + shared request guard (R3.6, R5.1)

**Files:** Create `apps/web/features/chat/hooks/use-latest-request.ts` + test, `use-hydrated-conversation.ts`; Modify `use-chat-read-state.ts`, `use-chat-messages.ts`, `member-profile-popover` + `messages-popover` (adoption), `use-chat-composer.ts`

- [ ] `useLatestRequest` (sequence-guarded latest-wins + conversation-scoped reset): extract from the ~7 hand-rolled variants; adopt in read-state, messages, composer, member-profile-popover, messages-popover, gif-picker — one adoption commit per file, each gated by that file's tests.
- [ ] `useHydratedConversation(chat)`: the hydration-key ritual duplicated verbatim between messages and read-state hooks.
- [ ] After C1: `use-chat-read-state.ts` splits into delivered-marker auto-advance and mark-read command orchestration (keep one hook file if it lands under ~250 lines with the guard and signature-hash gone — the unread-signature computation moves to a core selector per R3.6).
- [ ] Run: `vitest run features/chat/hooks` + standing gates.
- [ ] Commits: `refactor(web): add useLatestRequest and adopt across chat surfaces` → `refactor(chat): slim read-state hook onto core guard`

### Task D6: Break up `chat-client.test.tsx` (R3.2)

**Files:** Split `apps/web/features/chat/components/chat-client/chat-client.test.tsx` (3,840 lines) into `chat-client.test.tsx` (integration core), `chat-client.readstate.test.tsx`, `chat-client.realtime.test.tsx`, plus whatever D1/D3/D4 already extracted to hook tests

- [ ] Mechanical redistribution only — no assertion changes. Shared fixtures (`chat`, `searchableCommunityChat`, `realtimeMock`, `latestSubscribeStatusCallback`) move to a colocated `chat-client.fixtures.ts`.
- [ ] Target end state: the main file keeps ~15–20 wiring/prop-flow/happy-path tests; each split file owns one behavior area; every test runs in exactly one place (`vitest run features/chat/components/chat-client` count before == count after).
- [ ] Also add the two missing colocated hook tests flagged by the review while fixtures are fresh: `use-chat-messages.test.tsx` (cooldown, in-flight lock, backfill/reset branches) and `use-chat-realtime.test.tsx` (reconnect single-flight, first-subscribe skip) — renderHook against the real store, service fakes via props.
- [ ] Standing gates. Commits: `test(chat): split chat-client test hub by concern` → `test(chat): add colocated coverage for messages and realtime hooks`

---

## Phase E — Services layer (R3.3, R3.4, R5.2, R5.3)

### Task E1: `failWith` error helper (R5.3)

**Files:** Modify `apps/web/lib/services/errors.ts` (or `supabase/shared.ts`); adopt across `supabase/*.ts` (~50 call sites)

- [ ] Model on `notification-repository.ts`'s local `notificationFailure`: `failWith(operation: string, fallbackMessage: string)` returning the composed `serviceFailure(mapSupabaseError(error, {...}))` closure. Adopt file-by-file (one commit per adapter file), each gated by that adapter's tests.
- [ ] Commit series: `refactor(services): add failWith helper` → `refactor(services): adopt failWith in <file>` …

### Task E2: Consolidate the chat enrichment pipeline (R3.3 — biggest win, biggest test risk)

**Files:** Create `apps/web/lib/services/supabase/chat-enrichment.ts` + test; Modify `chat-repository.ts`, `local-chat-commands.ts`, `chat-message-hydration.ts`, `chat-mapping.ts`, `chat-realtime.ts`, `apps/web/lib/services/supabase/chat-repository.test.ts`

- [ ] **Characterize first:** extend `chat-repository.test.ts` with behavior-level assertions (returned DTO shapes for a conversation with reactions >25 ids, attachments, gifs) that do NOT assert query call order — these survive the refactor; the existing chain-stub order assertions will break and get rewritten.
- [ ] Build `chat-enrichment.ts`: pure folds `aggregateReactions(rows): Map<messageId, ReactionAggregate[]>`, `indexAttachments(rows, signedUrlByPath): Map<messageId, ClientChatImage[]>` + thin batched fetch wrappers `fetchReactionsFor(client, messageIds)` (25-id batches × 1000-row pages), `fetchAttachmentUrls(client, messages)` (`createSignedUrls(paths, 15*60)`). Port the three implementations onto it one call site per commit: repository → local-chat-commands → hydration.
- [ ] Unify mappers in `chat-mapping.ts` as the single home of `toClientChatMessage`/`toClientChatReadState`; delete the private copies in `chat-repository.ts` (~L652, ~L736) and `chat-realtime.ts` (realtime passes explicit empty reactions/images).
- [ ] Name the repository's stages as private functions while there (`resolveConversation`, `resolveParticipants`, `loadNewestWindow`) — same file, no new modules.
- [ ] Fix the DI break in `local-chat-commands.ts`: thread the caller's client/context instead of re-running `getLocalFallbackContext()` per call (removes a duplicate `auth.getUser()` round trip — small behavior improvement, own commit).
- [ ] Run after each step: `vitest run lib/services/supabase features/chat/server` + standing gates.
- [ ] Commit sequence: `test(services): characterize chat repository behavior` → `refactor(services): extract shared chat enrichment` → `refactor(services): single-source chat mappers` → `refactor(services): thread injected client through local chat commands`

### Task E3: Presence adapter split (R3.12 transport half)

**Files:** Modify `apps/web/lib/services/supabase/presence-realtime.ts`; Create `apps/web/features/presence/model/heartbeat-policy.ts` + test

- [ ] Coordinate with Phase F (same domain). Extract the heartbeat controller's decisions (idle detection thresholds, 5/10/30s backoff progression, lifecycle-event → action mapping) into a pure policy module; the adapter keeps listeners and plain send/end transport. Extend `presence-realtime.test.ts` before moving; keep its 220 lines green.
- [ ] Commit: `refactor(presence): separate heartbeat policy from transport`

### Task E4: Runtime locator hygiene (R3.13 area, small)

**Files:** Modify `apps/web/lib/services/runtime/browser.ts`, `runtime/server.ts`

- [ ] Memoize the per-call client construction in the non-memoized getters (currently `getCallCommandService` etc. construct a new Supabase client per call), matching `getBrowserServices`. Replace the 9-method hand-forwarded lazy adapters in `server.ts` with a generic lazy proxy over the interface **only if** it stays type-safe without casts; otherwise leave and add a comment pointing at the drift risk.
- [ ] Run: `vitest run lib/services tests` + standing gates. Commit: `refactor(services): memoize browser locator clients`

### Task E5: Split `contracts.ts` (R3.4 — LAST, quiet window)

**Files:** Create `apps/web/lib/services/contracts/{auth,profiles,chat,presence,notifications,calls,friends,booking,avatars,registry,index}.ts`; Modify `contracts.ts` (becomes one-line forward), `apps/web/tests/service-boundary.test.ts`, `docs/ARCHITECTURE.md`

- [ ] Pure text-move commit: distribute the 102 exports by bounded context (chat's three discontiguous blocks reunite in `chat.ts`; the `DatabaseServices`/`AppServices`/`ServerServices` aggregates in `registry.ts`); `contracts/index.ts` does `export type * from` each; `contracts.ts` keeps `export type * from "./contracts"` so zero importers change. Verify with `git diff --color-moved=zebra` that nothing changed but location.
- [ ] Update the boundary fitness test to target `lib/services/contracts/**` (it greps `contracts.ts` by path) and the two `ARCHITECTURE.md` references — same commit, so the guardrails never lapse.
- [ ] Separate commit: unify the three structurally-identical `{ok:false,code,notice}` result shapes (`NotificationCommandResult`, `PresenceCommandResult`, `CallCommandResult`/`MediaCheckCommandResult`/`BookingCommandResult`) as one generic `CommandResult<T>` in a shared contracts module; leave `ServiceResult` and notice-style results as the two intentional vocabularies.
- [ ] Run: full `pnpm --filter @fish/web exec vitest run tests` + standing gates.
- [ ] Commits: `refactor(services): split contracts by bounded context` → `refactor(services): unify command result shape`

---

## Phase F — Presence promotion to core (R3.12)

### Task F1: Core presence state module

**Files:** Create `packages/core/src/presence/state/{types,reducer,selectors}.ts`, `packages/core/src/presence/state/fixtures/presence-state-vectors.json`, `apps/web/tests/presence-state-fixtures.test.ts`; Modify `packages/core/src/presence/index` barrel

- [ ] Mirror the chat/notification/call pattern exactly. Model from the provider's current behavior: snapshot merge with revision ordering (single-sourcing the revision-compare policy currently duplicated between `mergeSnapshot` and `refresh`), optimistic preference-set + rollback, expiry auto-revert as a `now`-driven transition (reducer takes `now` as event data — no clocks in core).
- [ ] Vectors first, red→green TDD against the new web fixture test file. Include the ordering and rollback cases the provider test already proves.
- [ ] Commit: `feat(core): presence state reducer with fixture vectors`

### Task F2: Port the provider onto it

**Files:** Modify `apps/web/features/presence/components/presence-provider/presence-provider.tsx`, `features/presence/model/presentation.ts`

- [ ] Replace the hand-rolled Map/refs/revision state with `useReducer(reducePresenceState)`; move the 20-line `displayStatus` ternary from `useOwnPresence` into `model/presentation.ts` (its established home) with direct tests. Keep the provider's 222-line test green throughout; target ~200 lines of plumbing.
- [ ] Note for native follow-up in the PR description: presence vectors exist now; Kotlin/Swift ports can adopt (sync scripts currently cover chat only — do not build ios sync wiring speculatively).
- [ ] Run: `vitest run features/presence tests/presence-state-fixtures.test.ts` + standing gates.
- [ ] Commit: `refactor(presence): drive provider from core reducer`

### Task F3: Notification provider split (R3.11)

**Files:** Create `apps/web/features/notifications/hooks/use-navigation-attention.ts` (+ test), `use-browser-tab-title.ts` (+ test); Modify `notification-provider.tsx`, `components/shell/app-shell/app-shell.tsx` (consumer check only)

- [ ] After C5 (retry already pure). Extract navigation attention (own repo + realtime + state + debounce timer) into its own hook/provider — `app-shell` consumes `attention` independently today, so preserve the context shape or migrate app-shell in the same PR. Extract `useBrowserTabTitle(unreadCount)` (set + restore-on-unmount).
- [ ] Keep the 9 provider tests + `notification-attention.test.tsx` integration test green; provider lands ~300 lines.
- [ ] With presence re-homed (F2) this is the second user of the sorted-`join("|")`-key + 150 ms-debounce subscription idiom — extract the shared helper now (R5.12: second duplicate noted at review time; this move makes it the pattern's owner), e.g. `lib/hooks/use-keyed-subscription.ts`.
- [ ] Run: `vitest run features/notifications components/shell` + standing gates.
- [ ] Commit: `refactor(notifications): split attention and tab-title out of provider`

---

## Phase G — Component splits, calls test redistribution, shared UI (R3.7, R3.9, R3.13, R5.6)

### Task G1: `message-images` → attachment components (R3.9)

**Files:** Create `features/chat/components/message-attachments/{message-attachments.tsx,index.ts}`, `message-attachments/message-image/`, `message-attachments/message-file/`, `message-attachments/attachment-runs.ts` (+ tests); Delete `message-images/` after migration; Modify importers (`chat-message-row.tsx`), `components/index.ts` barrel

- [ ] Split the three components into folders per convention (lightbox may stay inside `message-image` unless it grows); export and table-test `attachmentRuns`, `fileTypeLabel`, `formatFileSize`, and a single `deriveImageLoadState(...)` replacing the twice-duplicated ternary. Rename the surface to "attachments" (the `images` prop already carries `kind:"file"` rows).
- [ ] Move the 8 behavioral tests to the new folder unchanged; run `vitest run features/chat/components/message-attachments` + module-boundary suite.
- [ ] Commit: `refactor(chat): split message attachments into convention folders`

### Task G2: `member-profile-popover` container/presentation split (R3.7)

**Files:** Create `features/chat/hooks/use-friend-relationship.ts` + test, `features/chat/model/friend-status.ts` + test; Modify `member-profile-popover.tsx`

- [ ] Pure first: `nextCandidateStatus(candidate, result)` encoding the `request_pending`/`already_friends`/`incoming_request_exists` transitions — table tests.
- [ ] `useFriendRelationship(member, overrides?)`: relationship load + race guard (adopt `useLatestRequest` from D5 if landed) + send/block commands; keeps the props-override DI convention so the popover stops touching `getBrowserServices()` directly.
- [ ] Re-point ~6 of the 15 existing tests at the hook/pure module; keep render tests for focus/a11y/confirm flows.
- [ ] Run: `vitest run features/chat/components/member-profile-popover features/chat/hooks/use-friend-relationship.test.tsx` + standing gates.
- [ ] Commit: `refactor(chat): extract friend relationship workflow from profile popover`

### Task G3: `messages-popover` hooks + trigger dedupe (R3.13)

**Files:** Create `features/chat/hooks/use-message-previews.ts` + test, `apps/web/lib/hooks/use-idle-preload.ts` + test (generic: rIC + matchMedia gate + load-event deferral + invalidate key); Modify `messages-popover.tsx`

- [ ] Extract preview cache/race policy and the 55-line idle scheduler; dedupe the trigger `IconButton` JSX (×3) into a local `messages-trigger-button/`. The 6 existing tests split: scheduling → renderHook, panel states → plain-prop renders.
- [ ] Run: `vitest run features/chat/components/messages-popover` + standing gates. Commit: `refactor(chat): extract preview loading and idle preload hooks`

### Task G4: Calls test redistribution + fixture factory (R3.13, R5.9)

**Files:** Create `features/calls/testing/call-context-fixture.ts`, `call-popover-view/call-popover-view.test.tsx` (grown from B6), `draggable-video-preview/draggable-video-preview.test.tsx`, `draggable-video-preview/resize-geometry.ts` + test; Modify `call-popover/call-popover.test.tsx` (751 → ~250), stories files

- [ ] Extract `computeResizedBox(edges, startRect, delta, stageSize, minWidth)` from the pointer-move handler (~L162–222) — pure geometry, table-test aspect-lock/dominant-axis/clamping; the component keeps DOM reads and setState.
- [ ] One `makeCallContextValue(overrides)` factory replaces the ~25-field literal duplicated ×4 (two tests + two stories).
- [ ] Move view/preview/screen tests from the `call-popover` hub into their component folders; hub keeps routing/timer/navigation cases.
- [ ] Also from R3.8: make media injectable in `call-provider.tsx` (constructor-prop with production default, like `commands`/`realtime`) and delete the module-level `vi.mock("../../client/call-media")`; then add the missing command tests (decline/cancel/end, mute/camera, permission-denied copy) against fakes.
- [ ] Dedupe the 22-prop context→view forwarding repeated in `call-popover.tsx` (~L89–109) and `call-screen.tsx` (~L29–48): one `toCallPopoverViewProps(context)` mapping used by both (R5.9).
- [ ] Run: `vitest run features/calls` + standing gates.
- [ ] Commits: `refactor(calls): extract resize geometry` → `test(calls): redistribute popover test hub and share fixtures` → `refactor(calls): inject call media dependency`

### Task G5: `ui/tooltip` primitive (R5.6)

**Files:** Create `apps/web/components/ui/tooltip/{tooltip.tsx,index.ts}` + test; Modify the 5 hand-rolled sites (`composer.tsx`, `emoji-picker.tsx`, `reactions.tsx`, `components/ui/icon-button`, `components/ui/icon-tab-strip`), `components/ui/index.ts`, `emoji-picker/` (split `emoji-picker-button/` into its own folder while touching it, R3.13)

- [ ] Build the primitive from the existing repeated markup (`rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg` + Base UI plumbing) — design tokens only, no new styles. Adopt site-by-site, one commit each, screenshot-free verification via existing component tests.
- [ ] Standing gates + module-boundary suite (new folders). Commits: `feat(ui): add tooltip primitive` → adoption commits → `refactor(chat): move emoji picker button to own folder`

### Task G6: Booking session-factory DI (R3.13, review §4 booking row)

**Files:** Modify `apps/web/features/booking/components/lesson-setup-screen/lesson-setup-screen.tsx`, `lesson-setup-screen.test.tsx`

- [ ] `LessonSetupScreen` currently `new`s `LessonSetupMediaSession` inside an effect — the one break in the repo's props-override DI convention, forcing a module mock plus a duplicated fake-session surface in its test. Add a `createSession?: (callbacks) => LessonSetupMediaSession` prop defaulting to the real constructor; replace the module mock with an in-memory fake passed through the prop (single fake shared with any other consumer).
- [ ] Run: `vitest run features/booking/components/lesson-setup-screen` (9 existing tests stay green, minus the `vi.hoisted` scaffolding). Standing gates.
- [ ] Commit: `refactor(booking): inject lesson setup media session`

---

## Suggested PR slicing

| PR | Contents | Risk |
|---|---|---|
| 1 | Phase A (dead surface) | Trivial |
| 2 | B1–B8 (pure extractions; can also be 2–3 smaller PRs) | Low |
| 3 | C1 alone (read-state guard — reviewable as the bug fix it is) | Low, cross-platform visible |
| 4 | C2–C5 | Low |
| 5 | D1–D2 (search + identity out of chat-client) | Moderate |
| 6 | D3–D4 (composer events + split) | Highest of the plan — sequence strictly |
| 7 | D5–D6 (guards, read-state slim, test redistribution) | Low-moderate |
| 8 | E1–E2 (failWith + enrichment) | Moderate (test rewrites) |
| 9 | E3–E4, F1–F3 (presence + notifications) | Moderate |
| 10 | E5 (contracts split — quiet window) | Low mechanical, high coordination |
| 11 | G1–G6 (component splits + calls tests + tooltip + booking DI) | Low |

Every PR leaves `pnpm build`, `pnpm --filter @fish/web typecheck`, and the full web vitest suite green; no PR depends on a later one to compile.

---

## Verification of "done" (per the review's guidelines, R7)

- [ ] No non-exempt source file > 450 lines without a one-deep-module justification in its header comment or PR description. Expected survivors: `call-media.ts`, `use-chat-image-uploads.ts`, `landing-page.tsx`, generated files.
- [ ] `chat-client.tsx` ≤ ~450 lines; `chat-client.test.tsx` ≤ ~800 with per-concern siblings; `use-chat-composer.ts` a façade ≤ ~200.
- [ ] `grep -rn "toClientChatMessage" apps/web/lib/services` returns exactly one definition site.
- [ ] `use-chat-messages` and `use-chat-realtime` each have a colocated test file.
- [ ] `packages/core` owns: monotonic read-state merge, message normalization, hydration fingerprint, presence state — each with fixture vectors, `pnpm ios:chat-vectors:check` clean.
- [ ] Re-run the review's size sweep (`find apps/web packages -name "*.ts*" … | xargs wc -l | sort -rn`) and append the before/after table to `docs/web-modularity-review.md`.
