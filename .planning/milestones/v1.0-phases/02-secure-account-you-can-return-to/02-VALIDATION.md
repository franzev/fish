---
phase: 2
slug: secure-account-you-can-return-to
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x + jsdom + React Testing Library (already installed in Phase 1 — no Wave 0 install needed) |
| **Config file** | `apps/web/vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `cd apps/web && pnpm test -- <pattern> --run` (the `test` script is `vitest`; `--run` forces single-shot, never watch mode) |
| **Full suite command** | `cd apps/web && pnpm test -- --run` (keeps the existing 71 Phase-1 tests green plus the new auth-screen tests) |
| **Web build gate** | `pnpm build` (App Router errors on unbounded `useSearchParams()` — proves the check-inbox / expired-link Suspense wrapping) |
| **Package typecheck** | `pnpm --filter @fish/supabase typecheck` (shared DB types) · `cd apps/web && pnpm typecheck` (web) |
| **DB "quick run" equivalent** | `supabase db reset` (re-applies all migrations + seed cleanly — the migration analog of a test run) |
| **Estimated UI-suite runtime** | ~10–20 seconds for the affected-pattern quick runs; ~30–45 seconds for the full web suite |

**Scope boundary (from RESEARCH.md Validation Architecture):** Vitest + jsdom + RTL is the correct tool for the **UI layer only** — form state, Alert/Input rendering, one-primary-action assertions, redirect-on-no-user. It **cannot** exercise real Supabase Auth flows, RLS policies, Postgres triggers, email delivery, or session persistence across a browser restart. Those live in the **Database** and **integration** tiers and are verified by (a) `grep` gates on the migration/script SQL, (b) `supabase db reset` applying cleanly, (c) the scripted `pnpm verify:rls` anon-session gate, and (d) the two blocking phase-gate manual walks. This is by design, not a coverage gap — do not force DB/email/session behaviors into Vitest.

---

## Sampling Rate

- **After every task commit:** Run that task's `<automated>` verify (the exact command from the Per-Task Verification Map below) — a UI pattern quick run, a `grep`/`typecheck` gate, or a checkpoint's blocking verification.
- **After every plan wave:** Run the full web suite `cd apps/web && pnpm test -- --run` (all 71+ existing tests plus new auth screens) plus `pnpm --filter @fish/supabase typecheck`; after any DB-touching wave, a clean `supabase db reset`.
- **Before `/gsd:verify-work`:** Full web suite green, `pnpm build` green (Suspense/search-param gate), `supabase db reset` clean, `pnpm verify:rls` exits 0, and both phase-gate manual walks (02-04 T4, 02-05 T3) approved.
- **Max feedback latency:** < 45 seconds for any automated gate (UI suite, grep, typecheck). DB and email/session behaviors are gated by the blocking checkpoints, which are intentionally human-paced.

---

## Per-Task Verification Map

Statuses reflect the plans as written. Automated commands are copied verbatim from each task's `<verify><automated>` block; checkpoint tasks are gated by human approval (no unit test — DB/email/session behavior is not jsdom-testable, per RESEARCH.md).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command / Gate | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|--------------------------|-------------|--------|
| 2-01-01 | 01 | 1 | AUTH-05 (foundation) | T-02-SC | Package legitimacy verified on npmjs.com before install; CLI + Docker prerequisites confirmed | checkpoint:human-action (blocking) | Manual gate — `supabase --version`, `docker info`, `supabase status`, package versions in `apps/web/package.json`; never auto-approved | ❌ prerequisite | ⬜ pending |
| 2-01-02 | 01 | 1 | AUTH-05 | T-02-01, T-02-02, T-02-03 | Server session read via getUser()/getClaims only (no getSession); single NextResponse cookie refresh; service key never NEXT_PUBLIC | unit (typecheck + grep) | `cd apps/web && pnpm typecheck && ! grep -rn "\.getSession(" lib/supabase/server.ts lib/supabase/proxy.ts proxy.ts` | ✅ created here | ⬜ pending |
| 2-01-03 | 01 | 1 | AUTH-05 | T-02-24 | 8-char minimum under `[auth]` (verified against generated schema); confirmations under `[auth.email]` | unit (grep + awk + typecheck) | `grep -q "home:" ... && grep -q "minimum_password_length = 8" ... && grep -q "enable_confirmations = true" ... && grep -q "^\[auth\]" ... && awk '...' && pnpm --filter @fish/supabase typecheck` | ✅ created here | ⬜ pending |
| 2-02-01 | 02 | 2 | DB-01, DB-02, DB-04 | T-02-06, T-02-07, T-02-23, T-02-25 | Hardened trigger (definer + search_path + on-conflict + coalesce); role='client' hard-coded; no forward reference; one-coach-per-client + role integrity | unit (grep gates on SQL) | `grep -q "security definer" 0002... && grep -q "search_path = ''" ... && grep -q "on conflict (id) do nothing" ... && grep -q "coalesce" ... && ! grep -q "is_coach_of" 0001... && ! grep -q "is_coach_of" 0003... && grep -qi "unique" 0003... && grep -q "enforce_coach_client_roles" 0003... && grep -v "^--" 0001... \| grep -q "enable row level security"` | ✅ created here | ⬜ pending |
| 2-02-02 | 02 | 2 | DB-03, DB-04 | T-02-04, T-02-05, T-02-08, T-02-23 | Recursion-safe SECURITY DEFINER helper created after coach_clients; caller coach-role checked; safe-field UPDATE policy; escalation guard for authenticated only | unit (grep gates on SQL) | `grep -q "private.is_coach_of" 0004... && grep -q "create schema if not exists private" ... && grep -qi "'coach'" ... && grep -qi "update" ... && grep -q "prevent_role_self_escalation" 0005... && grep -q "is distinct from" ... && grep -q "when (auth.role() = 'authenticated')" ...` | ✅ created here | ⬜ pending |
| 2-02-03 | 02 | 2 | DB-01, DB-02 | — | Generated types (real tables only) split from hand-written legacy chat contracts — no drift | unit (grep + typecheck) | `grep -q "coach_clients" database.generated.ts && grep -q "database.generated" database.types.ts && ! grep -q "conversations" database.generated.ts && pnpm --filter @fish/supabase typecheck` | ✅ created here | ⬜ pending |
| 2-02-04 | 02 | 2 | DB-01, DB-03, DB-04 | T-02-04, T-02-05, T-02-06, T-02-08, T-02-23, T-02-25 | `supabase db reset` clean in order (no 42P01); trigger never blocks signup; per-role RLS boundary (no 42P17); no self-escalation; role-integrity rejection | checkpoint:human-action (blocking) | Manual gate — `supabase db reset` exit 0; SQL DB-01/03/04 checks against local instance; regenerate types into `database.generated.ts`; `pnpm --filter @fish/supabase typecheck` + `pnpm build` | ❌ requires local stack | ⬜ pending |
| 2-03-01 | 03 | 3 | DB-02 | T-02-09, T-02-10, T-02-11 | Seed via real admin.createUser (email_confirm); pagination-safe idempotency; coach promoted before assignment; never raw auth.users insert | unit (grep gates) | `grep -q "admin.createUser" seed.ts && grep -q "already been registered" ... && grep -q "listUsers" ... && grep -q "coach_clients" ... && grep -q "email_confirm" ... && grep -q "\"seed\"" package.json && ! grep -q "insert into auth.users" seed.ts` | ✅ created here | ⬜ pending |
| 2-03-02 | 03 | 3 | DB-03, DB-04 | T-02-26 | RLS boundary asserted with anon-key sessions (subject to RLS), never the service-role key | unit (grep gates) | `grep -q "signInWithPassword" verify-rls.ts && grep -q "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" ... && ! grep -q "SERVICE_ROLE" verify-rls.ts && grep -q "\"verify:rls\"" package.json` | ✅ created here | ⬜ pending |
| 2-03-03 | 03 | 3 | DB-02, DB-03, DB-04 | T-02-09, T-02-26 | Idempotent seed (twice, zero dupes); scripted anon-session boundary passes (client/coach/escalation) | checkpoint:human-action (blocking) | Manual gate — `pnpm seed` twice (idempotent); `select count(*) from coach_clients` = 3; `pnpm verify:rls` exits 0 with all assertions PASS | ❌ requires local stack | ⬜ pending |
| 2-03-04 | 03 | 3 | DB-02 (deploy defer, D-14) | T-02-12 | Deferred hosted-setup steps documented; dev seed barred from prod | unit (grep gates) | `grep -q "Site URL" deploy-checklist.md && grep -q "auth/confirm" ... && grep -q "token_hash" deploy-checklist.md` | ✅ created here | ⬜ pending |
| 2-04-01 | 04 | 3 | AUTH-01, AUTH-02 | T-02-13 | Signup always creates client (only display_name sent); calm check-inbox; one primary; Suspense-wrapped useSearchParams | tdd (unit: RTL + typecheck) | `cd apps/web && pnpm test -- signup check-inbox --run && pnpm typecheck` | ✅ created here | ⬜ pending |
| 2-04-02 | 04 | 3 | AUTH-02 | T-02-15, T-02-16 | Server-side verifyOtp (no getSession); expired/used token → calm type-aware resend, never raw error; Suspense-wrapped | tdd (unit + grep + typecheck) | `grep -q "verifyOtp" route.ts && grep -q "expired-link" ... && ! grep -q "getSession" ... && grep -q "useSearchParams" expired-link/page.tsx && grep -q "Suspense" ... && pnpm test -- expired-link --run && pnpm typecheck` | ✅ created here | ⬜ pending |
| 2-04-03 | 04 | 3 | AUTH-05, AUTH-06 | T-02-14, T-02-16, T-02-17, T-02-27 | /home reads getUser (no getSession) + redirects signed-out to /login; one logout action; email uses token_hash not ConfirmationURL | tdd (unit + grep + typecheck) | `grep -q "getUser" home/page.tsx && grep -q "redirect" ... && ! grep -q "getSession" ... && grep -q "signOut" logout-button.tsx && grep -q "token_hash" confirmation.html && ! grep -q "ConfirmationURL" ... && pnpm test -- home --run && pnpm typecheck` | ✅ created here | ⬜ pending |
| 2-04-04 | 04 | 3 | AUTH-01, AUTH-02, AUTH-05, AUTH-06 | T-02-14..17, T-02-27 | End-to-end signup loop against local Supabase + Mailpit; real email, token_hash link, session persistence across restart; build gate green | checkpoint:human-verify (blocking, phase-gate) | Manual gate — `pnpm build` exit 0; signup → Mailpit verify → /home → refresh + restart → resend-on-expired → logout → signed-out redirect to /login | ❌ requires local stack + Mailpit | ⬜ pending |
| 2-05-01 | 05 | 4 | AUTH-03, AUTH-05 | T-02-19 | Login to /home; unverified → check-inbox (never scolds); bad creds → non-revealing field error; one primary | tdd (unit + grep + typecheck) | `grep -q "signInWithPassword" login/page.tsx && grep -q "check-inbox" ... && test $(grep -c 'variant="primary"' login/page.tsx) -eq 1 && pnpm test -- login --run && pnpm typecheck` | ✅ created here | ⬜ pending |
| 2-05-02 | 05 | 4 | AUTH-04 | T-02-18, T-02-20, T-02-21, T-02-28 | Non-enumerating reset (identical copy); recovery template hardcodes next=/reset-password (not via redirectTo); token_hash not ConfirmationURL | tdd (unit + grep + typecheck) | `grep -q "resetPasswordForEmail" forgot-password/page.tsx && ! grep -q "next=/reset-password" forgot-password/page.tsx && grep -q "updateUser" reset-password/page.tsx && grep -q "type=recovery" recovery.html && grep -q "next=/reset-password" recovery.html && grep -q "token_hash" ... && ! grep -q "ConfirmationURL" ... && pnpm test -- forgot-password reset-password --run && pnpm typecheck` | ✅ created here | ⬜ pending |
| 2-05-03 | 05 | 4 | AUTH-03, AUTH-04, AUTH-05 | T-02-18..22, T-02-28 | Login + recovery loop against local Supabase + Mailpit; Mailpit URL read to confirm type=recovery&next=/reset-password; recovery-session set-password; persistence; build gate | checkpoint:human-verify (blocking, phase-gate) | Manual gate — `pnpm build` exit 0; login/unverified-routing/non-enumerating reset/recovery-session set-password/refresh+restart walk; explicit Mailpit link inspection | ❌ requires local stack + Mailpit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** No run of 3+ consecutive tasks lacks an automated verify. The `auto`/`tdd` tasks (13 of 18) each carry a grep/typecheck/Vitest `<automated>` gate; the 5 checkpoints are blocking human gates covering exactly the behaviors jsdom cannot exercise (DB triggers/RLS, email delivery, session persistence). Every wave contains automated gates before its blocking checkpoint.

---

## Wave 0 Requirements

**No Vitest Wave 0 scaffolding needed.** Vitest 4.1.x + jsdom + RTL + `apps/web/vitest.config.ts` all exist from Phase 1 (71 passing tests). Each `tdd` task in plans 04/05 creates its own colocated `*.test.tsx` alongside the screen it tests (RED → GREEN within the task), so there is no separate stub-creation wave.

The only genuine prerequisites are **environment**, not test infrastructure, and are handled by the blocking checkpoint 2-01-01 (not a Wave 0 test task):
- [ ] Supabase CLI installed (`supabase --version`) — blocking prerequisite (2-01-01)
- [ ] Docker running (`docker info`) and `supabase start` succeeded — blocking prerequisite (2-01-01)
- [ ] `supabase/migrations/` directory — created by plan 02 (does not exist yet)

Files with **no automated harness** (Supabase client factories `lib/supabase/{client,server,proxy}.ts`, and the `/auth/confirm` Route Handler — no jsdom Route Handler harness) are intentionally verified by typecheck + grep gates and the manual phase-gate walks, per RESEARCH.md Wave 0 Gaps — not by unit tests.

---

## Manual-Only Verifications

These behaviors are not jsdom-testable (real Supabase Auth, RLS, Postgres triggers, email delivery via Mailpit, session persistence across a browser restart). Each is a **blocking checkpoint** in the plans.

| Behavior | Requirement | Checkpoint Task | Why Manual | Test Instructions (summary) |
|----------|-------------|-----------------|------------|-----------------------------|
| Supabase CLI + Docker up; packages legitimacy-verified & installed | AUTH-05 (foundation) | 2-01-01 (human-action) | CLI/Docker install + `supabase start` cannot be scripted reliably across environments; package-legitimacy checkpoint is never auto-approved | Install CLI, start Docker, `supabase start`/`supabase status`; verify both `@supabase/*` versions on npmjs.com before `pnpm add` |
| Migrations apply in order; trigger/RLS/escalation/role-integrity guards | DB-01, DB-03, DB-04 | 2-02-04 (human-action) | Triggers, RLS boundaries, and 42P17/42P01 checks require a running Postgres — not jsdom | `supabase db reset` clean; metadata-less signup → 1 client profile; safe-field UPDATE succeeds but role UPDATE rejected; per-role SELECT boundary; regenerate types |
| Seed idempotency + scripted anon-session RLS boundary | DB-02, DB-03, DB-04 | 2-03-03 (human-action) | Seed runs against the live admin API; RLS proof needs real anon sessions | `pnpm seed` twice (idempotent, zero dupes); `coach_clients` = 3; `pnpm verify:rls` exits 0 all-PASS |
| Full signup loop: email delivery, token_hash link, session persistence | AUTH-01, AUTH-02, AUTH-05, AUTH-06 | 2-04-04 (human-verify, phase-gate) | Mailpit email, server-side session issuance, and browser-restart persistence are outside jsdom | `pnpm build` green; signup → Mailpit verify → /home → refresh + restart → resend-on-expired → logout → signed-out /home redirects to /login |
| Login + recovery loop with Mailpit URL inspection | AUTH-03, AUTH-04, AUTH-05 | 2-05-03 (human-verify, phase-gate) | Recovery email URL params, recovery-session set-password, and persistence are outside jsdom | `pnpm build` green; login/unverified-routing/non-enumerating reset; read Mailpit link for `type=recovery&next=/reset-password`; set-password → /home; refresh + restart |

---

## Scope-Density Note (checker warning — informational)

Plans 02-02, 02-03, and 02-04 each carry 4 tasks touching 7–9 files (upper warning band). Per the checker's own recommendation, these are **not** split: each plan is a single coherent work unit (a complete DB tier, a complete seed+verify tier, a complete signup-loop slice), and splitting would fracture that cohesion without reducing per-task context. No action taken.

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a documented blocking-checkpoint gate (13 automated + 5 blocking checkpoints = all 18 tasks mapped)
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all prerequisites — no Vitest scaffolding needed (infra exists from Phase 1); environment prereqs handled by blocking checkpoint 2-01-01
- [x] No watch-mode flags — all UI runs use `--run`
- [x] Feedback latency < 45s for every automated gate
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
