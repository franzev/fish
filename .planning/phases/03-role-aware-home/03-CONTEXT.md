# Phase 3: Role-aware home - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

After login, a person lands inside a calm app shell on the home that matches their role — a client on the client home, a coach on the coach home listing only their assigned (seeded) clients. Signed-out visitors to any protected route are redirected to login. A client home before assignment and a coach home with zero clients show calm, guiding empty states. Covers SHEL-01..02 and ROUT-01..04.

Out of scope: 1-on-1 chat (Edge Function stays a stub — the `/chat` URL itself waits for the chat milestone), assignment UI (seed-only), coach signup, onboarding assessment, tracker engine, community/gamification, native clients, client-facing theme toggle.

</domain>

<decisions>
## Implementation Decisions

### Route map & redirects
- **D-01:** Client home lives at `/home` (the existing Phase 2 route, promoted from neutral placeholder to the real client home); coach home lives at `/coach`. `authRedirects.clientHome` in `packages/supabase/src/auth.ts` is updated from `/chat` to `/home` — no URL promises a capability that doesn't exist yet.
- **D-02:** `/` (root) becomes a pure redirect and never renders content: signed-out → `/login`, signed-in → role home. The stale pre-monochrome showcase currently at `/` is removed (this also clears the flagged accent-pink/accent-yellow dead references).
- **D-03:** Role mismatch is a silent redirect — a client visiting `/coach` (or a coach visiting the client `/home`) lands on their own role home with no message. The wrong URL simply behaves as if it were the right one.
- **D-04:** Post-login destination is always the role home. No `?next=` return-to-URL this milestone — with only two destinations, deep-link return adds open-redirect surface for near-zero benefit.
- **D-05:** A signed-in person visiting `/login` or `/signup` (or other signed-out-only screens) is silently redirected to their role home.
- **D-06:** Protection model is default-deny: everything requires a session except the public allowlist — `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/check-inbox`, `/expired-link`, `/auth/confirm`, and `/kit` (Phase 1 D-15 keeps the design contract public-but-unlinked in production).
- **D-07:** Logout lands on plain `/login` with no confirmation banner — the login form itself is the confirmation. (`authRedirects.signedOut` should reflect the effective destination.)

### App shell & navigation
- **D-08:** The shell is a slim top bar: FISH mark left, session info right, page content below. No sidebar — there is nothing to navigate to yet, and an empty rail is visual weight without function.
- **D-09:** Bar contents: logo + the person's display name (quiet, muted text) + a ghost logout button. Everything in the bar is secondary — the page below keeps the screen's single primary action (SHEL-01).
- **D-10:** Page content sits in one narrow centered column (~640px max) under the bar — same visual family as the 440px auth cards. No per-role widths.
- **D-11:** Each page owns its heading (Fraunces), rendered in the content column; the bar stays constant across screens and never carries page titles.

### Coach client list
- **D-12:** The list renders as quiet stacked rows inside a single Card with hairline dividers — one calm container reusing the existing Card component.
- **D-13:** Each row shows display name as the main text with the email quiet/muted. No `assigned_at` dates — bookkeeping, not coaching info.
- **D-14:** Rows are inert this milestone: no hover state, no cursor-pointer, no false affordance. Nothing looks tappable until a per-client destination exists.
- **D-15:** List is ordered alphabetically by display name — stable, predictable, findable.

### Empty states & copy
- **D-16:** The client home has two states: unassigned → calm reassurance ("We're getting things ready for you"); assigned → acknowledges the relationship by name ("Your coach [name] is setting things up"). Requires a small, scoped RLS allowance so a client can read their own coach's display name (via the existing `coach_clients` row) — planner/researcher to pin the exact policy shape.
- **D-17:** Empty states are a single quiet Tabler icon above one or two calm sentences, inside the content Card. No illustrations — no new asset discipline for two screens.
- **D-18:** Empty states offer no action. Pure reassurance; the only interactive element on screen is the shell's ghost logout. "At most one primary action" includes zero.
- **D-19:** Home pages greet by first name in the page heading — client: "Welcome back, [name]"; coach: "Your clients". The bar's name display is functional; the heading's greeting is human.

### Claude's Discretion
- Exact screen copy — drafted in FISH voice (sentence case, plain verbs, never scolds), reviewed at phase verification.
- Where protection is enforced (proxy.ts matcher vs layout-level `getUser()` checks vs both) and how the role is read server-side (profiles read vs JWT `app_metadata` claim), following the pinned pitfalls in STATE.md (never `getSession()` server-side; one middleware response with cookies on request AND response).
- Shell component structure and naming in the kit (`apps/web/components/`), route-group organization in `apps/web/app/`, and whether the shell is a layout or composed per-page.
- Specific Tabler icon choices for the two empty states.
- Loading/streaming behavior during the server-side role lookup (keep first paint calm; no spinners flashing on fast responses).
- Exact RLS policy shape for the client-reads-coach-name allowance (SECURITY DEFINER helper vs direct policy), consistent with Phase 2's recursion-safe patterns.
- Mobile behavior of the top bar (it holds only three quiet elements; simple responsive stacking is fine).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & requirements
- `AGENTS.md` — Non-negotiable design rules (one primary action, 56px targets, copy never scolds, assigned-never-chosen), stack lock, API boundary. Note: its token section still describes the pre-monochrome lime accent; the monochrome ladder in `apps/web/app/globals.css` is the live truth.
- `.planning/REQUIREMENTS.md` — SHEL-01..02 and ROUT-01..04 requirement texts; v2 deferrals (COAC-01/02 assignment UI + coach signup, THEM-01 toggle); out-of-scope table.
- `.planning/ROADMAP.md` — Phase 3 goal and the four success criteria (the "must be TRUE" statements); dependency on Phase 2's session/role/RLS foundation.

