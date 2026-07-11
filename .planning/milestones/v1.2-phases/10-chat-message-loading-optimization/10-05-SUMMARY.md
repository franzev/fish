---
phase: 10-chat-message-loading-optimization
plan: 05
subsystem: ui
tags: [react, tailwind-v4, accessibility, skeleton, chat-pagination]

requires:
  - phase: 10-chat-message-loading-optimization
    provides: bounded older-message pagination, scroll restoration, and stable pagination-state wiring
provides:
  - Shared community-message row geometry for final messages and loading placeholders
  - Two-row message-shaped older-history skeleton with non-visible busy status
  - Fixed 112px pagination slot and focused anatomy/accessibility regression coverage
affects: [chat-ui, pagination, loading-states, accessibility]

tech-stack:
  added: []
  patterns:
    - Shared layout primitive keeps final content and skeleton geometry structurally identical
    - Mutually exclusive idle, loading, and failure pagination treatments inside one fixed slot

key-files:
  created:
    - apps/web/components/chat/message-row/community-message-row-layout.tsx
    - apps/web/components/chat/message-row/message-rows-skeleton.tsx
    - apps/web/components/chat/message-row/index.ts
  modified:
    - apps/web/app/globals.css
    - apps/web/components/chat/index.ts
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx

key-decisions:
  - "Final community rows and loading rows delegate avatar/content alignment to CommunityMessageRowLayout rather than maintaining parallel class strings."
  - "The pagination slot uses a fixed 112px semantic height derived from the approximately 110.8px tallest loading state."
  - "Older-history loading exposes one sr-only status while all visual skeleton anatomy is aria-hidden and no loading Button remains mounted."

patterns-established:
  - "CommunityMessageRowLayout: avatar slot first, then one fluid min-w-0 flex-1 content column, with shared group spacing."
  - "Pagination loading state: static message-shaped skeleton plus aria-busy and one non-visible status; no visible copy or spinner."

requirements-completed: [CLOAD-03, CLOAD-04]

duration: 7min
completed: 2026-07-10
---

# Phase 10 Plan 05: One-to-One History Loading Skeleton Summary

**A two-row community-message skeleton now shares its complete row geometry with final messages inside a fixed, accessible 112px pagination slot.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-10T22:07:44Z
- **Completed:** 2026-07-10T22:14:34Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Extracted `CommunityMessageRowLayout` so final author/continuation rows and loading placeholders cannot drift in avatar placement, content start, padding, or fluid width behavior.
- Replaced generic full-width bars and Button loading treatment with exactly two message-shaped rows, one screen-reader-only status, and `aria-busy` on the transcript.
- Locked idle/loading/error to one fixed `h-pagination-slot` backed by the source-derived 112px token.
- Added focused coverage for skeleton anatomy, shared final-row geometry, visible-state mutual exclusion, accessibility semantics, focus behavior, and semantic token wiring.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared community-row geometry and build the one-to-one message skeleton** - `5678d535` (feat)
2. **Task 2: Lock skeleton anatomy, mutual exclusion, shared geometry, and stable dimensions with focused tests** - `9ef7fe01` (test)

## Files Created/Modified

- `apps/web/components/chat/message-row/community-message-row-layout.tsx` - Shared final/skeleton community-row geometry primitive.
- `apps/web/components/chat/message-row/message-rows-skeleton.tsx` - Deterministic author and continuation loading rows with stable test atoms.
- `apps/web/components/chat/message-row/index.ts` - Named message-row component exports.
- `apps/web/components/chat/index.ts` - Exposes the message-row folder through the chat kit barrel.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - Uses shared final-row layout, fixed pagination slot, skeleton-only loading, and busy semantics.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Regression coverage for anatomy, geometry, state exclusion, accessibility, focus, and slot dimensions.
- `apps/web/app/globals.css` - Raises the semantic pagination-slot token from 104px to 112px.

## Decisions Made

- Shared geometry is a non-focusable layout primitive rather than copied Tailwind strings, so both rendered messages and placeholders inherit future spacing changes together.
- The loading branch removes the pagination Button entirely instead of using its loading prop, preventing both visible copy and the Button's `animate-spin` child.
- The 112px slot value is the smallest whole semantic size above the approximately 110.8px source-calculated loading state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The workspace does not provide a Prettier executable, so the optional formatting attempt was unavailable. The required ESLint, TypeScript, focused tests, chat suite, and production build all passed without changes.

## Verification

- `pnpm --filter @fish/web exec vitest run "app/(authenticated)/chat/chat-client.test.tsx"` — 59/59 passed.
- `pnpm --filter @fish/web exec vitest run "app/(authenticated)/chat"` — 119/119 passed.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed across all configured workspace packages.
- `pnpm build` — passed, including the Next.js production build.
- Source review — no new primary action, Button spinner, shimmer/gradient, raw color, arbitrary visual utility, dependency, or programmatic focus movement.
- Security review — no authentication, authorization, RLS, server-action, persistence, or raw-HTML boundary changed; no high-severity finding introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The actionable Phase 10 UAT skeleton gap is implemented and regression-locked.
- Phase 10 now has summaries for all five plans and is ready for phase verification/UAT follow-up.
- Previously blocked UAT Tests 3 and 4 remain verification constraints; reconnect/backfill behavior was intentionally unchanged.

## Self-Check: PASSED

- All three created files exist and all four modified files are present.
- Both task commits are present in `git log --oneline --all --grep="10-05"`.
- Every task acceptance criterion and all plan-level verification commands passed.

---
*Phase: 10-chat-message-loading-optimization*
*Completed: 2026-07-10*
