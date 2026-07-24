---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 02
subsystem: api
tags: [supabase, edge-functions, storage, link-previews, privacy, cleanup]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: "Deployed shared-content RPCs, cleanup claims, and generated Supabase aliases from Plan 01"
provides:
  - "Canonical safe-link identity persistence independent of metadata enrichment"
  - "Retry-safe physical cleanup of deleted bound attachment Storage objects"
affects: [phase-11-plan-05, native-shared-content, shared-content-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persist validated first-link identity with conflict-ignore before enqueueing enrichment"
    - "Claim deleted attachment rows, remove Storage paths, and finish only successful IDs"

key-files:
  created:
    - supabase/functions/_shared/link-preview.test.ts
  modified:
    - supabase/functions/_shared/link-preview.ts
    - supabase/functions/chat-image-command/index.ts

key-decisions:
  - "Canonical link and preview-job upserts ignore conflicts so a later enqueue cannot replace the first safe URL for a message."
  - "Deleted-bound cleanup treats no paths and provider missing-object responses as converged, while Storage failures remain retryable."

patterns-established:
  - "Canonical link rows contain only validated message identity, URL, and hostname before optional metadata enrichment."
  - "Cleanup diagnostics expose aggregate counts and database error codes without logging paths, tokens, URLs, message IDs, or bodies."

requirements-completed: [DISC-03, PRIV-01]

# Metrics
duration: 5min
completed: 2026-07-22
---

# Phase 11 Plan 02: Safe link persistence and deleted attachment cleanup Summary

**Safe links now become gallery-eligible before preview enrichment, and deleted message attachments are physically removed through a retry-safe Storage cleanup pass.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-22T10:44:01Z
- **Completed:** 2026-07-22T10:49:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `persistCanonicalLinkIdentity` and made `enqueueLinkPreviewJob` durable only when both the minimal canonical row and the enrichment job persist.
- Preserved the first validated URL across repeated enqueue attempts and retained canonical rows when metadata fetching fails.
- Added a third cleanup pass using `claim_deleted_chat_attachment_cleanup` and `finish_deleted_chat_attachment_cleanup`, deduplicated Storage paths, missing-object convergence, sibling-claim release, and aggregate response counts.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add link identity persistence coverage** - `44d6dcca` (test)
2. **Task 1 GREEN: Persist canonical safe-link identity** - `b132472f` (feat)
3. **Task 2: Consume deleted-bound attachment claims** - `587efedd` (feat)

**Plan metadata:** `8402f5b5` (docs: complete plan); progress synchronization: `c235154c`.

## Files Created/Modified

- `supabase/functions/_shared/link-preview.test.ts` - Injected Supabase fake covering exact upserts, unsafe URL write exclusion, first-safe-link idempotency, and enrichment failure retention.
- `supabase/functions/_shared/link-preview.ts` - Canonical safe-link persistence before durable preview-job enqueueing.
- `supabase/functions/chat-image-command/index.ts` - Service-role deleted-bound claim, Storage removal, finish, retry, and count handling.

## Decisions Made

- Canonical identity and the job use `ignoreDuplicates` on the message primary key, keeping the first safe URL authoritative during retries or repeated sends.
- The cleanup worker records an attachment as successfully deleted only after all distinct known paths either remove successfully or are already missing; failed removals are excluded from the finish ID list.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first `pnpm verify:chat-attachments` attempt failed because the local `supabase_edge_runtime_fish` service was stopped, producing generic non-2xx Edge responses. The existing local Edge Functions runtime was restarted, and the complete verifier then passed without code changes.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05 can exercise the deployed shared-content deletion and safe-link lifecycle through the existing command paths.
- No known stubs were found in the three touched files; the `not available` strings are existing calm error responses, not placeholder UI or unimplemented data paths.

---
*Phase: 11-shared-content-contract-and-privacy-boundary*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- Task commits `44d6dcca`, `b132472f`, and `587efedd` exist in repository history.
- Focused Node tests, attachment verifier, build, lint, and typecheck passed.
