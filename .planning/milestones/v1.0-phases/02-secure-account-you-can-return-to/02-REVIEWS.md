---
phase: 2
reviewers: [codex]
reviewers_failed: [gemini]  # IneligibleTierError — Gemini CLI free-tier auth deprecated (migrate to Antigravity or API key)
reviewers_skipped: [claude]  # self — review invoked from Claude Code; skipped for independence
reviewed_at: 2026-07-02T23:02:12Z
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, 02-05-PLAN.md]
---

# Cross-AI Plan Review — Phase 2

## Codex Review

## Summary

The plans are generally strong: they translate the phase goals into a sensible Supabase-first implementation sequence, keep the product constraints visible, and put the highest-risk work, RLS, triggers, session cookies, and email token handling, behind explicit verification gates. The main risks are in a few technical details that could break execution: migration ordering around `private.is_coach_of`, Supabase `config.toml` field names, recovery-link routing semantics, possible lack of protected `/home`, and too much reliance on human checkpoints for things that could be scripted as repeatable verification.

## Strengths

- Clear dependency ordering: plumbing → schema → seed → signup loop → login/recovery loop.
- Good adherence to product rules: one primary action, calm copy, no role picker, no assignment UI, no learning features.
- Strong security posture: avoids `getSession()` server-side, uses token-hash email flow, hard-codes signup role to client, uses RLS, blocks role self-escalation.
- Good recognition that DB/RLS/auth email behavior cannot be meaningfully tested in jsdom.
- Seed script correctly goes through Supabase Admin API instead of raw `auth.users` inserts.
- Human setup gates are appropriate for Docker, Supabase CLI, Mailpit, and browser persistence checks.
- Plans avoid protected routing and role-aware homes, correctly deferring them to Phase 3.

## Concerns

- **HIGH: `private.is_coach_of` is created before `public.coach_clients` exists.**  
  In `02-02`, `0001_profiles.sql` defines `private.is_coach_of()` referencing `public.coach_clients`, but `coach_clients` is only created in `0003`. PostgreSQL SQL functions validate referenced relations at creation time unless carefully deferred. This can make `supabase db reset` fail immediately.

- **HIGH: `/home` may expose authenticated UI to signed-out users.**  
  Phase 2 explicitly avoids full route protection, but `home/page.tsx` only says it reads `getUser()`. It does not specify what happens when `getUser()` returns no user. Manual logout verification expects revisiting `/home` “no longer shows an authenticated session,” but the plan should require a redirect or unauthenticated placeholder. Otherwise AUTH-06 is weak.

- **HIGH: Supabase recovery flow may not land directly on `/reset-password` as written.**  
  `resetPasswordForEmail(... redirectTo: origin/auth/confirm?next=/reset-password)` plus a template containing `type=recovery&next=/reset-password` needs careful URL encoding and validation. If Supabase appends or rewrites params differently, `next` may be dropped or malformed. The plan should explicitly verify the generated Mailpit URL before relying on it.

- **HIGH: Supabase `config.toml` auth keys may be inaccurate.**  
  The plan asserts `minimum_password_length = 8` under `[auth.email]`. Supabase CLI config keys have changed over time; this should be checked against the current generated `supabase/config.toml` schema. A wrong key would silently fail or block `supabase start`.

- **MEDIUM: RLS verification is too manual and underspecified.**  
  The plans describe “run as client A / coach C,” but not exactly how to execute authenticated SQL with each JWT. This is easy to get wrong in Supabase Studio because service role bypasses RLS. A small verification script using anon client sessions would be more repeatable.

- **MEDIUM: `profiles` UPDATE policy is not specified.**  
  The role guard blocks role changes, but if there is no authenticated UPDATE policy, ordinary profile updates are blocked entirely. That may be fine for this phase, but then the role-guard verification “as authenticated client, attempt update role” may fail due to RLS before hitting the trigger. That still blocks escalation, but it does not prove the trigger.

- **MEDIUM: `coach_clients` RLS depends on role only indirectly.**  
  `private.is_coach_of(client_uuid)` checks relationship membership, not whether `auth.uid()` has `profiles.role = 'coach'`. If a malformed row assigned a client as coach, that user could read assigned profiles. The seed avoids this, but DB-level integrity should enforce coach/client roles or helper should verify role.

- **MEDIUM: Generated `database.types.ts` reconciliation is risky.**  
  The plan says to regenerate types, then “keep conversations/messages hand-written entries if gen types does not emit them.” Mixing generated and hand-written schemas in the same file can create drift and makes future regeneration error-prone. Better to separate generated DB types from legacy hand-written contracts or create the existing tables in migrations.

- **MEDIUM: The seed script’s idempotent user lookup via `admin.listUsers()` can be brittle.**  
  `listUsers()` is paginated. Fine for local dev, but the plan says it works hosted too. The script should either search all pages safely or use a deterministic admin lookup strategy if available.

