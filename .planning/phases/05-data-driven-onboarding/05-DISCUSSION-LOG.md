# Phase 5: Data-Driven Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 5-data-driven-onboarding
**Areas discussed:** Product shape, question-bank versioning, shared renderer, autosave/resume, coach review, verification gates
**Mode:** Auto-selected recommended defaults, per user instruction to always proceed with the recommendation.

---

## Product Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Warm in-chat assessment | Reuse FISH's ChatHub idiom; system voice asks one question at a time and answers appear as client replies. | yes |
| Full-screen one-question form | Separate form paradigm; low overload, but less native to the product. | |
| Scroll form | All questions visible at once; fastest for confident users but highest overload risk. | |

**User's choice:** Auto-selected the recommended validated sketch winner: warm in-chat assessment.
**Notes:** Grounded in `.claude/skills/sketch-findings-fish/references/onboarding.md` and `.planning/sketches/006-onboarding/README.md`.

---

## Question-Bank Versioning

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned assessment + immutable used versions | Separate assessment identity from published versions; responses pin exact version; used versions freeze. | yes |
| Mutable single question table | Simpler schema, but historical answers can drift when prompts/options change. | |
| Hard-coded client UI questions | Fastest initial UI, but violates ONBD-01 and the tracker-reuse goal. | |

**User's choice:** Auto-selected versioned assessment + immutable used versions.
**Notes:** This directly supports ONBD-05 and the roadmap success criterion for freeze-used-version behavior.

---

## Shared Renderer

| Option | Description | Selected |
|--------|-------------|----------|
| Field-config renderer + validator reused by onboarding and tracker | Renderer switches only on answer type, with validation from config. | yes |
| Onboarding-specific renderer now, tracker renderer later | Faster locally, but duplicates the central engine Phase 6 depends on. | |
| Generic form library/picker | Adds choices and abstraction weight not needed for the calm one-field flow. | |

**User's choice:** Auto-selected shared field-config renderer + validator.
**Notes:** This is the load-bearing reason Phase 5 precedes Phase 6 in STATE.md.

---

## Autosave And Resume

| Option | Description | Selected |
|--------|-------------|----------|
| Persisted autosave + exact resume position | Draft answers persist to Supabase and reload opens the last in-progress/first unanswered question. | yes |
| Local-only draft | Too weak; refresh/device changes lose work. | |
| Save only on final submit | Simpler, but violates no-lost-work and resume requirements. | |

**User's choice:** Auto-selected persisted autosave + exact resume position.
**Notes:** Copy must reassure rather than scold.

---

## Coach Review

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only assigned-client answer review | Coach sees pinned prompts and answers through RLS, with partial/empty calm states. | yes |
| Coach edit/score/recommendation surface | Adds grading and authoring scope; not part of this phase. | |
| Hide onboarding from coach until complete | Loses partial-state visibility and weakens ONBD-07. | |

**User's choice:** Auto-selected read-only assigned-client answer review.
**Notes:** Must use `private.is_coach_of`/relationship RLS; unassigned coach reads nothing.

---

## Verification Gates

| Option | Description | Selected |
|--------|-------------|----------|
| Full DB/app validation and RLS proof | Extend `pnpm verify:rls`, prove zod + pg_jsonschema validation, prove save/resume. | yes |
| Build/typecheck only | Too weak for data-driven config and RLS. | |
| Manual visual sign-off only | Useful but insufficient for database/version invariants. | |

**User's choice:** Auto-selected full DB/app validation and RLS proof.
**Notes:** `sketch-findings-fish` has been loaded; downstream UI work must keep the design-line checks explicit.

---

## the agent's Discretion

- Exact schema/table names and whether answer finalization uses status fields, timestamps, RPC, Server Actions, or Edge Functions.
- Exact route names, as long as client and coach flows stay assigned and read/write permissions stay RLS-backed.
- Exact seed question copy, as long as it remains neutral intake content and not an unvalidated teaching technique.

## Deferred Ideas

- Branching/skip logic, coach authoring UI, assessment recommendations, assignment UI, tracker-specific templates, and Progress/reward UI are intentionally deferred.