### Prior phase decisions (inherited, do not re-litigate)
- `.planning/phases/01-monochrome-design-system-you-can-see/01-CONTEXT.md` — Token/kit decisions the shell inherits: two-tone focus ring, `light-dark()` theme mechanism, `/kit` as the visual contract (D-12..15), semantic-role-only tokens.
- `.planning/phases/02-secure-account-you-can-return-to/02-CONTEXT.md` — Auth loop decisions this phase extends: `/home` as the Phase 2 interim landing (D-01, now promoted), route naming (D-02), display_name captured at signup (D-04), seed shape (D-10: 1 coach + ~3 assigned clients with fixed dev credentials).
- `.planning/STATE.md` — Accumulated decisions and pitfalls: layout-stability contract (nothing reflows on state change; notices float as overlays), 02-08 alert tone tokens, pinned versions (`@supabase/ssr@0.12.0`, Next.js 16 `proxy.ts`), never `getSession()` server-side, middleware cookie rules, role mirrored to `app_metadata`.

### Existing code this phase extends
- `packages/supabase/src/auth.ts` — `authRedirects` contract this phase rewires (`clientHome` → `/home`; wire role redirects for real).
- `apps/web/proxy.ts` + `apps/web/lib/supabase/proxy.ts` — Session-refresh middleware that grows route protection (D-06 default-deny + allowlist).
- `apps/web/app/home/page.tsx` — Phase 2 neutral placeholder being promoted to the client home; already demonstrates the server-side `getUser()` + redirect pattern.
- `apps/web/app/page.tsx` — Stale showcase replaced by the D-02 pure redirect.
- `apps/web/components/ui/` — Button, Input, Card (+Progress), Alert; the shell and homes compose these, never hand-roll.
- `apps/web/components/auth/logout-button.tsx` — Existing logout action moving into the shell bar.
- `apps/web/app/kit/page.tsx` — The visual contract; new shell/list/empty-state components are judged against it (and any new kit components should be demonstrated there per KIT-06).
- `packages/core/src/roles.ts` — `UserRole` union + `isUserRole()` guard; the only role vocabulary.
- `supabase/migrations/` — Existing profiles/coach_clients/RLS migrations; D-16's client-reads-coach-name allowance lands here as a new migration.

### Codebase analysis
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries, anti-patterns (multi-choice UI, raw hex), error-handling voice.
- `.planning/codebase/CONVENTIONS.md` — Naming, forwardRef/displayName, Tailwind/token conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1–2 kit: `Button` (ghost variant for the bar's logout), `Card` (client list container + empty-state container), `Alert` (if any form-level messaging appears), `Input` (not expected this phase).
- `LogoutButton` in `apps/web/components/auth/` — already wired to Supabase sign-out; relocates into the shell bar.
- `apps/web/app/home/page.tsx` — working server-component pattern: `createClient()` → `getUser()` → redirect if absent.
- Seeded data: 1 coach + 3 clients with display names, `coach_clients` rows, `is_coach_of` SECURITY DEFINER helper — the coach home has real rows on day one; any seeded account tests RLS boundaries.
- 152 passing Vitest tests (contrast, focus-ring tripwire, icon-source guard, Enter-submit) — new code must keep them green; harness ready for routing/shell tests.

### Established Patterns
- Tailwind v4 CSS-first (`@theme` in globals.css; never create tailwind.config.js; `tailwindcss` + `@tailwindcss/postcss` version-identical).
- Layout-stability contract: no control changes size on state change; notices float as out-of-flow overlays; extends to any loading states this phase adds.
- Named exports, `forwardRef` + `displayName` on focusable controls, `cn()` for conditional classes, no raw hex, Tabler-only icons (test-enforced).
- Server-side auth reads via `getUser()` only; three-client SSR factory layout in `apps/web/lib/supabase/` (browser/server/proxy).

### Integration Points
- `apps/web/proxy.ts` matcher already covers all non-static routes — protection logic slots into `updateSession` / a routing layer on top.
- New: shell component(s) + authenticated layout wrapping `/home` and `/coach`; `/coach` route; role lookup for redirects; migration for the client→coach-name read.
- `authRedirects` is imported by existing auth screens — changing `clientHome`/`signedOut` values propagates automatically wherever redirects are already wired.

</code_context>

<specifics>
## Specific Ideas

- The wrong door always opens the right room: every mis-navigation (wrong role's URL, auth pages while signed in, root) resolves as a silent redirect to the person's own home — no error screens, nothing to dismiss.
- The client home's assigned state names the coach ("Your coach [name] is setting things up") — the seeded relationship becomes visible from both sides, and the client's first authenticated screen feels like a person is already there for them.
- Inert means inert: client rows carry no hover/cursor affordance so nothing on the coach home promises interaction that doesn't exist yet.

</specifics>

<deferred>
## Deferred Ideas

- **Per-client coach view / tappable client rows** — rows become interactive when a destination exists (chat or client profile, next milestone).
- **`?next=` deep-link return after login** — revisit when the app has more destinations than the two role homes.
- **`/chat` URL** — reserved for the chat milestone; not stubbed now.
- Pre-existing v2 items reaffirmed in passing: COAC-01/02 (in-app assignment, coach signup), THEM-01 (client-facing theme toggle), THEM-02 (token pipeline).

</deferred>

---

*Phase: 3-Role-aware home*
*Context gathered: 2026-07-04*
