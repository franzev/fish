---
status: complete
quick_id: 260705-gby
completed: 2026-07-05
---

# Quick Task 260705-gby Summary

Implemented authentication improvements across web, iOS, and Android.

## Completed

- Added Confirm password to web sign-up and blocked password account creation when it does not match.
- Added web Google OAuth start actions for login and sign-up through the existing browser auth service.
- Added `/auth/callback` to exchange Supabase OAuth codes and route clients to `/home` and coaches to `/coach`.
- Enabled local Supabase Google provider config with env-backed secrets and added web/mobile OAuth callbacks to the local redirect allow-list.
- Added focused web tests for confirm-password validation, Google auth starts, service behavior, and the OAuth callback route.
- Added Android `feature/auth/AuthValidation.kt` for confirm-password gating and Google auth labels.
- Implemented Android Google sign-in/sign-up launch through `core/auth/SupabaseOAuth.kt`.
- Added Android `fish://auth/callback` deep-link handling and minimal session storage in `core/auth/AndroidAuthSession.kt` for returned Supabase tokens.
- Updated the Android `feature/auth` preview flow with secondary Google actions and kept sign-up from advancing when passwords do not match.
- Added Android unit tests for confirm-password validation, Google auth labels, OAuth URL construction, and callback parsing.
- Added an iOS auth preview screen with confirm-password validation and secondary Google actions, reusing the SwiftUI design system.
- Updated the deploy checklist for hosted Google OAuth and callback redirect setup.

## Verification

- PASS: `pnpm --filter @fish/web exec vitest run app/signup/signup-form.test.tsx app/login/login-form.test.tsx app/auth/callback/route.test.ts lib/services/supabase/core.test.ts` — 4 files, 35 tests.
- PASS: `pnpm --filter @fish/web exec vitest run app/signup/signup-form.test.tsx app/login/login-form.test.tsx` — 2 files, 25 tests.
- PASS: `pnpm --filter @fish/web build`.
- PASS: `xcodebuild -project apps/ios/FISH.xcodeproj -scheme FISH -destination 'generic/platform=iOS Simulator' build`.
- PASS: `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew app:testDebugUnitTest`.
- PASS: `git diff --check`.
- BLOCKED: repo-wide `pnpm --filter @fish/web lint` is blocked by an unrelated existing lint issue in `apps/web/components/onboarding/onboarding-conversation.tsx`.
- BLOCKED: repo-wide `pnpm --filter @fish/web typecheck` is blocked by an unrelated untracked `apps/web/components/onboarding/coach-onboarding-review.test.tsx` importing a missing `coach-onboarding-review` component.

## Commit

Changes were committed incrementally:

- `a989f1e` — `feat(ios): add auth preview shell`
- `0bb6987` — `feat(web): add OAuth auth flow`
- `ebe462f` — `feat(android): add OAuth auth shell`
- `fc9b4d6` — `fix(web): show Google auth icon`
- `f494ca9` — `refactor(android): split auth and token components`
- `f346a86` — `docs: add architecture and gap analysis`
- `9d65820` — `chore(dev): update launch configs`
