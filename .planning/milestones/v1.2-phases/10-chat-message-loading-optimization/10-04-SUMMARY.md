---
phase: 10-chat-message-loading-optimization
plan: 04
subsystem: chat-web-ui
tags: [react, intersection-observer, scroll-restoration, chat-ui, monochrome-states]

# Dependency graph
requires:
  - phase: 10-chat-message-loading-optimization
    provides: Zustand pagination dispatch wrappers/selectors, guarded Promise-returning loadOlderMessages/applyGapBackfill, "disconnected" realtime status emission from Plan 10-03
  - phase: 10-chat-message-loading-optimization
    provides: loadOlderMessagesAction/backfillMessagesAction/loadNewestMessagesAction direct-select reads from Plan 10-02
provides:
  - IntersectionObserver sentinel + quiet ghost "Load earlier messages" button, both driving ONE wrapped loadOlderAndPreserveScroll callback (manual scrollHeight-diff restore, instant, overflow-anchor:none)
  - Newest-identity (not length) new-message detection in useStickToBottom, so a prepended older page never yanks the viewport or raises a spurious pill
  - Fixed-height skeleton rows (opacity-only pulse) while isLoadingOlder; zero layout shift
  - Calm notice-tone offline banner + muted "Reconnecting…" pill keyed off selectRealtimeStatusForConversation, gated so an ordinary initial "connecting" load never reads as a reconnect
  - The three Plan 02 pagination/backfill/reset actions now actually reach ChatClient via the channel route
  - Shared IntersectionObserver test mock (tests/intersection-observer.ts) with a capture-and-trigger registry
affects: []

tech-stack:
  added: []
  patterns:
    - "One wrapped trigger callback for two entry paths: loadOlderAndPreserveScroll is the sole caller of Plan 03's loadOlderMessages, so neither the IntersectionObserver sentinel nor the 'Load earlier' button can bypass the scroll-anchor restore"
    - "Render-time state adjustment (not an effect) for 'has this conversation ever connected': comparing realtimeStatus to a previous-value state and conditionally setState-ing during the render body — the React-documented 'adjusting state when a prop changes' pattern — avoids a setState-in-effect cascade the project's eslint react-compiler rules reject"
    - "Shared IntersectionObserver mock registry: one module owns both the mock class and the trigger helper (mirrors the ResizeObserver stub precedent) so a test file in a different location can still fire a captured callback"

key-files:
  created:
    - apps/web/tests/intersection-observer.ts
    - apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts
    - apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts
  modified:
    - apps/web/vitest.setup.ts
    - apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx
    - apps/web/app/(authenticated)/channels/[id]/page.tsx
    - apps/web/app/globals.css

key-decisions:
  - "IntersectionObserverMock + installIntersectionObserverMock + triggerIntersection all live in one new file (apps/web/tests/intersection-observer.ts) sharing a single observedCallbacks Map, per the plan's incorporated review finding — vitest.setup.ts only calls the installer, it does not own the registry."
  - "useStickToBottom now tracks previousLastIdRef (the newest message's id, falling back to clientRequestId) instead of messages.length, so a prepended older page — same newest message, larger array — is provably inert to the hook; covered by a new dedicated unit test file."
  - "'Reconnecting…' only ever shows once the conversation has genuinely been 'connected' before (tracked via a previous-status render-time comparison, not a ref read during render and not a setState-in-effect) — the ordinary initial-mount 'connecting' state never displays it, keeping first load calm per states.md."
  - "The offline Alert only de-emphasizes the Composer (opacity-60 wrapper); the message transcript stays at full opacity per states.md so past coach instructions remain AA-legible while offline."
  - "Skeleton rows and the sentinel/button both gate independently off isLoadingOlder/hasMoreOlder so the affordance never dead-ends and never renders when there is no older history."

