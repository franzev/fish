# Phase 2: Secure account you can return to - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The full linear email/password auth loop — sign up → verify by email → log in → stay logged in across refresh and restart → log out → password reset — backed by the project's first real database: Supabase migrations for a hardened `profiles` table (row auto-created on signup by a trigger that never silently blocks signup), a `coach_clients` relationship table with a seed script, server-enforced roles (signup always creates clients; coach is seed-only), and RLS on every table. Covers AUTH-01..06 and DB-01..04.

Out of scope: protected routing middleware redirects, app shell, and role-aware homes (Phase 3 — ROUT-01..04, SHEL-01..02); chat (Edge Function stays a stub); OAuth/MFA/role pickers (explicitly barred); assignment UI (seed-only this milestone); hosted/production Supabase setup (deploy-time checklist).

</domain>

<decisions>
## Implementation Decisions

### Auth screens & post-login landing
- **D-01:** Post-login destination this phase is ONE neutral authenticated placeholder (`/home`): a calm "you're signed in" confirmation plus the log out action. It proves session persistence (AUTH-05) and logout (AUTH-06). Phase 2 does NOT stub `/chat` or `/coach` and does no role-based redirects — Phase 3 owns those.
- **D-02:** Top-level human-friendly routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`. The only namespaced route is the machine endpoint `/auth/confirm` required by the token-hash email verification flow.
- **D-03:** Auth screens are a centered Card from the Phase 1 kit: Fraunces heading, form fields, exactly one primary Button, and a quiet text link to the sibling flow ("New here? Create account"). Reuses Card's elevation treatment as shown on `/kit`.
- **D-04:** Signup asks for email + password + name. `profiles.display_name` gets a real value from day one so Phase 3's coach home lists clients by name, not raw emails. Three fields is still a calm form.

### Verification & recovery edge cases
- **D-05:** An unverified user attempting login is routed back to the same calm "check your inbox" screen from signup, whose single action is resend. One screen owns the not-verified-yet state; login never scolds, it just routes.
- **D-06:** Expired or already-used email links (verify AND reset) land on one dedicated calm expired-link screen with a single action: send a fresh link (email pre-filled when known). Explains and guides, never blames.
- **D-07:** Password reset never reveals account existence: the same calm success message shows whether or not the email has an account ("If that address has an account, a reset link is on its way"). No account-enumeration, no dead-end error state.
- **D-08:** Successful email links land the person signed in at `/home` — both email verification and reset-plus-new-password create a session directly. Fully linear: sign up → click link → you're in. Zero credential re-typing.

### Coach-client schema & seed script
- **D-09:** Relationship is a `coach_clients` join table (`coach_id`, `client_id`, `assigned_at`) with a UNIQUE constraint on `client_id` — one coach per client enforced by the database today; multiple coaches or history later is a constraint change, not a remodel. RLS reads go through SECURITY DEFINER helpers (avoids policy recursion).
- **D-10:** Seed creates one coach account plus ~3 pre-verified client accounts already assigned to that coach, all with fixed, documented dev credentials — Phase 3's coach home has real rows on day one, and any account can be logged into to test RLS boundaries.
- **D-11:** The seed is a TypeScript admin script (pnpm script) using the service-role key and `supabase.auth.admin.createUser` with email pre-confirmed — users pass through the real auth machinery so the DB-01 profile trigger fires exactly as in production. Idempotent; works against local and hosted. NOT raw inserts into `auth.users` via seed.sql.
- **D-12:** Reassignment replaces: `coach_clients` always holds exactly the current truth (one live row per client, `assigned_at` the only timestamp). No history/audit table this milestone — reassignment is seed/manual-only anyway.

### Supabase environment & email delivery
- **D-13:** Development runs against local Supabase via the CLI (`supabase start`, Docker). Migrations and seed run locally; the bundled mail-catcher (Mailpit) captures every verification/reset email — no real email sending, no rate limits during dev.
- **D-14:** Local only this phase. Creating/linking the hosted project, Site URL, redirect allow-list, and production email templates become a documented deploy-time checklist (deliverable of this phase as a doc, executed when the app first deploys).
- **D-15:** Both email templates (verify + reset) are rewritten in full FISH voice: calm sentence-case copy, plain single-column layout, one clear action link, expiry stated as fact not threat. They must be edited anyway to point at `{{ .SiteURL }}/auth/confirm` with `token_hash` — the voice pass rides along.
- **D-16:** Password minimum is 8 characters, configured in Supabase and stated upfront in the signup field's hint ("at least 8 characters"). No complexity rules (no forced symbols/uppercase). Strength meters/breach checks stay v2 (AUTH-V2-01).

### Claude's Discretion
- Env var and secret layout (`.env.local`, committed `.env.example`, service-role key confined to the seed script's environment — never `NEXT_PUBLIC`).
- Exact screen and email copy — drafted in FISH voice (sentence case, plain verbs, never scolds), reviewed at phase verification.
- pnpm script names wrapping the local Supabase workflow (start/reset/seed).
- RLS policy structure and SECURITY DEFINER helper details, following the pinned pitfalls in STATE.md research notes.
- Session/cookie refresh mechanics per the pinned `@supabase/ssr` pattern (Next.js 16 `proxy.ts`, `getUser()` server-side, cookies written to both request and response).
- Exact `profiles` columns beyond id / role / display_name / timestamps.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & requirements
- `AGENTS.md` — Non-negotiable design rules (one primary action, 56px targets, copy never scolds, assigned-never-chosen), stack lock, API boundary, build order.
- `.planning/REQUIREMENTS.md` — AUTH-01..06 and DB-01..04 requirement texts; v2 deferrals (AUTH-V2-01, COAC-01/02, THEM-01/02); out-of-scope table (no OAuth/MFA/role picker).
- `.planning/ROADMAP.md` — Phase 2 goal and the four success criteria (the "must be TRUE" statements); Phase 3 dependencies on this phase's schema.

### Prior phase & research (pinned technical decisions)
- `.planning/phases/01-monochrome-design-system-you-can-see/01-CONTEXT.md` — Design decisions the auth screens inherit: Alert component for form-level messages (D-10), notice/error two-tier field language (D-08/09), two-tone focus ring, `light-dark()` theme mechanism.
- `.planning/STATE.md` — Accumulated context: pinned versions (`@supabase/ssr@0.12.0`, `@supabase/supabase-js@2.110.0`, Next.js 16 `proxy.ts`), critical pitfalls (never `getSession()` server-side; SECURITY DEFINER idempotent `handle_new_user` trigger; one middleware response with cookies on request AND response; `token_hash` + `verifyOtp()` not legacy `ConfirmationURL`; role in `profiles` mirrored to `app_metadata`).
- `.planning/research/SUMMARY.md` — Milestone research the pins came from.

### Existing code this phase extends
- `packages/supabase/src/auth.ts` — `FishAuthClaims`, `authRedirects` (signedOut/clientHome/coachHome paths — Phase 2 adds its interim `/home` alongside, without wiring role redirects).
- `packages/supabase/src/database.types.ts` — Existing hand-written table types (profiles/conversations/messages); regenerate or align once real migrations exist.
- `packages/core/src/roles.ts` — `UserRole` union + `isUserRole()` guard; the only role vocabulary.
- `supabase/config.toml` — Project config; gains local auth settings (password min length, email template paths, Site URL for local).
- `apps/web/components/ui/` — Button, Input (notice/error tiers), Card, Alert — auth screens compose these, never hand-roll controls.
- `apps/web/app/kit/page.tsx` — The visual contract; auth screens are judged against it.
- `.planning/phases/01-monochrome-design-system-you-can-see/01-PATTERNS.md` — Component/code patterns mapped during Phase 1.

### Codebase analysis
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries, anti-patterns (multi-choice UI, raw hex), error-handling voice.
- `.planning/codebase/INTEGRATIONS.md` — Supabase integration status (client NOT yet integrated anywhere; no env vars; no migrations — this phase creates all three).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1 kit: `Button` (primary/secondary/ghost, loading overlay), `Input` (label/hint + notice/error tiers), `Card` (elevation), `Alert` (notice/error/success, Tabler icons) — every auth screen composes these; form-level messages use Alert, field-level uses Input's tiers.
- `cn()` in `apps/web/lib/utils.ts`; monochrome `light-dark()` tokens in `apps/web/app/globals.css`; Lexend/Fraunces already loaded in `apps/web/app/layout.tsx`.
- 71 passing Vitest tests (WCAG contrast, focus-ring tripwire, icon-source guard) — new auth code must not break them; the test harness is already set up for new tests.

### Established Patterns
- Tailwind v4 CSS-first (`@theme` in globals.css; NEVER create tailwind.config.js; `tailwindcss` and `@tailwindcss/postcss` stay version-identical).
- Named exports, `forwardRef` + `displayName` on focusable controls, props extend native HTML attributes, no raw hex.
- Shared contracts flow from `packages/core` (domain) and `packages/supabase` (Supabase-specific); web imports via workspace names `@fish/core` / `@fish/supabase`.
- pnpm only; `pnpm build` must pass before any commit.

### Integration Points
- New routes in `apps/web/app/`: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/home` (interim authenticated placeholder), `/auth/confirm` (token-hash endpoint), the check-inbox screen, and the expired-link screen.
- `apps/web/proxy.ts` (Next.js 16 middleware rename) — session refresh only this phase; route protection expands in Phase 3.
- `packages/supabase` — browser/server client factories (`@supabase/ssr`), regenerated `database.types.ts`.
- `supabase/migrations/` (new) — profiles, coach_clients, trigger, RLS policies, SECURITY DEFINER helpers; `supabase/config.toml` — local auth config + email template paths.
- Seed script (TypeScript, service-role) wired as a pnpm script.
- **Caveat:** PROJECT.md notes the monorepo scaffold (package.json, pnpm-workspace.yaml, packages/, parts of apps/web) is still untracked in git — commit it before Phase 2 execution builds on it.

</code_context>

<specifics>
## Specific Ideas

- The loop should feel fully linear with zero dead ends: every screen (including every unhappy path) has exactly one action, and email links drop you signed-in at `/home` — never back at a login form to re-type what you just proved.
- The inbox is part of the product: verification and reset emails read in the same calm FISH voice as the screens.
- Errors route rather than scold — an unverified login attempt isn't an error message, it's a redirect to the screen that already knows what to do.

</specifics>

<deferred>
## Deferred Ideas

- **Custom SMTP provider (e.g. Resend)** — deferred until real users onboard / deliverability matters; local dev uses the mail-catcher, and the hosted checklist notes the built-in sender's rate limits.
- **Assignment history / audit trail** (append-with-active-flag on `coach_clients`) — deferred until a real need appears; schema chosen so it's a constraint/column addition, not a remodel.
- Pre-existing v2 items reaffirmed in passing: AUTH-V2-01 (password strength/breach feedback), COAC-01/02 (in-app assignment, coach signup), THEM-01/02 (theme toggle, token pipeline).

</deferred>

---

*Phase: 2-Secure account you can return to*
*Context gathered: 2026-07-03*
