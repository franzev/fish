# Milestones

## v1.0 Monochrome Foundations (Shipped: 2026-07-04)

**Delivered:** The complete monochrome foundation — a dual-theme design system provable on `/kit`, a full email/password auth loop on a hardened RLS-protected schema, and role-aware routing that lands each person on their correct calm home.

**Phases completed:** 3 phases, 16 plans, 46 tasks
**Stats:** 174 commits · 229 files · ~29.2k insertions (~5.0k LOC product code) · 2026-07-02 → 2026-07-04 (3 days)
**Requirements:** 28/28 v1 requirements satisfied
**Closeout:** verified_closeout — all phases verified, milestone audit passed (see `milestones/v1.0-MILESTONE-AUDIT.md`); pre-close artifact audit's one open debug session resolved (no defect — tester typo, recovery pipeline proven healthy)

**Key accomplishments:**

- Monochrome light-dark() oklch token ladder with WCAG AA contrast tests (Vitest + colorjs.io), hardened Button with loading state and two-tone focus ring, rendered on a new /kit route with a dev theme toggle
- Input's notice/error two-tier system (border weight + message weight + Tabler icon, zero hue) and Card's light-dark() elevation token, both now demoed on /kit alongside Progress
- Alert with three structurally-distinguished monochrome tones, the completed /kit single-scroll contract (tokens/typography/icons + all five components), an icon-source guard, and two checkpoint-driven fixes: a Lightning CSS polyfill-aware theme toggle and a layout-stability hardening of Button
- Corrected the inverted two-tone `:focus-visible` ring band swap (max contrast 1.06:1 to ~18–19:1) and added a colorjs.io regression tripwire plus 5 WR-04 contrast pairings, closing the single blocking Phase 1 verification gap.
- Local Supabase (Postgres + Auth + Mailpit) running via CLI + Docker, pinned @supabase packages installed, three-client SSR factories wired, Next.js 16 proxy.ts refreshing sessions to both request and response, and config.toml [auth] keys verified against the CLI's actual generated schema
- Five ordered migrations creating hardened profiles + coach_clients with recursion-safe RLS via private.is_coach_of(), a signup trigger that never blocks auth.users inserts, a role self-escalation guard verified live against local Supabase, and real generated types split from legacy chat contracts
- Idempotent service-role seed (coach + 3 assigned clients through the real auth admin API with pagination-safe lookup), an anon-session verify-rls script proving DB-03/DB-04 with exit-code gating, and the D-14 hosted-Supabase deploy checklist
- The full linear signup loop: /signup (always a client) → FISH-voice token_hash email → /check-inbox → /auth/confirm verifyOtp → signed in at /home with one logout action; expired/used links route to a calm type-aware resend screen, and a signed-out /home visit redirects to /login
- The return-and-recover half of the auth loop: /login lands people signed in at /home (unverified logins route calmly to /check-inbox), /forgot-password sends a non-enumerating reset link whose template-hardcoded next=/reset-password lands them signed in on a single-field set-new-password screen that returns to /home
- Pinned the FISH dev port to 3001 and aligned Supabase's site_url/redirect allow-list to `http://localhost:3001` (not `127.0.0.1`) — cookies are host-scoped, so the fix required matching both port AND host to the browser's actual session origin, closing UAT test 3's blocker.
- Input now reserves constant message-row height and /login's wrong-password copy renders in the soft tier-1 notice tone, closing UAT test 7 with a verified zero-pixel layout shift.
- Every auth screen now submits on Enter via a shared `<form onSubmit>` pattern, Button gained honest pointer/progress/not-allowed cursors without losing non-activation, and — after two rounds of checkpoint feedback — notices float above their Card as a fading overlay with real semantic tone colors instead of forcing the card to resize.
- RLS-backed reverse client-to-coach read (is_client_of) + profiles.email, a role-aware pure-redirect root page, authRedirects as the single redirect source of truth, and a D-06/D-09/D-10-compliant (authenticated) guard layout wrapping a ghost-logout AppShell.
- Promoted the Phase 2 `/home` placeholder into the real client home: server-resolved wrong-door guard (coach → /coach), a first-name greeting, and an assigned/unassigned EmptyState that names the coach when a `coach_clients` row exists — all reading through Plan 01's `is_client_of` RLS policy with zero primary actions on the page.
- Coach home at `/coach`: a role-guarded server page listing exactly the coach's own assigned clients (alphabetical, inert, name + muted email) via an RLS-scoped `coach_clients` join, with a calm empty state at zero — plus a live `verify-rls.ts` fix that restores `pnpm verify:rls` to exit 0 by updating the client-boundary assertion to the post-0006 two-row invariant and adding the new D-16 client-reads-coach-name proof.
- Shared `redirectIfSignedIn()` server guard closes D-05: /login and /signup are now async Server Component shells that silently forward an already-authenticated visitor to their role home before the form ever renders.

---
