---
phase: 05-data-driven-onboarding
plan: 02
subsystem: ui
tags: [react, zod, field-renderer, onboarding, accessibility]
requires:
  - phase: 05-data-driven-onboarding
    provides: 05-01 versioned onboarding schema, seed config, and generated Supabase aliases
provides:
  - Dependency-free shared field contracts in packages/core
  - Web-only zod config and answer validation
  - Six-type reusable field renderer
  - Calm chat-style onboarding conversation components
affects: [phase-05-data-driven-onboarding, phase-06-tracker-engine]
tech-stack:
  added: []
  patterns: [config-type renderer switch, web-only zod validation, stable status rows, token-backed answer chips]
key-files:
  created:
    - packages/core/src/fields.ts
    - apps/web/lib/validation/onboarding.ts
    - apps/web/lib/validation/onboarding.test.ts
    - apps/web/components/fields/answer-chip.tsx
    - apps/web/components/fields/text-area-field.tsx
    - apps/web/components/fields/field-renderer.tsx
    - apps/web/components/fields/field-renderer.test.tsx
    - apps/web/components/fields/index.ts
    - apps/web/components/onboarding/autosave-status.tsx
    - apps/web/components/onboarding/onboarding-question-bubble.tsx
    - apps/web/components/onboarding/onboarding-conversation.tsx
    - apps/web/components/onboarding/onboarding-conversation.test.tsx
  modified:
    - packages/core/src/index.ts
key-decisions:
  - "packages/core exports structural field types only; zod stays in apps/web."
  - "FieldRenderer switches only on config.type and never seeded onboarding keys."
  - "Answer chips use the repo's min-h-control token utility for the 56px control floor."
patterns-established:
  - "Option-like field controls share AnswerChip with aria-pressed, border/fill/weight selected state, and min-h-control."
  - "Text and multi-select fields use exactly one primary Save answer action; single, scale, and boolean save on selection."
  - "OnboardingConversation renders prior saved answers as client bubbles and one current system question."
requirements-completed: [ONBD-02, ONBD-04]
duration: ~14min
completed: 2026-07-05
---

# Phase 05: Data-Driven Onboarding Plan 02 Summary

**Reusable six-type field contracts, zod validation, token-backed renderer controls, and calm onboarding conversation components**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-05T03:15:06Z
- **Completed:** 2026-07-05T03:29:05Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added dependency-free shared field contracts and onboarding review types in `packages/core`.
- Added zod v4 schemas and answer validation helpers in `apps/web` only.
- Built `AnswerChip`, `TextAreaField`, and `FieldRenderer` for all six config-driven answer types.
- Built `AutosaveStatus`, `OnboardingQuestionBubble`, and `OnboardingConversation` with approved copy, stable status rows, visual progress, and one current question.
- Added targeted validation, renderer, and onboarding component tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define shared field contracts and zod runtime validation** - `779ff81` (feat)
2. **Task 2: Build the six-type field renderer and answer controls** - `7cb717f` (feat)
3. **Task 3: Build calm chat-style onboarding conversation components** - `3aa6dee` (feat)

## Files Created/Modified

- `packages/core/src/fields.ts` - Shared field config, answer, onboarding question, and review data contracts.
- `packages/core/src/index.ts` - Exports the shared field contracts.
- `apps/web/lib/validation/onboarding.ts` - zod schemas and config/answer validation helpers.
- `apps/web/lib/validation/onboarding.test.ts` - Six-type config and answer validation tests.
- `apps/web/components/fields/answer-chip.tsx` - Large token-backed selected answer chip.
- `apps/web/components/fields/text-area-field.tsx` - Textarea control with visible label and reserved feedback row.
- `apps/web/components/fields/field-renderer.tsx` - Config-only renderer for six field types.
- `apps/web/components/fields/field-renderer.test.tsx` - Renderer branch, a11y, selected-state, and one-primary tests.
- `apps/web/components/onboarding/autosave-status.tsx` - Stable polite status row with approved copy.
- `apps/web/components/onboarding/onboarding-question-bubble.tsx` - System question bubble.
- `apps/web/components/onboarding/onboarding-conversation.tsx` - Chat-style onboarding shell.
- `apps/web/components/onboarding/onboarding-conversation.test.tsx` - Current-question, status, no-picker, no-judgement-copy, and one-primary tests.

## Decisions Made

- Used normalized answer payloads from the research shape: option id for single-select, option ids for multi-select, value for scale/text, and boolean for binary fields.
- Kept selection-style fields action-light: single-select, scale, and boolean call `onSaveAnswer` on selection; text and multi-select keep the explicit `Save answer` primary action.
- Used the existing `min-h-control` token utility instead of an arbitrary Tailwind class for 56px controls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Project consistency] Used `min-h-control` instead of `min-h-[var(--size-control)]`**

- **Found during:** Task 2 acceptance verification
- **Issue:** The plan asked `answer-chip.tsx` to contain the arbitrary Tailwind class `min-h-[var(--size-control)]`, but the repo has a global design-token guard that rejects arbitrary visual utility values in web source.
- **Fix:** Used the established Tailwind v4 theme utility `min-h-control`, which maps to `--size-control` from `apps/web/app/globals.css`.
- **Files modified:** `apps/web/components/fields/answer-chip.tsx`, `apps/web/components/fields/field-renderer.test.tsx`
- **Verification:** `pnpm --filter @fish/web test -- --run apps/web/tests/tailwind-design-token.test.ts` passed; `rg -n 'min-h-control|aria-pressed' apps/web/components/fields/answer-chip.tsx` passed.
- **Committed in:** `7cb717f`

---

**Total deviations:** 1 auto-fixed (project consistency)
**Impact on plan:** The control still meets the 56px requirement while preserving the repo's token-only source guard.

## Issues Encountered

- Initial RED test runs failed because the planned modules did not exist yet.
- The design-token guard rejected the arbitrary size utility spelling in the test source; the implementation now uses the existing `min-h-control` utility.
- TypeScript required explicit literal typing for field test helpers and default text answers; fixed before commit.

## Verification

- `pnpm --filter @fish/web test -- --run apps/web/lib/validation/onboarding.test.ts apps/web/components/fields/field-renderer.test.tsx apps/web/components/onboarding/onboarding-conversation.test.tsx` - passed.
- `pnpm typecheck` - passed.
- `if rg -n 'score|grade|streak|placement|recommendation|%' apps/web/components/fields apps/web/components/onboarding -g '!*.test.tsx'; then exit 1; else echo 'judgement-copy source scan passed'; fi` - passed.
- `if rg -n '#[0-9a-fA-F]{3,8}|tailwind.config' apps/web/components/fields apps/web/components/onboarding; then exit 1; else echo 'raw visual token scan passed'; fi` - passed.
- `if rg -n 'from "zod"|from '\''zod'\''' packages/core/src/fields.ts; then exit 1; else echo 'core zod boundary passed'; fi` - passed.

## Self-Check: PASSED

- Key created files exist for validation, renderer, and onboarding conversation components.
- Task commits exist for all three 05-02 tasks.
- All task-level and plan-level verification commands passed, except the planned arbitrary size-class spelling intentionally replaced by the repo-approved token utility and documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 05-03 can wire `/onboarding` Server Actions and route state into `OnboardingConversation`. Phase 6 can reuse `packages/core/src/fields.ts`, `apps/web/lib/validation/onboarding.ts`, and `FieldRenderer` without onboarding-specific question branches.

---
*Phase: 05-data-driven-onboarding*
*Completed: 2026-07-05*
