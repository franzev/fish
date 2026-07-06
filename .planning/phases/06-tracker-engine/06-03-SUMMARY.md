---
phase: 06-tracker-engine
plan: 03
status: complete
completed: 2026-07-06
requirements: [TRAK-02, TRAK-06, XC-01, XC-03]
---

# Phase 6.03 Summary - Assignment Command and Coach Review

## Delivered

- Added `supabase/functions/assign-tracker/index.ts`, registered in `supabase/config.toml` with `verify_jwt = true`.
- The assignment function verifies the caller with `getUser()`, checks the caller is a coach, re-checks `coach_clients` with both `coach_id = caller.id` and `client_id = body.clientId`, derives the active tracker version server-side, and writes with the service-role client only after authorization passes.
- The function request body accepts only `clientId`; it does not trust client-supplied coach IDs or version IDs.
- Added coach tracker review data loading and appended a read-only saved-entry timeline to `/coach/clients/[id]`.
- Extracted `apps/web/components/onboarding/format-answer.ts` and imported the shared formatter from onboarding review, onboarding conversation transcript, and tracker coach review.
- Kept coach review read-only: no primary button, input, textarea, edit, or delete affordance.

## Verification

- Source checks confirm `assign-tracker` derives `coach_id` from the verified caller and filters `coach_clients` with the caller's coach id.
- Focused Vitest run passed for onboarding coach review, onboarding conversation, tracker entry flow, and coach tracker review.
- `pnpm verify:rls` passed for assigned-coach reads, unassigned-coach denial, cross-client denial, client-only drafts, and coach progress gating.
- `pnpm build`, `pnpm lint`, and root `pnpm typecheck` passed during release verification.

## Threat Flags

- No open threat flags. The command boundary is server-derived, RLS denies cross-client reads, and the coach timeline only renders saved entries with shared snapshot-aware formatting.
