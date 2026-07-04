---
sketch: 001
name: navigation-shell
question: "For an app whose whole job is to remove choices, what is the navigation model?"
winner: D
tags: [navigation, shell, layout, cross-platform, calm]
---

# Sketch 001: Navigation / App Shell

## Design Question

FISH removes choices by design. So what *is* the navigation for the client? This
sketch tests three structural models — each shown on **web and Android together** so
cross-platform consistency is judged at a glance. Shared design language (monochrome
tokens, Lexend / Fraunces, ≥56px targets, soft & spacious), native structure per platform.

## How to View

open .planning/sketches/001-navigation-shell/index.html

Switch models with the tabs up top. Toggle light / dark bottom-right.

## Decision

**Winner: D · Synthesis.** Bottom-nav shell (Home · Messages · Profile), Messenger / WhatsApp
inspired. Chosen by the user (2026-07-04): familiar messaging patterns, a conversation *list*
that opens a thread, a calm dashboard Home, and a client Profile. Fuses B's fixed shell with
C's hub-as-Home and a known chat idiom. Web = left rail + desktop two-pane; Android = Material 3
bottom nav with a full-screen thread. Feeds sketch 002 (chat/thread) and 003 (profile).

## Refinements (2026-07-04)

Three changes from user direction, each with the recommendation behind it:

- **Brand mark** — the placeholder "F" is replaced by the real `logo.svg` (the teal fish badge
  from `apps/web/public/logo.svg`) inside an ink-bordered rounded square, in the web rail and
  both FISH conversation avatars. *Recommendation:* keep the logo in brand teal as the single
  sanctioned color accent — a logo is identity, not chrome (same color-exception logic already
  granted to alert tones); the ink border gives it a crisp edge on both themes. *Flag:*
  `apps/web/app/icon.svg` is mint `#75D5CA` while `logo.svg` is teal `#1b7ba5` — app icon and
  logo are out of sync; pick one.
- **4th tab: Progress** (`Home · Progress · Messages · Profile`). *Recommendation (design panel):*
  the tracker engine is the only upcoming roadmap surface that both lacks a home and is
  returned-to weekly, so it earns the slot; "Progress" over "Practice" because it frames a calm
  journey view, not a task queue or score. Icon is a milestone *path*, not a rising chart line
  (which would read as a grade). Runner-up: "Practice". *Caveat:* coach-first/code-second —
  don't SHIP this tab until a coach validates the tracking technique; keep 3 tabs and surface
  the tracker on Home until then. Four tabs is the ceiling; a fifth would erode calm.
- **Bottom-nav labels** — live toggle (full / active-only / icons-only); **decision: full labels** (user-confirmed 2026-07-04, over the initial icons-only request).
  *Recommendation:* keep labels; do NOT go icons-only. The project's own
  `docs/ui-ux-agent-guidelines.md` decides it: "Use labels with icons unless the icon is truly
  universal" (l.644); icon-only nav and "assume an icon is universal" are listed as don'ts
  (l.655, 729). The audience are neurodivergent AND non-native English readers — the two groups
  labels help most, and labels double as vocabulary scaffolding. If a cleaner bar is wanted,
  **active-label-only** is the furthest defensible step; full icons-only is a distant last.

## Variants

- **D · Synthesis ★ (selected)** — bottom-nav shell, **Home · Progress · Messages · Profile**. Messages is a
  conversation *list* → thread (Messenger/WhatsApp idiom). Web: left rail + two-pane (list + open
  thread). Android: Material 3 bottom nav; opening a thread goes full-screen (nav hides). Home is
  the calm dashboard; Profile is the client. Interactive — nav and the coach row are live.
- **A · Conversation-first** — the chat *is* the app. No tabs, no hub; you land in the
  coaching conversation. Profile behind the coach avatar; assigned practice arrives inline
  as a card. Web = centered conversation; Android = immersive edge-to-edge chat.
- **B · Three-tab** — one fixed set of destinations (Chat · Practice · Profile). Web = slim
  left rail; Android = Material 3 bottom navigation. Familiar, predictable muscle memory.
- **C · Calm hub** — home greets by name and surfaces the single assigned focus + one
  primary action (Message James). One tap to anything, then back. No persistent bar.

## What to Look For

- Which model best serves a client who benefits from **calm and few choices**?
- How each honors **one primary action per screen** (the send affordance vs. the hub button).
- Where **profile** lives, and how **assigned practice** surfaces without becoming a menu.
- Whether web and Android feel like *the same product* while each feels native.
- Coach note: the coach flow adds a **client-list before the conversation** — deferred to a later sketch.
