---
phase: 09-cross-platform-chat-state
plan: "08"
subsystem: routing
tags: [nextjs, app-router, chat, requirements-supersede, gap-closure]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state
    provides: The community-room /channels/[id] route (quick-task 260709-qag) and the app-shell dual-branch immersive check (/channels or /chat) that this plan narrows
provides:
  - "/chat route removed — apps/web/app/(authenticated)/chat/page.tsx deleted, /channels/general is the sole canonical chat surface"
  - "app-shell.tsx immersive check narrowed to /channels only, nav link arrays/labels/destinations unchanged"
  - "e2e/chat-send.spec.ts browser send-smoke navigates to the canonical community channel instead of the dead /chat URL"
  - "Dated 2026-07-10 supersede notes on CSTATE-02/CSTATE-06 (REQUIREMENTS.md), D-09 (09-CONTEXT.md), and the Phase 9 goal (ROADMAP.md), with original wording preserved"
affects: [09-VERIFICATION re-run, 09-09, 09-10, 09-11, gsd-secure-phase-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dated append-only supersede blockquote placed directly under the superseded bullet/decision/goal, preserving original wording for audit history instead of rewriting requirements in place"

key-files:
  created: []
  modified:
    - "apps/web/app/(authenticated)/chat/page.tsx (deleted)"
    - "apps/web/components/shell/app-shell.tsx"
    - "apps/web/components/shell/app-shell.test.tsx"
    - "apps/web/e2e/chat-send.spec.ts"
    - ".planning/REQUIREMENTS.md"
    - ".planning/phases/09-cross-platform-chat-state/09-CONTEXT.md"
    - ".planning/ROADMAP.md"

key-decisions:
  - "Deleted only the dead /chat page.tsx; left ChatClient/hooks/store/chat-state.ts/actions.ts/realtime.ts and their tests in place under chat/ (now a plain module folder, not a route) since channels/[id]/page.tsx imports from ../../chat/*"
  - "Supersede notes are additive dated blockquotes directly under the affected bullet/decision/goal — original CSTATE-02/06, D-09, and Phase 9 goal wording is untouched"

patterns-established:
  - "Route-scope drift is resolved by deletion + dated doc supersede notes, not by silently rewriting requirements — history stays auditable."

requirements-completed: [CSTATE-02, CSTATE-06]

coverage:
  - id: D1
    description: "/chat route deleted (git rm) and no application source references the removed \"/chat\" URL string"
    requirement: CSTATE-02
    verification:
      - kind: other
        ref: "test ! -f apps/web/app/(authenticated)/chat/page.tsx"
        status: pass
      - kind: other
        ref: "grep -rn '\"/chat\"' apps/web/app apps/web/components apps/web/e2e (no matches)"
        status: pass
      - kind: other
        ref: "pnpm build — route table lists /channels/[id], no /chat entry"
        status: pass
    human_judgment: false
  - id: D2
    description: "app-shell.tsx immersive layout check narrowed to /channels only; nav link arrays/labels/destinations unchanged"
    requirement: CSTATE-02
    verification:
      - kind: unit
        ref: "components/shell/app-shell.test.tsx (11 tests, obsolete /chat pathname case removed)"
        status: pass
      - kind: other
        ref: "git diff app-shell.tsx — clientNavItems/coachNavItems untouched"
        status: pass
    human_judgment: false
  - id: D3
    description: "e2e/chat-send.spec.ts navigates to the canonical community channel (/channels/22222222-2222-4222-8222-222222222222) instead of the removed /chat URL"
    verification:
      - kind: other
        ref: "grep page.goto apps/web/e2e/chat-send.spec.ts"
        status: pass
    human_judgment: true
    rationale: "Per the plan's verification note, this Playwright spec needs a live server and is intentionally not run as a gate in this execution — only the source-text change is proven here; a functional pass requires a live-server Playwright run."
  - id: D4
    description: "Dated 2026-07-10 supersede notes added to CSTATE-02/CSTATE-06 (REQUIREMENTS.md), D-09 (09-CONTEXT.md), and the Phase 9 goal (ROADMAP.md), pointing re-verification at /channels/general with original wording intact"
    requirement: CSTATE-06
    verification:
      - kind: other
        ref: "grep -n 2026-07-10 REQUIREMENTS.md 09-CONTEXT.md ROADMAP.md"
        status: pass
      - kind: other
        ref: "git diff REQUIREMENTS.md/09-CONTEXT.md/ROADMAP.md — additions only, no deletions of original text"
        status: pass
    human_judgment: false
  - id: D5
    description: "Repo-wide gates stay green after the route removal: typecheck, lint, build"
    verification:
      - kind: other
        ref: "pnpm typecheck"
        status: pass
      - kind: other
        ref: "pnpm lint"
        status: pass
      - kind: other
        ref: "pnpm build"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 08: Remove /chat Route and Supersede CSTATE-02/06 Summary

**Deleted the dead `/chat` redirect route, narrowed `app-shell`'s immersive check to `/channels`-only, repointed the e2e send-smoke at the community channel, and annotated CSTATE-02/CSTATE-06/D-09/the Phase 9 goal with dated supersede notes so re-verification measures the shipped community room, not the removed 1-on-1 route.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-10T04:26:20Z
- **Completed:** 2026-07-10T04:34:00Z
- **Tasks:** 2
- **Files modified:** 7 (1 deleted, 6 modified)

## Accomplishments
- Deleted `apps/web/app/(authenticated)/chat/page.tsx` via `git rm` — `/chat` no longer resolves; `/channels/general` is the sole canonical chat surface, confirmed absent from the `pnpm build` route table.
- Narrowed `app-shell.tsx`'s immersive-layout check from `isActivePath(pathname, "/channels") || isActivePath(pathname, "/chat")` to channels-only, and removed the now-obsolete "/chat gets the full pane" test case from `app-shell.test.tsx`; nav link arrays, labels, and destinations were left untouched.
- Repointed `apps/web/e2e/chat-send.spec.ts`'s browser send-smoke navigation from the dead `/chat` URL to the canonical community channel `/channels/22222222-2222-4222-8222-222222222222`.
- Added dated (2026-07-10) supersede notes — additive blockquotes, original wording preserved — under CSTATE-06 in `REQUIREMENTS.md`, under D-09 in `09-CONTEXT.md`, and under the Phase 9 goal in `ROADMAP.md`, so re-verification targets the community-room experience at `/channels/:id` rather than the removed route.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the /chat route and its remaining references** - `f43f30a0` (fix)
2. **Task 2: Add dated supersede notes to requirements and planning docs** - `7f39b8b7` (docs)

**Plan metadata:** _pending — this commit_

## Files Created/Modified
- `apps/web/app/(authenticated)/chat/page.tsx` - Deleted; the dead redirect-only route no longer exists
- `apps/web/components/shell/app-shell.tsx` - Immersive check narrowed to `/channels` only (dead `/chat` branch removed)
- `apps/web/components/shell/app-shell.test.tsx` - Removed the obsolete `/chat` full-pane test case; channel-route case still covers immersive layout
- `apps/web/e2e/chat-send.spec.ts` - Browser send-smoke now navigates to `/channels/22222222-2222-4222-8222-222222222222`
- `.planning/REQUIREMENTS.md` - Dated supersede note under CSTATE-06 pointing at `/channels/general`
- `.planning/phases/09-cross-platform-chat-state/09-CONTEXT.md` - Dated supersede note under D-09
- `.planning/ROADMAP.md` - Dated supersede note under the Phase 9 goal

## Decisions Made
- Kept the shared chat internals (`ChatClient`, `hooks/`, `store/`, `chat-state.ts`, `actions.ts`, `realtime.ts`, and their tests) in place under `apps/web/app/(authenticated)/chat/` rather than relocating them. Deleting `page.tsx` turns that directory into a plain module folder (no route); `channels/[id]/page.tsx` already imports from `../../chat/*`, so relocating would have caused unnecessary churn for zero behavioral benefit.
- Supersede notes are additive dated blockquotes placed directly under the superseded bullet/decision/goal rather than in-place rewrites, preserving the original requirement/decision history for audit purposes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale Next.js generated type-validator referenced the deleted /chat page**
- **Found during:** Task 1, plan-level verification (`pnpm typecheck`)
- **Issue:** After deleting `apps/web/app/(authenticated)/chat/page.tsx`, `pnpm typecheck` failed with `Cannot find module '../../app/(authenticated)/chat/page.js'` from `apps/web/.next/types/validator.ts` — a stale, gitignored Next.js build-cache artifact generated before the deletion.
- **Fix:** Removed the gitignored `apps/web/.next` build cache directory so Next.js regenerates its typed-route validator on the next typecheck/build.
- **Files modified:** None tracked by git (`.next/` is gitignored; no source change was needed).
- **Verification:** `pnpm typecheck` passed clean afterward; `pnpm build` also passed and confirmed `/chat` is absent from the route table while `/channels/[id]` remains.
- **Committed in:** N/A (no git-tracked file changed by this fix).

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was a local build-cache regeneration only — no source or behavior change. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CSTATE-02 and CSTATE-06 docs now describe the shipped community-room surface; Phase 09 re-verification should target `/channels/:id`, not `/chat`.
- Ready for `09-09-PLAN.md` (draft-safe send-failure recovery, WR-01) — independent of this plan's files per this plan's own closing notes (Wave 5 plans share no code files).
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` and `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` were left untouched, as instructed — confirmed via `git status`/`git diff` before and after this plan's commits (both files were already committed as part of 09-07 by the time this plan ran, so no uncommitted WIP was at risk).

## Self-Check: PASSED

- CONFIRMED DELETED: `apps/web/app/(authenticated)/chat/page.tsx`
- FOUND: `apps/web/components/shell/app-shell.tsx`
- FOUND: `apps/web/components/shell/app-shell.test.tsx`
- FOUND: `apps/web/e2e/chat-send.spec.ts`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/phases/09-cross-platform-chat-state/09-CONTEXT.md`
- FOUND: `.planning/ROADMAP.md`
- FOUND commit `f43f30a0` (Task 1) in `git log --oneline --all`
- FOUND commit `7f39b8b7` (Task 2) in `git log --oneline --all`
- Re-ran all acceptance criteria: `/chat` page absent; `grep -rn '"/chat"'` across `apps/web/app apps/web/components apps/web/e2e` returns nothing; `app-shell.tsx` immersive expression contains `isActivePath(pathname, "/channels")` and no `"/chat"`; `e2e/chat-send.spec.ts` navigates to `/channels/22222222-2222-4222-8222-222222222222`; nav arrays untouched (confirmed via `git diff`)
- Re-ran plan verification: `pnpm --filter @fish/web test "components/shell/app-shell.test.tsx"` → 1 file, 11 tests passed; `pnpm typecheck` → pass; `pnpm lint` → pass; `pnpm build` → pass (route table confirms `/channels/[id]` present, `/chat` absent)

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*
