# Chat & Conversation

Validated in sketch 002 (winner **C · Quoted reply**). Source: `sources/002-chat-interior.html`.

## The defining decision: gentle correction

The coach **quotes** the client's phrase and **replies with the fix**, Messenger-style — the
gentlest framing that still teaches, using a pattern people already know. The corrected word is
underlined in the soft `--notice` tone. **Never red, never scolding.**

```
[coach bubble]
  ⌜ I would like see the menu, please.        ← quoted (muted, left border)
  Almost! "I would like to see the menu."       ← "to" underlined in --notice
  That little "to" makes it perfect.
```

Rejected: **A · Suggestion card** (a "you said → try" card — keep only when a fix must be maximally
explicit; the struck-through "you said" edges toward marking a mistake). **B · Inline note**
(underline + tap-to-reveal — too easy to miss for learners who need the feedback).

## Conversation surface

- **Messages tab = a list, then a thread.** Rows: avatar + **monochrome ink presence dot** (never a green/color dot) + name + time + preview (ellipsis) + unread badge. Include a pinned **FISH** system thread. For coaches, this same list holds many clients.
- **Thread:** coach/me bubbles (coach = `--surface` + border; me = `--primary`), day dividers, **voice note** (waveform + play + duration — pronunciation matters), a positive **reaction** as reward.
- **Composer:** message field (≥48px) + `--primary` send (≥52px) + voice. One primary affordance (send).
- Inline **assigned-practice card** can appear in the stream (bar + one calm phrase, never a fraction/score).

## Build-time states to design (deferred from the sketch)

The sketch shows the happy path. A real build MUST add:
- **Message lifecycle:** sending → sent → seen, plus a calm **failed** state ("That didn't send. Give it a minute and try again." — never harsh).
- **Empty states** (single calm message, no added choices): Messages-empty ("James will start the conversation soon."), no-assignment on Home, caught-up Progress.
- **Long-content truncation** for names/previews/titles.

## Anti-patterns

- ❌ Red / alarming correction. ❌ Scolding or grading copy. ❌ A green ("online") presence dot — use a monochrome ink dot + the "online" text. ❌ Emoji as UI chrome (user-typed emoji in a message is fine).
