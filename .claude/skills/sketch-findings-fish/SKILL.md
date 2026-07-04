---
name: sketch-findings-fish
description: Validated FISH UI design decisions — navigation shell, chat, profile/progress, and the monochrome theme — from the .planning/sketches/ experiments. Load before building, changing, or reviewing any FISH client-facing screen so the settled design direction (and its anti-patterns) is applied instead of re-derived.
---

<context>
## Project: FISH

FISH is a ChatHub that teaches English to neurodivergent professionals (many with ADHD) who are
also non-native English readers. The product's job is to **remove choices** — the coach assigns,
the app presents. Calm, focus-first.

Design direction (from the sketch intake): **pure monochrome, soft & spacious** (Headspace/Calm-
like) with **native-per-platform** structure (responsive web + Material 3 Android) sharing one set
of tokens, Lexend/Fraunces type, and Tabler icons. Reference points: Headspace/Calm (the "calm"),
Messenger/WhatsApp (the conversation idiom), the shipped v1.0 monochrome design system.

Sketch session wrapped: 2026-07-04.
</context>

<design_direction>
## Overall direction

- **Shell:** a Messenger-style bottom-nav app — **Home · Progress · Messages · Profile**. Web = left rail + desktop two-pane; Android = Material 3 bottom nav, full-screen thread. Always-visible labels.
- **Chat:** gentle correction via **quoted reply** (never red/scolding); conversation list → thread; voice notes; monochrome presence.
- **Profile:** **essentials only** (identity + assigned coach + settings) — metrics live in the Progress tab, which is a **milestone journey, never a scoreboard**.
- **Theme:** monochrome `light-dark()` ladder; the teal logo + alert tones are the only colors; AA contrast, 56px targets, visible focus, reduced-motion, active-state-by-shape.
- **Never:** streaks that reset, scoreboards/grades/percentages client-facing, icon-only nav, color in structural UI, sub-56px targets, a `tailwind.config.js`.
</design_direction>

<findings_index>
## Design areas

| Area | Reference | Key decision |
|------|-----------|--------------|
| Navigation & shell | `references/navigation-and-shell.md` | Bottom-nav (Home/Progress/Messages/Profile), native per platform, labeled |
| Chat & conversation | `references/chat.md` | Quoted-reply gentle correction; list → thread; calm states |
| Profile & progress | `references/profile-and-progress.md` | Essentials-only profile; Progress = milestone journey, reward-only |
| Theme & tokens | `references/theme-and-tokens.md` | Monochrome `light-dark()` ladder; a11y floor; color rule |

## Theme

Winning theme: `sources/themes/default.css`. Brand mark: `sources/logo.svg` (teal, the one color accent).

## Source files

Full winning sketches (all variants; winner marked ★) are preserved in `sources/` for complete
reference: `001-navigation-shell.html`, `002-chat-interior.html`, `003-profile.html`. These are
throwaway HTML mockups — port their *decisions* into the real Next.js/Compose components; do not
copy the mock markup verbatim.
</findings_index>

<metadata>
## Processed sketches

- 001-navigation-shell — winner D · Synthesis
- 002-chat-interior — winner C · Quoted reply
- 003-profile — winner A · Essentials
</metadata>
