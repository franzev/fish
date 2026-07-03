---
phase: 02-secure-account-you-can-return-to
plan: 01
subsystem: auth
tags: [supabase, supabase-ssr, nextjs, proxy, session-refresh, config-toml]

# Dependency graph
requires:
  - phase: 01-monochrome-design-system-you-can-see
    provides: monorepo scaffold, apps/web Next.js app, packages/supabase contracts
provides:
  - Running local Supabase stack (Postgres + Auth + Mailpit) via CLI 2.109.0 + Docker
  - Pinned @supabase/supabase-js@2.110.0 + @supabase/ssr@0.12.0 in apps/web
  - Three-client SSR factories (browser / server / proxy) in apps/web/lib/supabase/
  - Next.js 16 proxy.ts session-refresh entry at the apps/web app root (AUTH-05 foundation)
  - authRedirects.home (/home interim landing, D-01)
  - config.toml [auth] section verified against the CLI's generated schema
  - Token-hash email template placeholders registered (plans 04/05 own the voice pass)
  - Committed env contract (.env.example) + gitignored .env.local
affects: [02-02, 02-03, 02-04, 02-05, phase-3-routing]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js@2.110.0", "@supabase/ssr@0.12.0", "Supabase CLI 2.109.0 (brew)"]
  patterns:
    - "Three-client Supabase pattern: lib/supabase/{client,server,proxy}.ts — no ad-hoc createClient calls"
    - "getUser()/getClaims() only server-side; .getSession( is a grep-gated review failure"
    - "updateSession constructs exactly ONE NextResponse and writes cookies to both request and response"

key-files:
  created:
    - apps/web/lib/supabase/client.ts
    - apps/web/lib/supabase/server.ts
    - apps/web/lib/supabase/proxy.ts
    - apps/web/proxy.ts
    - apps/web/.env.example
    - supabase/templates/confirmation.html
    - supabase/templates/recovery.html
    - .planning/phases/02-secure-account-you-can-return-to/02-USER-SETUP.md
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
    - .gitignore
    - packages/supabase/src/auth.ts
    - supabase/config.toml

key-decisions:
  - "Client factories stay untyped until plan 02 regenerates database.types.ts — the hand-written Database placeholder doesn't match the real schema"
  - "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY uses the new-style sb_publishable_ key; SUPABASE_SERVICE_ROLE_KEY uses the legacy JWT (local instance issues both — RESEARCH assumption A1 resolved)"
  - "updateSession constructs exactly ONE NextResponse (plan's Pitfall-5 gate), stricter than the official skeleton"
  - "Placeholder email templates already point at {{ .SiteURL }}/auth/confirm?token_hash= links so even placeholders are functionally correct (Pitfall 6)"

patterns-established:
  - "Three-client Supabase SSR pattern: browser (Client Components), server (Server Components/Route Handlers), proxy (session refresh)"
  - "Supabase CLI runtime dirs (supabase/.branches, supabase/.temp) are gitignored"

requirements-completed: [AUTH-05]

# Metrics
duration: 21min
completed: 2026-07-03
---

# Phase 2 Plan 01: Supabase Integration Plumbing Summary

**Local Supabase (Postgres + Auth + Mailpit) running via CLI + Docker, pinned @supabase packages installed, three-client SSR factories wired, Next.js 16 proxy.ts refreshing sessions to both request and response, and config.toml [auth] keys verified against the CLI's actual generated schema**

## Performance

- **Duration:** 21 min (excludes checkpoint wait)
- **Started:** 2026-07-02T23:54:02Z
- **Completed:** 2026-07-03T00:15:41Z
- **Tasks:** 3 (1 blocking human-action checkpoint + 2 auto)
- **Files modified:** 13

## Accomplishments

- Local Supabase stack running at http://127.0.0.1:54321 (Mailpit at :54324, Studio at :54323) — the walking backbone every AUTH-*/DB-* task this phase depends on
- `apps/web/lib/supabase/{client,server,proxy}.ts` — the three factories every later screen imports; `pnpm build` recognizes `ƒ Proxy (Middleware)`, proving the Next.js 16 proxy entry is wired
- Session refresh (AUTH-05 foundation): one NextResponse, cookies written to both request and response, `getClaims()` immediately after client creation, no route protection (Phase 3 owns that)
- `config.toml` auth keys placed under CLI-verified sections: `minimum_password_length = 8` under `[auth]` (D-16), `enable_confirmations = true` under `[auth.email]`, both template paths registered — `supabase start` accepts the config with no unknown-key errors
- `authRedirects.home` added without touching existing keys

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify CLI + Docker, install pinned packages (checkpoint:human-action)** - `e1ba19d` (chore) — approved by user after npm-registry legitimacy verification
2. **Task 2: Env files, three-client SSR factories, proxy entry** - `b86b463` (feat)
3. **Task 3: authRedirects.home + local [auth] config** - `7751d01` (feat)

## Files Created/Modified

