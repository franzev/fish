# Feature Research

**Domain:** Auth foundation + design system foundation for a coach-led, two-role (client/coach) ChatHub web app targeting neurodivergent (ADHD) professionals
**Researched:** 2026-07-02
**Confidence:** HIGH (auth/RLS patterns, WCAG standards, Tailwind v4 token architecture — verified against official docs); MEDIUM (ADHD-specific UX guidance, coaching-platform roster conventions — WebSearch-verified, multi-source agreement, no single authoritative spec)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unsafe.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Email/password sign up + log in | Baseline entry point for any authenticated product | LOW | Supabase `auth.signUp` / `signInWithPassword`; already scoped in PROJECT.md |
| Email verification | Confirms real email ownership, prevents throwaway/typo accounts; standard for any product that emails users (coach messages, resets) | LOW–MEDIUM | Supabase built-in email confirmation flow; needs a "check your inbox" holding screen — this is itself a screen that must obey one-primary-action |
| Password reset ("forgot password") | Users will lose passwords; a support-only workaround is what "incomplete" looks like | LOW–MEDIUM | Time-limited token via email, standard Supabase flow. Must land on a calm, single-field "set new password" screen |
| Session persistence across refresh/restart | Nobody expects to re-login every visit; ADHD users especially are derailed by unexpected friction (a login wall reintroduces a "choice"/task-switch) | LOW | Supabase SSR (`@supabase/ssr`) cookie-based session; use `getUser()` server-side, not `getSession()`, per current Supabase guidance |
| Log out | Explicit, expected control, especially on shared devices | LOW | Single action, not buried in a menu of settings |
| Protected routing (redirect signed-out users to login) | Baseline security expectation; without it the app "leaks" screens | LOW–MEDIUM | Next.js middleware + Supabase SSR; middleware must refresh the session token, not just check for a cookie |
| Role-aware landing (client vs coach see different homes) | Two-sided product; showing a coach the client home (or vice versa) is a broken/incomplete product, not a nice-to-have | MEDIUM | Requires role available at redirect time (JWT claim or profile lookup) right after auth |
| RLS on every table | For a product handling a vulnerable audience's private coaching data, "any authenticated user can read anyone's data" is a trust-breaking incompleteness, not a missing nice-to-have | MEDIUM–HIGH | Supabase default-deny; every table needs explicit policies before it's queried from the client |
| Visible keyboard focus state | Accessibility floor; already codified in AGENTS.md | LOW | `:focus-visible`, meets WCAG 2.2 SC 2.4.11 (measurable minimum contrast/size, not just "visible") |
| `prefers-reduced-motion` respected | Accessibility floor; vestibular/attention-sensitive users are explicitly in scope (ADHD often co-occurs with sensory sensitivity) | LOW | Global media query already noted as set in globals.css — verify it suppresses ALL non-essential transitions, not just marketing ones |
| Component states: default, hover, focus, disabled, loading, error | A UI kit that only ships the "happy path" of each component will visibly break the first time a form is slow or invalid | MEDIUM | Applies to Button, Input, Card at minimum; each state needs a monochrome-safe treatment (see Pitfalls research for how "error" reads without red) |
| Empty states | Coach home with zero seeded clients, client home before first assignment — these are the *default* first-run state for this product, not an edge case | LOW–MEDIUM | Must be calm, not alarming ("no clients yet" not "no data found") — directly serves "assigned never chosen" (nothing to browse yet is fine) |
| Dark + light theme, both fully specified | User already decided this is in scope for v1; a design system shipped with only one theme is incomplete for the stated milestone | MEDIUM | Real cost is exhaustive semantic tokens (not just inverting a couple of colors) — every state (error, disabled, focus) needs to work in both |
| Responsive layout / min tap target size (56px) | Already codified in AGENTS.md as non-negotiable; without it the product fails its own accessibility bar for a population that includes motor/attention variability | LOW–MEDIUM | `--size-control` token; must apply to every interactive element, not just primary buttons |

### Differentiators (Competitive Advantage)

