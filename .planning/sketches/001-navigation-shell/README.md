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

## Variants

- **D · Synthesis ★ (selected)** — bottom-nav shell, **Home · Messages · Profile**. Messages is a
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
