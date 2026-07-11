# Phase 4: Client Profiles - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 4-Client Profiles
**Areas discussed:** Edit flow & entry point, Protected-field freeze, Coach read-only view, Consent & a11y prefs

Mid-discussion the user set a session goal: *"always proceed with the recommended and don't ask me again; don't stop until Phase 4 is executed and verified working with a perfect score."* Remaining open decisions were resolved with the recommended option and recorded in CONTEXT.md.

---

## Edit flow & entry point

### Entry point
| Option | Description | Selected |
|--------|-------------|----------|
| Minimal profile route now | `/profile` route + one quiet link from client home; coach via client list; defer full bottom-nav shell | ✓ |
| Full bottom-nav shell now | Build Home/Progress/Messages/Profile with placeholder tabs | |
| Profile link in existing shell | Reuse top AppShell affordance only | |

**User's choice:** Minimal profile route now.

### Edit model
| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated edit screen | Read-only profile view + `/profile/edit` form with the single Save primary | ✓ |
| Inline edit on profile | Tap-to-edit in place | |
| One-field-at-a-time | Mirror onboarding one-per-screen flow | |

**User's choice:** Dedicated edit screen.

### Save + draft
| Option | Description | Selected |
|--------|-------------|----------|
| Server Action + DB prefill | Server Action via existing RLS update policy; prefill from DB; failed save keeps text; refresh reverts to last-saved (v1.0 auth model) | ✓ |
| Server Action + local draft | Also mirror in-progress edits to sessionStorage | |
| Client optimistic update | Client-side Supabase update + rollback | |

**User's choice:** Server Action + DB prefill.

### Goal field shape
| Option | Description | Selected |
|--------|-------------|----------|
| One freeform field | Single "What are you working toward?" text area / one column | ✓ (recommended default) |
| Two short fields | Separate language-goal + role-context columns | |

**User's choice:** Question dismissed; resolved via session goal to the recommended **one freeform field**.

---

## Protected-field freeze

| Option | Description | Selected |
|--------|-------------|----------|
| BEFORE-UPDATE trigger | Mirror shipped 0005 role guard | ✓ (layer 2) |
| Column REVOKE / scoped grant | Declarative Postgres privilege | ✓ (layer 1) |
| Both (defense-in-depth) | Column-scoped UPDATE grant (safe columns only) + trigger rejecting `level` changes | ✓ |

**User's choice:** Recommended default — defense-in-depth: column-scoped UPDATE grant excluding `level`, plus a BEFORE-UPDATE trigger mirroring 0005. `role` stays guarded by the existing 0005 trigger.
**Notes:** This is the write-safety template the whole milestone reuses, so it was locked on purpose.

---

## Coach read-only view

| Option | Description | Selected |
|--------|-------------|----------|
| Identity + goal + level (prefs/consent hidden) | Coach-relevant fields only | ✓ |
| Show everything incl. a11y prefs / consent | | |

**User's choice:** Recommended default — coach sees identity + goal/role-context + level; a11y prefs and consent hidden. Route `/coach/clients/[id]`, client-list rows become links, unassigned coach default-denied via `is_coach_of` (no cross-client leak).

---

## Consent & a11y prefs

| Option | Description | Selected |
|--------|-------------|----------|
| Combined terms+privacy, versioned fields, acknowledged on profile, non-blocking | | ✓ |
| One-time blocking first-run gate | | |
| Defer consent to onboarding (Phase 5) | | |

**User's choice:** Recommended default — one combined terms+privacy consent stored as boolean+timestamp+version, acknowledged on the profile, non-blocking this phase. Text size = 3 steps (Default/Large/Larger); prefs (theme/text-size/reduced-motion) are nullable columns (null = follow system), apply instantly + persist to DB.

---

## Claude's Discretion

- Exact `client_profiles` row-provisioning mechanism (trigger vs seed-backfill) — guarantee: no client ever missing their row.
- Column names/types, migration numbering (continues from `0006`), two-table write split in the edit Server Action.
- Copy strings, monogram/avatar rendering, "your agreement" affordance styling.

## Deferred Ideas

- Full bottom-nav shell (Home/Progress/Messages/Profile) — its own phase.
- Progress tab / milestone-journey UI — separate tab, not this phase.
- Coach editing of `level` / assignment UI — seed-only (ASGN-01 trigger).
- Full privacy tooling (export/delete/retention/audit) — privacy milestone.
- Granular / multi-doc consent and consent-as-hard-gate — pair with Phase 5 if a coach validates the need.
