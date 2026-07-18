# Web modularity review — oversized files and responsibility hotspots

Date: 2026-07-18 · Scope: `apps/web`, `packages/core`, `packages/supabase` (native apps excluded) · Method: full reads of every non-test source file over ~300 lines, plus churn analysis (`git log --since=2026-04-01`) and test-cost comparison. Analysis only — no code was changed.

---

## 1. Baseline: what "normal" looks like in this repo

Across 572 non-test, non-generated source files: **median 35 lines, mean 73, p90 ≈ 200**. 31 files exceed 300 lines, 15 exceed 400, 8 exceed 500. The codebase is generally very well factored — the findings below are about a heavy tail, not a systemic problem.

Three structural strengths worth naming, because every recommendation below leans on them:

1. **The pure core works.** `packages/core/src/chat-state` (reducer + selectors, fixture-verified) is the spine: every chat mutation in the web store dispatches through `reduceChatState`. Merging, optimistic reconciliation, and pagination live exactly once and are cheaply tested at store level.
2. **The layering holds.** `tests/service-boundary.test.ts` is an unusually good architectural fitness function — provider SDKs, generated rows, and raw clients genuinely cannot leak out of `lib/services/supabase/`. The problems found are *intra-layer* (duplication, granularity), not boundary leakage.
3. **The pure-module pattern already exists in features.** `features/chat/model/search` (parser, URL state, history — all pure, all table-tested) and `call-exit.ts` / `video-quality-preference.ts` in calls prove the "pure logic in `model/`, glue in hooks, IO in adapters" pattern. The oversized files below are, almost without exception, files that didn't follow the pattern their own feature established.

**The test-cost gradient is the strongest evidence in this review.** Pure modules (core reducer, `model/search`, `chat-store`) have dense, fast, table-driven tests. The two hooks that kept decision logic inline (`use-chat-messages`, `use-chat-realtime`) have **no colocated tests at all**, and the components that mixed IO with presentation pay for every branch with full renders, fake timers, and deferred-promise choreography.

**Churn × size — where refactoring pays off first** (commit touches since 2026-04-01):

| File | ~Lines | Touches |
|---|---|---|
| `features/chat/components/chat-client/chat-client.tsx` | 725 | ~50 (both locations) |
| `lib/services/contracts.ts` | 787 | 23 |
| `components/shell/app-shell/app-shell.tsx` | 332 | ~35 (both locations) |
| `lib/services/supabase/chat-repository.ts` | 744 | 14 |
| `features/chat/components/chat-message-list/chat-message-row/chat-message-row.tsx` | 422 | 16 |

---

## 2. Priority summary

| # | File | ~Lines | Verdict | Core problem |
|---|---|---|---|---|
| 1 | `features/chat/components/chat-client/chat-client.tsx` | 725 | **Split** | Whole search subsystem inlined in the composition root |
| 2 | `features/chat/components/chat-client/chat-client.test.tsx` | 3,840 | **Split** | 84 tests in 2 describes; the test hub for behavior owned by 6+ modules |
| 3 | `lib/services/supabase/chat-repository.ts` (+ `local-chat-commands.ts` 567, `chat-message-hydration.ts` 117) | 744 | **Split** | ~440-line mega-method; enrichment pipeline duplicated ×3 |
| 4 | `lib/services/contracts.ts` | 787 | **Split (carefully)** | 102 exports across 10 bounded contexts; 5 parallel result vocabularies; churn/conflict magnet |
| 5 | `features/chat/hooks/use-chat-composer.ts` | 645 | **Split** | Four modules in one hook; 24-member return |
| 6 | `features/chat/hooks/use-chat-read-state.ts` | 421 | **Split + move guard to core** | Monotonic merge guard exists only web-side — a consistency hazard |
| 7 | `features/chat/components/member-profile-popover/member-profile-popover.tsx` | 460 | **Split** | Service locator + friend-request state machine inside a popover |
| 8 | `features/calls/components/call-provider/call-provider.tsx` | 593 | **Trim, don't dismantle** | Sound orchestrator with ~90 duplicated command lines + inline pure mapping |
| 9 | `features/chat/components/message-images/message-images.tsx` | 394 | **Split** | Three components in one file — violates the repo's own convention |
| 10 | `features/chat/components/message-body/message-body.tsx` | 385 | **Split within folder** | Pure parser (incl. a security gate) unexported inside a component |
| 11 | `features/notifications/components/notification-provider/notification-provider.tsx` | 529 | **Split** | A second domain (navigation attention) + a 74-line retry algorithm accreted onto notification glue |
| 12 | Presence: `presence-provider.tsx` (345) + `lib/services/supabase/presence-realtime.ts` (323) | 668 | **Promote to core** | The only realtime domain without a core reducer; its state machine is smeared across provider and adapter |
| 13 | `features/chat/components/chat-message-list/chat-message-row/chat-message-row.tsx` | 422 | **Extract derivations** | Untested derivation cluster; O(n²) reply lookup |
| 14 | `features/chat/components/messages-popover/messages-popover.tsx` | 371 | **Extract hooks** | Idle-preload scheduler + cache policy + presentation |
| 15 | Test hubs: `call-popover.test.tsx` 751, `core.test.ts` 784, `actions.test.ts` 824 | — | **Redistribute** | Tests live far from the code that owns the behavior |

