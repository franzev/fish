---
quick_id: 260708-oxs
status: complete
---

# Quick Task 260708-oxs Summary

Deleted `apps/ios/`, `apps/android/`, `scripts/android-preview.mjs`, and the two Android-heavy
unpublished Linear draft docs (user chose delete over trimming). Removed the `android:preview`
script from `package.json`. Scrubbed native-platform references from all living documentation and
config (`AGENTS.md`, `README.md`, `.claude/CLAUDE.md`, `.planning/codebase/*.md`,
`.planning/PROJECT.md`, `.planning/STATE.md` forward-looking lines, `docs/ARCHITECTURE.md`,
`docs/deploy-checklist.md`, `packages/core/docs/chat-state-protocol.md`, and the
`sketch-findings-fish` skill files).

Left untouched, by design, as historical record (equivalent to git history):
- `.planning/phases/`, `.planning/quick/` (prior tasks), `.planning/milestones/`,
  `.planning/research/`, `.planning/sketches/`
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` (completed/checked phase records)
- `apps/web/tests/chat-state-boundary.test.ts` (generic platform-purity guard test, doesn't
  claim iOS/Android exist)
- `docs/recent-changes.md` (past-tense changelog)

`pnpm build` passes (packages/core, packages/supabase typecheck; `apps/web` Next.js build
succeeds).
