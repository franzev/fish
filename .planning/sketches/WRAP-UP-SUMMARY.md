# Sketch Wrap-Up Summary

**Date:** 2026-07-04
**Sketches processed:** 7 (all included — 001–003 first round, 004–007 frontier round)
**Design areas:** Navigation & shell · Chat & conversation · Profile & progress · Coach experience · States · Onboarding · Responsive web · Theme & tokens
**Skill output:** `.claude/skills/sketch-findings-fish/`

## Included Sketches

| # | Name | Winner | Design area |
|---|------|--------|-------------|
| 001 | navigation-shell | D · Synthesis | Navigation & shell |
| 002 | chat-interior | C · Quoted reply | Chat & conversation |
| 003 | profile | A · Essentials | Profile & progress |
| 004 | coach-conversation | D · Synthesis (menu → inline compose) | Coach experience |
| 005 | client-states | Catalog (states reference) | States |
| 006 | onboarding | B · Conversational | Onboarding |
| 007 | responsive-web | System (container queries) | Responsive web |

## Excluded Sketches

None.

## Design Direction

Pure monochrome, soft & spacious (Headspace/Calm-like), calm and choice-free for neurodivergent /
non-native-English learners. Native per platform (responsive web + Material 3 Android) over one set
of tokens, Lexend/Fraunces type, Tabler icons. Messenger/WhatsApp conversation idiom.

## Key Decisions

- **Shell:** bottom-nav — Home · Progress · Messages · Profile. Web = left rail + two-pane; Android = Material 3 bottom nav, full-screen thread. Always-visible labels (icons-only rejected against `docs/ui-ux-agent-guidelines.md`).
- **Chat:** quoted-reply gentle correction (never red); conversation list → thread; monochrome presence.
- **Profile:** essentials only; metrics live in the Progress tab.
- **Progress:** milestone journey, reward-only — no streaks, no scoreboards.
- **Coach side:** a client roster (monochrome "waiting" dot); correct/assign via tap → menu → inline compose; coaches get real tools (clients never choose).
- **States:** calm message lifecycle (sending/sent/seen/failed), empty, and loading/offline — reassure never alarm; notice tone for problems, never red.
- **Onboarding:** the data-driven assessment is a warm in-chat conversation.
- **Responsive web:** one container-query system — desktop two-pane → tablet single → mobile bottom-nav (mirrors Android).
- **Theme:** monochrome `light-dark()` ladder; teal logo + alert tones the only colors; AA contrast, 56px targets, focus ring, reduced-motion (hardened by a 5-lens design critique).

## Carried into build (deferred from sketches)

- `<div>`→semantic-element / ARIA is a build concern (real `apps/web/components` are already semantic).
- Message lifecycle (sending/sent/seen/failed) + empty states → design in the chat implementation.
- Long-content truncation contracts.
- Reconcile `apps/web/app/icon.svg` (mint) vs `logo.svg` (teal).
- **Progress tab is coach-first** — do not ship until a coach validates the tracking technique.

## Next

Define the milestone (`/gsd-new-milestone`) informed by these decisions, then `/gsd-plan-phase` per
phase. The `sketch-findings-fish` skill auto-loads during UI build/review.
