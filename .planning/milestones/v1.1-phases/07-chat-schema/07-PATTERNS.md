# Phase 7: Chat Schema - Patterns

**Mapped:** 2026-07-05  
**Scope:** chat schema, RLS, seed, generated types, live verifier

## Closest Analogs

| Target | Primary analog | Pattern to copy |
|--------|----------------|-----------------|
| `supabase/migrations/0009_chat.sql` | `supabase/migrations/0008_onboarding.sql` | Explicit grants, RLS enablement, authenticated RPCs, `revoke execute ... from public`, `grant execute ... to authenticated`, service-role-only writes. |
| `private.is_conversation_member` | `supabase/migrations/0004_rls_helpers.sql`, `0006_client_reads_coach_name.sql` | `security definer`, `stable`, `set search_path = ''`, qualified table reads, no recursive protected-table policy reads. |
| chat seed | `scripts/seed.ts` | Service-role client, deterministic upserts, seeded users resolved by email, idempotent repeated seed runs. |
| chat RLS assertions | `scripts/verify-rls.ts` | `signInAs` real anon-key sessions, `checkNoRecursion`, zero-row negative assertions, service-role only for setup. |
| generated aliases | `packages/supabase/src/database.types.ts` | Alias generated rows through `Database["public"]["Tables"][...]["Row"]`; keep generated file separate. |

## Concrete Constraints

- Do not add a UI file in this phase.
- Do not add a Node/Express API.
- Do not add broad authenticated direct `messages` writes.
- Do not add message edit/delete/soft-delete/redaction fields.
- Do not import zod into `packages/core`.
- Do not leave `LegacyChatContracts` in `packages/supabase/src/database.types.ts` after chat tables are generated.

## File Impact

| File | Role | Expected changes |
|------|------|------------------|
| `supabase/migrations/0009_chat.sql` | schema/RLS/RPC | New migration with chat tables, helper, policies, functions, indexes. |
| `scripts/seed.ts` | fixture setup | Create one conversation per seeded assignment and read-state rows. |
| `scripts/verify-rls.ts` | release gate | Add `checkChat*` assertions and reset helper. |
| `packages/supabase/src/database.generated.ts` | generated schema | Regenerated from local Supabase after migration. |
| `packages/supabase/src/database.types.ts` | public DB type surface | Remove legacy contracts; add chat row aliases. |

## Known Landmines

- `SECURITY DEFINER` functions must use a controlled `search_path`.
- A service-role Supabase client bypasses RLS; verifier ownership checks must use `signInAs`.
- Negative RLS reads should return zero rows, not detailed "not authorized" side-channel errors.
- Shell redirects can damage generated files if interrupted; generate to a temporary file first, inspect, then move intentionally.
