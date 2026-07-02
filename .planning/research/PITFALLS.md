# Pitfalls Research

**Domain:** Supabase auth (email/password) on Next.js App Router with role-based RLS, plus Tailwind v4 CSS-first dual-theme tokens
**Researched:** 2026-07-02
**Confidence:** HIGH (Supabase auth/RLS findings cross-verified via official docs + Context7 + multiple community sources; Tailwind v4 dark mode verified via official docs; project-specific drift findings verified by reading current codebase)

## Critical Pitfalls

### Pitfall 1: Trusting `getSession()` (or unverified cookie data) for server-side auth decisions

**What goes wrong:**
Middleware, layouts, or Server Components read `supabase.auth.getSession()` (or worse, read `user_metadata` off a decoded cookie) and treat the result as proof of identity. `getSession()` reads the session from the storage adapter (cookies) without contacting the Auth server, so a forged or stale cookie can pass as a valid session on the server. This is a spoofing vector, not just a staleness bug — cookies can be edited by the client.

**Why it happens:**
`getSession()` is the first result in autocomplete and works fine client-side (where the SDK already trusts local storage) and in tutorials that don't distinguish server vs. client trust boundaries. Copy-pasting client-side patterns into middleware/Server Components is the default mistake.

**How to avoid:**
- Server-side (middleware, Server Components, Route Handlers, Server Actions): always call `supabase.auth.getUser()` — it makes a network round-trip to the Auth server and verifies the token — or, if the project uses newer asymmetric JWT signing keys, `supabase.auth.getClaims()`, which verifies the JWT locally against the cached JWKS endpoint (fast, still cryptographically verified, no round-trip needed once cached).
- Never use `getSession()` to gate a redirect, a role check, or a data read in server code. Reserve `getSession()` for client-side reads where you already control the browser context.
- `getClaims()` still falls back to a network call if the project uses the legacy shared-secret (HS256) signing key rather than asymmetric (RS256/ES256) — check which key type the project uses before assuming the "cheap" local-verification path applies.

**Warning signs:**
- Any `.getSession()` call inside `middleware.ts`, a Server Component, or a Route Handler.
- Auth checks that read `request.cookies` directly and parse a JWT payload without calling an SDK verification method.
- A code review comment or PR that "removes the getUser() call because it looked redundant with getSession()."

**Phase to address:** Auth foundation phase (Supabase client setup: browser client, server client, middleware). Add this as an explicit acceptance check on every PR touching auth: "does this call getUser()/getClaims(), not getSession(), for any server-side authorization decision?"

---

### Pitfall 2: RLS policy recurses on itself (infinite recursion / "infinite recursion detected in policy for relation")

**What goes wrong:**
A policy on `profiles` (or a `coach_clients` relationship table) needs to check the current user's role or relationship — e.g. "a coach can read a client's profile if they are assigned to that client." The natural first draft writes a `SELECT` against `profiles` (or the same relationship table) *inside* the policy's `USING` clause. Because RLS applies to every query against that table — including the one the policy itself issues — Postgres re-triggers the same policy while evaluating it, and throws "infinite recursion detected in policy for relation."

**Why it happens:**
Role/relationship data for this app naturally lives in tables that are themselves protected by RLS (`profiles`, `coach_clients`). Checking "is this user a coach of that client" requires querying exactly the table (or a related table) that RLS is trying to protect. This is not an edge case — it's the default shape of any coach/client relationship check.

**How to avoid:**
- Wrap any role/relationship lookup used inside a policy in a `SECURITY DEFINER` function marked `STABLE`, placed in a non-exposed schema (e.g. `private`), so the inner lookup bypasses RLS instead of re-triggering it:
  ```sql
  create schema if not exists private;

  create function private.is_coach_of(client_id uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = ''
  as $$
    select exists (
      select 1 from public.coach_clients cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = is_coach_of.client_id
    );
  $$;

  create policy "coach_reads_assigned_client_profile"
  on public.profiles for select
  to authenticated
  using ( (select private.is_coach_of(id)) );
  ```
- Never put `SECURITY DEFINER` functions in `public` if they aren't meant to be called directly via the API — restrict to a private schema.
- Do not read a role off `profiles` from inside a `profiles` policy directly; always go through the definer function.

**Warning signs:**
- Postgres error `42P17: infinite recursion detected in policy for relation "profiles"` (or `coach_clients`) — this fires at query time, so it often only surfaces once you write the first real coach-side query, not at migration time.
- A policy's `USING`/`WITH CHECK` clause contains a bare subquery against the same table the policy is defined on, or against another RLS-protected table that itself checks back.

**Phase to address:** Database foundation phase (migrations + RLS policies for `profiles` and the coach-client relationship table). Verify by writing a test query as both a coach and a client role and confirming no recursion error and correct row visibility, before building any UI on top.

---

### Pitfall 3: `role` stored/trusted client-side instead of enforced by RLS on every table