patterns-established:
  - "loadOlderAndPreserveScroll shape: capture viewport.scrollHeight/scrollTop synchronously, await the injected action, then requestAnimationFrame a scrollTop = newHeight - previousHeight + previousTop assignment — the one canonical scroll-anchor-restore shape any future prepend-triggering hook in this codebase should reuse."

requirements-completed: [CLOAD-03, CLOAD-04]

coverage:
  - id: D1
    description: "An IntersectionObserver sentinel above the oldest message auto-loads older history near the top, and a quiet focusable 'Load earlier messages' ghost button loads it on demand — both route through the same wrapped loadOlderAndPreserveScroll callback, and neither is a second primary action"
    requirement: "CLOAD-03"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#shows the quiet Load earlier messages button only when hasMoreOlder is true / hides the Load earlier messages button when hasMoreOlder is false"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#auto-loads older history when the sentinel intersects, through the scroll-preserving path"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#drives the same wrapped scroll-preserving callback from the button as the sentinel"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loading older messages preserves the exact reading position via a manual scrollHeight-diff restore (instant, no animation); overflow-anchor:none prevents the browser from fighting it"
    requirement: "CLOAD-04"
    verification:
      - kind: other
        ref: "grep -n 'scrollHeight|requestAnimationFrame' apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts; grep -q overflow-anchor apps/web/app/globals.css"
        status: pass
    human_judgment: true
    rationale: "jsdom performs no real layout, so no automated test can assert scrollTop lands at the exact restored pixel value after a prepend. Verified structurally (the capture -> await -> rAF restore shape, no animated scroll anywhere in the hook) and by the plan's own Task 3 human-check: after pnpm seed, scrolling up through >=3 older pages must keep the message under the eye fixed. That manual check is the closing proof for this truth at the phase gate."
  - id: D3
    description: "The stick-to-bottom hook keys new-message detection off the newest message's identity, so a prepended older page never yanks the viewport down or raises a spurious 'New messages' pill"
    requirement: "CLOAD-04"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts (3 cases: append/near-bottom follows, prepend is inert, far-scrolled reader gets the pill)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Loading and offline/reconnect states are calm: fixed-height skeleton rows reserve their space (zero layout shift), notice tone only, never red, reduced-motion respected; the offline/reconnecting state renders off the store realtime status Plan 03 emits"
    requirement: "CLOAD-03"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#shows fixed-height skeleton rows while an older page loads, and removes them after"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#shows a calm notice-tone offline state (never an error tone) when the realtime status is disconnected"
        status: pass
    human_judgment: true
    rationale: "The visual calm/never-alarming quality of the skeleton pulse and the offline banner (perceptual, not structural) is the plan's own Task 3 human-check item — toggling network offline/online and confirming notice/muted tone only, non-scolding copy, and preserved reading position. Structural coverage (Alert tone=\"notice\", no error/red tone class, skeleton test ids) is automated above."
  - id: D5
    description: "IntersectionObserver is mocked in the test host with a capture-and-trigger helper so sentinel behavior is unit-testable, sharing one registry between the installer and the trigger helper"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx (triggerIntersection import from @/tests/intersection-observer, used in the sentinel-triggered-load case)"
        status: pass
      - kind: other
        ref: "grep -q installIntersectionObserverMock apps/web/vitest.setup.ts; grep -c previousCountRef apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts == 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "loadOlderMessagesAction/backfillMessagesAction/loadNewestMessagesAction are imported and passed to ChatClient from channels/[id]/page.tsx, so the Plan 02 actions actually reach the client hooks"
    requirement: "CLOAD-03"
    verification:
      - kind: other
        ref: "grep -c 'loadOlderMessagesAction|backfillMessagesAction|loadNewestMessagesAction' \"apps/web/app/(authenticated)/channels/[id]/page.tsx\" == 6"
        status: pass
    human_judgment: true
    rationale: "channels/[id]/page.tsx is a server component with no dedicated render test in this codebase (consistent with the rest of the route file, which has never had a test); the wiring is verified structurally (import + prop-pass grep) and by pnpm build succeeding against the route's real prop types, not by a rendered-route test."
  - id: D7
    description: "No regression to existing chat behavior; full apps/web suite, build, lint, and typecheck stay green"
    verification:
      - kind: unit
        ref: "pnpm --filter @fish/web exec vitest run (446/446 tests, up from 437 at baseline)"
        status: pass
      - kind: other
        ref: "pnpm build; pnpm lint; pnpm typecheck"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-10
