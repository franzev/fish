---
sketch: 004
name: coach-conversation
question: "How does a coach give a gentle correction and assign practice, without it feeling like grading?"
winner: D
tags: [coach, authoring, correction, roster]
---

# Sketch 004: Coach Conversation

The first **coach-side** sketch. The coach is the one who *assigns*, so this is where the whole
client experience is authored. Grounded in `sketch-findings-fish` (monochrome, ink presence, 56px,
the quoted-reply correction locked in 002).

## Design Question

How does a coach compose the gentle quoted-reply correction and assign practice from inside a
conversation — without the tooling turning the calm chat into a grading interface? Also: the coach's
entry is a **roster** (many clients), unlike the client's single-coach list.

## How to View

open .planning/sketches/004-coach-conversation/index.html

Web shows the desktop **two-pane** (roster + open conversation); Android shows the conversation.

## Decision

**Winner: D · Synthesis** (user-confirmed 2026-07-04). Tap a message → a small menu (fix · praise ·
assign) → **Suggest a fix** opens the inline compose panel that produces the exact quoted-reply the
client receives (002 C). Combines B's discoverable branch menu with A's inline authoring, and keeps
the thread free of the permanent chrome C would add. Assign/praise branch from the same menu; the
"assigned never chosen" rule constrains clients, not coaches — coaches get a real picker.

## Variants

- **D · Synthesis ★ (selected)** — tap message → menu (fix/praise/assign) → inline compose (interactive).
- **A · Inline compose** — tap the client's message; the composer becomes a "suggest a fix" panel
  (quoted phrase + corrected line + optional note), sends as the quoted-reply correction. Assign is a quiet ＋.
- **B · Message actions** — long-press / hover the message for a coach-only menu (suggest a fix,
  praise, assign). Familiar messaging pattern; tools stay hidden until needed.
- **C · Coach toolbar** — a slim always-present toolbar above the composer (correct · assign · voice ·
  praise). Fastest for many corrections; costs a permanent strip of chrome.

## What to Look For

- Does the authoring feel like **coaching** or like **grading/marking**? (Copy + calm matter.)
- Where correction lives vs. how often a coach reaches for it (A/B on-demand, C always-visible).
- The **roster**: waiting-for-reply signalled in monochrome (ink dot), not color; who needs the coach.
- Consistency with the client's received correction (002 C · quoted reply) — the coach authors *that*.
- Coaches get **tools** (assign = a real picker) — the "assigned never chosen" rule constrains *clients*, not coaches.
