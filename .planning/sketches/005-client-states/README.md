---
sketch: 005
name: client-states
question: "How does the app stay calm when it's empty, loading, or failing?"
winner: catalog
tags: [states, empty, error, loading, chat]
---

# Sketch 005: Client States

A **consistency / catalog** sketch (not a pick-one-winner sketch): the deferred states every real
screen needs, designed to the calm rules. The three tabs are state *categories*, each with a live
**cycler**. Grounded in `sketch-findings-fish`.

## Design Question

How does FISH behave when a screen is empty, loading, or something fails — while staying calm for a
neurodivergent audience? Monochrome; the soft `notice` tone for problems (never red); one gentle
message; no added choices.

## How to View

open .planning/sketches/005-client-states/index.html

Use the **cyclers** under each tab to flip a live frame through its states.

## State categories

- **A · Message lifecycle** — `sending → sent → seen → failed`. Quiet monochrome status reassures an
  ADHD client the message went through; a failed message uses the notice tone + calm "tap to try
  again," never a red error.
- **B · Empty states** — new client (Messages), no task today (Home), caught up (Progress). Each is
  one gentle line that explains and reassures the coach will act; **no buttons demanding a choice**.
- **C · Loading & connection** — a soft skeleton of what's coming (not a blank screen or spinner);
  a calm notice-tone "you're offline, messages will send later" banner; a quiet "reconnecting."

## What to Look For

- Does every state **reassure** rather than alarm? (Especially failed/offline — notice tone, not red.)
- Empty states have **zero added choices** and name what the coach will do next.
- Status is quiet enough to not add anxiety, present enough to answer "did it send?"
- Skeletons/pulse respect `prefers-reduced-motion` (via the shared theme).

## Decision

Approved as the **states reference** for the build — these treatments carry into the real chat,
Home, and Progress implementations. No single "winner variant"; the catalog is the deliverable.
