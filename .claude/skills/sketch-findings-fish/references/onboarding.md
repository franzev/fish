# Onboarding

Validated in sketch 006 (winner **B · Conversational**). Source: `sources/006-onboarding.html`.

A new client's first five minutes: a short **data-driven assessment** (questions from the DB, per the
build order) so the coach can tailor things.

## Decision: the assessment IS a chat

FISH is a ChatHub, so onboarding happens where everything else does: a warm **system voice** asks one
question at a time; the client **taps an answer chip** and it becomes their reply. This reuses the
chat components (no new form paradigm), is the warmest / lowest-pressure framing, and paces one
question at a time — which is exactly the overload protection this audience needs. Keep a subtle
"2 of 4"-style cue in the system voice so it still feels **bounded**.

Rejected: **A · one-question-per-screen** (the fallback if an explicit, reviewable form is ever needed —
it's a separate paradigm); **C · scroll form** (everything on screen at once — worst for overload).

## Rules

- **Data-driven:** questions come from the database, never hard-coded.
- Answering questions **about yourself is input**, not the menu-of-plans the "assigned never chosen"
  rule forbids. (Onboarding may offer answer options; the *learning plan* is still coach-assigned.)
- Progress shown **visually / softly**, never as a grade. Big tap targets, calm copy that sets
  expectations (the coach guides what's next).

## Anti-patterns

- ❌ A long form with every question visible at once. ❌ Hard-coded questions. ❌ Framing onboarding
  as a client choosing their own plan.
