# Phase 2: Secure account you can return to - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 2-Secure account you can return to
**Areas discussed:** Auth screens & post-login landing, Verification & recovery edge cases, Coach-client schema & seed script, Supabase environment & email delivery

---

## Auth screens & post-login landing

| Option | Description | Selected |
|--------|-------------|----------|
| One neutral placeholder | Single minimal authenticated page (/home): calm signed-in confirmation + log out; Phase 3 replaces with role-based redirects | ✓ |
| Stub /chat and /coach now | Create role redirect targets as placeholders and route by role at login (pulls Phase 3's ROUT-02/03 forward) | |
| You decide | | |

**User's choice:** One neutral placeholder

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level: /login, /signup… | /login, /signup, /forgot-password, /reset-password; only /auth/confirm namespaced (token-hash endpoint) | ✓ |
| All under /auth/* | Everything namespaced; tidier folders, longer URLs | |
| You decide | | |

**User's choice:** Top-level routes

| Option | Description | Selected |
|--------|-------------|----------|
| Centered card | One Card from the Phase 1 kit: Fraunces heading, single primary Button, quiet text link to sibling flow | ✓ |
| Bare centered form | No card surface; form directly on page background | |
| You decide | | |

**User's choice:** Centered card

| Option | Description | Selected |
|--------|-------------|----------|
| Email + password + name | profiles.display_name real from day one; Phase 3 coach home lists names not emails | ✓ |
| Email + password only | Absolute minimum fields; display_name falls back to email prefix | |
| You decide | | |

**User's choice:** Email + password + name

---

## Verification & recovery edge cases

| Option | Description | Selected |
|--------|-------------|----------|
| Return to check-inbox screen | Same calm post-signup screen owns the not-verified state; resend is its single action | ✓ |
| Alert on the login screen | Stay on /login with kit Alert + inline resend; login carries two actions | |
| You decide | | |

**User's choice:** Return to check-inbox screen

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated expired-link screen | One calm screen, single action (send fresh link, email pre-filled when known); serves verify + reset | ✓ |
| Login with an Alert | Redirect to /login with Alert explaining; login inherits extra state | |
| You decide | | |

**User's choice:** Dedicated expired-link screen

| Option | Description | Selected |
|--------|-------------|----------|
| Same calm success either way | "If that address has an account, a link is on its way" — no account enumeration | ✓ |
| Honest not-found message | Helpful for typos but leaks which emails have accounts | |
| You decide | | |

**User's choice:** Same calm success either way

| Option | Description | Selected |
|--------|-------------|----------|
| Signed in, straight to /home | Verify and reset both land in-session; fully linear, zero re-typing | ✓ |
| Bounce to login first | Links confirm, then land on /login with "all set — log in" note | |
| You decide | | |

**User's choice:** Signed in, straight to /home

---

## Coach-client schema & seed script

| Option | Description | Selected |
|--------|-------------|----------|
| Join table, one coach per client | coach_clients (coach_id, client_id, assigned_at) + UNIQUE(client_id); future-relaxable; clean RLS via SECURITY DEFINER helpers | ✓ |
| coach_id column on profiles | Simplest but mixes relationship into profiles; tangles RLS | |
| You decide | | |

**User's choice:** Join table, one coach per client

| Option | Description | Selected |
|--------|-------------|----------|
| Coach + 3 assigned clients | Pre-verified accounts with fixed documented dev credentials; coach home has rows day one | ✓ |
| Coach + unassigned clients too | Adds RLS-boundary and empty-state test accounts | |
| Coach account only | Leanest; clients via real signups | |
| You decide | | |

**User's choice:** Coach + 3 assigned clients

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript admin script | pnpm script, service-role key, auth.admin.createUser (email pre-confirmed); real trigger fires; idempotent; local + hosted | ✓ |
| supabase/seed.sql | Standard local flow but direct auth.users inserts are fragile and bypass the DB-01 trigger | |
| You decide | | |

**User's choice:** TypeScript admin script

| Option | Description | Selected |
|--------|-------------|----------|
| Replace — one live row | coach_clients holds current truth only; assigned_at only timestamp; history deferred | ✓ |
| Append with active flag | Full history from day one; every policy/query filters to active | |
| You decide | | |

**User's choice:** Replace — one live row

---

## Supabase environment & email delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Local via Supabase CLI | supabase start (Docker); Mailpit catches all auth emails; instant resets; no rate limits | ✓ |
| Hosted dev project | Real cloud project from the start; no Docker but rate-limited sender, slower resets | |
| You decide | | |

**User's choice:** Local via Supabase CLI

| Option | Description | Selected |
|--------|-------------|----------|
| Local only this phase | Hosted setup (link, Site URL, redirect allow-list, prod templates) becomes a deploy-time checklist doc | ✓ |
| Hosted project now too | Prove real deliverability early; adds account setup + secrets + rate limits to phase | |
| You decide | | |

**User's choice:** Local only this phase

| Option | Description | Selected |
|--------|-------------|----------|
| Full FISH voice | Rewrite both templates: calm sentence case, plain single-column, one action link, factual expiry | ✓ |
| Fix links, keep default copy | Minimum edit for token-hash flow; voice pass deferred | |
| You decide | | |

**User's choice:** Full FISH voice

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum 8, stated upfront | Supabase min 8; hint says "at least 8 characters"; no complexity rules | ✓ |
| Supabase default (6) | Least friction, weakest baseline | |
| You decide | | |

**User's choice:** Minimum 8, stated upfront

---

## Claude's Discretion

- Env var and secret layout (.env.local, .env.example, service-role key confined to seed script)
- Exact screen and email copy (FISH voice, reviewed at verification)
- pnpm script names for the local Supabase workflow
- RLS policy structure and SECURITY DEFINER helper details (per STATE.md pinned pitfalls)
- Session/cookie refresh mechanics per pinned @supabase/ssr pattern
- Exact profiles columns beyond id / role / display_name / timestamps

## Deferred Ideas

- Custom SMTP provider (e.g. Resend) — when real users onboard / deliverability matters
- Assignment history / audit trail on coach_clients — when a real need appears
- Reaffirmed v2: AUTH-V2-01, COAC-01/02, THEM-01/02

**Session note:** Discussion paused once after Area 1 (user dismissed the continuation prompt) and resumed on request; checkpoint file preserved progress across the pause.
