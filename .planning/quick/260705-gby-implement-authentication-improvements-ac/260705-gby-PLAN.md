---
status: complete
quick_id: 260705-gby
created: 2026-07-05
completed: 2026-07-05
---

# Quick Task 260705-gby: Authentication Improvements Across Web, iOS, And Android

Implement authentication improvements across web, iOS, and Android: add a Confirm Password field to sign-up and validate it matches before account creation; enable Google Sign-In and Google Sign-Up in the existing auth flow; keep the implementation lean, minimal, maintainable, and aligned with current architecture.

## Plan

1. Web auth
   - Add confirm-password state and field-level validation to the sign-up form before calling Supabase sign-up.
   - Add a minimal Supabase Google OAuth method, expose it through the browser auth adapter, and add `/auth/callback` to exchange the OAuth code.
   - Add secondary Google actions to login and sign-up without adding a second primary action.
   - Update focused auth tests.

2. Native auth previews
   - Android: keep existing confirm-password validation, add Google secondary auth actions to login/sign-up, launch Supabase Google OAuth in the browser, and handle the `fish://auth/callback` deep link.
   - iOS: add a small auth preview flow with confirm-password validation and Google secondary auth actions, reusing the current SwiftUI design-system components.

3. Verification
   - Run focused web auth tests and service tests.
   - Run Android unit tests or compile-oriented checks if the local Gradle setup permits.
   - Run an iOS build check if Xcode tooling is available.