Section 4 lists large files that should **not** be split, and why.

---

## 3. Detailed findings

### 3.1 `chat-client.tsx` — 725 lines, highest churn in the repo

**What it is.** The chat screen's client composition root: wires nine hooks, derives presentation state, renders header/list/composer/sidebars.

**Why split.** The hook wiring and JSX are this file's legitimate job — that part is cohesive and should stay. But a complete **search subsystem** (~250 lines) is embedded inline: twelve `useState`s, `runSearch` with sequence-guarded pagination and last-page clamping, URL push/replace/restore via `popstate`, and sidebar coordination. Search has its own state machine, its own IO, its own URL protocol — and its pure request-builder `createSearchRequest` (L65–87) sits in this file while its five sibling functions (`parseChatSearchQuery`, `criteriaFromQuery`, `createChatSearchUrl`, `readChatSearchUrlState`) already live in the pure, tested `model/search` module. The file also inlines author-identity resolution (`getMessageAuthorName/Avatar/Member`, L225–244) — pure derivation used only as props.

**Recommended breakdown** (all following existing conventions):
- `features/chat/hooks/use-chat-search.ts` — the twelve state slices, `runSearch`, `updateSearchUrl`, the popstate-restore effect. Interface: `{ search, criteria, results, page, sort, notice, isSearching, rightSidebar bindings, runSearch, … }`.
- `createSearchRequest` → `features/chat/model/search/` beside its siblings (pure, table-testable: criteria → `ChatSearchInput`).
- Author-identity resolution → small pure helper (`model/` or colocated `.ts`), taking `(message, chat, searchMembers)`.
- The reconnect-banner derivation (L299–327) is **already exemplary** — derived-during-render, well-commented — leave it.