status: complete
---

# Phase 10 Plan 04: Render Pagination as a Calm, Jank-Free Chat Surface Summary

**IntersectionObserver sentinel + quiet "Load earlier messages" ghost button sharing one wrapped scroll-anchor-restore callback, a newest-identity fix to stick-to-bottom that makes prepends inert, fixed-height skeleton/offline states, and the three Plan 02 pagination actions finally threaded from the channel route into ChatClient.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-10T07:50:00Z (approx., first commit 9bf223fc)
- **Completed:** 2026-07-10T08:00:40Z
- **Tasks:** 3
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- Added `apps/web/tests/intersection-observer.ts` as the single shared module owning both the capture-and-trigger `IntersectionObserverMock` class and the `triggerIntersection` helper against one `observedCallbacks` registry; `vitest.setup.ts` now installs it alongside the existing ResizeObserver stub.
- Fixed `useStickToBottom`'s core CLOAD-04 bug: new-message detection now tracks the newest message's identity (`previousLastIdRef`, id with a `clientRequestId` fallback) instead of `messages.length`, so a prepended older page — same newest message, larger array — is provably inert (new `use-stick-to-bottom.test.ts`, 3 cases).
- Created `use-load-older-messages.ts` (`useLoadOlderMessages`): an `IntersectionObserver` sentinel effect (`rootMargin: "200px 0px 0px 0px"`, early-returns when `!hasMoreOlder || isLoadingOlder`, disconnects on cleanup) plus ONE wrapped `loadOlderAndPreserveScroll` callback — capture `scrollHeight`/`scrollTop`, `await onLoadOlder()`, then `requestAnimationFrame` an instant `scrollTop` restore. No animated scroll anywhere in the hook.
- Wired `channels/[id]/page.tsx` to import and pass `loadOlderMessagesAction`, `backfillMessagesAction`, and `loadNewestMessagesAction` to `<ChatClient>` — closing the review-flagged HIGH gap where Plan 02's actions were built but never reached the client.
- Wired `chat-client.tsx`: threaded the three new action props into `useChatMessages`, passed `applyGapBackfill` into `useChatRealtime`, added a `sentinelRef` + the sentinel element + a `Button variant="ghost"` "Load earlier messages" (both driving the same `loadOlderAndPreserveScroll`, never raw `loadOlderMessages`), 2 fixed-height opacity-pulse skeleton rows while `isLoadingOlder`, a calm `Alert tone="notice"` offline banner + muted "Reconnecting…" pill keyed off `selectRealtimeStatusForConversation` (gated so the ordinary initial "connecting" state never shows the reconnect pill), and dimmed only the Composer (not the transcript) while offline.
- Added `@keyframes skeleton-pulse` (opacity-only, never a shimmer sweep) + `@utility animate-skeleton-pulse` and `.chat-log-viewport { overflow-anchor: none; }` to `globals.css`, reusing the existing global reduced-motion clamp.
- Extended `chat-client.test.tsx` with 6 new cases: button visibility by `hasMoreOlder`, sentinel-triggered load (via `triggerIntersection`), button-triggered load through the identical wrapped callback, skeleton rows appearing/disappearing, and the disconnected calm offline state.
- Zero new `variant="primary"` in `chat-client.tsx`; send remains the screen's one primary action.

## Task Commits

Each task was committed atomically:

