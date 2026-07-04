# Sketch Manifest

## Design Direction

Calm, choice-free UI for neurodivergent professionals (many with ADHD) learning English.
**Pure monochrome** (black/white/greys), **soft & spacious** aesthetic — Headspace/Calm-like:
generous whitespace, large rounded cards, gentle elevation, unhurried. Dual **light/dark**
resolves from one token ladder. **Lexend** body / **Fraunces** display, Tabler icons, ≥56px
tap targets, **one primary action per screen**, progress-as-visual (never a grade), rewards
that never punish a gap. **Native per platform**: shared design language (tokens, type,
spacing), but web is responsive and Android follows Material 3 — each feels native while the
product feels like one thing.

## Reference Points

- **Headspace / Calm** — soft, spacious, unhurried; the "which calm" the theme leans toward
- **FISH v1.0 shipped design system** — the monochrome `light-dark()` token ladder, `/kit`, the chat component library at `/kit/chat`
- **iMessage / Telegram** — the familiarity baseline for 1-on-1 conversation

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | navigation-shell | For a choice-minimal app, what is the client's navigation model? | **D · Synthesis** — bottom nav (Home/Progress/Messages/Profile), Messenger-style list→thread, real logo mark, labeled nav | navigation, shell, layout, cross-platform, calm |
| 002 | chat-interior | How does gentle correction appear without ever scolding? | **C · Quoted reply** — coach quotes the phrase and replies with the fix, Messenger-style | chat, conversation, correction |
| 003 | profile | How much does a client see about themselves without a scoreboard? | **A · Essentials** — identity + coach + settings, no stats (Progress owns metrics) | profile, identity, settings |
