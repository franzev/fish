---
sketch: 007
name: responsive-web
question: "Does 'native per platform' hold as the web resizes?"
winner: system
tags: [responsive, web, breakpoints, container-queries]
---

# Sketch 007: Responsive Web

A **demonstration** sketch (not a pick-one-winner): the same web Messages screen at three widths,
proving the "native per platform" claim holds as the browser resizes. Grounded in
`sketch-findings-fish`.

## Design Question

Sketch 001 claimed web = responsive (rail + two-pane) and Android = bottom nav. Does that actually
hold as one system when the web window shrinks — or are they two disconnected designs?

## How to View

open .planning/sketches/007-responsive-web/index.html

Flip the **Desktop / Tablet / Mobile** tabs. It is the **same markup and tokens** in all three —
only the container width changes.

## Breakpoints (CSS container queries)

- **Desktop (≥ 900px)** — rail (labeled) + conversation list + open thread (two-pane). Classic
  desktop messaging layout.
- **Tablet (600–899px)** — rail stays; one pane fits, so the open thread takes the space with a back
  control to the list.
- **Mobile (< 600px)** — the rail becomes a Material-style **bottom navigation** and you land on the
  list — the exact pattern the Android app uses. The web quietly becomes the app.

## What to Look For

- The desktop two-pane and mobile bottom-nav are **one responsive system reflowing**, not two designs.
- Web feels native at every size *and* stays consistent with Android.
- **Container queries** (not viewport media queries) so a panel reflows to *its own* width — important
  for the two-pane where the thread pane has its own breakpoints.

## Decision

Approved as the **responsive contract** for the web build: rail+two-pane → rail+single → bottom-nav,
via container queries. The mobile-web breakpoint deliberately mirrors the Android layout.
