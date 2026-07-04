---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 03-04-PLAN.md
last_updated: "2026-07-04T04:12:42.459Z"
last_activity: 2026-07-04
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# Project State: FISH — Monochrome Foundations

**Last updated:** 2026-07-03

## Project Reference

- **Core value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.
- **Current milestone:** Monochrome Foundations (design system + auth foundation)
- **Current focus:** Phase 03 — role-aware-home

## Current Position

Phase: 03 (role-aware-home) — EXECUTING
Plan: 4 of 4

- **Phase:** 3 — Role-aware home
- **Plan:** 4 of 4
- **Status:** Phase complete — ready for verification
- **Progress:** [██████████] 100%

## Roadmap Snapshot

| Phase | Goal (short) | Requirements | Status |
|-------|--------------|--------------|--------|
| 1 | Dual-theme monochrome tokens + hardened UI kit, provable on a demo page | TOKN-01..06, KIT-01..06 | Complete |
| 2 | Full linear auth loop backed by hardened profiles + coach-client schema with RLS | AUTH-01..06, DB-01..04 | Complete |
| 3 | App shell, protected routing, calm role-aware landings | SHEL-01..02, ROUT-01..04 | Not started |

## Performance Metrics

- **Phases planned:** 3
- **Phases complete:** 2
- **Plans complete:** 12
- **Requirements mapped:** 28 / 28

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 12 min | 3 | 10 |
| 01 | 02 | 8 min | 2 | 6 |
| 01 | 03 | 41 min | 3 | 9 |
| 02 | 07 | 2 min | 3 | 4 |
| 02 | 08 | 47 min | 3 | 11 |
| Phase 03 P01 | 42min | 4 tasks | 15 files |
| Phase 03 P02 | 8min | 1 tasks | 4 files |
| Phase 03 P03 | 15min | 3 tasks | 5 files |
| Phase 03 P04 | 3min | 2 tasks | 8 files |

## Accumulated Context

### Decisions (from PROJECT.md, carried into roadmap)

- Pure monochrome first, no color tokens — hierarchy before color; color is a deliberate later layer.
- Light + dark themes from day one — tokens must support both schemes; retrofitting is costlier.
- Coach accounts are seed-only; assignment is seed-only this milestone (schema + RLS + coach view make the relationship real, UI deferred).
- Signup always creates clients; role escalation is a manual act.
- Tabler Icons as the only icon set; Lexend (body) + Fraunces (display) as the type pairing.

### Decisions (from execution)