**What goes wrong:**
The app reads `role` from `packages/core` types or from client-side state (e.g. a cached profile object, `user_metadata`, or a prop passed down) and uses it to decide what to *render*, then assumes that's also what *protects* the data. If RLS isn't independently enforcing the coach/client boundary at the database layer, a client with dev tools (or a modified request) can read/write data belonging to other clients or escalate to coach-only reads, regardless of what the UI shows.

A specific, easy-to-miss variant: role or profile data is written into `user_metadata` (`raw_user_meta_data`), which the authenticated user can update themselves via `supabase.auth.updateUser()`. If any RLS policy or server logic trusts `user_metadata` for authorization, a client can self-promote to coach by editing their own metadata. `app_metadata` (`raw_app_meta_data`) is the field that only server-side/service-role code can write — that's the only metadata field safe to use for authorization.

**Why it happens:**
Role is needed in the UI immediately (to decide "show coach home vs. client home"), so it's tempting to treat that same client-visible value as the enforcement mechanism, skipping the step of writing a matching RLS policy. Storing role on `user_metadata` "just works" in early testing because the developer is the one making the requests honestly.

**How to avoid:**
- Treat client-visible role (from a fetched profile row, a session, or middleware-computed redirect target) as **presentation only**. Every table that has role-differentiated access must have its own RLS policy that re-derives the caller's role/relationship server-side (see Pitfall 2's `SECURITY DEFINER` pattern) — never trust a role value the client asserts.
- Store `role` in the `profiles` table (server-writable, RLS-protected: clients can read their own row but cannot update the `role` column — enforce with a `WITH CHECK` or a trigger that rejects role changes from non-service-role callers) rather than in `user_metadata`.
- If a JWT custom claim for role is added later for performance, populate it via a Custom Access Token Auth Hook reading from `app_metadata`/`profiles` — never from `user_metadata` — and remember the claim goes stale until the user's session refreshes (do not rely on it for anything that must reflect an *immediate* role change, e.g. right after manually assigning a coach).
- Because "signup always creates clients" and "coach accounts are seed-only" are explicit product constraints (see PROJECT.md), add a positive test: attempt to self-register as a coach (via API, not UI) and confirm it's rejected — both at the signup handler and via RLS on `profiles.role`.

**Warning signs:**
- Any RLS policy that references `auth.jwt() -> 'user_metadata'` or `raw_user_meta_data`.
- A signup flow that lets the client pass a `role` field that gets written verbatim.
- UI-only role gating (e.g. `if (role === 'coach') return <CoachHome/>`) with no corresponding table-level policy proven by a test written as the other role.

**Phase to address:** Auth foundation phase (roles) and database foundation phase (RLS). Verification: for every table, write down "what happens if a client calls this with a forged role" and confirm RLS — not app code — is what blocks it.

---

### Pitfall 4: `handle_new_user` trigger silently blocks all signups

**What goes wrong:**
A trigger on `auth.users` (commonly named `handle_new_user`, firing `AFTER INSERT`) creates the matching `public.profiles` row. If this trigger function isn't `SECURITY DEFINER`, or references a table the trigger's executing role (`supabase_auth_admin`) doesn't have grants on, or violates a `NOT NULL`/`UNIQUE` constraint on `profiles`, the *entire signup transaction fails* — not just the profile insert. Users see a generic "Database error saving new user" and cannot sign up at all. This is easy to miss locally if the first few test signups happen to satisfy the trigger's assumptions, then breaks the moment a real edge case (duplicate email casing, missing display name, etc.) hits it.

**Why it happens:**
The trigger crosses a schema/privilege boundary: `auth.users` is owned by Supabase's internal `supabase_auth_admin` role, which has minimal grants outside the `auth` schema by design. Tutorials often show the trigger function without `security definer` or without `set search_path = ''`, which works in a quick demo but is fragile.

**How to avoid:**
- Trigger function must be `SECURITY DEFINER`, owned by a role with insert rights on `public.profiles` (typically `postgres`), and should set `search_path = ''` (or explicit schema-qualify everything) to avoid search-path hijacking.
- Keep the trigger function minimal and defensive: use `insert ... on conflict do nothing` semantics where sensible, avoid `NOT NULL` columns on `profiles` that aren't guaranteed present at signup (e.g. don't require `display_name` not-null if the signup form doesn't collect it yet).
- Test signup with the actual Supabase local/staging instance (not just a mocked client) before considering auth "done" — this failure mode does not show up in pure frontend testing.
- Since this product mandates "signup always creates clients," the trigger is also the natural place to set `role = 'client'` by default — make that default explicit and covered by a test, since it's also the security boundary from Pitfall 3.

**Warning signs:**
- Supabase error `Database error saving new user` returned from `signUp()`.
- Postgres logs showing a permission-denied or constraint-violation error on `public.profiles` at the time of a `auth.users` insert.
- Any migration that creates the trigger function without `security definer`.

