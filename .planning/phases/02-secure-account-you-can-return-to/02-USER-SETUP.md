# Phase 2: User Setup Required

**Generated:** 2026-07-03
**Phase:** 02-secure-account-you-can-return-to
**Status:** Complete (this machine — done during plan 02-01 execution)

Local Supabase (Postgres + Auth + Mailpit) via Docker is required for every migration, seed, and email-capture task this phase (D-13). All items below were completed during plan 02-01 execution on this machine; keep this checklist for any fresh machine.

## Environment Variables

All three live in `apps/web/.env.local` (gitignored; `apps/web/.env.example` is the committed contract).

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [x] | `NEXT_PUBLIC_SUPABASE_URL` | `supabase status` after `supabase start` (local: http://127.0.0.1:54321) | `apps/web/.env.local` |
| [x] | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `supabase status` — the `PUBLISHABLE_KEY` line (`sb_publishable_...`) | `apps/web/.env.local` |
| [x] | `SUPABASE_SERVICE_ROLE_KEY` | `supabase status` — the `SERVICE_ROLE_KEY` line (seed script only, never `NEXT_PUBLIC_`) | `apps/web/.env.local` |

## Machine Setup

- [x] **Install Supabase CLI**
  - Command: `brew install supabase/tap/supabase` (macOS)
  - Installed: v2.109.0 during plan 02-01
  - Skip if: `supabase --version` already prints a version
- [x] **Start Docker Desktop (or Colima/OrbStack)**
  - `docker info` must succeed before `supabase start` will work
- [x] **Start local Supabase**
  - Command: `supabase start` from the repo root
  - First run pulls ~13 images (several minutes); later runs are fast

## Verification

```bash
supabase --version   # prints a version
docker info          # exits 0
supabase status      # prints API URL http://127.0.0.1:54321 + keys
grep SUPABASE apps/web/.env.local   # three vars populated
```

Expected: local API at `http://127.0.0.1:54321`, Mailpit at `http://127.0.0.1:54324`, Studio at `http://127.0.0.1:54323`.

---

**Once all items complete:** Mark status as "Complete" at top of file. (Done for this machine.)
