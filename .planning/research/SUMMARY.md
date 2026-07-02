# Project Research Summary

**Project:** FISH — ChatHub for English coaching (neurodivergent professionals, ADHD-first)
**Domain:** Supabase-auth + role-based Next.js App Router web, with dual-theme CSS-first token system (Tailwind v4)
**Researched:** 2026-07-02
**Confidence:** HIGH

## Executive Summary

FISH is a coach-led, two-sided (client/coach) messaging platform targeting neurodivergent professionals with ADHD, prioritizing calm and focus through deliberate constraint: the product removes choices rather than adding them. The recommended technical approach is Supabase-native (auth + Postgres + Edge Functions) on a Next.js App Router foundation with SSR, dual-theme tokens in pure monochrome (pending later color addition), and strict role-based access control via Row Level Security. The primary challenge is not the stack—these are well-established patterns—but enforcing the product's discipline: avoiding self-serve UX choices, resisting OAuth sprawl, and protecting the vulnerable audience (ADHD professionals) from performance-anxiety gamification (streaks, scores, leaderboards). The stack research confirms all critical packages; the feature and architecture research align with AGENTS.md's existing constraints; the pitfalls research flags that the most damaging mistakes are auth corner-cases (trusting unverified sessions, RLS policy recursion, role stored client-side) and Tailwind version drift, all of which are preventable with discipline and testing.

The recommended approach mitigates every critical pitfall through straightforward patterns: always `getUser()`/`getClaims()` server-side (never `getSession()`), wrap role/relationship checks in `SECURITY DEFINER` functions, and pin Tailwind and PostCSS versions exactly. The roadmap should front-load the design-system foundation (tokens, hardened UI states) in parallel with auth/database work, since both are prerequisite to any user-facing feature and neither blocks the other. By the end of Phase 1 (auth + foundation), the app should be genuinely functional: signup→verify→login→role-aware home, with fully styled states and working RLS, serving as the platform for 1-on-1 chat (the next committed feature) to build on.

## Key Findings

### Recommended Stack

The stack research confirms three established families of tools for this architecture:

**Core technologies:**
- **@supabase/supabase-js 2.110.0** — official JS client for auth, database, storage, realtime; latest stable as of research date. Do not adopt 3.0.0-next (prerelease).
- **@supabase/ssr 0.12.0** — official successor to deprecated `auth-helpers-*` packages; provides `createBrowserClient` and `createServerClient` factories with SSR-aware cookie handling. Framework-agnostic, production-ready.
- **Tailwind CSS 4.3.2** — already chosen in AGENTS.md; v4 is CSS-first (@theme syntax). Project currently pins 4.3.1 (safe to bump to 4.3.2 if desired).
- **@tailwindcss/postcss 4.3.2** — must match tailwindcss version exactly (hard requirement, not project-specific guidance). Version drift breaks the build silently.
- **Inline no-flash theme script** (no package) — ~10 lines of JavaScript in `<head>` reading `localStorage` + `prefers-color-scheme`, setting `data-theme` attribute on `<html>` before paint. Zero dependencies, no hydration risk.

**Supporting:**
- `next-themes 0.4.6` — only needed if roadmap adds a visible theme-picker UI later (not in current scope). For "respects OS preference, persists manual override," the inline script is sufficient.

**Not needed:**
- Do not adopt `@supabase/auth-helpers-nextjs` (deprecated).
- Do not create `tailwind.config.js` (v4 is CSS-first; file will be silently ignored).
- Do not add a separate auth provider (Clerk, Auth.js, Firebase) — Supabase Auth is the system of record and single provider already specified.

### Expected Features

**Table stakes (users assume these exist):**
- Email/password signup + login + logout (linear, single-path, no choice forks)
- Email verification (with patient error handling, not scolding)
- Password reset ("forgot password" with calm, time-limited flow)
- Session persistence across refresh/browser restart (SSR cookie-based)
- Protected routing (signed-out → login; role-aware home)
- Role-based landing (client home vs. coach home — completely different shells, not a conditional)
- RLS on every table (coach sees only assigned clients; clients see only their own data)
- Accessible baseline: visible keyboard focus, `prefers-reduced-motion` respected, 56px tap targets

