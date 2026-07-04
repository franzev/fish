# Responsive Web

Validated in sketch 007 (a **demonstration** of the responsive contract). Source:
`sources/007-responsive-web.html`. Proves "native per platform" (from `navigation-and-shell.md`) holds
as one system, not two disconnected designs.

## The contract — one markup, container-query driven

The same web app reflows by **CSS container queries** (not viewport media queries), so each panel
responds to *its own* width:

- **≥ 900px — desktop:** left rail (labeled) + conversation **list** + open **thread** (two-pane).
- **600–899px — tablet:** rail stays; one pane fits, so the **thread** takes the space with a **back**
  control to the list.
- **< 600px — mobile:** the rail becomes a Material-style **bottom navigation** and the app lands on
  the **list** — the exact layout the Android app uses. The web quietly becomes the app.

## Why container queries

Use `@container` (not `@media`) so a two-pane's thread panel can reflow based on the panel width, not
the whole viewport — important when the rail + list already consume horizontal space. The mobile
breakpoint deliberately **mirrors the Android bottom-nav layout**, which is what makes web feel native
at every size while staying consistent cross-platform.

## Anti-patterns

- ❌ Treating web and mobile as two separate designs — it's one system reflowing.
- ❌ Viewport-only media queries for panel layout (a nested pane needs its own container breakpoints).
- ❌ Dropping the bottom nav on mobile web (it should match Android, per `navigation-and-shell.md`).
