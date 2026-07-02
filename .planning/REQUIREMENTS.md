# Requirements: FISH — Monochrome Foundations

**Defined:** 2026-07-02
**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Design Tokens & Theming

- [x] **TOKN-01**: All UI renders in pure monochrome — black, white, and greys only; no hue-based color values remain in the token set
- [x] **TOKN-02**: Tokens use role-based semantic names (e.g. surface, foreground, notice) — no hue names like accent-pink, so color can be layered in later without renaming
- [x] **TOKN-03**: Light and dark themes are both fully specified — every token (including error/disabled/focus states) resolves correctly in both
- [x] **TOKN-04**: Theme follows the user's system preference automatically with no flash of wrong theme on first paint
- [x] **TOKN-05**: Lexend renders as the body/UI font and Fraunces as the heading/display font on every screen
- [x] **TOKN-06**: Tabler Icons is the single icon source; no other icon sets are imported

### UI Kit

- [x] **KIT-01**: Button, Input, Card, and Progress render correct default/hover/focus/disabled/loading/error states (as applicable) in both themes
- [x] **KIT-02**: Errors and notices are distinguishable in monochrome through weight, structure, and iconography — never red, and copy never scolds
- [ ] **KIT-03**: New base components required by this milestone's screens (auth forms, shell, landings, empty states) are built in the shared kit — needs-driven, no speculative components
- [x] **KIT-04**: Every interactive control is at least 56px tall
- [x] **KIT-05**: Every interactive element shows a visible keyboard focus state, and all non-essential motion is suppressed under prefers-reduced-motion
- [x] **KIT-06**: A UI kit demo page shows every component in every state in both themes — the visual contract for future screens

### App Shell

- [ ] **SHEL-01**: An app shell (navigation + page layout) wraps authenticated screens with at most one primary action visible per screen
- [ ] **SHEL-02**: Client home before assignment and coach home with zero clients show calm, guiding empty states — never alarming "no data" language

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password; signup always creates a client account
- [ ] **AUTH-02**: User receives a verification email after signup and lands on a calm single-action "check your inbox" screen
- [ ] **AUTH-03**: User can log in with email and password
- [ ] **AUTH-04**: User can reset their password via an email link that lands on a single-field "set new password" screen
- [ ] **AUTH-05**: User session persists across browser refresh and restart
- [ ] **AUTH-06**: User can log out from any authenticated screen

### Database Foundation

- [ ] **DB-01**: A profile row is created automatically and reliably on signup (hardened trigger — a failing trigger must not silently block signups)
- [ ] **DB-02**: A coach-client relationship table exists with a seed script that creates a coach account and assigns clients to it
- [ ] **DB-03**: RLS is enabled on every table: a client can only read their own data; a coach can only read their own assigned clients
- [ ] **DB-04**: Role is stored and enforced server-side; an authenticated user cannot escalate themselves to coach (coach role is seed/manual-only)

### Routing & Roles

- [ ] **ROUT-01**: Signed-out users are redirected to login from any protected route
- [ ] **ROUT-02**: A client lands on the client home after login
- [ ] **ROUT-03**: A coach lands on the coach home after login
- [ ] **ROUT-04**: Coach home lists that coach's assigned (seeded) clients — and only theirs

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Coach Operations

- **COAC-01**: Coach can assign a client to themselves in-app (trigger: roster outgrows manual seeding)
- **COAC-02**: Coach signup workflow with vetting step (trigger: coach onboarding volume outpaces manual creation)

### Theming & Tokens

- **THEM-01**: Client-facing light/dark toggle (trigger: real user complaints about system-preference default)
- **THEM-02**: packages/tokens JSON source generating CSS + native constants (trigger: native builds actually begin)

### Auth Hardening

- **AUTH-V2-01**: Password strength / breach-check feedback on signup (trigger: observed weak-password incidents)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Color palette / brand colors | Hierarchy before color — monochrome is the point of this milestone; color is a later deliberate layer |
| OAuth / social login | Every extra button is a decision; violates "remove choices"; multiplies auth surface for no benefit at this stage |
| MFA | Adds an enrollment flow full of choices at the costliest moment (onboarding); no security signal demanding it |
| Role picker at signup | Lets anyone claim coach powers over a vulnerable audience; signup always creates clients |
| Coach marketplace / browse UI | Violates "assigned, never chosen" — the defining product stance |
| Streaks / gamification / scores | Explicitly barred by AGENTS.md until coach-validated; broken streaks are the top abandonment trigger for this audience |
| Community feed | Barred until foundations + chat are done and coach-validated (AGENTS.md build order) |
| 1-on-1 chat | Next foundation after this milestone per build order; Edge Function stub stays a stub |
| Onboarding assessment, tracker engine | Later build-order items; blocked on this milestone's foundations |
| Native iOS/Android implementation | Web-first; native mirrors tokens in a later milestone |
| Rich micro-interactions / animated transitions | Conflicts with reduced-motion requirement and ADHD-UX guidance; motion only for essential feedback |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOKN-01 | Phase 1 | Complete |
| TOKN-02 | Phase 1 | Complete |
| TOKN-03 | Phase 1 | Complete |
| TOKN-04 | Phase 1 | Complete |
| TOKN-05 | Phase 1 | Complete |
| TOKN-06 | Phase 1 | Complete |
| KIT-01 | Phase 1 | Complete |
| KIT-02 | Phase 1 | Complete |
| KIT-03 | Phase 1 | Pending |
| KIT-04 | Phase 1 | Complete |
| KIT-05 | Phase 1 | Complete |
| KIT-06 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| AUTH-06 | Phase 2 | Pending |
| DB-01 | Phase 2 | Pending |
| DB-02 | Phase 2 | Pending |
| DB-03 | Phase 2 | Pending |
| DB-04 | Phase 2 | Pending |
| SHEL-01 | Phase 3 | Pending |
| SHEL-02 | Phase 3 | Pending |
| ROUT-01 | Phase 3 | Pending |
| ROUT-02 | Phase 3 | Pending |
| ROUT-03 | Phase 3 | Pending |
| ROUT-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

> Note: an earlier count of "24" was carried in some initialization inputs. The actual requirement set is 28 (TOKN 6 + KIT 6 + SHEL 2 + AUTH 6 + DB 4 + ROUT 4). Count corrected during roadmap creation.

---
*Requirements defined: 2026-07-02*
*Last updated: 2026-07-02 after roadmap traceability mapping*