- **MEDIUM: Client-side auth pages depend on `useSearchParams()`.**  
  In Next App Router, client components using `useSearchParams()` may need a Suspense boundary depending on route/rendering mode. The plan should account for build-time behavior, not just Vitest.

- **LOW: File paths for `proxy.ts` are ambiguous.**  
  The plan says “Create `apps/web/proxy.ts` at the project root.” In a monorepo, this means app root, not repo root. The frontmatter is correct, but the wording could confuse executors.

- **LOW: Email resend behavior is underspecified for expired links.**  
  `/expired-link` is shared between confirmation and recovery, but the action needs to know whether to resend signup confirmation or password recovery. The plan says “resend/reset as appropriate” without defining how the screen determines type.

- **LOW: Tests based on `grep -c 'variant="primary"'` are fragile.**  
  They miss implicit defaults and may count test text or wrapped components incorrectly. Useful as a cheap guard, but not sufficient for the one-primary rule.

## Suggestions

- Move `private.is_coach_of()` into the migration after `coach_clients` exists, or create `coach_clients` before defining the helper/policies that reference it.
- Add explicit behavior for unauthenticated `/home`: redirect to `/login` or render a neutral signed-out state. Make the manual logout test assert that exact behavior.
- Verify `supabase/config.toml` keys against the installed CLI’s generated config before writing the plan as executable. Treat auth config as CLI-version-sensitive.
- Add a repeatable `scripts/verify-rls.ts` or SQL/JWT verification script that logs in seeded users with the anon key and asserts visible rows. Keep the human browser walk, but script DB boundaries.
- Decide whether profile updates are out of scope. If out of scope, change DB-04 verification to prove the trigger with a service-role or controlled SQL path; if in scope, add an UPDATE policy allowing safe profile fields while the trigger blocks role changes.
- Harden `coach_clients` with constraints or triggers ensuring `coach_id` points to a coach profile and `client_id` points to a client profile, or make `private.is_coach_of()` also check the caller’s role.
- Split generated Supabase types from hand-written legacy table contracts, or create migrations for all tables represented in `database.types.ts`.
- Specify recovery/confirmation resend type on `/expired-link`, e.g. `?email=&type=signup|recovery`, so the single action can call the correct Supabase method.
- Use RTL assertions for one primary visible action, not only source greps.
- Add a final full-phase verification command list: `pnpm lint`, `pnpm typecheck`, `pnpm build`, app tests, `supabase db reset`, `pnpm seed`, RLS verification.

## Risk Assessment

**Overall risk: MEDIUM.**

The architecture is sound and the plans are security-conscious, but several execution details are sharp enough to break the phase: migration ordering, Supabase config compatibility, RLS verification mechanics, and recovery-link routing. None of these require a redesign, but they should be corrected before execution so the phase does not stall in local Supabase setup or pass verification with untested assumptions.

---

## Gemini Review

**FAILED** — Gemini CLI 0.36.0 returned `IneligibleTierError: This client is no longer supported for Gemini Code Assist for individuals` (free-tier auth deprecated; Google directs users to the Antigravity suite). No review produced. To include Gemini in future runs, re-authenticate with a paid tier / API key or a compatible client.

---

## Consensus Summary

Only one external reviewer (Codex) completed successfully, so no cross-reviewer consensus can be computed. Treat the Codex findings — particularly the three HIGH items — as the priority list:

### Priority Concerns (Codex, HIGH)
1. **Migration ordering** — `private.is_coach_of()` is defined in `0001_profiles.sql` but references `public.coach_clients`, which is only created in `0003_coach_clients.sql`; `supabase db reset` may fail at creation time.
2. **Unauthenticated `/home` behavior unspecified** — the plan reads `getUser()` but doesn't define the redirect/placeholder when no user exists, weakening the AUTH-06 logout verification.
3. **Recovery-link routing assumptions** — the `redirectTo`/`next=/reset-password` parameter chain through `/auth/confirm` needs explicit verification of the actual generated Mailpit URL (encoding/rewriting can drop `next`).
4. **`config.toml` auth keys are CLI-version-sensitive** — verify `minimum_password_length` placement against the installed CLI's generated schema before treating the plan as executable.

### Notable MEDIUM Themes
- RLS verification should be scripted (seeded users + anon key), not only manual Studio walks — service role silently bypasses RLS.
- `profiles` UPDATE policy is unspecified: the role-guard test may be blocked by RLS before proving the trigger.
- `coach_clients` integrity: helper checks relationship membership, not the caller's coach role.
- Mixing generated and hand-written entries in `database.types.ts` invites drift.
- `admin.listUsers()` pagination makes the seed's idempotency check brittle beyond local dev.
- `useSearchParams()` in client pages may need Suspense boundaries at build time.

### Divergent Views
None — single reviewer.

**Overall risk (Codex): MEDIUM** — architecture sound and security-conscious; sharp execution details (migration order, config schema, RLS verification mechanics, recovery routing) should be corrected before execution.
