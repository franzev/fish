# FISH Android personal chat

Native Kotlin and Jetpack Compose implementation of FISH's authorized
one-to-one coaching chat, including text, emoji, GIF, and bundled sticker
messages. This slice intentionally excludes group chat, calls, uploads,
reactions, search, notifications, and conversation creation.

## Architecture

Dependency direction is one-way:

```text
app -> feature:chat -> core:designsystem
 |          |
 +----------+-> data:chat -> Room + Supabase adapter
benchmarks -> app (test target only)
```

- `core:designsystem` contains generated semantic tokens, theme, typography,
  motion, shapes, sizes, icons, and reusable branded Compose controls.
- `feature:chat` owns chat screens, chat-specific controls, presentation
  models, the pure reducer, fixture parity tests, and its conversation-scoped
  ViewModel. It cannot import Room or Supabase.
- `data:chat` exposes the FISH-owned `ChatRepository` and `GifRepository`
  seams. Room, Ktor, DataStore, KLIPY, and Supabase remain internal
  implementation packages.
- `benchmarks` owns Baseline Profile generation and macrobenchmarks.

This intentionally follows the small-app shape in Android's official samples.
Additional Gradle modules are added only when ownership, build performance, or
multiple adapters create a real seam.

## Naming

The `Fish` prefix is reserved for the small branded UI interface where it
distinguishes FISH behavior from Material, such as `FishTheme`, `FishIcons`,
and `FishButton`. Feature types and internal implementation types use their
domain names, such as `ChatScreen`, `ChatViewModel`, and `ChatDatabase`.
Gradle plugin IDs and the application class retain the project identity where
global uniqueness or manifest clarity is useful.

The rationale and phased record are in
`../../docs/android-personal-chat-foundation-plan.md` and
`../../docs/adr/0001-android-personal-chat-architecture.md`.

## Local configuration

Use Android Studio's bundled JBR or run through the root scripts, which find it
automatically. The app accepts these environment variables:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
export FISH_ANDROID_KLIPY_API_KEY="your-public-klipy-key"
export FISH_ANDROID_KLIPY_CLIENT_KEY="fish_chat_android"
```

The web-compatible `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` fallback is also
accepted. Never put a service-role key in an Android build. For persistent
local configuration, use `FISH_SUPABASE_URL` and
`FISH_SUPABASE_PUBLISHABLE_KEY` in `~/.gradle/gradle.properties`. Android also
accepts the web-compatible `NEXT_PUBLIC_KLIPY_API_KEY` and
`NEXT_PUBLIC_KLIPY_CLIENT_KEY` fallbacks. A missing KLIPY key leaves the GIF
tab visible with calm unavailable copy; emoji and local stickers remain
bundled.

Release builds reject cleartext traffic. Debug builds allow it so an emulator
can reach a local Supabase stack through `10.0.2.2`.

Release signing is opt-in and secret-free in source control. CI or a release
workstation supplies all four values as environment variables or Gradle
properties:

```bash
FISH_ANDROID_KEYSTORE_PATH=/secure/path/upload.jks
FISH_ANDROID_KEYSTORE_PASSWORD=...
FISH_ANDROID_KEY_ALIAS=...
FISH_ANDROID_KEY_PASSWORD=...
```

When all values are present, `:app:assembleRelease` produces a signed APK. With
no signing values it intentionally produces an unsigned verification artifact.

## Verification

Run from the repository root:

```bash
pnpm android:verify-design   # token parity, contrast, raw-value and boundary checks
pnpm chat-media:verify       # shared sticker/emoji catalogs and backend allowlists
pnpm android:test            # reducer, ViewModel, and remote-contract unit tests
pnpm android:screenshots     # light/dark, window, font-scale, RTL visual matrix
pnpm android:instrumented    # Compose accessibility and Room/repository tests
pnpm android:check           # lint, unit tests, screenshots, and minified release build
pnpm android:baseline-profile
pnpm android:benchmark
```

`android:instrumented`, profile generation, and benchmarks need a connected
API 33+ device or emulator. Emulator benchmark results are smoke tests only;
release performance thresholds must be measured on physical hardware.

The 2026-07-16 media release-candidate pass completed design/catalog checks,
host tests, 17 device tests, 13 screenshot scenarios, the minified release
build, and Baseline Profile generation with no failures. Shared reducer
coverage includes the 24 chat-state vectors plus GIF/sticker acknowledgement
parity fixtures. A local two-account Supabase run for the chat foundation also verified
authentication, RLS-backed history, outgoing idempotency, incoming Realtime,
read receipts, process-restored drafts, active network loss, reconnect, and
authoritative backfill. In the final five-iteration emulator smoke comparison,
median cold startup was 3,597 ms without compilation and 3,455 ms with the
generated profile. Emulator results are noisy directional evidence, not a
physical-device release threshold.

## Data and failure policy

- Reads use RLS-protected PostgREST queries.
- Sends use the existing `send-message` Edge Function and stable client request
  IDs. A manual retry reuses the same ID, preventing duplicate messages.
- GIF rows are joined into Room during page loads and Realtime changes. KLIPY
  share registration runs only after Supabase confirms a send.
- GIF reporting uses the existing idempotent `chat-command` action. Provider
  queries, media URLs, and account identifiers are never logged; KLIPY gets a
  random install-scoped customer ID from Preferences DataStore.
- Read receipts use `chat-command` with `mark-read-state`.
- Realtime changes are hints written into Room; reconnect performs a bounded
  authoritative backfill.
- Drafts are user/conversation scoped and remain editable offline.
- Offline sends are never silently queued. Send becomes available after
  reconnect.
- App backup is disabled, release cleartext is disabled, SDK logs are disabled,
  and diagnostics never contain message bodies or account identifiers.

## External release gates

Before public release, repeat the successful local two-account validation
against the target Supabase project, run token-refresh/network-switch/process-
death cases on representative physical phones, record hardware macrobenchmark
thresholds, supply the release signing/distribution credentials, and complete the coach plus
target-client usability review described in the plan.