**Benefits.** Chat-client drops to ~400 lines of genuine composition. Search behavior becomes testable via `renderHook` instead of full-screen renders (directly shrinking finding #2). The highest-churn file in the repo stops being the place where every search tweak, presence tweak, and composer tweak collides.

**Risks.** Low-moderate. The popstate/URL-restore choreography is subtle (guarded by `restoredUrlRef`); move it verbatim with its tests rather than "improving" it in flight. The monolith test currently covers this behavior — migrate those cases into `use-chat-search.test.tsx` in the same change.

### 3.2 `chat-client.test.tsx` — 3,840 lines, 84 tests, 2 describe blocks

**Why split.** This is the single largest file in the web project — a test hub where search, realtime status, read-state, composer wiring, focus handling, and sidebar behavior are all tested through full `ChatClient` renders against hoisted module mocks. Every test pays the full-render tax; every behavioral change anywhere in the chat feature lands here; 84 tests in two describes makes failures hard to localize. This is a symptom file: its size mirrors chat-client's over-wide surface.

**Recommended breakdown.** Follow the extractions, don't reorganize in place: as `use-chat-search` (3.1), composer sub-hooks (3.5), and read-state changes (3.6) land, move their scenario tests into those modules' colocated test files, keeping `chat-client.test.tsx` as a genuine integration suite (~15–20 tests: wiring, prop flow, one happy path per subsystem). Splitting the remaining integration file by concern (`chat-client.search.test.tsx` etc.) is worthwhile even before extractions.

**Benefits.** Failure localization, parallel test execution, and an end to the "every chat PR edits a 4k-line test file" merge bottleneck — this matters given parallel working sessions.

**Risks.** Low. Pure test motion, no production code. The main cost is diff review; do it as a mechanical, behavior-preserving PR.

### 3.3 Chat data layer: `chat-repository.ts` (744) + `local-chat-commands.ts` (567) + friends — one pipeline, three copies

**Why split.** `SupabaseChatRepository.getAssignedConversation` is a ~440-line method: auth → profile → channel/conversation resolution (including hard-coded demo-community fallbacks) → participant resolution → newest-40 keyset window → sender names → reactions (25-id batches × 1000-row pages) → attachments + signed URLs → gifs → read states → unread summary → mapping. Roughly 40% of it is 15 near-identical error-mapping blocks. Worse, the **enrichment pipeline exists three times**: here, in `local-chat-commands.ts` (`addReactionAggregates`, `addImageAttachments`, `addGifAttachments`…), and again in `chat-message-hydration.ts`. The row→domain mappers are also tripled: `toClientChatMessage` ×3 (repository, `chat-mapping.ts`, a deliberately-partial copy in `chat-realtime.ts`) and `toClientChatReadState` ×3, field-identical. `local-chat-commands.ts` additionally constructs its own server client (bypassing the injected-client DI used everywhere else) and re-acquires it per call — a second `auth.getUser()` round trip per command.

**Recommended breakdown.**
- One `lib/services/supabase/chat-enrichment.ts`: reaction aggregation, attachment + signed-URL resolution, gif and sender-name resolution — pure fold/mapping functions plus one thin batched-fetch wrapper each; consumed by repository, local commands, and hydration.
- Promote `chat-mapping.ts` to the **single** home of `toClientChatMessage` / `toClientChatReadState`; delete the two private copies (the realtime variant can pass empty reactions/images explicitly).
- Inside the repository, name the stages as private functions (`resolveConversation`, `resolveParticipants`, `loadNewestWindow`) — same file is fine; the win is stage boundaries and single-copy enrichment, not more files.
- Add the error-helper the layer already prototyped in `notification-repository.ts` (`notificationFailure`): a shared `failWith(operation, fallbackMessage)` would delete several hundred lines across ~50 call sites.
- Thread the injected client through `local-chat-commands.ts` instead of self-acquiring.

**Benefits.** The three copies of batching/signed-URL logic can never drift apart again (they already differ subtly); the mega-method becomes readable stages; hundreds of lines of boilerplate disappear; enrichment folds become table-testable pure functions.

**Risks.** Moderate — not from the code, from the tests: `core.test.ts` (784 lines, misnamed — it is mostly chat-repository tests) uses hand-built thenable chain stubs that assert exact query call order ("profiles queried exactly once"). Consolidation will break those assertions even when behavior is preserved. Plan for test rework toward behavior-level assertions in the same effort, and rename the file `chat-repository.test.ts`.

### 3.4 `contracts.ts` — 787 lines, 102 exports, 10 bounded contexts

**Why split — and why carefully.** This is the documented single ports file (`docs/ARCHITECTURE.md` names it), and a boundary fitness test keeps it transport-clean, so it is a deliberate seam — not an accident. But it now interleaves ten contexts out of order (chat alone is split across three discontiguous blocks), carries **five parallel failure vocabularies** (`ServiceResult`, `ChatOperationResult`, and three structurally-identical `{ok:false,code,notice}` command results), and at 23 touches since April it is the second-hottest file in the repo — every new capability edits it, which is exactly the merge-conflict profile to avoid with parallel sessions.

**Recommended breakdown.** Split by bounded context into `lib/services/contracts/` — `auth.ts`, `profiles.ts`, `chat.ts`, `presence.ts`, `notifications.ts`, `calls.ts`, `friends.ts`, `booking.ts`, `avatars.ts`, `registry.ts` (the `DatabaseServices`/`AppServices`/`ServerServices` aggregates) — with `contracts/index.ts` doing `export type * from` each, and keep a one-line `contracts.ts` forwarding to it so **zero importers change**. Unify the three identical command-result shapes into one generic `CommandResult` (a rename-level change), and leave `ServiceResult` vs notice-style results as the two intentional vocabularies (repository errors vs user-facing notices) unless a larger unification is wanted.

**Why not "just leave it"?** Types-only files can run long harmlessly — if they're stable. This one is hot, and its disorder has consequences: the parallel result shapes exist *because* contributors couldn't see the existing ones.

**Benefits.** Context-local diffs (chat contract changes stop colliding with friends changes), discoverability, and a natural place per context to colocate contract-level doc comments.

**Risks.** Low mechanically (barrel preserves every import), but two guardrails must move with it: update `tests/service-boundary.test.ts` (it targets `contracts.ts` by path) and the two references in `docs/ARCHITECTURE.md`. Do the split as a pure text-move commit with no type changes so review is `git diff --color-moved`-trivial.

### 3.5 `use-chat-composer.ts` — 645 lines, 24-member return

**Why split.** One hook is really four modules: optimistic send orchestration (with rollback + gif share registration), edit-session lifecycle, optimistic delete (with authoritative-tombstone race handling), and gif/sticker selection — plus keyboard handling. The return object has 24 members; `sendWithRequestId` (9 positional args) leaks raw into chat-client as the retry handler. Two deeper problems: the hook keeps a **parallel edit-state model** while the store's `setEditTarget`/`editTargetId` sit unused (two models, one dead), and optimistic deletes re-implement the tombstone concept the core reducer already models, forcing chat-client to overlay `presentedMessages` afterward.

**Recommended breakdown.**
- Selection state (gif/sticker mutual exclusion, conversation reset, failure restore) → core `ChatComposerState` events, where `draft`/`replyTargetId` already live. The revision-counter machinery dissolves into reducer semantics.
- Optimistic delete/edit transitions → core events (`deleteRequested`/`deleteFailed`), single-sourcing the transcript and deleting the `presentedMessages` overlay in chat-client.
- Remaining IO orchestration → two or three hooks in `hooks/`: `use-send-message`, `use-message-mutations` (edit + delete + reaction + report), keeping `use-chat-composer` as a thin façade if the single-entry interface is worth preserving.
- Resolve the edit-state duplication in whichever direction wins — but delete the loser.

**Benefits.** The race branches (late failure after reconnect-tombstone, conversation-switch mid-send) become fixture-testable reducer transitions — they are currently the most expensive tests in the feature (deferred-promise choreography through `renderHook`). Native ports inherit the semantics through core.

**Risks.** Moderate. This touches the send path — the product's core loop. Sequence it: (1) pure extractions + core events with fixture vectors, (2) hook split, (3) chat-client rewiring; keep the existing 344-line hook test green throughout, then redistribute it.

### 3.6 `use-chat-read-state.ts` — 421 lines, and a real consistency hazard

**Why split.** Delivered-marker auto-advance, debounced unread refresh (hand-rolled dependency hash), optimistic mark-read with reconciliation, and a monotonic merge guard all share one hook. The sharpest finding: **`mergeMonotonicReadState` exists only in this web hook.** The core reducer's `mergeReadState` transition has no monotonicity check, so `refreshConversation` in `use-chat-messages` (which dispatches `mergeReadState` directly) bypasses the guard — two merge paths with different guarantees — and native ports reading core as the reference implementation never see the guard at all.

**Recommended breakdown.** Move `isEarlierTimestamp` + `mergeMonotonicReadState` into the core reducer's transition (they are already 100% pure and core-shaped), with fixture vectors for out-of-order events; then shrink the hook to delivered-marker + mark-read orchestration, extracting the unread-signature computation as a core selector. *(A background-task chip for the guard move was created alongside this review.)*

**Benefits.** Closes an actual bug class (read-state regression on out-of-order events via the direct-dispatch path), removes a web/native semantic fork, and turns the hook's most subtle logic into table tests.

**Risks.** Low-moderate: it changes core, which native apps treat as reference — land the fixture vectors first so all ports see the new semantics explicitly.

### 3.7 `member-profile-popover.tsx` — 460 lines

**Why split.** The worst container/presentation mix in the chat feature: a presentational popover that calls service locators directly (`getBrowserServices().database.friends`, `getFriendCommandService`), owns a friend-request state machine (send-result → `request_pending`/`already_friends`/`incoming_request_exists` transitions), relationship loading with race guards, and a block-confirmation focus choreography — around ~200 lines of actual popover.

**Recommended breakdown.** `useFriendRelationship(member)` hook (loading, race guard, send/block commands — the natural home is wherever the friends feature owns hooks), plus a pure `nextCandidateStatus(candidate, result)` transition function; the popover keeps focus/a11y/layout. Optionally a `block-confirmation/` child component folder.

**Benefits.** Removes the only service-locator usage inside chat presentation; ~6 of the 15 (excellent) behavioral tests become plain unit tests; the popover becomes reusable wherever member profiles appear next.

**Risks.** Low. The tests are strong and behavior-level; they will catch regressions during the move.

### 3.8 `call-provider.tsx` — 593 lines: trim, don't dismantle

**Why mostly keep.** This is a genuine orchestrator whose hardest logic — the call state machine — is already extracted and fixture-verified in `packages/core/src/call-state`. Its connection concurrency control (`connectCall` with per-callId in-flight promise dedup) is deep, cohesive, and correctly the file's core. Do not break the provider into multiple providers.

**What to change.**
- Extract `applyCall`'s snapshot→event mapping (~60 pure decision lines) into a colocated module beside `call-exit.ts` — the file's own precedent for exactly this move.
- Deduplicate `startCall`/`startLessonCall` (~45 near-identical lines) and collapse `decline`/`cancel`/`end` into one parameterized `terminate` — ~90 lines of drift-prone duplication.
- Extract the permission-result → `{reason, notice}` mapping (repeated ×3 with inline copy strings).
- Make the media dependency injectable like `commands`/`realtime` (it is currently constructed inside a `useState` initializer), killing the module-level `vi.mock` in the provider test.

**Benefits.** Provider drops to ~420 lines of genuine orchestration; the currently-untested command handlers (decline/cancel/end, mute/camera, permission-denied copy) become testable without module mocks.

**Risks.** Low for extractions; the media-injection change touches the provider's construction path — verify with the existing recovery/coalescing tests, which are the strongest in the calls feature.

### 3.9 `message-images.tsx` — 394 lines, three components in one file

**Why split.** `MessageImages`, a 234-line `MessageImage` (nine `useState`s of progressive-load state machine + signed-URL refresh + blob-URL GC timers + a full lightbox dialog), and `MessageFile` share one file — a direct violation of the repo's one-component-per-folder rule. Pure helpers (`attachmentRuns`, `fileTypeLabel`, `formatFileSize`) are unexported; the load-state ternary is duplicated twice within the file; both sub-components call the image service locator directly.

**Recommended breakdown.** `message-image/` and `message-file/` component folders (the lightbox is a candidate third, `image-lightbox/`), a colocated `attachment-runs.ts` pure helper, and a pure `deriveImageLoadState(...)`. In the same move, address the naming drift: these "images" now carry `kind:"file"` attachments — this is really `message-attachments/`.

**Benefits.** Convention compliance, table-tested run-grouping/state-derivation, and a rename that stops the vocabulary drifting from what the code does.

**Risks.** Low. The 8 behavioral tests (crossfade, no-unavailable-flash, popup fallback) are solid guards; keep them at the folder level.

### 3.10 `message-body.tsx` — 385 lines: split parser from renderer

**Why split (within the folder).** The file contains a complete pure parsing layer — block tokenizer, recursive list parser, inline parser, emoji-only detection, and the `sanitizeHref` security gate (T-p06-02) — all unexported beneath a 20-line component. It is deliberately minimal and well-documented (genuine complexity, not sprawl), but the two layers have different test needs: tokenizer edge cases (unclosed fences, indentation nesting, parens-in-URLs) want data-level tests; only element/class mapping and href neutralization need the DOM.

**Recommended breakdown.** `message-body/message-body-parser.ts` (token types + `tokenize` + `sanitizeHref`) with table tests including the two security cases at data level; renderers stay in the component. If Android/iOS render the same markup, the token layer is a `packages/core` candidate (`chat-media`/chat vocabulary already lives there) — verify before promoting.

**Benefits.** The security gate becomes directly testable (today it is only reachable through DOM assertions); parser edge cases get cheap. Lowest-risk, highest-testability item in this list.

**Risks.** Minimal. Pure code motion within a folder.

### 3.11 `notification-provider.tsx` — 529 lines

**Why split.** The reducer-in-core architecture is right (state transitions live in `@fish/core/notification-state`), but the provider has accreted three things beyond its notification-IO job: (a) an entire **second domain** — navigation attention, with its own repository, its own realtime subscription, its own state and debounce timer; (b) a `document.title` unread-badge side channel; (c) the 74-line `refreshAndMarkLoadedSeen` **snapshot-retry algorithm** (retry limit 3, change-seq comparison, optimistic page substitution on refetch failure) buried in a `useCallback`. The tests show the cost: a 40-line five-service fake factory plus three-deep `mockReturnValueOnce` chains to reach the retry branches.

**Recommended breakdown.** Extract `useNavigationAttention` (hook or sibling provider — it already has a separate repository and realtime contract), `useBrowserTabTitle(unreadCount)`, and lift the retry loop into a pure function (`(page, summary, commandResults) → next page/summary/notice`) in `features/notifications/model` or core, fixture-testable. Provider lands ~300 lines of legitimate subscription-and-command glue.

**Benefits.** The most intricate reconciliation algorithm in the notifications feature becomes table-testable; attention gets clear ownership (app-shell consumes it independently via `useOptionalNotifications().attention` today — evidence it is a separate concern).

**Risks.** Low-moderate. The provider is mounted once in the authenticated layout; keep mounting order and context identity stable, and lean on the existing 9 behavioral tests during the move.

### 3.12 Presence — the one domain that never got the core treatment

**Files:** `features/presence/components/presence-provider/presence-provider.tsx` (345) + `lib/services/supabase/presence-realtime.ts` (323).

**Why split (by promotion, not extraction).** Chat, notifications, and calls all follow the house pattern: pure reducer + fixture vectors in `packages/core`, thin web provider as IO glue. **Presence is the only realtime domain that skipped it** — and both of its files show the consequences. The provider hand-rolls the state machine in React state: revision-gated snapshot merges (with the revision-compare policy duplicated between `mergeSnapshot` and `refresh`), optimistic preference-set with ref-compare rollback, expiry auto-revert timers, and a 20-line nested-ternary `displayStatus` derivation — none testable without rendering the provider against three fake services. Meanwhile the adapter mixes genuine transport (`subscribe`, chunked 100-id fan-in) with `startSession`, a full browser **heartbeat controller** (activity/idle detection, 5/10/30s retry backoff, `visibilitychange`/`online`/`pagehide`) — UI-runtime lifecycle policy in the adapter layer.

**Recommended breakdown.** Create `packages/core/src/presence` state: snapshot merge + revision ordering + preference/expiry transitions as a reducer with fixture vectors (siblings show exactly how); move `displayStatus` into the existing pure `features/presence/model/presentation.ts`; move the heartbeat idle/backoff decisions into the same core state or `features/presence`, leaving the adapter with plain transport operations. Provider shrinks to ~200 lines of plumbing.

**Benefits.** Closes the architecture's one asymmetry; native ports (which treat core as the reference implementation) gain presence semantics for free; merge/rollback/expiry become fixture tests instead of fake-timer choreography.

**Risks.** Moderate — this is a re-homing of live logic, not a text move. Presence regressions are quiet (a wrong "online" badge breaks no test by default). Land core reducer + vectors first, port the provider onto it second, move the heartbeat last; the existing provider (222-line) and adapter (220-line) tests are good harnesses to keep green throughout.

### 3.13 Remaining component extractions (smaller, bundle with feature work)

- **`chat-message-row.tsx` (422):** extract `deriveRowPresentation(...)` (grouping/status/avatar/day-divider cluster — currently untested) and a `day-divider/` folder; hoist the `ChatMessageActions`/`ChatMessageEditingState` contracts up to the list level; build the reply-lookup map once in `chat-message-list` instead of `messages.find` per row (O(n²) on long transcripts).
- **`messages-popover.tsx` (371):** extract `useMessagePreviews` (cache + race guard) and a generic `useIdlePreload` (the 55-line rIC/matchMedia scheduler); dedupe the trigger-button JSX written out three times.
- **`use-chat-messages.ts` (427) / `use-chat-realtime.ts` (413):** mostly *subtractive* — delete the dead `setMessages` bridge and `mergeMessage` export, the never-consumed voice-recording surface, and the store's unused `setEditTarget`/`clearComposer`; unify `toLocalMessage` with core's private `normalizeMessage` (export it from core); share the duplicated hydration-key ritual (`useHydratedConversation`). Then both hooks are legitimately deep IO modules at reasonable size — but give each a colocated test; today their reconnect single-flight and cooldown policies have none.
- **`availability-table.tsx` (293):** ~96 lines (a third of the file) is pure schedule-grid construction (`buildScheduleWeeks` + calendar-date helpers) sitting above the component, testable today only through DOM render. Extract to a sibling pure module — the booking feature's own `format.ts` is the precedent — and dedupe the slot-button markup between desktop table and mobile list. Component lands ~190 cohesive lines.
- **Booking DI break:** `LessonSetupScreen` `new`s `LessonSetupMediaSession` inside an effect — the one place the repo's uniform props-override DI convention is broken, forcing module mocks and a duplicated fake-session surface in the screen test. A session-factory prop restores the convention.
- **`packages/core/src/chat-state/selectors.ts` (312):** cohesive but mis-titled — it holds three strata: merge primitives used by the reducer (`mergeChatMessage`, equality helpers), genuine selectors, and presentation (`getMessageSnippet`, `toReplyPreview`) that embeds **English UI copy in core** ("Message deleted", "Sticker"…). Fixture-covered so the copy is contract today, but it is a localization liability shared with the native ports. When next touched, split `merge.ts` from `selectors.ts`; not urgent.
- **Test hubs:** `call-popover.test.tsx` (751) tests four components — redistribute to `call-popover-view` (currently untested at 395 lines) and `draggable-video-preview` (untested at 364); share the call-context fixture literal currently duplicated ×4. Rename `core.test.ts` → what it is (chat-repository tests). `actions.test.ts` (824) is a legitimate integration suite — leave it, but it shrinks naturally as the layers below it gain unit tests. (Counter-signal worth knowing: `landing-page.test.tsx` covers only the hero SVG's hex values — the page itself has zero render coverage.)

---

## 4. Large files that should NOT be split (size ≈ genuine complexity)

| File | ~Lines | Why it earns its size |
|---|---|---|
| `packages/supabase/src/database.generated.ts` | 3,153 | Generated. Exempt by definition. |
| `features/calls/client/call-media.ts` | 503 | One cohesive LiveKit↔app adapter — this *is* the IO boundary, and mocking is irreducible here. Two surgical extractions only: the speaking-detection DSP math (attack/decay smoothing, thresholds, hold — pure, currently needs rAF mocking to test) and the teardown block duplicated between `disconnect()` and the Disconnected handler. `requestMediaPermission` is an unrelated export that belongs beside, not inside. |
| `features/chat/hooks/use-chat-image-uploads.ts` | 465 | The best-shaped large hook in the repo: a small interface hiding real async complexity (hash-claim dedupe, cancellation races, TUS→signed-PUT fallback, concurrency-2 scheduler). Extract the pure acceptance/partition logic and hoist the framework-free transport adapters; keep the machine intact. |
| `features/calls/components/call-popover-view/call-popover-view.tsx` | 395 | JSX breadth (~11 call statuses × popover/screen × audio/video), not logic tangle. Export `getCallCopy` (pure status→copy map, currently untestable) and give the file its own test; split the video stage only if it grows. |
| `features/calls/components/draggable-video-preview/draggable-video-preview.tsx` | 364 | A single cohesive widget. The one seam worth cutting: `computeResizedBox(edges, startRect, delta, stage, minWidth)` — the aspect-locked resize math is the densest pure logic in the calls feature and is currently tested by monkey-patching `getBoundingClientRect`. |
| `features/chat/components/chat-message-list/message-actions/message-actions.tsx` | 322 | One progressive-disclosure surface (reveal matrix + three-view popover state machine); its 10 render tests are the right kind. Minor: it hand-rolls menu rows that `ui/action-menu` already provides. |
| `packages/core/src/chat-state/reducer.ts` + `selectors.ts` | 377 + 312 | The pure reference implementation, fixture-verified, shared with native ports. Long *because* every transition lives here once — the deletion test passes emphatically: remove it and its complexity reappears in every platform. |
| `features/chat/components/composer/composer.tsx` | 237 | Cohesive controlled surface. The smell is its 19-prop interface (three parallel media trios), not its length — a single discriminated `mediaSelection` contract would collapse ~12 props. |
| `app/_components/landing-page/landing-page.tsx` | 433 | The acceptable kind of long: a zero-state server component where 145 lines are copy constants and the rest is ten static marketing sections mapping over them. Cheapest tidy-up: move the copy to a colocated `content.ts`. (Side flags found in passing: testimonial avatars point at external robohash.org URLs through `next/image`, and the quotes are placeholder pre-launch copy — a content TODO, not a structure problem.) |
| `features/booking/client/lesson-setup-media.ts` | 363 | Six media capabilities in one deliberately React-free session class (acquisition fallbacks, device switching, LiveKit diagnostic, test tone, mic meter). The heavy environment fakery in its test is intrinsic to the domain. Extract the pure mic-meter math if touched; otherwise leave. The adjacent `lesson-setup-screen`/`lesson-setup-view` container/presenter pair is the pattern other features should copy. |
| `components/shell/app-shell/app-shell.tsx` + `user-menu.tsx` | 332 + 282 | Both cohesive at size (nav config + surface flags + layout; a three-view drill-down menu is one unit). Optional tidy-ups only: extract a `ChannelNav` to dedupe the ~20-line channel-link markup between desktop rail and mobile strip, and import `ThemePref`/`TimeFormatPref` from `lib/prefs` instead of re-declaring them. |

---

## 5. Cross-cutting duplication (consolidate once, shrink many files)

These recur across the files above; consolidating them shrinks several candidates without any restructuring:

1. **"Latest request wins" race guard — ~7 hand-rolled variants** (`member-profile-popover`, `messages-popover`, `gif-picker`, `use-chat-composer`, `use-chat-read-state`, `use-chat-messages`, chat-client's `searchSequenceRef`). One `useLatestRequest`/`useConversationScopedRequest` hook.
2. **Chat row→domain mappers ×3 and enrichment pipeline ×3** (finding 3.3) — the single biggest consolidation win in the repo.
3. **Service-error boilerplate** — the 4-field `mapSupabaseError(...)` options object retyped at ~50 call sites; `notification-repository.ts` already prototyped the helper.
4. **Result vocabularies ×5** in `contracts.ts` (finding 3.4).
5. **Textarea autosize** — `resizeComposer` (composer) ≡ `resizeEditor` (message-editor), verbatim.
6. **Tooltip plumbing ×5** (`composer`, `emoji-picker`, `reactions`, `icon-button`, `icon-tab-strip`) — a missing `ui/tooltip` primitive.
7. **Local-date logic ×3** (`chat-day-label`'s `isSameLocalCalendarDay` vs `toDateString()` comparison in chat-message-row vs date-picker's `toIso`/`fromIso`); `formatChatDayLabel` also hardcodes `"en-US"`.
8. **Criterion-id construction** (`${kind}:${value}`) at ~6 sites — belongs in `model/search` as `makeCriterion()`.
9. **Call command handlers** — `startCall`/`startLessonCall` and `decline`/`cancel`/`end` (finding 3.8); 22-prop context→view forwarding duplicated between `call-popover` and `call-screen`; call-context test fixture ×4.
10. **Message-shape knowledge ×3** — core `areChatMessagesEqual`, the store's `createChatHydrationKey` fingerprint, and native ports each enumerate message fields; the fingerprint belongs in core beside the equality helpers.
11. **Dead abstractions to delete** — `lib/services/container.ts` (generic DI container, zero production users; the real mechanism is the runtime locators), the `setMessages` realtime bridge, `mergeMessage`, the voice-recording surface, store `setEditTarget`/`clearComposer`.
12. **Realtime subscription-key idiom ×2** — sorted `join("|")` id-key plus 150 ms debounce timer, hand-rolled in both `notification-provider` and `presence-provider`; a shared `useRealtimeSubscription`-style helper once presence is re-homed (3.12).

---

## 6. Where functional patterns help — and where they would hurt

**The repo has already run this experiment, and the results are in.** The purely functional layer (core reducer + fixture vectors, `model/search`, the reducer-backed Zustand store) produces the cheapest, densest tests in the codebase and is the reference implementation for two native ports. The imperative-glue layer is where tests are expensive or missing. The recommendation is not "adopt FP" — it is *finish applying the pattern the codebase already chose*:

**Extend (high confidence):**
- **Events over shadow state.** Composer selection, optimistic deletes, and the monotonic read-state guard (3.5, 3.6) re-model in React state what the reducer already owns; presence (3.12) never got a reducer at all, and the notification mark-seen retry (3.11) is a reconciliation algorithm hiding in a callback. Reducer events + fixture vectors are the established, cross-platform way to make all of these testable.
- **Pure derivation extraction.** Every "derivation cluster" named above — row presentation, author identity, image load-state, unread signature, `getCallCopy`, `nextCandidateStatus`, resize geometry, speaking-detection smoothing, `attachmentRuns`, the message-body tokenizer — is logic whose *only* obstacle to table-testing is being defined inside a component or class. Extracting them is pure win: no new concepts, immediate test-cost collapse.
- **Fold-shaped enrichment.** Reaction aggregation and attachment mapping (3.3) are folds over rows; writing them as pure `(rows) → aggregates` functions with thin fetch wrappers is what makes single-sourcing them possible.
- **Immutable update discipline** is already universal (reducer transitions, `map`-based overlays); keep it — nothing to change.

**Do not add (would be abstraction for its own sake):**
- **No Result/Either monad library, no fp-ts/Effect.** The layer already has typed results (`ServiceResult`, notice-style results). The problem is five ad-hoc *shapes*, not a missing algebra — unify the shapes (3.4) and stop there. Introducing monadic composition would fork the codebase's idiom and raise the entry bar for no test benefit the current pattern doesn't already deliver.
- **Don't functionalize the IO adapters.** `call-media.ts`, the realtime services, and the repositories are imperative shells around SDKs — that is their job (ports-and-adapters is doing the isolation FP would otherwise buy). A class with mutable connection state is the honest model of a WebRTC session.
- **Don't extract trivial one-line derivations** into named helpers (the repo's inline `canSend`-style booleans are fine where they are); extraction pays only where there are branches worth table-testing.
- **Beware speculative generic abstraction** — the codebase's own cautionary tale is `container.ts`: a generic functional service container with zero production users while the concrete locators do the real work. Build shared utilities (`useLatestRequest`, `failWith`) from the third concrete duplicate, not from anticipation.

---

## 7. Recommended guidelines

Calibrated to this repo's actual distribution (median 35, p90 ≈ 200):

**Line count is a tripwire, not a rule.** Treat it as the prompt to ask better questions, never as a merge gate:

- **> 300 lines** (component/hook/adapter): stop and name the file's responsibilities in one sentence each. More than one sentence → find the seam.
- **> 450 lines:** the file must justify itself as *one deep module* — one interface hiding one coherent body of complexity (`call-media`, `use-chat-image-uploads`, the core reducer all pass). "Several things that happen to ship together" does not pass.
- **Generated files, fixtures, static JSX breadth, and genuine one-machine complexity are exempt** — by argument, not by silence. The argument belongs in the PR description.

**The tests are the better signal.** A file needs splitting when:
- a branch can only be reached through full renders, module-level `vi.mock`, or fake timers, **and** the branch is a pure decision (the test-cost gradient above);
- its test file grows past ~2× the source and covers behavior owned by other modules (chat-client.test.tsx, call-popover.test.tsx);
- tests assert *call sequences* on stubs rather than outcomes (core.test.ts) — a sign the unit under test has no observable seam.

**Structural rules that are already conventions — enforce them:**
- One exported component per folder (message-images and emoji-picker currently violate this); pure decision logic in `model/` (feature-local) or `packages/core` (cross-platform) with table tests; IO in adapters; composition in providers/roots.
- A hook returning **> ~10 members**, or a component taking **> ~20 props**, is interface sprawl regardless of line count — group into objects (chat-message-list's `viewport`/`pagination`/`transcript` props are the in-repo model) or split.
- New state that shadows reducer-owned concepts requires a reason written down; default is a reducer event.
- Third duplicate of a pattern → shared utility; second duplicate → note it; first → leave it.

**Function-level:** a function that needs a mock to test a *decision* is two functions (decision + effect). Positional argument lists past ~5 become an options object (`sendWithRequestId`'s 9 are the current outlier).

**The deletion test, as the final arbiter:** imagine deleting the module. If its complexity would vanish, it was a pass-through — inline it. If its complexity would reappear across N callers (core reducer: every platform), it is earning its size. That, not line count, is the standard.
