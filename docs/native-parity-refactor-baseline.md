# Native parity refactor — baseline

Green state captured before the refactor in `docs/native-parity-refactor-plan.md` began.
Every behaviour-preserving commit in stages 1–4 must reproduce these numbers exactly, and must
leave `docs/native-parity-refactor-baseline.txt` byte-identical.

Captured 2026-07-25 on Xcode 26.6 / Swift 6.3.3 / Gradle 9.4.1 / JBR 21.0.10.

## Android

```
pnpm android:check   →  BUILD SUCCESSFUL   (1074 tasks)
```

Covers `check`, `assembleRelease`, and `validateDebugScreenshotTest` for `:feature:chat`,
`:feature:call`, `:feature:presence`, `:feature:settings`, plus the design-system and
notification-policy verifiers.

## iOS

```
pnpm ios:test        →  ** TEST SUCCEEDED **
                        412 tests in 75 suites, 0 failures
```

The `Executed 0 tests` lines in the log come from the legacy XCTest harness; this package uses
swift-testing, which reports separately. 412 is the real figure.

## Image baselines

`docs/native-parity-refactor-baseline.txt` holds `shasum` for all 303 recorded images:

| Source | Count |
|---|---:|
| Android `screenshotTestDebug/reference` | 65 |
| iOS `__Snapshots__` | 238 |

Verify no rendering changed:

```bash
{ find apps/android -path "*screenshotTestDebug/reference*" -name "*.png" -exec shasum {} + ; find apps/ios/FishKit/Tests -path "*__Snapshots__*" -name "*.png" -exec shasum {} + ; } | sort -k2 | diff - docs/native-parity-refactor-baseline.txt
```

Expected: no output for stages 1–3. Stage 4 adds new lines only; existing lines must not change.

## Component inventory at baseline

From `pnpm parity:scan`:

| | Android | iOS (FishKit) |
|---|---:|---:|
| Components | 132 | 82 |
| Files declaring ≥1 | 35 | 65 |

Registry: 103 canonical components — 44 paired, 29 Android-only, 30 iOS-only, 7 with aligned
props. `pnpm parity:verify` reports **18** one-per-file violations, which are the stage 1–2
work list.
