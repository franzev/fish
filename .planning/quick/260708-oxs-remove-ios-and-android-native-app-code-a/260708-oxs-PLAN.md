---
quick_id: 260708-oxs
mode: quick
---

# Quick Task 260708-oxs: Remove iOS and Android native app code and all references

Delete the native iOS and Android app scaffolds and scrub every reference to them from living
documentation and config, since the project is web-only going forward. History is preserved via
git; historical planning records (`.planning/phases/`, `.planning/quick/`, `.planning/milestones/`,
`.planning/research/`, `.planning/sketches/`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`)
are left untouched as a record of what was built and decided at the time.

## Tasks

1. Delete `apps/ios/`, `apps/android/`, `scripts/android-preview.mjs`, and the two Android-heavy
   unpublished Linear draft docs (`docs/linear-chat-ui-tickets-draft.md`,
   `docs/linear-recent-changes-tickets-draft.md`) — user chose "delete" over editing them down.
2. Remove the `android:preview` script from `package.json`.
3. Scrub iOS/Android/Swift/Kotlin/Xcode/Gradle/Jetpack references from living docs and config:
   `AGENTS.md`, `README.md`, `.claude/CLAUDE.md`, `.planning/codebase/*.md`, `.planning/PROJECT.md`,
   `.planning/STATE.md` (forward-looking lines only), `docs/ARCHITECTURE.md`,
   `docs/deploy-checklist.md`, `packages/core/docs/chat-state-protocol.md`, and the
   `sketch-findings-fish` skill files (reframing "mirrors Android" design rationale as
   standalone responsive-web decisions).
4. Verify `pnpm build` still passes.

## Verification

- `grep` sweep confirms no iOS/Android/native-platform references remain outside historical
  `.planning/` archives.
- `pnpm build` succeeds.