1. **Task 1: Land the IntersectionObserver test mock and fix the stick-to-bottom prepend-vs-append misfire** - `9bf223fc` (test)
2. **Task 2: Create the sentinel hook with IntersectionObserver auto-load and ONE wrapped scroll-anchor-restore callback** - `1e3e14a4` (feat)
3. **Task 3: Thread the new actions through the route, wire the sentinel/button/skeleton/reconnect UI, add CSS, extend the test** - `73b62803` (feat)

**Plan metadata:** (pending — see final commit below)

## Files Created/Modified

- `apps/web/tests/intersection-observer.ts` - `IntersectionObserverMock`, `installIntersectionObserverMock`, `triggerIntersection` sharing one registry
- `apps/web/vitest.setup.ts` - installs the shared IntersectionObserver mock
- `apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts` - newest-identity (`previousLastIdRef`) new-message detection replacing the length comparison
- `apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts` - new: append/near-bottom, prepend-inert, far-scrolled-pill cases
- `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts` - new: `useLoadOlderMessages`, sentinel + wrapped `loadOlderAndPreserveScroll`
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - sentinel/button/skeleton UI, offline/reconnect state, `chat-log-viewport` class, extended props + hook wiring
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - 6 new cases covering pagination UI and the offline state
- `apps/web/app/(authenticated)/channels/[id]/page.tsx` - imports and passes the three Plan 02 actions to `ChatClient`
- `apps/web/app/globals.css` - `--duration-skeleton` token, `@keyframes skeleton-pulse` + `@utility animate-skeleton-pulse`, `.chat-log-viewport { overflow-anchor: none }`

## Decisions Made

