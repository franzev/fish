---
status: resolved
trigger: "The InitialPreferenceScript isn't working correctly. The application should determine whether the user prefers light or dark mode before the initial page render. Currently, the page renders with the default theme and then switches, causing a visible flash/transition (FOUC). Ensure the correct theme is applied during the initial render so users never see the theme transition."
created: 2026-07-11
updated: 2026-07-11
---

# Debug Session: InitialPreferenceScript FOUC

## Symptoms

- expected: The resolved light or dark preference is applied before the browser's first paint, with no default-theme frame, loading flash, or visible transition.
- actual: The page initially paints in the default/system theme and then switches to the user's persisted preference.
- errors: No reported exception; infer a render-order or pre-paint execution failure and inspect console/build evidence.
- timeline: Unknown; determine from current implementation and git history if relevant.
- reproduction: Load or hard-refresh an authenticated page where the persisted theme differs from the default/system theme and observe the initial frame.

## Current Focus

- hypothesis: Confirmed — `InitialPreferenceScript` is dead code, so no pre-paint theme mutation is emitted at all; the live path first applies preferences in a post-paint `useEffect`.
- test: Trace all non-test imports/usages and compare authenticated layout composition against the client hydrator lifecycle.
- expecting: No `InitialPreferenceScript` mount in the server tree, with `PreferenceHydrator` as the only live preference applier.
- next_action: Complete — the root document serializes preferences directly on `<html>` and browser coverage verifies the first frame and console.
- reasoning_checkpoint: FIX VERIFIED — authenticated HTML contains the persisted attributes before visible markup, without pre-hydration DOM mutation.
- tdd_checkpoint:

## Evidence

- `rg -n "initial-preference-script" apps/web --glob '!**/*.test.*' --glob '!**/*.stories.*'` finds only the component barrel; no production module imports or renders `InitialPreferenceScript`.
- `apps/web/app/(authenticated)/layout.tsx` returns `ChatIdentityGuard` followed by `AppShell`; it has the server-fetched profile preferences available, but does not render the pre-paint script.
- `apps/web/components/shell/app-shell/app-shell.tsx` renders `PreferenceHydrator` inside the first visible shell container.
- `apps/web/components/shell/preference-hydrator/preference-hydrator.tsx` is a client component and applies `data-theme` exclusively from `useEffect`. React effects run after commit/paint eligibility, so the initial CSS resolves from `html { color-scheme: light dark; }` (system/default) before the persisted override is installed.
- `apps/web/components/shell/initial-preference-script/initial-preference-script.test.ts` proves only that manually evaluating the generated JavaScript mutates `document.documentElement`; it never renders `InitialPreferenceScript` or verifies server-tree/HTML order.
- `apps/web/app/(authenticated)/layout.test.tsx` verifies redirect and visible shell content only. Its valid-profile fixture omits theme preferences and has no assertion that a script precedes visible content.
- The two relevant current test files pass together (5/5) despite the disconnected component, confirming the regression gap: `pnpm --filter @fish/web test --run components/shell/initial-preference-script/initial-preference-script.test.ts 'app/(authenticated)/layout.test.tsx'`.
- Git history shows commit `50ff7a40` added the script component and isolated generator tests, but did not add any production import/mount. This is an incomplete integration, not a later ordering regression.

## Eliminated

- Script payload logic: direct unit coverage demonstrates that `themePref: "dark"` sets `document.documentElement.dataset.theme` and null clears it.
- Missing CSS override hook: `globals.css` contains `html[data-theme="light"]` and `html[data-theme="dark"]` rules with explicit `color-scheme` values.
- Preference data unavailable on the server: the authenticated layout already receives `profile.themePref`, `textSizePref`, `reducedMotionPref`, and `timeFormatPref` before returning its tree.
- A merely late script tag: rendered production output contains no initial preference script at any position because the component is unreferenced.


## Resolution

- root_cause: `InitialPreferenceScript` was created but never mounted. The only connected path is `PreferenceHydrator` -> `useEffect`, which necessarily applies the persisted theme after the initial render is paintable.
- fix: Resolve the authenticated profile at the root layout through a request-cached server read and serialize theme, text size, reduced motion, and time format directly as `<html>` attributes. This removes the raw script and avoids both post-paint switching and hydration mutation. `PreferenceHydrator` remains for later client-side updates.
- verification: Browser regression hard-navigates with a persisted dark preference and an emulated light system, proves the first animation frame is already dark, observes no intermediate non-dark state, and asserts zero console errors. Targeted layout/page-data/module-boundary suites pass (17 tests); lint, workspace typecheck, and production build pass.
- files_changed: `apps/web/app/layout.tsx`, `apps/web/features/auth/server/page-data.ts`, `apps/web/e2e/initial-theme.spec.ts`; obsolete `apps/web/components/shell/initial-preference-script/` removed
