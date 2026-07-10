---
status: issues_found
phase: 10-chat-message-loading-optimization
depth: standard
files_reviewed: 30
files_reviewed_list:
  - "apps/web/app/(authenticated)/channels/[id]/page.tsx"
  - "apps/web/app/(authenticated)/chat/actions.test.ts"
  - "apps/web/app/(authenticated)/chat/actions.ts"
  - "apps/web/app/(authenticated)/chat/chat-client.test.tsx"
  - "apps/web/app/(authenticated)/chat/chat-client.tsx"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts"
  - "apps/web/app/(authenticated)/chat/realtime.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-selectors.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-store.test.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-store.ts"
  - "apps/web/app/globals.css"
  - "apps/web/components/chat/index.ts"
  - "apps/web/components/chat/message-row/community-message-row-layout.tsx"
  - "apps/web/components/chat/message-row/index.ts"
  - "apps/web/components/chat/message-row/message-rows-skeleton.tsx"
  - "apps/web/lib/services/supabase/core.test.ts"
  - "apps/web/lib/services/supabase/core.ts"
  - "apps/web/lib/services/supabase/types.ts"
  - "apps/web/tests/chat-state-fixtures.test.ts"
  - "apps/web/tests/intersection-observer.ts"
  - "apps/web/vitest.setup.ts"
  - "packages/core/docs/chat-state-protocol.md"
  - "packages/core/src/chat-state/fixtures/chat-state-vectors.json"
  - "packages/core/src/chat-state/reducer.ts"
  - "packages/core/src/chat-state/selectors.ts"
  - "packages/core/src/chat-state/types.ts"
findings:
  critical: 0
  blocker: 0
  warning: 1
  info: 0
  total: 1
reviewed_at: "2026-07-10T23:17:17Z"
diff_base: 50ff7a4021c6ab0c1985a4d5fa3d9c0d8596e357
---

# Phase 10: Code Review Report

## Summary

Phase 10's bounded message reads, composite keyset pagination, retained-window reaction enrichment, reducer deduplication, scroll-anchor restoration, skeleton geometry, and authoritative reconnect cursor selection are internally consistent and covered by focused regressions. Plan 10-06 closes both warnings from the preceding review: empty/client-only transcripts now hydrate a bounded newest window, optimistic tails no longer become server cursors, and initial reaction reads are restricted to the retained 40-message window.

One reconnect-coalescing race remains when a mounted client changes conversations while an earlier conversation's backfill is still pending. No critical security or authorization issue was found. Pagination/backfill reads remain input-validated, bounded, caller-session Supabase selects protected by RLS.

## Warnings

### WR-01 — A stale conversation's completion can clear the active conversation's reconnect lock

**Evidence:** `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:105-106`, `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:135-138`, `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:154-168`; existing switch coverage at `apps/web/app/(authenticated)/chat/chat-client.test.tsx:1813-1861` verifies stale older-page isolation but does not exercise overlapping reconnect backfills.

`backfillInFlightRef` is shared by the mounted hook. On a conversation change, the effect assigns it `null`, allowing the new conversation to start its own backfill. The old promise is not cancelled or generation-guarded, however, and its unconditional `.finally(() => { backfillInFlightRef.current = null; })` still runs. If conversation B has installed a new in-flight promise before conversation A settles, A's `finally` erases B's lock. A second B channel resubscribe can then launch a duplicate backfill while B's first recovery read is still running.

**Impact:** During a quick conversation switch combined with reconnect churn, the intended one-backfill-across-three-channels guarantee can be broken. This adds duplicate bounded reads and permits two reset/merge chains for the same new conversation to race. The reducer prevents duplicate message rows, but it does not prevent redundant network work or out-of-order hydration metadata commits.

**Recommendation:** Store the created promise in a local variable and clear the ref only when it still points to that same promise (or use a conversation generation token). Add a regression that starts a deferred backfill for A, switches to B, starts a deferred backfill for B, resolves A, then emits another B channel resubscribe and proves B still has exactly one in-flight recovery.

## Scope and Verification

- Reviewed all 30 explicitly scoped files at standard depth against `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, CLOAD-01 through CLOAD-06, the Phase 10 protocol/plan artifacts, and the 10-06 gap-closure contract.
- Traced SSR N+1 windowing, reaction batching, cursor validation and PostgREST filters, older-page lifecycle/error gating, reconnect recovery/reset, store hydration, deduplication, read markers, scroll restoration, skeleton accessibility, and route action wiring.
- Focused Vitest run passed: 6 files, 141 tests (`actions`, `chat-client`, `use-stick-to-bottom`, `chat-store`, Supabase core, and chat-state fixtures).
- `pnpm typecheck` passed across configured workspace packages.
- `pnpm lint` passed.
- No source code was modified. The unrelated uncommitted `apps/web/components/chat/index.ts` export edit and untracked Phase 9 security report were preserved and not attributed to Phase 10.

---

_Reviewed: 2026-07-10T23:17:17Z_  
_Reviewer: gsd-code-reviewer_  
_Completion: REVIEW_COMPLETE_
