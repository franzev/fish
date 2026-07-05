# Phase 6: Tracker Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 06-tracker-engine
**Areas discussed:** Tracker config/cadence/milestone source, entry draft/save lifecycle, assignment command/active policy

---

## Tracker config, cadence, and milestone source

| Option | Description | Selected |
|--------|-------------|----------|
| Separate milestone journey on the assignment | Tracker versions define fields + cadence; assignment owns coach-authored milestone steps so a coach can add the next step later without changing entry schema. | yes |
| Inside the tracker version | Simpler immutable bundle, but less faithful to "coach adds each step as you're ready." | |
| Planner decides | Let planning choose the thinnest safe schema. | |

**User's choice:** Recommended route approved.
**Notes:** The user selected option 1 for milestone source and client timezone, then instructed the agent to continue with recommended choices without further interruption.

| Option | Description | Selected |
|--------|-------------|----------|
| Client profile timezone | Uses Phase 4 `client_profiles.timezone` so daily/weekly periods match the client's life. | yes |
| Coach timezone | Useful for operations, less client-centered. | |
| UTC/server time | Simplest technically, but wrong-feeling near midnight. | |

**User's choice:** Option 1.
**Notes:** Current periods are client-local.

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly one active assignment | Matches "single assigned tracker", prevents client choice, and keeps Home focused. | yes |
| Multiple active assignments but show only one | Leaves room for operations but creates hidden complexity. | |
| Planner decides | Let planning enforce the roadmap with the simplest safe database constraint. | |

**User's choice:** Recommended route.
**Notes:** Enforce one active tracker assignment per client.

---

## Entry draft, save lifecycle, and coach visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase-backed private draft | Preserves draft across refresh/navigation/device switch while keeping half-typed content hidden from coaches. | yes |
| Browser-only local draft | Easier, but weaker than TRAK-03 because it does not survive device switch or browser data loss. | |
| Saved partial entries visible to coach | Gives coach earlier visibility but risks exposing accidental/unfinished text. | |

**User's choice:** Recommended route.
**Notes:** Drafts are durable and private. Coach timeline reads saved entries only.

| Option | Description | Selected |
|--------|-------------|----------|
| One visible `Save entry` action | Quiet draft persistence can happen behind the scenes; the only client-facing primary action saves the entry. | yes |
| Separate save draft and submit actions | More explicit, but creates competing actions and more choices. | |
| Planner decides | Let implementation decide. | |

**User's choice:** Recommended route.
**Notes:** `Save entry` also acts as retry after failure.

---

## Assignment command and active-tracker policy

| Option | Description | Selected |
|--------|-------------|----------|
| Seed-invocable and future coach-safe Edge Function | Satisfies v1.1 seed-only operations while keeping the command boundary ready for coach-authenticated use. | yes |
| Seed-only function | Simplest now, but may need rework when assignment UI arrives. | |
| Direct DB seed only | Avoids Edge Function work but misses the roadmap command boundary. | |

**User's choice:** Recommended route.
**Notes:** No assignment UI ships in Phase 6.

| Option | Description | Selected |
|--------|-------------|----------|
| Derive coach/version server-side | Prevents trusting client-supplied authority fields and matches the roadmap success criterion. | yes |
| Accept explicit coach/version payload | Flexible but unsafe and harder to verify. | |
| Planner decides | Let implementation choose. | |

**User's choice:** Recommended route.
**Notes:** Function derives coach from `coach_clients` and active tracker version server-side.

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent same assignment, reject conflicts | Double-call safe while preventing silent replacement of a client's active tracker. | yes |
| Always replace active tracker | Operationally convenient but risky and out of scope without replacement UI. | |
| Always reject any existing assignment | Safe but less idempotent for seed reruns. | |

**User's choice:** Recommended route.
**Notes:** Conflicting active assignment replacement is deferred.

## the agent's Discretion

- Exact table/RPC/interface names.
- One table with draft/saved status vs separate draft and saved-entry tables.
- Exact timezone fallback if client timezone is absent.
- Exact neutral seed tracker copy.

## Deferred Ideas

- Assignment/reassignment UI.
- Coach tracker authoring UI.
- Tracker template gallery or picker.
- Progress tab navigation.
- Reward/return mechanics beyond the required milestone journey.
- Entry comments, edit/delete, filters, charts, heatmaps, analytics, exports, and notifications.