**Phase to address:** Database foundation phase (migrations), before auth UI is considered functional. Verify with an actual signup against a local Supabase instance, not just a UI smoke test.

---

### Pitfall 5: Middleware doesn't refresh/persist the session correctly, causing random logouts or stale sessions

**What goes wrong:**
Two related failure shapes:
1. No middleware calls `getUser()`/refreshes the token at all → access tokens expire mid-session and users get silently logged out on the next server-rendered request, because Server Components can only *read* cookies, not write refreshed ones back to the browser.
2. Middleware is added, but the `NextResponse` object is re-created or replaced after cookies were set on it (a very common mistake: calling `NextResponse.next()` a second time, or returning a *new* response instead of the one the Supabase cookie handlers wrote to), silently dropping the refreshed session cookie.

**Why it happens:**
The Supabase SSR cookie contract requires `getAll`/`setAll` cookie handlers that write to *both* the incoming request (so downstream Server Components see the refreshed session in the same request) *and* the outgoing response (so the browser stores the refreshed cookie). It's easy to write a middleware that only threads one of the two, or that constructs the response before creating the Supabase client and then swaps it, which detaches the cookie writes from the object actually returned.

**How to avoid:**
- Follow the official pattern exactly: create the mutable `response` first, create the Supabase server client with `getAll`/`setAll` that write to both `request.cookies` and `response.cookies`, call `getUser()` (not `getSession()`) to force a refresh check, and return that same `response` object — do not construct a second `NextResponse` afterward.
- Do not run other logic between creating the Supabase client and calling `getUser()` in middleware — the official docs call this out explicitly because it's easy to accidentally short-circuit the refresh (e.g. an early `return` for a public route added above the auth check).
- Scope the middleware `matcher` to avoid running on static assets/prefetch requests, both for performance and to avoid needless refresh calls triggered by Next.js link prefetching.
- If deploying behind a CDN or using ISR on any route touched by auth cookies, ensure `Cache-Control: private, no-store` is respected on responses that set auth cookies — a cached `Set-Cookie` response can leak one user's session to another user's browser. (Lower risk for this project initially since most authenticated routes won't be cached, but worth a deliberate check before any caching is added later.)

**Warning signs:**
- Users report being logged out after leaving a tab open, or after their token's ~1 hour expiry, even though "remember me" / persistent session was expected.
- Middleware code has more than one `NextResponse.next()`/`NextResponse.redirect()` construction, or logic runs between client creation and `getUser()`.
- Any route redirects to `/login` unpredictably right after a legitimate sign-in.

**Phase to address:** Auth foundation phase (middleware + protected routing). Verify by testing a session across an actual token expiry window (or by forcing expiry in local dev) and confirming the app stays signed in without a manual re-login.

---

### Pitfall 6: Email verification / password reset redirect flow breaks because confirmation and OAuth-style callback routes are conflated

**What goes wrong:**
Supabase's default email templates use `{{ .ConfirmationURL }}`, which is a legacy implicit-flow link that lands the user on the site with tokens in the URL *fragment* (`#access_token=...`), which Server Components/Route Handlers cannot read (fragments never reach the server). Teams following the PKCE/SSR pattern need to instead point the email template at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (or `type=recovery` for password reset), and implement a **separate** `/auth/confirm` Route Handler that calls `supabase.auth.verifyOtp({ type, token_hash })` — this is a different mechanism from the `/auth/callback` handler that calls `exchangeCodeForSession(code)` for OAuth/PKCE-code links. Mixing these up (e.g. building only a `/auth/callback` that expects a `code` param, then wiring the confirmation email to send `token_hash` instead) means every confirmation/reset link 404s or errors on the exact flow that matters most for this app (signup verification, password reset).

A second common failure: the confirmation link is single-use and short-lived; if an email client's link-scanning/pre-fetch bot (many corporate/consumer mail scanners do this for "safety") opens the link before the real user does, the token gets consumed and the user's own click then fails with "email link is invalid or has expired" — this reads as a Supabase bug but is a link-scanner interaction that requires either a confirmation-landing page (not an auto-consuming GET) or handling the already-used case gracefully in copy.

**Why it happens:**
Supabase's docs and dashboard defaults still reference the older `{{ .ConfirmationURL }}` template pattern in places, while the SSR/PKCE guide requires the `token_hash` + `/auth/confirm` pattern. Most tutorials for "Supabase + Next.js auth" focus on OAuth (`/auth/callback`) since that's the flashier flow, so email/password verification (which this project actually needs first) gets less coverage and is easy to under-build.

**How to avoid:**
- Update the Supabase email templates (Confirm signup, Reset password, Magic Link) to use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (or the relevant `type`) rather than the default `{{ .ConfirmationURL }}`.
- Implement `/auth/confirm` as a Route Handler using `verifyOtp({ type, token_hash })`, separate from any OAuth `/auth/callback`. Since this milestone has no OAuth, only `/auth/confirm` is needed — but name it precisely so it isn't confused with a future OAuth callback route.
- Make the confirm handler idempotent/gentle in error copy: if `verifyOtp` fails because the token was already consumed (e.g. by a mail scanner), the message should say "this link was already used — try logging in, or request a new one" rather than a scolding/technical error (this also satisfies the AGENTS.md copy rule: never scold, always guide).
- Set explicit `Site URL` and `Redirect URLs` in Supabase Auth settings for every environment (local, staging, prod) — a mismatch here causes redirects to silently fall back to `localhost` in production, a documented, frequently-reported issue.

**Warning signs:**
- Confirmation link lands on a page showing raw `#access_token=` in the URL bar with no session established.
- "Email link is invalid or has expired" reported by real users who are confident they clicked promptly.
- Password reset and email verification share one handler that only expects one `type`.

**Phase to address:** Auth foundation phase (email/password auth: signup, verification, reset). Verify by testing the actual email link end-to-end (not just the API call) in at least one environment with real email delivery, including a deliberate "click twice" test.

---

### Pitfall 7: Tailwind v4 + PostCSS plugin version drift silently breaks the build/tokens

**What goes wrong:**
Tailwind v4's CSS-first `@theme` approach couples `tailwindcss` and `@tailwindcss/postcss` tightly — if they drift to different versions (e.g. one gets bumped by a dependency update, `pnpm up` without pinning, or a partial `pnpm add` in a workspace package), the build can fail outright, or — worse — succeed while silently not applying some/all of the `@theme` tokens, producing unstyled or partially-styled output that's easy to miss in a quick visual check but breaks specific components.

**Why it happens:**
Because there's no `tailwind.config.js`, there's no single place developers instinctively check for "is this configured right" — the coupling lives purely in `package.json` version ranges (`^4.3.1` for both currently in this repo, which allows independent minor-version drift since `^` permits different patch/minor bumps for each package if resolved separately in a workspace). In a pnpm monorepo, if `@tailwindcss/postcss` is hoisted or resolved from a different workspace package than `tailwindcss`, they can end up mismatched even with matching semver ranges.

**How to avoid:**
- Pin `tailwindcss` and `@tailwindcss/postcss` to the *exact same* version (not just the same `^` range) in `apps/web/package.json`, and re-verify after every `pnpm install`/`pnpm up`.
- Never create `tailwind.config.js` — if one appears (e.g. from a copy-pasted example or an AI suggestion), Tailwind v4 will silently prefer/ignore config in ways that don't match the CSS-first mental model; delete it and keep all tokens in `@theme` in `globals.css`.
- After any Tailwind-related dependency change, do a full visual pass of the UI kit demo page (all components, all states, both themes) before merging — this is exactly the kind of regression a quick "does `pnpm build` pass" check won't catch, since the build can succeed with wrong/missing styles.
- Add `pnpm build` (which this repo already requires pre-commit per AGENTS.md) as the baseline gate, but recognize it verifies *compilation*, not *correct token output* — the visual pass is the only thing that catches silent drift.

**Warning signs:**
- `pnpm build` passes but a component that shouldn't be missing color obviously renders unstyled or default browser-styled.
- `pnpm-lock.yaml` diff shows `tailwindcss` and `@tailwindcss/postcss` resolving to different versions after a routine dependency update.
- Any PR that adds or references `tailwind.config.js`, `tailwind.config.ts`, or `postcss.config.js` beyond the existing `@tailwindcss/postcss` plugin entry.

**Phase to address:** Design system / token pipeline phase (this milestone, since it hardens the UI kit and formalizes the token pipeline). Add a lockfile check or CI step asserting both packages match exactly.

---

### Pitfall 8: Dual-theme (light/dark) tokens flash on load (FOUC) or mismatch server/client render (hydration error)

**What goes wrong:**
Two related failures when adding a real light/dark theme (this project currently has only a single flat token set with no dark variant at all — this milestone is where dual-theme structure is introduced for the first time):
1. **FOUC:** if theme choice (light/dark, or "follow system") is only applied client-side after mount (e.g. via a `useEffect` that toggles a class), the server-rendered HTML paints with the default theme first, then visibly flips — jarring for an ADHD-focused calm product, and directly works against the product's anti-startle design goals.
2. **Hydration mismatch:** if the server renders one theme class/attribute and the client's inline script or theme library computes a different one (because it reads `localStorage`/`matchMedia`, which don't exist on the server), React throws a hydration mismatch warning/error on the `<html>` element unless explicitly suppressed there.

