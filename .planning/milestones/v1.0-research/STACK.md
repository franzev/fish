# Stack Research

**Domain:** Supabase auth (SSR, App Router) + dual-theme design tokens on Tailwind v4, added to an existing Next.js 16 / React 19 monorepo
**Researched:** 2026-07-02
**Confidence:** HIGH (versions and code patterns verified against npm registry and official docs/source READMEs on 2026-07-02)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` | `2.110.0` | Core Supabase JS client (auth, database, storage, realtime) | Official client; latest stable on npm as of research date. `3.0.0-next.*` exists but is a prerelease line — do not adopt for this milestone. |
| `@supabase/ssr` | `0.12.0` | Cookie-aware Supabase client factories for SSR frameworks (`createBrowserClient`, `createServerClient`) | Official successor to the deprecated `@supabase/auth-helpers-*` packages. Framework-agnostic; ships the documented App Router cookie pattern. Latest stable on npm as of research date. |
| Tailwind CSS | `4.3.2` (project pinned `4.3.1` — safe to bump) | Utility CSS, CSS-first `@theme` config | Already the project's locked choice (AGENTS.md forbids `tailwind.config.js`). v4's `@custom-variant` directive is what makes a second (dark) theme a CSS-only concern — no JS theme engine required for the styling itself. |
| `@tailwindcss/postcss` | `4.3.2` | PostCSS plugin for Tailwind v4 | **Must match `tailwindcss` version exactly** (already an AGENTS.md rule) — mismatched versions break the build. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Inline `<head>` theme script (no package) | n/a | Read `localStorage` + `prefers-color-scheme`, set `data-theme` on `<html>` before paint | **Recommended default for this project.** Zero dependencies, ~10 lines, no hydration-mismatch risk, no `"use client"` boundary needed at the root. See "Theme-Switching Approach" below. |
| `next-themes` | `0.4.6` | Turnkey theme provider + `useTheme()` hook, system-preference sync, no-flash script injection | Only if the roadmap later needs a rich in-app theme picker (explicit light/dark/system toggle UI with reactive updates in many components). Not needed for "theme respects OS preference, persists a manual override" — the inline script covers that alone. See caveat below. |
| `@supabase/auth-js` types (bundled) | via `@supabase/supabase-js` | `User`, `Session`, `AuthError` types | Already exported from `@supabase/supabase-js`; do not install separately. Use to type `packages/supabase` contracts. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI (already scaffolded per `supabase/config.toml`) | Local Postgres, migrations, Edge Functions, type generation | Use `supabase gen types typescript --local` (or `--linked`) to generate DB types into `packages/supabase` — keeps `packages/supabase` as the single source of truth for auth/database contracts per AGENTS.md. |
| `next.config.mjs` — no change needed | n/a | No Supabase-specific Next.js config required; `@supabase/ssr` works with default Next.js 16 server/edge runtimes. |

## Installation

```bash
# From apps/web
pnpm add @supabase/supabase-js@2.110.0 @supabase/ssr@0.12.0

