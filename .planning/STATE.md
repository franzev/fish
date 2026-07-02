---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 01-02-PLAN.md
last_updated: "2026-07-02T08:42:19.372Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 0
---

# Project State: FISH — Monochrome Foundations

**Last updated:** 2026-07-02

## Project Reference

- **Core value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.
- **Current milestone:** Monochrome Foundations (design system + auth foundation)
- **Current focus:** Phase 01 — monochrome-design-system-you-can-see

## Current Position

Phase: 01 (monochrome-design-system-you-can-see) — EXECUTING
Plan: 01-02 complete (2 of 3); next is 01-03-PLAN.md

- **Phase:** 1 — Monochrome design system you can see
- **Plan:** 01-02 complete (2 of 3); next is 01-03-PLAN.md
- **Status:** Ready to execute
- **Progress:** [███████░░░] 67%

## Roadmap Snapshot

| Phase | Goal (short) | Requirements | Status |
|-------|--------------|--------------|--------|
| 1 | Dual-theme monochrome tokens + hardened UI kit, provable on a demo page | TOKN-01..06, KIT-01..06 | Not started |
| 2 | Full linear auth loop backed by hardened profiles + coach-client schema with RLS | AUTH-01..06, DB-01..04 | Not started |
| 3 | App shell, protected routing, calm role-aware landings | SHEL-01..02, ROUT-01..04 | Not started |

## Performance Metrics

- **Phases planned:** 3
- **Phases complete:** 0
- **Plans complete:** 2
- **Requirements mapped:** 28 / 28

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 12 min | 3 | 10 |
| 01 | 02 | 8 min | 2 | 6 |

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

## Session Continuity

- **Last session:** 2026-07-02T08:42:19.368Z
- **Stopped at:** Completed 01-02-PLAN.md
- **Resume file:** None
- **Next action:** `/gsd:execute-phase 1` to run 01-03-PLAN.md.
- **Files:** `.planning/phases/01-monochrome-design-system-you-can-see/01-02-SUMMARY.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`.

---
*State initialized: 2026-07-02 at roadmap creation.*
