# Deferred Items — Phase 01

Out-of-scope discoveries logged during execution. Not fixed inline per scope boundary.

## From plan 01-01

- **`apps/web/app/page.tsx` references removed tokens** — the home showcase's swatch
  array still lists `bg-old-hue-token-a` and `bg-old-hue-token-b`, which no longer exist in
  the monochrome `@theme` ladder (Task 2 removed them). Tailwind silently skips unknown
  utilities so the build passes, but those two swatches render with no background.
  `/kit` supersedes the home showcase as the design-system contract (D-12), and plans
  01-02/01-03 only touch `app/kit/page.tsx` — the stale home page needs a follow-up
  (either retire it or point it at the monochrome ladder). Discovered during Task 2.