# Only if a richer theme-toggle UI is scoped later (see caveat below)
pnpm add next-themes@0.4.6
```

No dev dependency changes are needed — `tailwindcss` and `@tailwindcss/postcss` are already present; optionally bump both from `4.3.1` to `4.3.2` together (never independently, per AGENTS.md).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `@supabase/ssr` cookie pattern | `@supabase/auth-helpers-nextjs` | Never — officially deprecated and consolidated into `@supabase/ssr`. The npm README states this explicitly. |
| Inline `<head>` script for theme persistence | `next-themes` | If the roadmap adds a visible theme-toggle control with multiple consumers needing reactive `useTheme()` state (not just a CSS variant). For this milestone (tokens + OS-respecting theme, no toggle UI specified in PROJECT.md scope) the inline script is simpler and has no client-component/hydration surface. |
| `getClaims()` in `proxy.ts` for route protection | `getUser()` in `proxy.ts` | Use `getUser()` only where you need a **fresh** user record from the Auth server on that exact request (e.g. confirming email-verification status changed seconds ago). For ordinary "is this request authenticated, what's the role claim" gating, `getClaims()` is officially preferred — it validates the JWT locally via the project's JWKS endpoint (fast, no round trip) instead of always calling the Auth server. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Use the legacy `ANON_KEY` naming only if the Supabase project was created before the publishable/secret key system and hasn't been migrated. A **new** Supabase project created now issues both legacy and new-style keys; official quickstarts and example templates use the `PUBLISHABLE_KEY` naming. Confirm which key format the actual `supabase/config.toml`-linked project provides before locking the env var name. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `@supabase/auth-helpers-nextjs` / `-react` / `-remix` / `-sveltekit` | Deprecated, explicitly consolidated into `@supabase/ssr` per the package's own README ("Package Consolidation Notice"). No longer receives fixes. | `@supabase/ssr` |
| `middleware.ts` with `export function middleware()` | Next.js 16 renamed this convention to `proxy.ts` with `export function proxy()`. `middleware.ts` still works but is deprecated and documented as scheduled for removal; it also historically ran on the Edge runtime, while `proxy.ts` runs on the **Node.js runtime** — relevant if the auth proxy logic ever needs Node-only APIs. Since this app is already on Next.js 16.2.9, start with the current convention rather than something that will need a rename immediately. | `proxy.ts` exporting `proxy(request)`, per the [official Next.js Proxy docs](https://nextjs.org/docs/app/getting-started/proxy) |
| `supabase.auth.getSession()` for authorization decisions (in `proxy.ts`, server components, or RLS-adjacent checks) | Reads directly from the cookie with **no server verification** — a malicious client could forge a cookie with a spoofed user id. The `@supabase/ssr` README states this explicitly: "Do not use `getSession()` for authorization decisions." | `getClaims()` (routing/gating) or `getUser()` (when a verified, fresh record is required) |
| `tailwind.config.js` | Tailwind v4 is CSS-first; a config file is not read by the v4 pipeline and creating one is explicitly barred by AGENTS.md. | `@theme` block(s) in `apps/web/app/globals.css` |
| Raw hex colors or literal light/dark values duplicated per-component | AGENTS.md: "use these, never raw hex in web." Duplicating breaks the single-source-of-truth token contract the roadmap depends on for a later native token pipeline. | CSS custom properties inside `@theme` (or `@theme inline` — see below), referenced only via Tailwind utility classes |
| Separate auth provider (Clerk, NextAuth/Auth.js, Firebase Auth) | AGENTS.md is explicit: "one backend service, no separate auth provider." Supabase Auth is already the system of record for roles via RLS; adding a second identity provider creates a role-sync problem the coach/client RLS model doesn't need. | Supabase Auth (`@supabase/ssr` + `auth.users` + a `profiles` table with a `role` column) |

## Theme-Switching Approach (Tailwind v4 CSS-first, light + dark, monochrome)

**Recommended pattern: `data-theme` attribute + `@custom-variant` + inline no-flash script.**

1. **Custom variant, not the default media-query variant.** The project needs a theme the user (or a future in-app toggle) can override independent of OS preference, so define an explicit variant rather than relying on Tailwind's default `prefers-color-scheme` behavior:

   ```css
   /* apps/web/app/globals.css, near the top, after @import "tailwindcss" */
   @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
   ```

   Attribute-based (`data-theme`) over class-based (`.dark`) because the codebase already treats `data-*` conventions as the semantic layer (and `data-theme="light" | "dark"` is self-documenting versus an opaque `.dark` class — relevant since this is a *monochrome* system where the attribute value itself communicates intent).

2. **Token architecture: two value sets, one variable name.** Keep every existing token *name* (`--color-bg`, `--color-surface`, `--color-foreground`, etc. — per AGENTS.md's token list) but give each a light and dark value, switched by the `data-theme` attribute:

   ```css
   @theme {
     /* token *names* Tailwind generates utilities from */
     --color-bg: var(--bg);
     --color-surface: var(--surface);
     --color-foreground: var(--foreground);
     /* ...etc for every token */
   }

   :root, [data-theme="light"] {
     --bg: oklch(...);        /* near-white */
     --surface: oklch(...);
     --foreground: oklch(...); /* near-black */
   }

   [data-theme="dark"] {
     --bg: oklch(...);         /* near-black */
     --surface: oklch(...);
     --foreground: oklch(...); /* near-white */
   }
   ```

   This is the standard v4 pattern for theme-swappable design tokens: `@theme` declares the Tailwind-facing variable *once*; the actual light/dark values live in plain CSS custom properties resolved by the `data-theme` attribute on `<html>`. Avoids redeclaring `@theme` per-scheme (not supported — `@theme` is meant to run once) and avoids `dark:bg-[oklch(...)]` utility duplication across every component.

3. **No-flash theme resolution: inline script in `<head>`, not a client component wrapping the tree.** Add a small blocking inline script in `apps/web/app/layout.tsx`'s `<head>` that reads `localStorage` (fallback to `prefers-color-scheme`) and sets `data-theme` on `<html>` before first paint:

   ```tsx
   <script
     dangerouslySetInnerHTML={{
       __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
     }}
   />
   ```

   This is Tailwind's own documented approach for avoiding flash-of-wrong-theme and keeps `layout.tsx` a server component — no root-level `"use client"` boundary, no hydration mismatch, no extra dependency. It is proportionate to this milestone's scope (tokens + theme persistence; no toggle UI is in `PROJECT.md`'s Active scope).

4. **`next-themes` is a legitimate later upgrade, not a requirement now.** If a future milestone adds a visible theme-toggle control with several components reacting to theme state via a hook, `next-themes@0.4.6` is still the standard, well-tested choice (peer deps explicitly allow React 19: `"react": "^16.8 || ^17 || ^18 || ^19 || ^19.0.0-rc"`). Flag: it has not published a release since March 2025, so there is no vendor confirmation it has been tested against Next.js 16's `proxy.ts` convention or Tailwind v4.3.x specifically — low risk (it only touches `localStorage` + a DOM attribute, nothing Next-16-specific) but worth a smoke test before adopting. Confidence: MEDIUM (peer-dep compatibility verified; real-world Next 16 usage not directly confirmed).

## Supabase Auth Pattern (App Router, Next.js 16)

**Three files, matching the current official Supabase example** (verified against `supabase/supabase` GitHub example, `examples/auth/nextjs`, 2026-07-02):

1. **`apps/web/lib/supabase/client.ts`** — browser client, used in Client Components:
   ```ts
   import { createBrowserClient } from '@supabase/ssr'

   export function createClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
     )
   }
   ```

2. **`apps/web/lib/supabase/server.ts`** — server client, used in Server Components / Server Actions / Route Handlers, backed by `next/headers` cookies:
   ```ts
   import { createServerClient } from '@supabase/ssr'
   import { cookies } from 'next/headers'

   export async function createClient() {
     const cookieStore = await cookies()
     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
       {
         cookies: {
           getAll() { return cookieStore.getAll() },
           setAll(cookiesToSet) {
             try {
               cookiesToSet.forEach(({ name, value, options }) =>
                 cookieStore.set(name, value, options)
               )
             } catch {
               // Called from a Server Component; safe to ignore if
               // proxy.ts is refreshing the session (see below).
             }
           },
         },
       }
     )
   }
   ```

3. **`apps/web/proxy.ts`** (project root, NOT `middleware.ts`) — refreshes the session on every navigation and performs the redirect gating described in PROJECT.md ("signed-out → login, client → client home, coach → coach home"):
   ```ts
   import { type NextRequest } from 'next/server'
   import { updateSession } from '@/lib/supabase/proxy'

   export async function proxy(request: NextRequest) {
     return await updateSession(request)
   }

   export const config = {
     matcher: [
       '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
     ],
   }
   ```
   with the session-refresh logic in `apps/web/lib/supabase/proxy.ts` calling `supabase.auth.getClaims()` (not `getUser()`) to decide redirect behavior — see the "What NOT to Use" table for why.

**Role-aware redirect logic** (client vs coach landing) belongs in this proxy layer or in a shared server-side role lookup, reading the `role` claim/column established by the `profiles` table + RLS design — not duplicated per-page.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@supabase/ssr@0.12.0` | `@supabase/supabase-js@2.110.0` | Both are current `latest` dist-tags as of 2026-07-02; `@supabase/ssr` wraps `supabase-js` and both are maintained in lockstep by Supabase. |
| `@supabase/ssr` (any current 0.x) | Next.js `16.2.9`, App Router | Cookie pattern (`getAll`/`setAll`) is framework-agnostic and does not depend on the `middleware.ts`→`proxy.ts` rename — only the *file* wrapping `updateSession()` needs to use the new convention. |
| `tailwindcss@4.3.x` | `@tailwindcss/postcss@4.3.x` | Must be the exact same version (already an AGENTS.md rule) — this is a hard Tailwind v4 requirement, not project-specific caution. |
| `next-themes@0.4.6` | `react@19.2.7` | Peer dependency range explicitly includes `^19 || ^19.0.0-rc`; safe if adopted. |
| Next.js `16.x` | `proxy.ts` | `middleware.ts` still functions but is deprecated (scheduled removal, runtime differs — Edge vs Node). New code on Next.js 16 should use `proxy.ts` from the start. |

