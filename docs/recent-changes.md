# Recent Changes

Last reviewed: 2026-07-04

This note documents the recent implementation work visible in the current
worktree plus the latest commits on `main`. Some items below are still
uncommitted in the local tree; treat this as a review aid, not a release note.

## Summary

Recent work tightened the product foundation around three areas:

- Service access on web now goes through an explicit abstraction layer instead
  of direct Supabase imports from UI surfaces.
- Web and Android design-system primitives moved closer to token-driven,
  reusable component contracts.
- UI/UX governance was made explicit so future screen work starts from the
  FISH calm-focus rules and the consolidated PDF-derived guidance.

## Web Service Boundary

The web app now has a small service layer under `apps/web/lib/services`.
It provides an immutable service container, public environment validation,
typed service results, Supabase service factories, and repository-style
interfaces for auth, profiles, coach-client assignment, realtime, and storage.

Auth-facing helpers were split into `apps/web/lib/auth/browser.ts`,
`apps/web/lib/auth/server.ts`, and `apps/web/lib/auth/redirects.ts`. App routes
and auth UI now depend on those helpers instead of importing Supabase clients or
`@fish/supabase` contracts directly.

The boundary is enforced by `apps/web/tests/service-boundary.test.ts`, which
scans `.tsx` files and fails if they import Supabase clients or shared database
contracts directly.

## Web UI Kit

The web primitives are being prepared for wider reuse:

- `Button`, `Input`, and `Alert` now expose `class-variance-authority` variant
  helpers so maintained styles can be reused without duplicating class strings.
- `Button` now defaults to content width. Screens that need one large action
  opt into `fullWidth`.
- UI package barrels now re-export component helpers with `export *`.
- `Progress` is imported from its own module rather than through `Card`.
- Storybook no longer constrains every story to a narrow centered frame.
- Tests cover CVA variant output, 56px tap target contracts, loading click
  guards, input feedback precedence, and the `cn()` merge helper.

The product rule remains unchanged: at most one primary action per screen, and
primary actions should be deliberate rather than a default layout side effect.

## Android Design System

The Android design system moved closer to web parity:

- `Button` now defaults to content width and requires explicit `fullWidth` use
  for focused flows.
- `Button` and `TextField` use design tokens for spacing, stroke, opacity,
  progress sizing, and elevation instead of local magic numbers.
- `TextField` keeps a single-line contract and strips newline input.
- Native type tokens now use bundled Lexend and Fraunces fonts.
- `Theme` provides new stroke, elevation, and opacity composition locals.
- `ThemePreview` creates paired light/dark previews for components.
- A source-level Android unit test records the button width contract until
  fuller Compose UI tests exist.

The Android auth preview was refactored into route/page specs so login,
signup, check-inbox, reset-password, expired-link, and signed-in states share
the same quiet layout model.

## Branding And Preview Assets

App branding was refreshed across web and Android:

- The web icon switched to the current turquoise brand fill.
- Android launcher assets moved from old `.webp` outputs to generated `.png`
  density assets plus adaptive icon XML.
- Android splash/window background uses the launcher background color and splash
  drawable.
- Bundled native font assets were added for Android typography.

The Android preview helper now validates `ANDROID_PREVIEW_PORT`, reports all
LAN fallback URLs, serves the APK with `content-length` and `no-store`, supports
`HEAD`, and returns a plain 404 for unknown paths.

## Documentation And Agent Guidance

`docs/ui-ux-agent-guidelines.md` consolidates the UI/UX guidance extracted from
the PDFs under `uiux/` and adapts it to FISH. `AGENTS.md` now requires agents to
read that guide before designing UI, changing a user-facing screen, or reviewing
UI components.

The important precedence rule is:

1. FISH product rules in `AGENTS.md` win.
2. Existing tokens and base components win.
3. `docs/ui-ux-agent-guidelines.md` guides product UI decisions.
4. Generic PDF advice is supporting reference only.

## Related Drafts

- `docs/linear-chat-ui-tickets-draft.md` remains an unpublished draft for the
  chat UI component library.
- `docs/linear-recent-changes-tickets-draft.md` contains unpublished follow-up
  ticket drafts from the changes summarized here.