**Differentiators (competitive edge):**
- Zero-choice auth (single linear path, no OAuth options, no "pick your plan")
- Assigned-never-chosen coach roster (coaches assigned by admin/seed, not picked by clients)
- Pure monochrome design language (forces hierarchy from type/spacing/structure, not color, avoiding over-stimulation)
- Non-scolding error language (soft copy, no alarming red, per AGENTS.md)
- UI kit demo page (every component, every state, both themes, one place — internal differentiator improving dev velocity)

**Anti-features (explicitly avoid):**
- Role picker at signup ("I'm a client" / "I'm a coach") — security risk
- OAuth sprawl (Google, Apple buttons) — reintroduces choice; conflicts with "remove choices"
- Streak counters / daily-use gamification — explicitly barred in AGENTS.md; top abandonment trigger for this audience
- Score-based progress ("87% fluent") — use visual progress bars, never numeric grades
- Client-facing coach marketplace — contradicts "assigned never chosen"
- Multi-factor authentication (not needed v1, defers until a concrete security signal exists)
- Community feed / social features — explicitly deferred; 1-on-1 chat is next after foundation

**MVP for this milestone:**
- Complete linear auth loop (signup→verify→login→reset) with no forks
- Profiles table + coach-client relationship table with RLS enforcing boundaries
- Signup defaults to client role; coach role is seed/manual-only
- Dual-theme tokens (light + dark monochrome) replacing flat color set
- UI kit hardened: Button, Input, Card, Progress all have disabled/loading/error states
- App shell with calm empty states
- Protected routing (client → `/`, coach → `/coach`, signed-out → `/login`)
- Focus states + reduced-motion respected

### Architecture Approach

The architecture is a standard Supabase + Next.js 16 App Router pattern: browser client reads/writes forms, server client reads data in Server Components (protected by RLS), middleware refreshes tokens and gates access (role-based redirects), and Edge Functions handle command-style writes with validation. Role is mirrored from `profiles.role` into the JWT's `app_metadata` claim for fast middleware reads; RLS policies use `SECURITY DEFINER` helper functions to avoid recursion when checking coach-client relationships. Theme is handled via Tailwind v4's `@custom-variant` binding to `[data-theme]` attribute, with an inline script reading `localStorage` before paint.

**Major components:**
1. **Browser client (`createBrowserClient`)** — forms/auth/interactive features in Client Components
2. **Server client (`createServerClient`)** — reads in Server Components, refreshed per-request by middleware
3. **Middleware (`proxy.ts`)** — token refresh, session validation, role-based routing (signed-out/client/coach redirects)
4. **Database schema** — `auth.users` (managed by Supabase), `profiles` (1:1, source of truth for role), `coach_clients` (relationship table with RLS)
5. **RLS policies + SECURITY DEFINER helpers** — enforce coach/client data boundaries at the DB layer, independent of app code
6. **Edge Functions** — command writes (assign client, send message) with validation beyond RLS's reach
7. **Token system** — Tailwind v4 `@theme` block mapping semantic names to CSS custom properties, resolved per `[data-theme]` attribute
8. **Routing structure** — `(auth)` group for signup/login/reset, `(client)` and `(coach)` groups for role-specific shells

Build order is critical: token architecture first (UI kit depends on it), then UI kit hardening, then app shell/routing, then database schema and Supabase client setup in parallel, then auth UI, then middleware + protected routing, finally role-aware landings as the integration point proving everything works end-to-end.

### Critical Pitfalls (Prevention-focused)

1. **Trusting `getSession()` server-side** — Most damaging auth mistake. `getSession()` reads the (possibly stale/forged) cookie without verifying against Auth server. Always use `getUser()` or `getClaims()` in middleware/Server Components. Reserve `getSession()` for client-side reads only. Cost of missing this: session spoofing, clients can impersonate others.

2. **RLS policy recursion** — When a policy needs to check role/relationship (e.g., "coach can read client profile"), a naive direct `SELECT profiles` inside the policy re-triggers the policy, causing "infinite recursion detected." Solution: wrap the check in a `SECURITY DEFINER` function in a private schema. Must do this for `profiles` and `coach_clients` policies. Cost of missing this: queries fail at runtime, breaking entire feature until policies are fixed.

3. **Role stored/trusted client-side instead of RLS-enforced** — Storing role only in `user_metadata` or trusting client-computed role for authorization lets authenticated clients self-promote (via `supabase.auth.updateUser()`). Must store role in `profiles` table (server-writable) and mirror to `app_metadata` (not user-writable) via trigger. Every table with role-differentiated access gets its own RLS policy. Cost of missing this: direct data-leakage vulnerability.