## Sources

- `npm view @supabase/supabase-js dist-tags` / `npm view @supabase/ssr dist-tags` — direct npm registry query, confirms `2.110.0` / `0.12.0` as `latest`, 2026-07-02
- [supabase/ssr README (raw, GitHub)](https://raw.githubusercontent.com/supabase/ssr/main/README.md) — deprecation notice for `auth-helpers-*`, and the authoritative `getSession()` vs `getUser()` vs `getClaims()` guidance, fetched via `gh api` 2026-07-02
- `gh api repos/supabase/supabase/contents/examples/auth/nextjs/...` (client.ts, server.ts, proxy.ts, lib/supabase/proxy.ts, .env.example) — official Supabase Next.js auth example, current file layout including `proxy.ts` convention and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` naming, fetched 2026-07-02. HIGH confidence — primary source, not a summary.
- [Next.js Proxy docs](https://nextjs.org/docs/app/getting-started/proxy) — official confirmation of the `middleware.ts` → `proxy.ts` rename in Next.js 16, Node.js runtime, `export function proxy()` convention. Fetched 2026-07-02 (doc dated `lastUpdated: 2025-12-20`, version `16.2.10`). HIGH confidence.
- [Tailwind CSS Dark Mode docs](https://tailwindcss.com/docs/dark-mode) — `@custom-variant` syntax for class- and attribute-based dark mode, inline no-flash script pattern. HIGH confidence, official docs.
- [Supabase: Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) + [GitHub discussion #40300](https://github.com/orgs/supabase/discussions/40300) — legacy `anon`/`service_role` keys being phased out in favor of `sb_publishable_...`/`sb_secret_...`; both work simultaneously during migration. MEDIUM confidence on exact Next.js env var naming (confirmed separately via the official example repo `.env.example`, which upgrades this to HIGH).
- `npm view next-themes peerDependencies` / `time.modified` — confirms React 19 peer-dep support and that the package's last publish was 2025-03-11 (no Next.js 16–specific validation available). MEDIUM confidence on real-world Next 16 compatibility (inferred from peer ranges and its framework-agnostic implementation, not a vendor statement).
- [GitHub issue supabase/supabase#39947](https://github.com/supabase/supabase/issues/39947) — corroborates that official SSR guides were updated to recommend `getClaims()` over `getUser()` in proxy/middleware, tied to the new publishable-key JWT model.
- `npm view tailwindcss dist-tags` / `npm view @tailwindcss/postcss dist-tags` — confirms `4.3.2` latest (project pinned at `4.3.1`, compatible, optional bump).

---
*Stack research for: Supabase auth (SSR/App Router) + Tailwind v4 dual-theme tokens*
*Researched: 2026-07-02*
