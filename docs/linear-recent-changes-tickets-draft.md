# Linear Draft: Recent Changes Follow-Ups

Draft status: review only. Do not publish to Linear until Franz approves.

Last drafted: 2026-07-04

## Shared Linear Setup

- Team: Founders, unless a more specific Linear team is preferred.
- Assignee: Franz by default.
- Labels: Draft, UI, Design System, Web, Android, Platform, Docs as applicable.
- Projects: Web, Android, Platform.
- Publish status: not published. No Linear issue IDs exist for these drafts.
- Scope rule: these are follow-up tickets from recent foundation/UI changes.
  They should not add new learning features, plan pickers, community feeds, or
  gamification.

## Ticket 01: Review and Adopt UI/UX Agent Guidelines

Linear fields:

- Project: Platform
- Labels: Docs, UI, Design System
- Priority: P1
- Status: Draft

### Overview

Review the new UI/UX agent guidelines and make them the working reference for
future FISH screen design and UI reviews.

### Why This Matters

FISH depends on a calm, low-choice interface. The new guidelines translate the
PDF reference material into product-specific rules so agents and developers do
not accidentally add visual noise or extra choices.

### Scope

- Review `docs/ui-ux-agent-guidelines.md`.
- Confirm the precedence rules against `AGENTS.md`.
- Keep the existing instruction that agents must read the guide before UI work.
- Decide whether any PDF-derived guidance should be removed, softened, or moved
  to an appendix.

### Acceptance Criteria

- [ ] Franz has reviewed the guide.
- [ ] Any product-rule conflicts are resolved in favor of `AGENTS.md`.
- [ ] The guide clearly preserves one primary action per screen.
- [ ] The guide does not encourage client-facing plan/template browsing.
- [ ] The guide remains linked from `AGENTS.md`.

### Test / Review Notes

Manual review only. No code test required.

---

## Ticket 02: Finish Web UI Primitive Variant Export Audit

Linear fields:

- Project: Web
- Labels: UI, Design System, Web
- Priority: P1
- Status: Draft

### Overview

Audit the web UI primitives after the move to reusable CVA variant helpers and
make sure consumers import the right components and style helpers.

### Why This Matters

`Button`, `Input`, and `Alert` now expose maintained variant helpers. This is a
good foundation, but the next pass should make sure future UI work reuses those
contracts instead of copying Tailwind strings.

### Scope

- Check all imports from `apps/web/components/ui`.
- Confirm `Progress` consumers import from `components/ui/progress` or the
  unified barrel, not through `Card`.
- Confirm `Button fullWidth` is explicit on focused flows that need one large
  action.
- Confirm Storybook examples still show realistic layout widths after removing
  the global max-width wrapper.
- Add or update short usage notes where a component has a non-obvious contract.

### Acceptance Criteria

- [ ] No stale imports rely on `Card` re-exporting `Progress`.
- [ ] Primary action screens intentionally pass `fullWidth` where needed.
- [ ] Variant helper exports are covered by tests for Button, Input, and Alert.
- [ ] Storybook examples render without unintended full-width layout shifts.
- [ ] No raw hex colors are introduced.

### Suggested Verification

- `pnpm --filter @fish/web test -- --run`
- `pnpm --filter @fish/web lint`
- `pnpm --filter @fish/web typecheck`

---

## Ticket 03: Add Native Android Component Parity Plan

Linear fields:

- Project: Android
- Labels: Android, UI, Design System
- Priority: P1
- Status: Draft

### Overview

Define the next Android design-system component set after the token and
primitive cleanup.

### Why This Matters

Android now has stronger tokens, fonts, preview helpers, and improved Button
and TextField contracts. The deleted older component files make it important to
state which native primitives are intentionally available now and which should
be rebuilt next.

### Scope

- Inventory current Android components under
  `apps/android/app/src/main/java/space/fishhub/app/designsystem/component`.
- Decide whether Alert, Card, and Progress should be rebuilt now, deferred, or
  replaced by other primitives.
- Keep component behavior aligned with web tokens and FISH rules.
- Document touch target, feedback, loading, and full-width contracts for native
  components.

### Acceptance Criteria

- [ ] Android component inventory is documented.
- [ ] Alert/Card/Progress ownership is decided.
- [ ] Button content-width default and explicit full-width usage are preserved.
- [ ] TextField single-line behavior is documented.
- [ ] Follow-up implementation tickets exist for any missing required primitive.

### Suggested Verification

- Android Studio previews for light and dark themes.
- `./gradlew test` from `apps/android` once Gradle is available locally.

---

## Ticket 04: Replace Android Source-Text Tests With Compose-Focused Tests

Linear fields:

- Project: Android
- Labels: Android, Testing, Design System
- Priority: P2
- Status: Draft

### Overview

Upgrade the temporary Android source-level design-system tests into tests that
verify behavior through Compose where practical.

### Why This Matters

The current Android test records the button full-width contract by reading
source files. That is useful as a short-term guard, but UI behavior should be
covered closer to how users experience it.

### Scope

- Keep the current source test until replacement coverage exists.
- Add Compose tests for button enabled/loading/full-width behavior where the
  project test setup supports it.
- Add TextField tests for single-line input and feedback state display.
- Verify labels and touch targets remain accessible.

### Acceptance Criteria

- [ ] Button behavior has non-source-based test coverage.
- [ ] TextField behavior has non-source-based test coverage.
- [ ] Source-text tests are either removed or kept only for contracts that
  cannot yet be expressed through Compose tests.
- [ ] Tests run in the documented Android workflow.

### Suggested Verification

- `./gradlew test`
- Android Studio test runner for Compose tests if needed.

---

## Ticket 05: Validate Android Launcher, Splash, and Preview Install Flow

Linear fields:

- Project: Android
- Labels: Android, QA, Branding
- Priority: P1
- Status: Draft

### Overview

Review the refreshed Android launcher, splash screen, font assets, and APK
preview helper on real or emulated devices.

### Why This Matters

Branding assets changed across density buckets, adaptive icons, the splash
screen, and the web icon. The preview helper also changed the LAN install path.
These need device-level validation, not just source review.

### Scope

- Check adaptive launcher icon in normal and round icon contexts.
- Check splash screen in light and dark device themes.
- Confirm bundled Lexend and Fraunces fonts load in the preview app.
- Run `pnpm android:preview` and install the APK from a phone on the same LAN.
- Confirm invalid `ANDROID_PREVIEW_PORT` fails with a clear message.

### Acceptance Criteria

- [ ] Launcher icon appears correctly on at least one emulator or device.
- [ ] Splash screen background and foreground are not cropped awkwardly.
- [ ] Fonts render in Android auth preview screens.
- [ ] Preview helper serves the APK from local and fallback LAN URLs.
- [ ] Unknown preview paths return 404.

### Suggested Verification

- `pnpm android:preview`
- Manual install on Android device or emulator.

---

## Ticket 06: Document Web Service Boundary Usage

Linear fields:

- Project: Web
- Labels: Web, Platform, Docs
- Priority: P1
- Status: Draft

### Overview

Add developer-facing documentation for the web service abstraction layer and
the TSX import boundary test.

### Why This Matters

The web app now has a cleaner service boundary, but future work needs a short
reference that explains where UI code should import auth/data helpers from and
where concrete Supabase clients are allowed.

### Scope

- Document the roles of `apps/web/lib/services`, `apps/web/lib/auth`, and the
  legacy `apps/web/lib/supabase` compatibility files.
- Explain why `.tsx` files must not import `@supabase/*`, `@fish/supabase`, or
  `@/lib/supabase` directly.
- Include examples for browser auth actions, server profile reads, and adding a
  future third-party service to the container.
- Link to the boundary test.

### Acceptance Criteria

- [ ] Documentation explains allowed import paths for UI code.
- [ ] Documentation explains where Supabase client construction belongs.
- [ ] Documentation includes one browser helper example and one server helper
  example.
- [ ] Boundary-test failures are easy to understand and fix.

### Suggested Verification

- `pnpm --filter @fish/web test -- --run tests/service-boundary.test.ts`
- `pnpm typecheck`

---

## Ticket 07: Confirm Chat UI Ticket Draft Against Updated UI Kit

Linear fields:

- Project: Platform
- Labels: UI, Design System, Planning
- Priority: P2
- Status: Draft

### Overview

Re-review the existing unpublished chat UI ticket draft against the updated web
and Android design-system contracts.

### Why This Matters

`docs/linear-chat-ui-tickets-draft.md` was drafted before the latest primitive
and Android token changes. Before publishing those tickets, the chat plan should
reflect the current component defaults and avoid rebuilding patterns that now
belong in shared primitives.

### Scope

- Review every ticket in `docs/linear-chat-ui-tickets-draft.md`.
- Update assumptions around `Button fullWidth`, `Progress` imports, CVA style
  helpers, Android tokens, and Android component availability.
- Keep chat UI scope UI-only with mock data.
- Keep Send as the only primary action in the composer.

### Acceptance Criteria

- [ ] Existing chat draft is checked against current web UI primitives.
- [ ] Existing chat draft is checked against current Android primitives.
- [ ] Any missing shared primitive work is moved into separate foundation
  tickets.
- [ ] Draft remains unpublished until Franz approves.

### Suggested Verification

Manual planning review only.
