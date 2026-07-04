# States — empty, loading, error, lifecycle

Validated in sketch 005 (a **catalog**, not a winner-pick). Source: `sources/005-client-states.html`.
Every real screen needs these; for this audience they must **reassure, never alarm**. Monochrome; the
soft `--notice` tone for problems (never red); one calm message; no added choices.

## Message lifecycle

`sending → sent → seen → failed`, shown as quiet meta under the outgoing bubble:
- **sending** — subtle "Sending…", bubble slightly translucent.
- **sent / seen** — small monochrome check / double-check + word.
- **failed** — `--notice` tone: "Not sent — tap to try again" with a warning glyph. **Never a red
  error.** An ADHD client who can't tell a message sent will re-send it, so this state matters.

## Empty states

One gentle line that explains and reassures the coach will act — **no buttons demanding a choice, no
dead ends**:
- **New client (Messages):** heading "Your coach will say hello soon" + "James will start the conversation when you're both ready. Nothing to do yet."
- **No task today (Home):** "Nothing to practice yet today. James will add your next step when you're ready."
- **Caught up (Progress):** "You're all caught up. Lovely work." (a gentle terminal milestone).

## Loading & connection

- **Loading** — a soft **skeleton** of what's coming (not a blank screen or a spinner-of-doom); the
  pulse respects `prefers-reduced-motion` (via the theme).
- **Offline** — a calm `--notice`-tone banner: "You're offline. Messages will send when you're back."
  with the content dimmed. Never an alarming red failure.
- **Reconnecting** — a quiet "Reconnecting…" in muted tone.

## Anti-patterns

- ❌ Red / alarming error states anywhere client-facing. ❌ Spinners on a blank screen (use skeletons).
- ❌ Empty states that add choices or read as a failure. ❌ Motion without a reduced-motion guard.
