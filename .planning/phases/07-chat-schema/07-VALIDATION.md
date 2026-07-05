---
phase: 7
slug: chat-schema
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 7 - Validation Strategy

> Per-phase validation contract for chat schema execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Supabase CLI + TypeScript verifier + pnpm monorepo gates |
| Config files | `supabase/config.toml`; `scripts/verify-rls.ts`; `package.json` scripts |
| Quick run command | `pnpm db:reset && pnpm seed && pnpm verify:rls` |
| Full suite command | `pnpm db:reset && pnpm seed && pnpm verify:rls && pnpm typecheck && pnpm lint && pnpm build` |
| Estimated runtime | 2-5 minutes, depending on local Supabase state |

## Sampling Rate

- After migration authoring: run source scans for grants, RLS, `client_request_id`, and no authenticated message mutation policy.
- After seed/verifier edits: run `pnpm db:reset && pnpm seed && pnpm verify:rls`.
- Before phase closeout: run full suite command above.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 07-01 | 1 | CHAT-01, CHAT-04, CHAT-06, XC-01 | T-07-01..T-07-08 | Chat tables, RLS, RPC, immutable messages, idempotency, stable ordering | migration/source | `rg -n "send_chat_message|client_request_id|is_conversation_member" supabase/migrations/0009_chat.sql` | pending | pending |
| 07-01-02 | 07-01 | 1 | CHAT-01 | T-07-02 | Seed one conversation per assignment with no chooser surface | seed | `pnpm db:reset && pnpm seed` | pending | pending |
| 07-01-03 | 07-01 | 1 | CHAT-01, CHAT-04, CHAT-06, XC-01 | T-07-01..T-07-08 | Live RLS proves member access, outsider denial, idempotency, immutable messages, body constraints | RLS/integration | `pnpm verify:rls` | pending | pending |
| 07-01-04 | 07-01 | 1 | CHAT-01, CHAT-04 | T-07-07 | Generated types include real chat rows and legacy contracts are removed | type/source | `supabase gen types typescript --local`; `pnpm typecheck` | pending | pending |

## Wave 0 Requirements

- [ ] `supabase/migrations/0009_chat.sql` exists with chat schema, RLS, helper, RPC, grants, constraints, and indexes.
- [ ] `scripts/seed.ts` creates deterministic chat conversations for seeded coach-client assignments.
- [ ] `scripts/verify-rls.ts` contains live `checkChat*` assertions wired into `main()`.
- [ ] `packages/supabase/src/database.generated.ts` is regenerated from the local schema.
- [ ] `packages/supabase/src/database.types.ts` exports `ConversationRow`, `MessageRow`, `MessageReadRow` and no longer exports `LegacyChatContracts`.

## Manual-Only Verifications

None required. Phase 7 has no UI. All acceptance criteria are source, migration, RLS, and build gates.

## Validation Sign-Off

- [x] All tasks have automated verification.
- [x] Sampling covers authorization, integrity, schema/type realism, and final full-suite gates.
- [x] No watch-mode commands.
- [x] Feedback latency target under 15 minutes.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-07-05