Features that set the product apart from generic SaaS auth/design-system defaults. Not required by users generally, but core to this product's value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pure monochrome design language (no brand color as crutch) | Forces hierarchy to come from type scale, weight, spacing, and structure rather than color-coding — directly serves "remove choices, not add them"; most competitors (Duolingo, Cambly, italki) lean on saturated color/gamification palettes this audience finds overstimulating | MEDIUM | Real differentiator is *discipline*: resisting the pull to reintroduce color for "delight" later. Document rationale so future contributors don't quietly reintroduce brand color |
| Zero-choice auth flow (no OAuth picker, no "choose your plan," no role selector at signup) | Every fork in a flow is a decision the user has to make — a population selected for executive-function/decision-fatigue sensitivity benefits disproportionately from a single linear path | LOW | Cheap to build *because* it's less, not more — this is a differentiator that also reduces engineering effort, a rare alignment |
| Assigned-never-chosen coach roster (seed/manual assignment, no self-serve client browsing coaches) | Coaching-platform category default is client-facing coach marketplaces (browse/pick a coach) — this product deliberately inverts that, consistent with "assigned never chosen" | LOW (for this milestone — it's a seed script, not UI) | Differentiator is really a *product* stance, not a technical one; technically it's the *simplest* option, which is the point |
| Non-scolding, non-red error/notice language and color-free-but-not-invisible error treatment | Most design systems use red for errors reflexively; in monochrome + ADHD-safe context, errors need to be distinguishable by weight/structure/icon without being alarming | MEDIUM | Requires a documented pattern (e.g., icon + border weight + copy tone) since "just make it red" isn't available — this is genuinely harder than typical design systems and worth flagging to PITFALLS |
| UI kit demo/contract page (every component, every state, both themes, one page) | Not unique to this product, but rare for a v1 milestone — pays for itself immediately given AGENTS.md's "no hand-rolled buttons" rule; becomes the living spec coaches/reviewers can sanity-check against | MEDIUM | This is as much an internal differentiator (dev velocity, consistency enforcement) as a user-facing one |
| Token pipeline designed for native mirroring (iOS/Android later) | Most web-first startups don't think about native parity until they're deep into iOS/Android builds and tokens have drifted | MEDIUM | Low cost now (name tokens semantically, keep a single source of truth) vs. high cost later (retrofitting) — front-loading this is the differentiator |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific product and audience — or that are explicitly out of scope for this milestone per PROJECT.md/AGENTS.md.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Role picker at signup ("I'm a client" / "I'm a coach") | Feels flexible, standard in many multi-role SaaS products, saves a manual seeding step | Lets anyone claim coach powers over vulnerable users; also reintroduces a choice at the exact moment (onboarding) where friction is most costly for this audience | Signup always creates a client (already decided in PROJECT.md); coach role is a manual/admin-granted escalation |
| OAuth sprawl (Google, Apple, Microsoft, etc. sign-in buttons) | Perceived as reducing friction, industry-standard for consumer apps | Each additional button is a *decision* ("which one did I use last time?"), directly violates "remove choices, not add them"; also multiplies the auth surface area to secure/test for zero clear benefit at this stage | Single email/password path for v1; revisit only if coaches report real signup drop-off tied to password fatigue |
| Streak counters / daily-use gamification | Extremely common in language-learning apps (Duolingo is the category-defining example), feels like "engagement" | Explicitly barred in AGENTS.md — a streak that can break is the single named top abandonment trigger for this audience; even "gentle" streaks imply a scoreboard that can go to zero | Defer all gamification until coach-validated; if ever built, reward-only (celebrate returning, never penalize a gap) |
| Score/percentage-based progress ("87% fluent," grade badges) | Feels quantifiable, gives users a number to chase | AGENTS.md is explicit: progress must be visual, never a grade — numeric scores read as judgment to a population often already anxious about performance evaluation | Use the `Progress` bar/milestone component; visual fullness, not a percentage-as-verdict |
| Client-facing coach marketplace / "browse coaches" gallery | Standard pattern in coaching platforms generally (Coaching.com, TrainingPeaks, CoachAccountable all default to some client-initiated discovery) | Violates "assigned, never chosen" — browsing N coaches is exactly the menu-of-options UI explicitly barred for clients | Coach-client relationship is assigned by the coach/admin (seed this milestone, dashboard-driven later) |
| Self-serve coach signup UI | Reduces manual ops work, "obviously" more scalable | Explicitly out of scope in PROJECT.md — open coach signup lets anyone claim coach powers over a vulnerable population before any vetting process exists | Coach accounts created manually (seed/dashboard) for v1; revisit once a vetting workflow is designed |
| Multi-factor authentication (TOTP/WebAuthn) this milestone | Frequently cited as a modern SaaS "table stakes" security feature in general auth research | Adds a setup flow with its own choices/steps (device enrollment, backup codes) at the exact onboarding moment friction is costliest; not requested by product scope, and the audience is coaching clients, not an enterprise/security-sensitive buyer | Rely on Supabase's standard email/password + verified email for v1; revisit only if abuse/security signals demand it, and if so keep it optional and coach-configurable rather than a client-facing choice |
| Social/community features (feed, comments, likes) | Common in "learning app" category, seen as driving retention | Explicitly barred in AGENTS.md until foundations are complete and coach-validated; also reintroduces browsing/choice-heavy UI (whose post to view, what to react with) | Wait — 1-on-1 chat is next in build order, community explicitly waits |
| Theme picker exposed to end users (light/dark toggle as a settings choice) | "Standard" UX expectation in many apps now, feels like user empowerment | Another decision point for a product whose thesis is removing decisions; also doubles the QA/support surface ("which theme were you in when X broke?") | Default to system `prefers-color-scheme`; both themes must exist and be correct, but do not necessarily need a client-facing switch this milestone — confirm with product owner before building a toggle UI |
| Rich "delight" micro-interactions / animated transitions between screens | Feels modern, polished, common in current design-system trends | Directly conflicts with `prefers-reduced-motion` requirement and general ADHD-UX guidance to minimize non-essential animation/sensory input | Prefer instant or near-instant state changes; reserve any motion for essential feedback (e.g., a loading indicator), and make even that motion suppressible |

## Feature Dependencies

```
Email/password sign up
    └──requires──> Supabase project + auth config (already provisioned)
    └──enables───> Email verification
                       └──enables───> "Verified" gate before first protected action (optional, confirm with product)

Session persistence (SSR cookies)
    └──requires──> Supabase SSR client (@supabase/ssr) wired into Next.js middleware
    └──requires──> Protected routing/middleware

Protected routing (redirect signed-out → login)
    └──requires──> Session persistence
    └──enables───> Role-aware landing (client home vs coach home)

Role-aware landing
    └──requires──> Client/coach roles wired to packages/core contracts
    └──requires──> Database foundation (profiles table with role column)
    └──requires──> RLS policies (a role check that can be spoofed via client-editable metadata is not a real boundary)

RLS policies
    └──requires──> Database foundation (profiles, coach-client relationship tables) must exist first
    └──enables───> Coach home listing assigned clients (safely scoped to that coach only)

Coach home (assigned clients list)
    └──requires──> Coach-client relationship table + seed data
    └──requires──> RLS (coach can only see their own clients)
    └──requires──> Role-aware landing

Pure monochrome token set
    └──requires──> (nothing upstream — can start immediately, decouple from auth work)
    └──enables───> UI kit hardening (states need tokens to express disabled/error/focus without color)
    └──enables───> App shell/layout
    └──enables───> UI kit demo page (needs both the tokens and the hardened components)

UI kit hardening (states: disabled/loading/error)
    └──requires──> Pure monochrome token set
    └──enables───> Auth screens (signup/login/reset forms need Input+Button in loading/error states)
    └──enables───> UI kit demo page

App shell/layout (nav, page structure, empty states)
    └──requires──> Pure monochrome token set
    └──enhances──> Role-aware landing screens (shell wraps them)

Token pipeline formalization (native mirroring)
    └──requires──> Pure monochrome token set stabilized
    └──enhances──> (future) iOS/Android — not blocking for this milestone
```

### Dependency Notes

- **Auth screens require UI kit hardening, not the reverse:** login/signup/reset forms are the first real-world test of Input/Button error and loading states. Sequence design-system state work before or alongside auth UI, not after — otherwise auth screens get built against an incomplete kit and need rework.
- **Role-aware landing requires RLS, not just a role column:** if role is only checked client-side (e.g., from `user_metadata`), it can be spoofed by the authenticated user. The redirect logic can read a role for UX purposes, but any data boundary must be enforced by RLS/JWT custom claims, not by trusting client state.
- **Coach home requires the coach-client relationship table before it can be "real":** the milestone scopes assignment UI out, but the schema + RLS + a query that lists "my clients" must exist for the coach home to show anything beyond a hardcoded stub.
- **Pure monochrome tokens are the one workstream with no upstream dependency** — it can and should start in parallel with auth/backend work, since nothing else in the design-system list can proceed without it (hardened states, app shell, and the demo page all sit downstream of it).
- **Theme picker (anti-feature) conflicts with system-preference default:** if a client-facing toggle is ever added, decide whether it overrides or supplements `prefers-color-scheme` — don't build both a toggle and silently ignore system preference, that produces inconsistent behavior.

## MVP Definition

### Launch With (v1 — this milestone)

Minimum viable product for this milestone — what's needed for the auth + design-system foundation to be real and safe to build on.

- [ ] Email/password sign up, log in, log out, email verification, password reset — the complete linear auth loop with no forks
- [ ] Session persistence across refresh (Supabase SSR, `getUser()` in server contexts)
- [ ] Protected routing middleware (signed-out → login; client → client home; coach → coach home)
- [ ] Profiles table + coach-client relationship table with RLS enforcing boundaries (coach sees only their clients; client sees only their own data)
- [ ] Signup always creates a client; coach role is seed/manual-only
- [ ] Pure monochrome token set (light + dark), replacing all existing color tokens
- [ ] UI kit hardened: default/hover/focus/disabled/loading/error states for Button, Input, Card, Progress
- [ ] App shell with calm empty states (coach home with zero/seeded clients, client home pre-assignment)
- [ ] UI kit demo page showing every component/state/theme combination
- [ ] Visible focus states + `prefers-reduced-motion` respected across all new screens
- [ ] 56px minimum tap targets on every interactive element introduced this milestone

### Add After Validation (v1.x)

Features to add once the foundation is proven and coach-validated in production use.

- [ ] Client-facing theme toggle (if user research shows system-preference default isn't sufficient) — trigger: real user complaints, not speculative preference
- [ ] Coach-facing assignment UI (currently seed-only) — trigger: coach roster grows beyond what manual seeding can sustain
- [ ] Coach signup workflow with vetting step — trigger: coach onboarding volume outpaces manual account creation
- [ ] Password strength / breach-check feedback on signup — trigger: any observed credential-stuffing or weak-password incidents
- [ ] Native token consumption in iOS/Android — trigger: native builds actually begin

### Future Consideration (v2+)

Features to defer until the coaching technique and core product loop are validated.

- [ ] Multi-factor authentication — defer until there's a concrete security signal or coach/enterprise requirement, not "because SaaS best practice lists it"
- [ ] Community feed — explicitly barred until foundations + chat are done and coach-validated (AGENTS.md)
- [ ] Any gamification/streaks — explicitly barred until coach-validated; if built, reward-only, never a resettable streak
- [ ] OAuth/social login — defer indefinitely unless a specific, evidenced friction point emerges; conflicts with "remove choices" by default

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Email/password auth loop (signup/login/logout/verify/reset) | HIGH | MEDIUM | P1 |
| Session persistence + protected routing | HIGH | MEDIUM | P1 |
| Profiles + coach-client schema + RLS | HIGH | MEDIUM–HIGH | P1 |
| Role-aware landing screens | HIGH | LOW–MEDIUM | P1 |
| Coach home (assigned clients list) | MEDIUM–HIGH | LOW (given schema/RLS done) | P1 |
| Pure monochrome token set (light+dark) | HIGH | MEDIUM | P1 |
| UI kit hardened states (disabled/loading/error) | HIGH | MEDIUM | P1 |
| App shell + calm empty states | MEDIUM–HIGH | LOW–MEDIUM | P1 |
| UI kit demo page | MEDIUM (high internal value, low direct user-facing value) | LOW–MEDIUM | P1 |
| Focus states + reduced motion | HIGH (accessibility floor) | LOW | P1 |
| Token pipeline formalized for native mirroring | LOW now / HIGH later | LOW–MEDIUM | P2 |
| Client-facing theme toggle | LOW–MEDIUM | LOW | P3 |
| MFA | LOW (for this audience/stage) | MEDIUM–HIGH | P3 |
| Coach signup + vetting UI | MEDIUM | MEDIUM | P3 |
| Assignment UI (coach picks clients in-app) | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when possible (doesn't block milestone completion)
- P3: Nice to have, explicitly deferred future consideration

## Competitor Feature Analysis

Not a head-to-head competitor comparison (this is a coach-led B2B2C service, not competing feature-for-feature with consumer apps), but relevant category defaults worth contrasting against:

| Feature | Consumer language apps (Duolingo, Cambly, italki) | Coaching platforms (CoachAccountable, TrainingPeaks, Coaching.com) | FISH approach |
|---------|-----|-----|-----|
| Account creation | Open self-signup, often with social auth choices | Coach/admin invites client via email link; client completes registration | Client self-signup (email/password) but role is fixed to "client"; coach accounts are seed/manual-only — a hybrid that keeps client onboarding low-friction while locking down coach escalation |
| Coach discovery | Client browses/picks a tutor from a marketplace (italki, Cambly) | Client is typically pre-assigned to a coach/trainer by the business | FISH: assigned-never-chosen, matching the coaching-platform norm, explicitly rejecting the marketplace-browse pattern |
| Progress display | Streaks, XP, levels, leaderboards (Duolingo is the canonical case) | Visual progress toward goals/milestones, less gamified | FISH: visual milestone progress only, reward-only mechanics if any are added later — closer to the coaching-platform norm, explicit anti-pattern against Duolingo-style streaks |
| Color/branding | High-saturation, playful color systems (part of the "fun" brand promise) | More neutral, professional/utilitarian palettes | FISH: pure monochrome — more restrained than either category default, a deliberate accessibility-driven choice rather than a brand-personality choice |
| Theme (light/dark) | Increasingly standard to offer both | Mixed — many coaching tools are light-only or admin-configurable | FISH: both themes built from day one as a token-architecture decision, ahead of typical coaching-platform practice |

## Sources

- [Custom Claims & Role-based Access Control (RBAC) — Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [RLS Performance and Best Practices — Supabase Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [How to protect routes using @supabase/ssr? — GitHub Discussion #21468](https://github.com/orgs/supabase/discussions/21468)
- [Role based authorization in Next.js middleware — GitHub Discussion #29482](https://github.com/orgs/supabase/discussions/29482)
- [SaaS Authentication: Key Considerations & Best Practices — Descope](https://www.descope.com/blog/post/saas-auth)
- [Design Tokens That Scale in 2026 (Tailwind v4 + CSS Variables) — Mavik Labs](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/)
- [Dark Mode with Design Tokens in Tailwind CSS — richinfante.com](https://www.richinfante.com/2024/10/21/tailwind-dark-mode-design-tokens-themes-css)
- [Theme variables — Tailwind CSS Docs](https://tailwindcss.com/docs/theme)
- [Dark mode — Tailwind CSS Docs](https://tailwindcss.com/docs/dark-mode)
- [WCAG 2.4.11 Focus Appearance Minimum — TestParty](https://testparty.ai/blog/wcag-focus-appearance-minimum)
- [Web Content Accessibility Guidelines (WCAG) 2.2 — W3C](https://www.w3.org/TR/WCAG22/)
- [Design accessible animation and movement — Pope Tech](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)
- [How to design for ADHD and neurodiversity in UX — Welcoming Web](https://welcomingweb.com/learn/designing-for-neurodiversity-adhd-ux)
- [Designing for Neurodivergent Users: 8 Practical Tips — accessiBe](https://accessibe.com/blog/knowledgebase/how-to-design-digital-environments-for-people-with-neuro-divergency)
- [Neurodiversity In UX: 7 Key Design Principles — devqube](https://devqube.com/neurodiversity-in-ux/)
- [Loading, empty and error states pattern — Agriculture Design System (Australian Government)](https://design-system.agriculture.gov.au/patterns/loading-error-empty-states)
- [Loading — Carbon Design System](https://carbondesignsystem.com/patterns/loading-pattern/)
- [CoachAccountable Knowledge Base — Clients](https://www.coachaccountable.com/knowledgeBase/coaching/clients)
- [Invite and Manage Your Clients — Coaching.Com Help Center](https://help.coaching.com/en/articles/29982-invite-and-manage-your-clients)
- [Adding Athletes to my Coach Account — TrainingPeaks Help Center](https://help.trainingpeaks.com/hc/en-us/articles/204072554-Adding-Athletes-to-my-Coach-Account)
- Project context: `.planning/PROJECT.md`, `AGENTS.md` (non-negotiable design rules, build order, out-of-scope decisions)

---
*Feature research for: Coach-led ChatHub auth + design-system foundation (ADHD-first audience)*
*Researched: 2026-07-02*
