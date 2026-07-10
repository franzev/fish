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
- **Caught up (Progress):** "You're all caught up" + "Lovely work this week. Your next step will appear here when James adds it." (a gentle terminal milestone — keep the second clause so the state still promises the coach will act, never a bare dead end).

## Loading & connection

- **Loading** — a soft **skeleton** of what's coming (not a blank screen or a spinner-of-doom); the
  pulse respects `prefers-reduced-motion` (via the theme).
- **Offline** — a calm `--notice`-tone banner: "You're offline. Reconnect, then try again."
  De-emphasise **only the composer** (it can't send yet); keep the **message transcript at full opacity**
  so past coach instructions stay AA-legible for an audience that re-reads. Never an alarming red failure.
  No offline queue exists — a failed send stays a real, manual **Retry** action; the copy must never
  promise automatic or background delivery.
- **Reconnecting** — a quiet "Reconnecting…" in muted tone.

## Anti-patterns

- ❌ Red / alarming error states anywhere client-facing. ❌ Spinners on a blank screen (use skeletons).
- ❌ Empty states that add choices or read as a failure. ❌ Motion without a reduced-motion guard.
