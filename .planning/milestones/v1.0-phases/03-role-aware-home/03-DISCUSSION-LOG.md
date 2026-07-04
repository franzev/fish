# Phase 3: Role-aware home - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 3-Role-aware home
**Areas discussed:** Route map & redirects, App shell & navigation, Coach client list, Empty states & copy

---

## Route map & redirects

### Where do the role homes live?

| Option | Description | Selected |
|--------|-------------|----------|
| /home + /coach | Client home reuses the existing /home route; coach lands at /coach; /chat waits until chat exists | ✓ |
| /chat + /coach | Honor authRedirects as-written; client home is the empty future chat surface | |
| One /home for both roles | Single route renders per-role content; fewer routes, muddier per-role testing | |

**User's choice:** /home + /coach (recommended)

### What should `/` (root) do?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure redirect | Signed-out → /login, signed-in → role home; root never renders | ✓ |
| Minimal public landing | One-card page: logo, one sentence, one Log in action | |
| Redirect to /kit | Root points at the design-system contract page | |

**User's choice:** Pure redirect (recommended)

### Role mismatch behavior (client types /coach, coach on client /home)

| Option | Description | Selected |
|--------|-------------|----------|
| Silent redirect | Land on their own role home, no message | ✓ |
| Redirect + quiet notice | Redirect with a soft one-line notice | |
| Calm not-found screen | Guiding "nothing here" page with one action home | |

**User's choice:** Silent redirect (recommended)

### Post-login destination after a protected-route redirect

| Option | Description | Selected |
|--------|-------------|----------|
| Always role home | Ignore the originally requested URL; no ?next= param | ✓ |
| Return to requested URL | Preserve deep link via validated ?next= param | |

**User's choice:** Always role home (recommended)

### Signed-in person visits /login or /signup

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to role home | Auth screens are for signed-out people | ✓ |
| Show the form anyway | Session gets replaced on re-login; odder experience | |

**User's choice:** Redirect to role home (recommended)

### Public route allowlist (default-deny protection)

| Option | Description | Selected |
|--------|-------------|----------|
| Auth screens + /kit | /login, /signup, /forgot-password, /reset-password, /check-inbox, /expired-link, /auth/confirm, /kit public; all else requires session | ✓ |
| Auth screens only | /kit requires a session too; revisits Phase 1 D-15 | |

**User's choice:** Auth screens + /kit (recommended)

### Logout destination

| Option | Description | Selected |
|--------|-------------|----------|
| Plain /login | No banner; the login form itself is the confirmation | ✓ |
| /login + quiet confirmation | Soft "You're signed out" floating notice | |

**User's choice:** Plain /login (recommended)

**Notes:** User initially chose "More questions" at the first area checkpoint, prompting the auth-pages, allowlist, and logout questions.

---

## App shell & navigation

### Shell shape

| Option | Description | Selected |
|--------|-------------|----------|
| Slim top bar | Quiet header: mark left, session actions right, content below | ✓ |
| Sidebar skeleton | Left rail with one item per role, ready for later | |
| No persistent chrome | Shared layout wrapper with spacing only | |

**User's choice:** Slim top bar (recommended)

### Bar contents

| Option | Description | Selected |
|--------|-------------|----------|
| Logo + name + logout | Muted display name + ghost logout; identity confirmation at zero interaction cost | ✓ |
| Logo + logout only | Absolute minimum; no identity confirmation | |
| Logo + avatar menu | Avatar opens a menu holding logout; hides logout behind a click | |

**User's choice:** Logo + name + logout (recommended)

### Page layout inside the shell

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow centered column | ~640px max, same family as the 440px auth cards | ✓ |
| Wider content area | ~960px+ anticipating denser coach views | |
| Per-role widths | Client narrow, coach wider; two layout systems | |

**User's choice:** Narrow centered column (recommended)

### Page titles

| Option | Description | Selected |
|--------|-------------|----------|
| Page owns its heading | Bar stays constant; each page opens with its own Fraunces heading | ✓ |
| Title in the bar | Bar shows the current page title; changes per screen | |

**User's choice:** Page owns its heading (recommended)

---

## Coach client list

### List rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Rows in one Card | Single Card, stacked rows, hairline dividers | ✓ |
| One Card per client | Each client in its own elevated Card | |
| Bare list, no container | Plain rows on the page background | |

**User's choice:** Rows in one Card (recommended)

### Row content

| Option | Description | Selected |
|--------|-------------|----------|
| Name + email | Display name main, email quiet/muted; no dates | ✓ |
| Name only | Calmest, but duplicate names indistinguishable | |
| Name + email + assigned date | Adds "since June 2026"; information without an action | |

**User's choice:** Name + email (recommended)

### Row interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Inert rows | No hover, no cursor-pointer, no false affordance | ✓ |
| Tappable → placeholder | Rows link to a calm per-client dead-end page | |

**User's choice:** Inert rows (recommended)

### Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Alphabetical by name | Stable, predictable, findable | ✓ |
| Most recently assigned first | Surfaces change; reshuffles as roster grows | |

**User's choice:** Alphabetical by name (recommended)

---

## Empty states & copy

### Client home coach acknowledgement

| Option | Description | Selected |
|--------|-------------|----------|
| Two states, show coach | Unassigned: reassurance; assigned: "Your coach [name] is setting things up"; needs small RLS allowance | ✓ |
| One state regardless | Same message whether or not an assignment exists | |

**User's choice:** Two states, show coach (recommended)

### Empty-state visual form

| Option | Description | Selected |
|--------|-------------|----------|
| Tabler icon + short copy | Single quiet icon above one or two calm sentences | ✓ |
| Copy only | Even quieter; risks reading as unfinished | |
| Illustration | Warmest; new asset discipline for two screens | |

**User's choice:** Tabler icon + short copy (recommended)

### Empty-state action

| Option | Description | Selected |
|--------|-------------|----------|
| No action | Pure reassurance; only interactive element is the shell's ghost logout | ✓ |
| Quiet secondary link | Low-key outlet (mailto, /kit); invents a destination | |

**User's choice:** No action (recommended)

### Greeting

| Option | Description | Selected |
|--------|-------------|----------|
| Greet by first name | Client: "Welcome back, Ana"; coach: "Your clients" | ✓ |
| Neutral headings | Client: "Home"; the bar carries identity alone | |

**User's choice:** Greet by first name (recommended)

---

## Claude's Discretion

- Exact screen copy (FISH voice, reviewed at verification)
- Protection enforcement location (proxy vs layouts vs both) and server-side role read mechanics
- Shell component structure/naming and route-group organization
- Specific Tabler icons for the empty states
- Loading/streaming behavior during role lookup
- Exact RLS policy shape for the client-reads-coach-name allowance
- Mobile top-bar behavior

## Deferred Ideas

- Per-client coach view / tappable client rows (when chat or client profiles exist)
- `?next=` deep-link return after login (when more destinations exist)
- `/chat` URL reserved for the chat milestone
