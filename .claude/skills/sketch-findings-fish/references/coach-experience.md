# Coach Experience

Validated in sketch 004 (winner **D · Synthesis**). Source: `sources/004-coach-conversation.html`.

The coach is the one who **assigns**, so the coach side authors the entire client experience.

## Entry: the roster

The coach's Messages tab is a **roster of many clients** (unlike the client's single-coach list).
Rows show the client, last message, and a **monochrome ink "waiting for you" dot** — which MUST carry a
text/`aria-label` ("Waiting for your reply"), never shade + shape alone — (never a colored
badge) so the coach sees who needs a reply. Web puts the roster in the left pane of a two-pane;
Android is a list → conversation.

## Authoring: tap → menu → inline compose

The decided interaction for correcting/assigning inside a conversation:

1. **Tap the client's message** → a small menu: **Suggest a fix · Praise · Assign practice**.
2. **Suggest a fix** → an **inline compose panel** opens (the quoted phrase, the corrected line with
   the fixed word underlined in `--notice`, an optional warm note) — this produces the *exact*
   quoted-reply the client receives (see `chat.md`).

This combines a discoverable branch menu with inline authoring, and keeps the thread free of
permanent chrome. Rejected alternatives: **A** jumped straight to fix (no branch); **B** was the menu
alone; **C** a permanent coach toolbar above every composer (too much standing chrome).

## Coaches get tools

The **"assigned, never chosen"** rule constrains **clients**, not coaches — a coach *does* choose what
to assign, so "Assign practice" is a real picker/library. Keep the coach's tools efficient; keep the
*client's* surfaces choice-free.

## Anti-patterns

- ❌ Making correction feel like grading/marking (red, scores, harsh copy). Use the calm quoted reply.
- ❌ A permanent tools toolbar on every conversation (chrome competes with calm). Author on demand.
- ❌ A green/colored "waiting" indicator — monochrome ink dot only.