**Why it happens:**
Theme preference (especially "follow system" or a previously-saved user choice) is fundamentally a client-only piece of information at first paint — the server doesn't know the browser's `prefers-color-scheme` or `localStorage` value on a cookie-less read. Naive implementations toggle the theme class only after React mounts, which is both too late (FOUC) and inconsistent with what the server actually sent (hydration error).

**How to avoid:**
- Use Tailwind v4's `@custom-variant` to bind `dark:` to an explicit selector this project controls (class or `data-theme` attribute on `<html>`) rather than the default `prefers-color-scheme`-only behavior, so a persisted user choice can override system preference:
  ```css
  @import "tailwindcss";
  @custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
  ```
- Set the theme attribute on `<html>` via a small **inline, synchronous** script in `<head>` (not a deferred/external script, not a `useEffect`) that runs before first paint: read `localStorage`, fall back to `matchMedia('(prefers-color-scheme: dark)')`, and set the attribute immediately. This is the standard pattern used by `next-themes` and hand-rolled solutions alike.
- Add `suppressHydrationWarning` on the `<html>` element specifically (it only suppresses one level deep, so it's safe/scoped) since the inline script intentionally changes that element before React hydrates.
- If persisting theme choice server-side later (e.g. for logged-in users so the theme is consistent across devices), prefer reading it from a cookie in the root layout (readable server-side) over `localStorage` alone — this avoids the FOUC/hydration problem entirely for authenticated users because the server can render the correct theme class from the start. Worth deciding now given auth is being built in this same milestone: a cookie-backed theme preference (readable in `middleware.ts`/root layout) is more aligned with an SSR app than `localStorage`-only.
- Respect `prefers-reduced-motion` when transitioning between themes (already a stated project rule) — disable/skip any color-transition animation for users with that preference, and consider `disableTransitionOnChange`-equivalent behavior so toggling doesn't cause a jarring cross-fade across the whole screen (calm-product requirement, not just a performance nicety).

**Warning signs:**
- Visible flash/flip of background color on hard refresh, especially in dark-preferring browsers/OS.
- React warning: "Hydration failed because the server rendered HTML didn't match the client" pointing at the `<html>` or root element.
- Theme toggle "sticks" only after a manual refresh instead of applying immediately.

**Phase to address:** Design system / dual-theme token phase (this milestone, explicitly listed: "Light and dark monochrome themes from day one"). Verify by hard-refreshing in both an OS-dark and OS-light environment and confirming zero visible flash, plus checking the browser console for hydration warnings.

---

### Pitfall 9: Monochrome/dual-theme token naming that can't later layer color without a rename

**What goes wrong:**
This milestone deliberately strips color (lime primary, pink/yellow accents) down to pure monochrome, with color explicitly planned as "a deliberate later layer" (per PROJECT.md). If token names are chosen to describe the *current* value rather than its *role* (e.g. `--color-black`, `--color-white`, `--color-grey-1`, `--color-dark-surface`) instead of semantic/role-based names (e.g. `--color-bg`, `--color-surface`, `--color-primary`, `--color-on-primary`), then reintroducing color later requires renaming tokens across every component and both themes — exactly the retrofitting cost the project is trying to avoid by doing dual-theme now. The existing `globals.css` (read directly for this research) already uses role-based names (`--color-bg`, `--color-primary`, `--color-on-primary`, etc.) with OKLCH values — the naming convention is sound; the risk is in *how the monochrome pass rewrites values*, not introducing new literal names.

A second, more concrete risk specific to this migration: the current tokens are a single flat set (no light/dark split at all) with actual saturated brand colors (aquatic blue primary, coral/sand accents) baked directly into names like `--color-accent-pink`/`--color-accent-yellow` that describe *hue*, not *role*. Migrating to monochrome while keeping hue-named tokens (`accent-pink` now rendering as grey) leaves misleading names in the codebase that will confuse the next person who adds color back — a token called `accent-pink` that renders as a shade of grey is a trap.

**How to avoid:**
- Name every token for its **role/purpose** (`bg`, `surface`, `surface-2`, `primary`, `on-primary`, `foreground`, `body`, `muted`, `notice`, `success`) not its literal color or hue — the current file mostly does this already except for `accent-pink`/`accent-yellow`, which should be renamed to role-based names (e.g. `accent-1`/`accent-2`, or removed entirely if monochrome truly has no accent tier this milestone) rather than kept as color-named tokens holding grey values.
- Define both themes' values using the same token *names*, scoped by the `dark:`/`[data-theme=dark]` selector or a light/dark `@theme` block pair — never invent separate token names per theme (e.g. avoid `--color-bg-light` / `--color-bg-dark` as the primary API; instead let `--color-bg` resolve differently per theme scope so components never need to know which theme is active).
- Keep the semantic *contrast/weight* roles (e.g. `notice`, distinguished "by weight/structure, not hue" per AGENTS.md in monochrome) as their own named tokens now, even though they currently render as a shade of grey/weight — this is exactly the kind of token that must exist today so color can be layered onto it later without a rename, matching the project's own stated design rule.
- Document (in the UI kit demo page, which this milestone already plans to build) which tokens are "structural" (bg/surface/border — likely to stay neutral even after color returns) vs. "expressive" (primary/notice/accent — the ones color will land on first) so the later color milestone has a clear map of what to touch.

**Warning signs:**
- A token name containing a literal hue word (`pink`, `yellow`, `blue`, `grey-3`) whose rendered value no longer matches that hue after the monochrome pass.
- Components hard-coding `dark:` variants inline per-component instead of consuming theme-aware tokens — this defeats the purpose of a token layer and means color-layering later requires touching every component instead of just `@theme`.
- Two different token names used for what is conceptually the same role in light vs. dark mode.

**Phase to address:** Design system / monochrome token phase (this milestone). Verify by checking every token name in `globals.css` against "does this name describe what it's *for*, not what it currently *looks like*."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Skip the `/auth/confirm` custom route and rely on Supabase's default `{{ .ConfirmationURL }}` (implicit flow) | Faster to wire up, works in a quick manual test | Tokens land in URL fragment, unreadable server-side; breaks the SSR/PKCE session model the rest of the app uses | Never for this project — the app is SSR/App-Router-first |
| Store role on `user_metadata` instead of `profiles`/`app_metadata` | One less table join; role visible on the JWT immediately | Client can self-escalate role via `updateUser()`; violates the explicit "signup always creates clients" security constraint | Never |
| Write RLS policies with direct `auth.uid()` comparisons (no `SELECT` wrapping) | Simpler-looking SQL, fine at low row counts | Postgres re-evaluates per row; becomes a real latency problem once conversations/messages tables grow (chat is the very next foundation phase) | Acceptable only for tables that will always stay tiny (e.g. a single-row config table); never for `profiles`, `messages`, or `coach_clients` |
| Skip the `handle_new_user` `SECURITY DEFINER` + `search_path` hardening because "it works in local dev" | Faster migration to write | Silent, hard-to-diagnose signup failures in production the first time a constraint or grant edge case is hit | Never — this is a one-time correct pattern, not worth deferring |
| Use `localStorage`-only theme persistence instead of a cookie readable by the server | Simpler, no server plumbing needed | FOUC returns for any authenticated/server-rendered route that could otherwise know theme ahead of time; harder to retrofit once pages assume client-only theme state | Acceptable for this milestone's unauthenticated marketing/demo pages; not for the authenticated app shell once auth exists in the same milestone |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase SSR (`@supabase/ssr`) in middleware | Constructing a second `NextResponse` after cookies were set, or running logic between client creation and `getUser()` | Create `response` once, wire `getAll`/`setAll` to both `request` and `response` cookies, call `getUser()` immediately, return that same `response` |
| Supabase email templates | Leaving default `{{ .ConfirmationURL }}` while building a PKCE/SSR `/auth/confirm` handler that expects `token_hash` | Update templates to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` to match the handler actually built |
| Supabase Auth redirect URLs | Only configuring `Site URL`/`Redirect URLs` for local dev, forgetting staging/prod | Explicitly set per-environment Site URL and allow-list every redirect URL used (confirm, reset) in each environment's Auth settings |
| Supabase RLS + role checks | Querying the protected table (or a table with a circular RLS dependency) directly inside a policy | Use a `SECURITY DEFINER`, `STABLE` function in a private schema for any role/relationship lookup used inside a policy |
| pnpm workspace + Tailwind v4 | Letting `tailwindcss` and `@tailwindcss/postcss` resolve to different versions across the workspace | Pin both to the exact same version in `apps/web/package.json`; re-check after every dependency bump |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Unwrapped `auth.uid()` in RLS policies (`USING (user_id = auth.uid())`) | Queries against `messages`/`profiles` get slower as row count grows; Supabase's Performance Advisor flags `auth_rls_initplan` | Wrap in `(select auth.uid())` so Postgres caches it as an init-plan instead of evaluating per row; add supporting indexes on the compared columns | Noticeable once tables reach tens of thousands of rows — likely to hit first on `messages` once chat (the next foundation phase) ships |
| No middleware `matcher` scoping | Middleware runs on every static asset/prefetch request, adding latency and needless Supabase Auth calls | Scope `matcher` in `middleware.ts` to exclude `_next/static`, images, and other non-page assets | Noticeable as soon as Next.js link prefetching is exercised across multiple protected routes |
| Realtime subscriptions per open conversation (flagged in CONCERNS.md) | Slower page loads / connection overhead as concurrent users grow | Not this milestone's concern directly, but the auth/session model built now (cookie-based, `getUser()` per request) should not be re-derived per Realtime event — cache the verified user for the connection's lifetime | Out of scope for this milestone; flag for the chat foundation phase |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting `getSession()` server-side | Forged/stale cookie treated as valid identity, enabling impersonation | Always `getUser()`/`getClaims()` server-side; reserve `getSession()` for client-only reads |
| Authorization derived from `user_metadata` | Client can self-escalate role via `updateUser()` | Only use `app_metadata`/`profiles` (server-writable) for role/authorization data |
| Missing or recursive RLS on `profiles`/`coach_clients` | Any client can read other clients' data, or a client can read coach-only data | Every table gets RLS from the first migration; role/relationship checks go through `SECURITY DEFINER` functions, tested as both roles before shipping |
| Signup allowed to set its own `role` | Client can register directly as a coach | Signup handler/trigger hard-codes `role = 'client'`; RLS blocks client-initiated updates to `profiles.role`; coach creation stays a manual/seed act as the product requires |
| Cached responses on routes that set auth cookies | One user's session `Set-Cookie` served to a different user behind a CDN/ISR cache | Ensure auth-cookie-setting responses stay `Cache-Control: private, no-store`; avoid ISR on authenticated routes |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Theme flash (FOUC) on load | Jarring flash of wrong-then-right background — directly undermines the "calm, no startle" product goal for an ADHD-focused audience | Inline synchronous theme script in `<head>` + `suppressHydrationWarning` on `<html>`, or server-rendered theme from a cookie once auth exists |
| Technical/scolding error copy on an already-used or expired confirmation link | Confused, anxious user who did nothing wrong (often just an email scanner bot consumed the link first) | Soft, guiding copy per AGENTS.md's "never scold" rule: "this link was already used — try logging in, or we'll send a new one" |
| Auth session silently expiring mid-use due to missed middleware refresh | User loses in-progress work (e.g. a chat draft) and is bounced to login with no warning | Correct middleware refresh pattern (Pitfall 5) plus, if a session does expire, preserve any in-flight input rather than discarding it on redirect |
| Role visible in UI immediately after coach assignment via seed, but stale JWT claim (if claims are ever used for role) doesn't reflect it | Coach/client sees old permissions until they log out and back in, looking like a bug | Prefer a fresh `profiles` read (not a JWT claim) for anything that must reflect an assignment made moments ago, given assignment is seed-only and manual this milestone |

## "Looks Done But Isn't" Checklist

- [ ] **Email/password auth:** Often missing the actual `/auth/confirm` route and updated email templates — signup "succeeds" in a demo where the developer manually confirms via the Supabase dashboard, but the real email link flow was never exercised end-to-end. Verify: click an actual confirmation email in a fresh inbox, in the deployed/staging environment, not just call the API directly.
- [ ] **Middleware protected routing:** Often missing the return-the-same-response discipline — passes a manual test (login, refresh once) but silently drops the refreshed cookie on a longer session. Verify: stay logged in past the access token's expiry window (or force-expire locally) and confirm no surprise logout.
- [ ] **RLS policies:** Often only tested as the "happy path" role (e.g. only ever queried as a coach in dev). Verify: write and run at least one query as a client attempting to read another client's data, and one as a client attempting a coach-only read — both must be rejected by the database itself, not by application code choosing not to ask.
- [ ] **Signup role safety:** Often only tested via the UI form, which naturally only offers "client." Verify: call the signup Edge Function/handler directly (or attempt a raw `profiles` insert as an authenticated client) with `role: 'coach'` and confirm it's rejected.
- [ ] **Dual theme:** Often only visually checked in one OS-level theme setting. Verify: hard refresh in both OS-light and OS-dark, and toggle any in-app theme control, checking for both visible flash and console hydration warnings.
- [ ] **Tailwind token pipeline:** Often "looks fine" because most utilities still resolve to *something* even when misconfigured (Tailwind falls back gracefully in places). Verify: check the UI kit demo page pixel-for-pixel against intended token values, not just "nothing looks broken."

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| RLS recursion discovered after other tables/features are built on top | LOW–MEDIUM | Introduce the `SECURITY DEFINER` helper function and rewrite the offending policies; no data migration needed, just policy replacement via a new migration file |
| Role stored on `user_metadata` and already in use | MEDIUM | Migrate role storage to `profiles`/`app_metadata` via a backfill migration, update all RLS policies referencing the old field, force-refresh sessions (or wait out token TTL) so stale claims clear |
| `handle_new_user` trigger blocking signups in production | MEDIUM–HIGH (if live users are affected) | Fix trigger function (add `security definer`, correct grants/constraints), then manually reconcile any `auth.users` rows that succeeded without a matching `profiles` row |
| Tailwind version drift shipped to production with broken tokens | LOW | Pin exact versions, reinstall, redeploy — no data/schema impact, purely a dependency fix |
| Token names baked around monochrome hues, color layer now blocked | MEDIUM | Rename tokens to role-based names in one pass, updating all component references; safe to do as a dedicated refactor commit since it's a rename, not a behavior change |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| `getSession()` trusted server-side | Auth foundation (Supabase client + middleware setup) | Code review grep for `.getSession(` in `middleware.ts`/Server Components; confirm only `.getUser()`/`.getClaims()` used server-side |
| RLS recursive policies | Database foundation (migrations + RLS for profiles/coach-client) | Run a query as each role (coach, client, unrelated client) before building any UI on top; confirm no `42P17` error and correct row visibility |
| Role trusted client-side / `user_metadata` misuse | Auth foundation (roles) + Database foundation (RLS) | Attempt self-registration as coach via direct API call; confirm rejection at both signup handler and RLS layer |
| `handle_new_user` trigger blocking signups | Database foundation (migrations) | Run real signups against local/staging Supabase instance (not mocked) before marking auth "done" |
| Middleware session refresh/cookie loss | Auth foundation (protected routing/middleware) | Test session across an actual or forced token-expiry window; confirm no unexpected logout |
| Email verification/reset redirect flow | Auth foundation (email/password auth) | Click a real confirmation/reset email end-to-end in at least one deployed environment; test "click twice" (already-used token) case |
| Tailwind version drift | Design system / token pipeline phase | Pin exact versions; add a lockfile assertion; full visual pass of UI kit demo page after any Tailwind dependency change |
| Theme FOUC / hydration mismatch | Design system / dual-theme token phase | Hard refresh in both OS-dark and OS-light; check browser console for hydration warnings |
| Token naming blocking future color layer | Design system / monochrome token phase | Audit every token name for role-based (not hue-based) naming before considering the token set "done" |

## Sources

- [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence, official docs, verified via WebFetch (getUser/getClaims warnings) and Context7 `/supabase/ssr` (middleware cookie pattern)
- [Creating a Supabase client for SSR — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence, official docs
- Context7 `/supabase/ssr` — `createServerClient`, middleware `getAll`/`setAll` cookie contract, `applyServerStorage` cache-control headers — HIGH confidence, official library source
- [Infinite recursion when using users table to specify users role for RLS — Supabase Discussion #1138](https://github.com/orgs/supabase/discussions/1138) — MEDIUM-HIGH confidence, official Supabase GitHub discussion, pattern cross-verified against Supabase RLS docs (`security definer` function)
- [Supabase RLS SECURITY DEFINER: Preventing Infinite Recursion — DEV Community](https://dev.to/kanta13jp1/supabase-rls-security-definer-preventing-infinite-recursion-in-admin-policies-4go2) — MEDIUM confidence, community source, consistent with official pattern
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence, official docs (security definer function pattern, verified via WebFetch)
- [Custom Claims & Role-based Access Control (RBAC) — Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — HIGH confidence, official docs
- [JWT Claims Reference — Supabase Docs](https://supabase.com/docs/guides/auth/jwt-fields) — HIGH confidence, official docs
- [RLS Performance and Best Practices — Supabase Troubleshooting](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH confidence, official docs (`(select auth.uid())` init-plan pattern)
- [76 RLS policies rewritten in one migration — DEV Community](https://dev.to/arvavit/76-rls-policies-rewritten-in-one-migration-the-authuid-init-plan-trap-in-supabase-4hg) — MEDIUM confidence, community, consistent with official advisor lint (`auth_rls_initplan`)
- [Database error saving new user — Supabase Troubleshooting](https://supabase.com/docs/guides/troubleshooting/database-error-saving-new-user-RU_EwB) — HIGH confidence, official docs
- [Sign-up database trigger to insert into public users table — Supabase Discussion #306](https://github.com/orgs/supabase/discussions/306) — MEDIUM confidence, official Supabase GitHub discussion
- [PKCE flow — Supabase Docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow) — HIGH confidence, official docs
- [Email-based Auth with PKCE Flow for SSR — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr) — HIGH confidence, official docs, verified via WebFetch (`/auth/confirm` + `verifyOtp` pattern)
- [Always redirects to localhost despite correct redirect URLs — Supabase Discussion #26483](https://github.com/orgs/supabase/discussions/26483) — MEDIUM confidence, official Supabase GitHub discussion
- [JavaScript: getUser — Supabase Docs](https://supabase.com/docs/reference/javascript/auth-getuser) — HIGH confidence, official reference
- [JavaScript: getClaims — Supabase Docs](https://supabase.com/docs/reference/javascript/auth-getclaims) — HIGH confidence, official reference
- [Introducing JWT Signing Keys — Supabase Blog](https://supabase.com/blog/jwt-signing-keys) — HIGH confidence, official blog (asymmetric keys default since Oct 2025, getClaims local verification)
- [Dark mode — Core concepts — Tailwind CSS](https://tailwindcss.com/docs/dark-mode) — HIGH confidence, official docs, verified via WebFetch (`@custom-variant`, FOUC inline-script pattern)
- [next-themes — GitHub (pacocoursey)](https://github.com/pacocoursey/next-themes) — MEDIUM-HIGH confidence, widely-adopted reference implementation for the FOUC/hydration pattern
- Direct repository inspection: `/Users/franz/Work/Personal/fish/apps/web/app/globals.css`, `apps/web/package.json` — HIGH confidence, primary source (confirms current single-flat-theme token state and exact dependency versions)
- `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md`, `AGENTS.md` — HIGH confidence, primary project sources

---
*Pitfalls research for: Supabase auth + RLS on Next.js App Router, Tailwind v4 dual-theme tokens*
*Researched: 2026-07-02*