4. **`handle_new_user` trigger blocks all signups** — If the trigger creating `profiles` row on auth.users insert isn't `SECURITY DEFINER` or has permission/constraint issues, entire signup transaction fails with generic "Database error saving new user." Solution: trigger function must be `SECURITY DEFINER`, set `search_path = ''`, keep it minimal (use `ON CONFLICT` where sensible). Cost of missing this: nobody can sign up, blocking the entire product.

5. **Middleware drops refreshed session cookie** — Second-most-damaging auth mistake. If middleware creates the Supabase client, calls `getUser()` to refresh, but then constructs a *second* `NextResponse` afterward, the refreshed cookie (written to the first response) is lost. Users get silently logged out after token expiry. Solution: follow the official pattern exactly (one response, `getAll`/`setAll` write to both request and response, return the same response). Cost of missing this: silent random logouts after session refresh, breaking trust in persistence.

6. **Email verification/reset redirect broken** — Default Supabase email templates use `{{ .ConfirmationURL }}` (legacy implicit flow, tokens in URL fragment unreadable server-side). Must update templates to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` and implement a separate `/auth/confirm` Route Handler using `verifyOtp()` (not `exchangeCodeForSession()`, which is for OAuth). Cost of missing this: confirmation/reset links 404 or error.

7. **Tailwind version drift** — If `tailwindcss` and `@tailwindcss/postcis` diverge to different versions (easy in a monorepo workspace), the build can succeed while silently not applying some `@theme` tokens, producing unstyled components. Solution: pin both to exact same version in `apps/web/package.json`, re-verify after every dependency update, do a full visual pass of UI kit after any Tailwind change. Cost of missing this: broken styles shipped to prod, looks like a regression but the build passed.

## Implications for Roadmap

Based on research, suggested **4-phase structure** for the auth + design-system foundation:

### Phase 1: Design System & Token Foundation
**Rationale:** Prerequisite for all UI work this milestone; independent of auth/backend (can start immediately). Unblocks UI kit hardening and app shell before auth code is written.
**Delivers:**
- Pure monochrome token set (light + dark) in Tailwind v4 `@theme` + `[data-theme]` overrides
- Inline no-flash theme script in root layout
- Updated design tokens documentation (semantic names, contrast/weight roles, notes for future color layering)
- Foundational token values (oklch format, verified to work in both light and dark modes)
**Addresses features:** Dark + light theme (both fully specified), responsive layout, component states (foundation)
**Avoids pitfalls:** Tailwind version drift (exact pinning), token naming blocking future color layer (semantic names only)

### Phase 2: UI Kit Hardening & App Shell
**Rationale:** Depends on Phase 1 tokens; unblocks auth screens (signup/login forms need fully-hardened Input/Button states). App shell structure depends on route groups that middleware will target.
**Delivers:**
- Button, Input, Card, Progress components: default / hover / focus / disabled / loading / error states for both themes
- EmptyState component (calm, not alarming)
- AppShell + navigation structure (`(auth)`, `(client)`, `(coach)` route groups)
- UI kit demo page (all components, all states, both themes, one page)
- Accessibility hardening: visible focus states, `prefers-reduced-motion` respected
**Uses stack:** Tailwind v4 tokens (already available from Phase 1)
**Addresses features:** Component states, empty states, focus states, reduced-motion, responsive + 56px tap targets
**Avoids pitfalls:** Dark-mode flash/hydration issues (token system solves this), theme naming drift (demo page locks semantic names in place)

### Phase 3: Database Schema + RLS Foundation
**Rationale:** Required before any signup/auth flow can be tested end-to-end; doesn't depend on UI (SQL migrations can be built independently). Establishes the data contracts (profiles, coach-client relationships) that auth UI will target.
**Delivers:**
- `profiles` table (1:1 with auth.users, role defaults to 'client', RLS: users can read own row only)
- `coach_clients` relationship table (RLS: coach sees own assignments, client sees own coaches)
- RLS policies on both tables (including `SECURITY DEFINER` helper functions avoiding recursion)
- `handle_new_user` trigger (SECURITY DEFINER, creates profiles row on signup, sets role='client' default, idempotent)
- Seed script for test coaches (manual/admin-only account creation)
- Generated TypeScript types from DB schema (via `supabase gen types`)
**Implements architecture:** Database schema, RLS enforcement, role/relationship access control
**Avoids pitfalls:** RLS recursion (pattern established), trigger blocking signups (correct SECURITY DEFINER pattern), role self-escalation (client can't write role column)

### Phase 4: Auth + Protected Routing
**Rationale:** Depends on Phase 1 (UI kit for login/signup screens), Phase 2 (app shell to redirect into), Phase 3 (profiles table to land on after signup). Final integration point.
**Delivers:**
- Supabase client setup: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server), `lib/supabase/middleware.ts` (refresh helper)
- `middleware.ts` (`proxy.ts` convention, not old `middleware.ts`): session refresh, role-based redirect logic
- Auth screens: signup, login, email-verification (confirm flow), password reset, logout
- `/auth/callback` → `/auth/confirm` Route Handler (uses `verifyOtp()` for email/password flows)
- Updated Supabase email templates (pointing at `/auth/confirm` with `token_hash`)
- Role-aware landing screens: client home + coach home (stubs with empty state, assigned clients list for coach)
- End-to-end testing: signup→verify→login→session persistence across refresh→role-aware redirect
**Uses stack:** @supabase/supabase-js, @supabase/ssr, Supabase project (auth + Postgres + Edge Functions stubs)
**Addresses features:** All table-stakes auth features, session persistence, role-aware routing
**Avoids pitfalls:** Trusting getSession() (uses getUser()/getClaims()), email template mismatch (updated templates), middleware cookie loss (correct pattern), trigger signup blocking (tested with real signup flow)

### Phase Ordering Rationale

1. **Tokens first, UI second** — Neither blocks the other; tokens come first because every UI component will reference them. Starting here prevents "theme blindness" (components built against single-flat tokens then retrofitted to dual-theme).

2. **App shell before auth** — Routing structure `(auth)`, `(client)`, `(coach)` must exist for middleware to redirect into. Building the shell parallel with Phase 3 (DB) is fine.

3. **Database before auth UI** — Signup needs somewhere to land (profiles table); login needs role to be readable (profiles + JWT custom claim); session refresh needs RLS to protect it. Schema is prerequisite.

4. **Auth last, integration last** — Depends on everything above. Final phase wires it all together and proves the chain works end-to-end.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 1 (Tokens):** Medium-depth token extraction if `packages/tokens/src/tokens.json` is added as the formal source (currently tokens live only in CSS). Guideline already exists in ARCHITECTURE.md, but extracting into a portable format requires a small definition pass. Skip if keeping hand-written CSS is acceptable for this milestone.
- **Phase 3 (Database):** Moderate-depth verification of RLS patterns — this is where the most complex SQL lives and mistakes are costly. Recommend a code review checklist against the specific pitfalls (SECURITY DEFINER pattern, no recursion, role table-readonly from client, etc.). Not a blocker, but a deliberate gate.

**Phases with standard patterns (skip research-phase):**
- **Phase 2 (UI Kit):** Well-documented patterns. AGENTS.md already specifies the design rules; Tailwind v4 and component hardening are standard. No research-phase needed.
- **Phase 4 (Auth):** Official Supabase + Next.js docs are excellent. @supabase/ssr package ships with the exact pattern this project needs. Build can follow the official template. No research-phase needed beyond reviewing PITFALLS.md for the 6 critical auth mistakes.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All versions verified against npm registry and official docs as of 2026-07-02. No prerelease dependencies. `@supabase/ssr` officially replaces deprecated `auth-helpers-*` packages; Tailwind v4 pattern confirmed against official docs. |
| Features | **HIGH** | Core features verified against official Supabase RLS/auth docs and AGENTS.md constraints. Table-stakes list aligns with WCAG accessibility standards. ADHD-UX guidance from multiple sources (Welcoming Web, accessiBe, devqube) all converge on the same principles (remove choice, no gamification, visual progress only). |
| Architecture | **HIGH** | Pattern verified via official Supabase examples (Context7 `/supabase/ssr` source, official Next.js auth guide), Tailwind v4 official docs, and codebase inspection (current token state matches recommendations). Three-client setup, middleware refresh, SECURITY DEFINER RLS, dual-theme token indirection all confirmed as official/recommended patterns. |
| Pitfalls | **HIGH** | Pitfalls research cross-verified across official Supabase docs (auth, RLS, email), official Tailwind v4 docs (dark mode, FOUC), multiple community discussions confirming patterns, and direct codebase inspection (e.g., current token names already semantic/role-based, no breaking renames needed). No conflicting sources. |

**Overall confidence:** **HIGH** — Stack is standard, architecture patterns are well-documented, and pitfalls are preventable with the patterns already in the research documents.

### Gaps to Address

1. **Exact token values (oklch colors) pending design review** — STACK.md and ARCHITECTURE.md specify the pattern (`@theme inline` + `[data-theme]` overrides); Phase 1 will define the actual okLCH values for light and dark. Current AGENTS.md has placeholder naming but values are not fully specified for both themes. Recommend a quick design review (or AI-assisted generation from the monochrome/accessibility constraint) before Phase 1 commit.

2. **Supabase environment setup (local, staging, prod)** — Research assumes a Supabase project exists (mentioned in AGENTS.md as "provisioned"); detailed setup instructions for linking the project, configuring email templates per-environment, and setting Site URL / Redirect URLs per environment are out of scope. Roadmap should include a small "Environment Setup" checklist during Phase 3 (database) to confirm all three environments are configured correctly.

3. **Edge Function stubs** — ARCHITECTURE.md assumes Edge Functions exist for command writes (send-message, assign-client). This milestone is not building those functions, but the schema (especially coach-client relationship) should be designed with the future Edge Function contract in mind. Recommend a brief design doc confirming the Edge Function signatures before Phase 3 is considered "done."

4. **Native token generation (iOS/Android mirror)** — ARCHITECTURE.md flags a `packages/tokens` directory as optional but recommended for future native scaling. If `packages/tokens/src/tokens.json` is added in Phase 1, there is no generation step this milestone — it's just hand-authored raw data. Confirm whether Phase 1 should include a brief schema/format for that file (so it's easy to write a generator later) or defer the entire `packages/tokens` structure to the native-build milestone.

## Sources

### Primary (HIGH confidence)
- npm registry: @supabase/supabase-js, @supabase/ssr, tailwindcss, @tailwindcss/postcss — version/dist-tag query as of 2026-07-02
- Supabase official docs: auth/server-side/nextjs — getUser/getClaims vs getSession, cookie pattern, security rules
- Supabase official docs: auth/server-side/creating-a-client — createBrowserClient/createServerClient contract
- Supabase official docs: database/postgres/row-level-security — RLS pattern, SECURITY DEFINER, recursion avoidance
- Supabase official docs: database/postgres/custom-claims-and-role-based-access-control-rbac — app_metadata vs user_metadata, JWT claim strategy
- Supabase official docs: auth/server-side/email-based-auth-with-pkce-flow-for-ssr — token_hash pattern, verifyOtp, email template configuration
- Next.js official docs: app/getting-started/proxy — proxy.ts convention, Node.js runtime, replacement for deprecated middleware.ts
- Tailwind CSS official docs: dark-mode — @custom-variant, data-attribute binding, FOUC prevention via inline script
- Tailwind CSS official docs: theme — @theme syntax, v4 CSS-first architecture
- Supabase GitHub: /supabase/ssr source — createServerClient, createBrowserClient API, middleware cookie contract
- AGENTS.md and PROJECT.md from codebase — product constraints (coach-first, no choice, no gamification, monochrome, role security)

### Secondary (MEDIUM confidence)
- Supabase RLS discussion #1138: infinite recursion pattern — official Supabase GitHub discussion and RLS docs
- Supabase discussion #26483: redirect URL misconfiguration — Site URL behavior in production
- Tailwind CSS discussion #18471: theming best practices v4 — @theme inline + @layer theme pattern for multi-theme, confirmed by Tailwind team
- Welcoming Web: designing for neurodiversity — ADHD-UX guidance (remove choices, no streaks, visual progress)
- accessiBe: neurodiversity design tips — reduced motion, calm UI, anti-gamification
- CoachAccountable, Coaching.com, TrainingPeaks help docs — coach roster and client-management patterns

### Tertiary (PRIMARY SOURCE — codebase inspection)
- /Users/franz/Work/Personal/fish/apps/web/app/globals.css — current token state (monochrome, role-based naming, ready for dual-theme refactor)
- /Users/franz/Work/Personal/fish/apps/web/package.json — current tailwindcss/postcss versions and ranges
- /Users/franz/Work/Personal/fish/AGENTS.md — design rules, API boundary, build order, non-negotiable constraints
- /Users/franz/Work/Personal/fish/PROJECT.md — product requirements, coaching-first rule, scope decisions

---
*Research completed: 2026-07-02*
*Synthesized by: Claude Haiku 4.5*
*Ready for roadmap planning.*
