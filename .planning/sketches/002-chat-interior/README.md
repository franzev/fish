---
sketch: 002
name: chat-interior
question: "How does gentle correction appear in a calm coaching conversation without ever scolding?"
winner: C
tags: [chat, conversation, correction, voice, calm]
---

# Sketch 002: Chat Interior

## Design Question

The 1-on-1 coaching thread is where FISH earns its keep. The hard, product-defining
question isn't "what does a bubble look like" — it's **how the coach corrects the client's
English without it ever feeling like a red-pen scolding**. Three correction styles, each in a
full thread (web + Android), with everything else held constant (voice note, inline assigned
practice, seen-state, a positive reaction) so only the correction varies.

Grounded in the existing `apps/web/components/chat` library — `quoted-message`, `voice-player`,
`reactions`, `message-status` are already built.

## How to View

open .planning/sketches/002-chat-interior/index.html

Switch styles with the tabs. In **B**, tap the underlined word / note chip to reveal the fix.
Toggle light / dark bottom-right.

## Decision

**Winner: C · Quoted reply** (user-confirmed 2026-07-04). The coach quotes the client's phrase
and replies with the fix in the notice tone — the gentlest framing that still teaches clearly,
using a pattern people already know, consistent with the Messenger direction locked in sketch 001.
A (suggestion card) stays available when a fix needs to be maximally explicit; B (inline note) was
judged too easy to miss for learners who need the feedback.

## Variants

- **C · Quoted reply ★ (selected)** — the coach quotes the phrase and replies with the fix, Messenger-style.
- **A · Suggestion card** — a soft "gentle suggestion" card under the message: *you said → try*,
  plus an encouraging why. Most explicit and teacherly; adds a block to the stream.
- **B · Inline note** — the phrase is softly underlined; a small note reveals the fix on tap.
  Least intrusive, correction is opt-in — the stream stays calm and clean.
- **C · Quoted reply** — the coach quotes the phrase and replies with the fix, Messenger-style.
  Familiar and warm; consistent with the D navigation direction.

## What to Look For

- Does the correction **encourage** or **grade**? All use the soft `notice` tone, never red.
- How much does each add to the stream vs. keep it clean?
- Whether it still reads as a **calm conversation** with a person, not a grammar checker.
- Consistency of the surrounding elements (voice, practice card, seen, reaction) across styles.
- The **reaction** (👏) as reward-not-scold — celebrating the corrected retry.
