---
sketch: 006
name: onboarding
question: "What are a new client's first five minutes?"
winner: B
tags: [onboarding, assessment, first-run, form]
---

# Sketch 006: Onboarding

A new client's first five minutes: a short **data-driven assessment** (questions from the DB, per the
build order) so the coach can tailor things. Grounded in `sketch-findings-fish`.

## Design Question

For an ADHD audience the risk is overload, so how the assessment is *paced* matters most. Answering
questions about *yourself* is input, not the menu-of-plans the "assigned never chosen" rule forbids.

## How to View

open .planning/sketches/006-onboarding/index.html

## Decision

**Winner: B · Conversational** (user-confirmed 2026-07-04). FISH is a ChatHub, so onboarding-as-a-chat
is native rather than a bolt-on form: it reuses the chat components, is the warmest / lowest-pressure
framing, and paces one question at a time without a separate UI. A subtle "2 of 4"-style cue keeps it
feeling bounded. A · One-per-screen is the fallback if an explicit, reviewable form is ever needed;
C · Scroll form was rejected (most on screen at once — worst for overload).

## Variants

- **B · Conversational ★ (selected)** — the assessment is a warm chat (system voice → answer chips).
- **A · One question per screen** — full-screen, a single question with big options and visual
  progress. Least possible overload (one decision on screen); more taps to finish.
- **B · Conversational** — the assessment *is* a chat: a warm system voice asks one question at a
  time, the client taps an answer chip. On-brand for a ChatHub, personal, reuses the chat components,
  no new form paradigm.
- **C · Scroll form** — all questions on one calm scrollable page, progress on top, one action at the
  bottom. Fastest for a confident user; more on screen at once (the audience's hardest thing).

## What to Look For

- Which pacing best protects a new, possibly anxious client from **overload**?
- Does it feel like a **form to fill** or a **warm welcome**? (B leans hardest into welcome.)
- Progress shown **visually**, never as a grade.
- Big tap targets (≥56/44px), one primary action, calm copy that sets expectations (the coach guides next).