- Kept the IntersectionObserver mock class + trigger helper co-located in one new file (`apps/web/tests/intersection-observer.ts`) with a single shared `Map` registry, per the plan's incorporated review finding — `vitest.setup.ts` only installs it.
- Derived "has this conversation ever connected" (used to gate the "Reconnecting…" pill) via the React-documented render-time state-adjustment pattern (compare `realtimeStatus` to a stored previous value, conditionally `setState` in the render body) rather than a `useEffect` — the project's `eslint-plugin-react-hooks` (react-compiler rules) rejects both a ref read during render and a `setState` call inside an effect, so this was the only pattern satisfying both `pnpm lint` and the calm-first-load requirement.
- The offline `Alert` only wraps and dims the `Composer` (`opacity-60`); the transcript stays at full opacity, matching states.md's explicit instruction that past coach messages must stay AA-legible while offline.
- Added a `--duration-skeleton: 1400ms` token to `@theme` (rather than reusing `--duration-typing`) so the skeleton pulse's cadence can be tuned independently of the typing-dots animation later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking/lint] Fixed two `eslint-plugin-react-hooks` (react-compiler) rule violations discovered only at `pnpm lint`**
- **Found during:** Task 3 verification (`pnpm lint`, after tests/typecheck/build already passed)
- **Issue:** (a) `chat-client.tsx` initially read a `hasConnectedRef.current` value during render to compute `isReconnecting` — flagged by `react-hooks/refs` ("Cannot access refs during render"). (b) The first fix attempt moved the flag into `useState` updated from a `useEffect`, which then tripped `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect can trigger cascading renders"). (c) `use-stick-to-bottom.test.ts`'s test harness mutated a module-level `stateHolder` object during the component's render body, flagged by `react-hooks/immutability`.
- **Fix:** (a)+(b) Replaced the ref-during-render/effect-setState pair with the React-documented "adjusting state when a prop changes" pattern: a `previousRealtimeStatus` state compared against the current value, with the derived `setHasConnected(true)` call made conditionally in the render body itself (not an effect) when the comparison detects a transition to `"connected"`. (c) Moved the harness's `stateHolder.current = state` assignment into a `useEffect` (side effects belong there, not in the render body) so the test file itself also satisfies `react-hooks/immutability`.
- **Files modified:** `apps/web/app/(authenticated)/chat/chat-client.tsx`, `apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts`
- **Commit:** `73b62803` (folded into the Task 3 commit, since the lint failure surfaced during Task 3's own verification step before either fix was committed)

**2. [Rule 3 - Blocking/typecheck] Fixed an untyped `Promise` in a new test's mock**
- **Found during:** Task 3 verification (`pnpm typecheck`, after `pnpm lint` passed)
- **Issue:** The new skeleton-rows test built `vi.fn(() => new Promise((resolve) => { resolveLoad = resolve; }))` without a generic parameter, so TypeScript inferred `Promise<unknown>`, which didn't satisfy `loadOlderMessagesAction`'s `Promise<LoadOlderMessagesActionState>` prop type.
- **Fix:** Extracted a local `LoadOlderResult` type alias and applied it as the `Promise<LoadOlderResult>` generic parameter.
- **Files modified:** `apps/web/app/(authenticated)/chat/chat-client.test.tsx`
- **Commit:** `73b62803` (folded into the Task 3 commit)

No other deviations. All five cross-AI review incorporation items in the plan's `<review_incorporation>` (route wiring, single wrapped scroll-restore callback for both trigger paths, co-located IO mock registry, "disconnected" status consumption, the corrected zero-primary-count assertion) were implemented exactly as specified.

## Issues Encountered

- **`grep -c 'tone="error"|bg-error|text-error|red' chat-client.tsx` returns 6, not 0** (the plan's own acceptance-criteria grep). Verified this is entirely a substring false-positive from the pre-existing `filteredMessages` identifier (contains "…filte`red`…") appearing 6 times in the file — there is no `tone="error"`, `bg-error`, or `text-error` anywhere, and no new red/error-tone markup was added by this plan. Documented here rather than silently treated as a pass, matching the plan's own precedent (the LOW review item that corrected an equally naive earlier grep).

## User Setup Required

None - no external service configuration required. This plan touches only web hooks/components, one route, test infrastructure, and `globals.css`; no new dependencies, no schema/migration, no environment variables.

## Next Phase Readiness

- Phase 10 is now feature-complete across all 4 plans (10-01 portable pagination contract, 10-02 bounded keyset window + actions, 10-03 store/hook pagination-reconnect brain, 10-04 this plan's UI wiring). CLOAD-01 through CLOAD-06 are all implemented; CLOAD-03/CLOAD-04 close with this plan.
- Two truths remain **human_judgment: true** at the phase level, both matching the plan's own designated `<human-check>` (not automatable in jsdom, and this project's convention is unit/fixture tests + build gates over browser-preview tooling): (1) the exact reading-position preservation across >=3 real scrolled-up older pages, and (2) the perceptual calm of the skeleton/offline states with the network toggled. Both are ready for a manual pass at the phase gate (`pnpm seed` then scroll the general channel; toggle network offline/online).
- No blockers. `pnpm typecheck`, `pnpm build`, `pnpm lint`, and the full `apps/web` vitest suite (446/446 tests, up from 437 at baseline) are green at HEAD. `git status` confirms no changes outside the 9 files this plan declared (6 from the plan's `files_modified` list plus the two new test/hook files it explicitly names as artifacts), and no `package.json`/`pnpm-lock.yaml` changes (zero new dependencies).

---
*Phase: 10-chat-message-loading-optimization*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 9 created/modified files confirmed present via `[ -f ]`; all 3 task commit hashes (`9bf223fc`, `1e3e14a4`, `73b62803`) confirmed in `git log --oneline --all`. Plan-level verification re-run clean: full `apps/web` vitest suite (446/446 passed, up from 437 at baseline), `pnpm typecheck` (all 3 workspace packages), `pnpm build`, and `pnpm lint`. `git status` confirms no changes outside the files this plan declared, and no `package.json`/`pnpm-lock.yaml` changes (zero new dependencies).