- `apps/web/lib/supabase/client.ts` - createBrowserClient factory for Client Components
- `apps/web/lib/supabase/server.ts` - createServerClient factory with getAll/setAll cookie contract; setAll try/catch swallow for Server Component calls
- `apps/web/lib/supabase/proxy.ts` - updateSession(): single NextResponse, dual cookie writes, getClaims() with no logic in between
- `apps/web/proxy.ts` - Next.js 16 proxy entry (apps/web app root) with static-asset-excluding matcher
- `apps/web/.env.example` - committed three-key env contract (empty values)
- `apps/web/.env.local` - populated from `supabase status` (gitignored, never committed)
- `.gitignore` - `.env*.local` + Supabase CLI runtime dirs
- `packages/supabase/src/auth.ts` - authRedirects.home added, existing keys preserved
- `supabase/config.toml` - [auth] + [auth.email] + two template registrations
- `supabase/templates/{confirmation,recovery}.html` - token-hash placeholder templates (deviation, see below)
- `apps/web/package.json` / `pnpm-lock.yaml` - pinned @supabase deps

## Decisions Made

- Client factories left untyped this plan: the hand-written `Database` placeholder in `packages/supabase` doesn't match the real schema (and likely fails supabase-js's GenericSchema constraint); plan 02 regenerates real types and wires the generic. Import path will be `@fish/supabase` per the barrel re-export.
- Env keys: publishable key uses the new-style `sb_publishable_...` value; service-role uses the legacy JWT (both issued simultaneously by this CLI version — resolves RESEARCH assumption A1). Var names match the plan's contract exactly.
- `supabase/.branches/` and `supabase/.temp/` (CLI runtime state) gitignored rather than committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created placeholder email templates so config.toml validates**
- **Found during:** Task 3 (VERIFY-AGAINST-CLI step)
- **Issue:** The CLI validates that `content_path` files exist at start time: `Invalid config for auth.email.template.confirmation.content_path: open supabase/templates/confirmation.html: no such file or directory`. The plan registers the paths now but authors the HTML in plans 04/05 — as written, `supabase start` fails.
- **Fix:** Created minimal placeholder templates that already use the correct `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` link shape (Pitfall 6), so they are functionally correct even before the FISH-voice pass in plans 04/05.
- **Files modified:** supabase/templates/confirmation.html, supabase/templates/recovery.html
- **Verification:** `supabase stop && supabase start` succeeds with no config errors
- **Committed in:** 7751d01 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for the plan's own VERIFY-AGAINST-CLI gate to pass. Plans 04/05 replace template content, not structure. No scope creep.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Placeholder email template copy | supabase/templates/confirmation.html, supabase/templates/recovery.html | Intentional — plans 04/05 own the FISH-voice rewrite (D-15); links already use the token-hash pattern so the flow works meanwhile |
| Untyped Supabase clients | apps/web/lib/supabase/{client,server}.ts | Intentional — plan 02 regenerates database.types.ts from the real schema and wires the Database generic |

## Issues Encountered

- **Worktree destroyed at checkpoint pause:** after the Task 1 checkpoint return, the original worktree and its branch were removed by the orchestrator; on resume the shell landed in the main repo on `main`. Recreated the worktree at the same path and a fresh `worktree-agent-ae99521dbaa1966cc` branch from the same base commit (b605c2a). No work was lost (zero repo changes existed at checkpoint time).
- **First-run Docker image pulls are slow and quiet:** ~13 images pulled over several minutes with no visible progress via `docker images` polling; resolved by waiting (foreground pull test confirmed registry access was fine).
- Pre-existing `vite@8` peer warning (`@types/node >=22.12.0` wanted, 22.10.7 installed) — out of scope (tracked in STATE.md todos), not fixed.

## Authentication Gates

- **Task 1 (planned checkpoint:human-action, package-legitimacy gate):** Supabase CLI was not installed; I automated `brew install supabase/tap/supabase` (v2.109.0), confirmed Docker running, then stopped for the blocking gate. User approved after orchestrator verified both packages on the npm registry (official supabase org, no install hooks). Then ran `pnpm add`, `supabase start`, `supabase status` as planned.

## User Setup Required

**External tooling was configured during execution.** See [02-USER-SETUP.md](./02-USER-SETUP.md) — Status: Complete for this machine (CLI installed, Docker running, `.env.local` populated). The checklist remains for fresh machines.

## Next Phase Readiness

- Local Supabase running; three client factories and proxy session refresh in place — plan 02 (migrations + generated types) can begin immediately
- `supabase status` keys documented in `.env.local`; seed script (plan 03) will consume `SUPABASE_SERVICE_ROLE_KEY`
- Template paths already registered in config — plans 04/05 only edit HTML content, no config change or restart-ordering concern

## Self-Check: PASSED

- All 8 created files verified present on disk (`[ -f ]`)
- All 3 task commits found in `git log` (e1ba19d, b86b463, 7751d01)
- Plan-level verification re-run: `supabase status` prints URL + keys; `pnpm build` (web build + shared package typechecks) exits 0; no `.getSession(` in server.ts/proxy.ts/app-root proxy.ts; `.env.local` git-ignored; proxy.ts at apps/web app root recognized as `ƒ Proxy (Middleware)`

---
*Phase: 02-secure-account-you-can-return-to*
*Completed: 2026-07-03*