- 01-01: Border tokens tuned darker/lighter than plan proposal (light 0.64/0.55-strong, dark 0.55/0.65-strong) — plan values failed the WCAG 3:1 UI gate; the contrast test is the acceptance gate.
- 01-01: Contrast test parses globals.css at test time — single source of truth, token edits auto-re-verified.
- 01-01: `--color-primary-press` name kept (semantic, not hue) so Button hover/active classes carry forward.
- 01-01: Vitest locked as the test framework (first test infrastructure; jsdom + RTL + jest-dom, @/ alias).
- 01-02: `--shadow-card` uses a single shadow layer (not a two-layer shadow) to avoid comma-parsing ambiguity between `light-dark()`'s two arguments and `box-shadow`'s own comma-separated layer list inside the Tailwind v4 `@theme` block.
- 01-02: Input's disabled field reuses `disabled:opacity-50`, matching Button's existing disabled treatment, for a consistent calm/dim disabled language across the kit.
- 01-03: Theme overrides must be stylesheet `color-scheme` rules (`data-kit-theme` attribute on html), never inline `style.colorScheme` — Lightning CSS downlevels `light-dark()` into a prefers-color-scheme variable polyfill that only build-time-visible `color-scheme` declarations can flip. Verify theme work against the *served* CSS, not the authored CSS.
- 01-03: Layout-stability contract — no control changes size on state change: loading overlays an absolutely-centered spinner over the still-mounted `opacity-0` label, Button variants share a constant border width, and active states signal with color only (never a font-weight flip).
- 02-06: `supabase/config.toml` `site_url`/`additional_redirect_urls` must be `http://localhost:3001`, not `http://127.0.0.1:3001` — Supabase session cookies are host-scoped, and Next.js's post-verify redirect lands the browser on `localhost` regardless of the incoming request host, so a `127.0.0.1` link plants a cookie the browser never sees again. Pin the dev port explicitly (`next dev -p 3001`) AND match the host the browser actually navigates on.
- 02-07: Message row spacing (`mt-2`) moved from each conditional `<p>` onto the single persistent container so the gap above the message is also constant, not just the row height — extends the phase-01 layout-stability contract (Button's overlay spinner) to Input's hint/notice/error row.
- 02-08: Layout-stability now extends to "notices never reflow the card" — /expired-link and /check-inbox float their result notice above the vertically-centered Card as an always-mounted, out-of-flow (`absolute`, `bottom-full`), fading (`animate-fade-in`, reduced-motion-safe) `aria-live="polite"` overlay, so the card's own box is never touched by notice visibility, superseding an initial reserved-invisible-row fix the user rejected at checkpoint.
- 02-08: Alert tones are now deliberately distinguished by hue as well as shape/weight — calm, desaturated semantic tokens (`--color-error` soft coral, `--color-warning` soft amber, `--color-success` sage green; chroma <= 0.15, `light-dark()` pairs, contrast-test gated) back Alert's `notice|warning|error|success` tones. This is a scoped, documented exception to the phase-01 "distinguish never by hue" rule — `--color-notice` stays neutral/monochrome.
- 02-08: Button non-activation no longer relies on `pointer-events-none` (it silently suppressed the button's own cursor, blocking `cursor-progress`/`cursor-not-allowed` from ever rendering). Disabled buttons are inert via the native HTML `disabled` attribute (blocks click + keyboard); loading buttons are inert via an explicit click-guard (`preventDefault` + early return before the consumer `onClick`), attached only when a consumer `onClick` exists (keeps Server-Component call sites with no handler prerender-safe).
- 02-08 (post-approval polish): Input's reserved message row `mt-2` → `mt-1` and every auth form's `space-y-5` → `space-y-1` (min-h-[22px] unchanged) — input-bottom-to-next-label rhythm is now a consistent 30px (4+22+4) across all six auth forms, down from 50px where the reserved row and form gap were double-counting.
- 03-01: `is_client_of()` omits the redundant caller-role re-check that `is_coach_of()` carries — `enforce_coach_client_roles` (0003) already guarantees `coach_clients.client_id` references a client-role profile.
- 03-01: `profiles.email` is `NOT NULL DEFAULT ''` with a backfill `UPDATE`, keeping the generated TypeScript type non-optional (`email: string`).
- 03-01: `LogoutButton` flips from `variant="primary"` to `variant="ghost"` (D-09) — the authenticated shell's primary-action count is now zero, a deliberate widening of D-18's "at most one primary action" rule.
- 03-01: `pnpm verify:rls` intentionally exits 1 at the end of this plan (2/6 `checkClientBoundary` assertions now fail) because the new `is_client_of` policy widens a client's read surface from 1 row to 2 (own + assigned coach) — approved at the Task 2 checkpoint; Plan 03-03 updates the assertions and restores exit-0.
- 03-01: `apps/web/package.json` was missing `@fish/core`/`@fish/supabase` as workspace dependencies despite existing repo-wide imports relying on them — added as a Rule 3 blocking fix (internal workspace wiring only, no new external packages fetched).
- 03-02: `firstName` is derived by splitting `display_name` on whitespace and taking the first token — single-word names fall through unchanged since `split(" ")[0]` on a one-word string returns the whole string.
- 03-02: The client home page re-reads `getUser()` + `profiles.role` itself for its own wrong-door guard rather than trusting a value threaded from the shared layout — Server Components re-execute per navigation, and the per-page role check is Plan 01's stated design (the layout doesn't cleanly know which leaf route it wraps).
- 03-02: No manual `coach_id`/`client_id` filtering beyond the direct id lookups on `coach_clients` and `profiles` — the `is_client_of` RLS policy (Plan 01) is treated as the sole authorization boundary for the coach-name read, per AGENTS.md's API rule.
- 03-03: `checkClientBoundary()` updated to the post-0006 two-row invariant (own + assigned coach) per approved deviation at 03-01's Task 2 checkpoint — restores `pnpm verify:rls` to exit 0 (8/8 assertions pass live).
- 03-03: Coach home queries `coach_clients` embedded-joined to `profiles` (`profiles:client_id(...)`) rather than profiles-minus-self, resolving RESEARCH.md Open Question 3 and avoiding the self-row edge case.
- 03-03: `ClientList` sorts a shallow copy of the `clients` prop via `localeCompare`, never mutating the incoming prop (D-15).
- 03-04: `redirectIfSignedIn()` reads only `profiles.role` (not `display_name`) — the guard only needs to pick a destination, unlike the home pages which also render the name.
- 03-04: Existing `login/page.test.tsx` and `signup/page.test.tsx` behavioral coverage was renamed and re-pointed at the extracted `LoginForm`/`SignupForm` components (`login-form.test.tsx`/`signup-form.test.tsx`) rather than replaced with a new minimal smoke test, since the form logic moved verbatim and the existing suite gives strictly more coverage.

### Sequencing constraints (from research)

- Tokens have zero upstream dependency → Phase 1 first; the hardened kit is consumed by auth UI, so design-system work precedes auth screens.
- Database schema + RLS must exist before the role-aware landing / coach home → DB is folded into the Phase 2 account slice; the coach-client relationship it produces backs the Phase 3 coach home.
- Next.js 16 uses `proxy.ts` (renamed from `middleware.ts`); pin `@supabase/ssr@0.12.0` + `@supabase/supabase-js@2.110.0`.
- RLS needs `SECURITY DEFINER` helpers to avoid recursion on the coach/client shape.
- Keep `tailwindcss` and `@tailwindcss/postcss` on the exact same version or the build silently breaks.

### Critical pitfalls to carry into planning

- Never trust `getSession()` server-side — use `getUser()` / `getClaims()` in proxy/Server Components.
- `handle_new_user` trigger must be `SECURITY DEFINER` with `search_path = ''` and idempotent — a failing trigger must not silently block signups (DB-01).
- Middleware must return one response and write refreshed cookies to both request and response, or sessions drop silently.
- Email verification/reset must use `{{ .SiteURL }}/auth/confirm?token_hash=...&type=email` + `verifyOtp()`, not the legacy `ConfirmationURL` / `exchangeCodeForSession()`.
- Role stored in `profiles` + mirrored to `app_metadata` via trigger; never trust client-side role.

### Todos / open questions (from research gaps)

- [ ] Decide whether Phase 1 formalizes `packages/tokens/src/tokens.json` as a portable source, or keeps hand-written CSS this milestone (THEM-02 is v2).
- [x] Define actual oklch token values for light + dark before Phase 1 commit — done in 01-01 (globals.css ladder, contrast-test verified).
- [ ] `apps/web/app/page.tsx` still references removed accent-pink/accent-yellow utilities — see phase deferred-items.md.
- [ ] `vite@8` peer-wants `@types/node >=22.12.0` (installed 22.10.7) — warning only; bump with the next dependency task.
- [ ] Confirm Supabase environments (local / staging / prod): linked project, per-env email templates, Site URL / Redirect URLs — checklist during Phase 2.
- [ ] Confirm future Edge Function signatures (assign-client) inform the coach-client schema design in Phase 2.

### Blockers

- None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260704-dn2 | Implement native Android static Compose UI preview for current web auth screens, no auth wiring yet | 2026-07-04 | 2e21c80 | [260704-dn2-go-with-option-1-implement-native-androi](./quick/260704-dn2-go-with-option-1-implement-native-androi/) |

## Session Continuity

- **Last activity:** 2026-07-04
- **Last session:** 2026-07-04T04:12:42.454Z
- **Stopped at:** Completed 03-04-PLAN.md
- **Resume file:** None
- **Next action:** Phase 02 verification (confirm phase-level success criteria against the now-fully-resolved UAT), then plan phase 03 (role-aware home).
- **Files:** `.planning/phases/02-secure-account-you-can-return-to/02-08-SUMMARY.md`, `.planning/phases/02-secure-account-you-can-return-to/02-UAT.md`, `.planning/debug/resolved/enter-submit-expired-link.md`, `.planning/debug/resolved/enter-submit-reset-password.md`, `.planning/ROADMAP.md`.

---
*State initialized: 2026-07-02 at roadmap creation.*
