# React Native Reusability Audit — FISH

Audit date: 2026-07-15

> **Status update (2026-07-17): superseded in part.** The mobile apps were
> built natively (`apps/android` — Kotlin/Compose, `apps/ios/FishKit` —
> SwiftPM/SwiftUI) rather than in React Native, so the TypeScript code-sharing
> mechanics below (shared `packages/services`, portable hooks, zustand store,
> the RN dependency-alternatives table, and the reuse percentages) do not
> apply to mobile. What remains valid:
>
> - The backend (edge functions, RLS, RPCs) is reused 100% by all clients —
>   unchanged.
> - `packages/core` now serves as the **reference implementation and contract
>   source**: native apps reimplement the pure reducers and verify parity
>   against the JSON fixture vectors core exports (see
>   `apps/android/feature/*/src/test/.../\*ParityTest.kt`). Sticker/emoji
>   catalogs are shared as JSON (`@fish/core/chat-media/*`), and design tokens
>   are code-generated for Kotlin and Swift from
>   `design/tokens/fish.tokens.json`.
> - The schema-hoisting recommendation (§3 step 3) is *more* important now:
>   three clients hand-mirror the edge-function command contracts.
> - The web-only hygiene items (§3 steps 1–2, the two pre-emptive fixes)
>   remain valid for the web app on their own merits.
>
> The sections below are kept for reference and for the web-internal findings.

**TLDR:** This codebase is unusually well-positioned for a React Native port. The
ports-and-adapters architecture documented in `docs/ARCHITECTURE.md` holds up at
the file level: **~80% of the non-UI code is directly reusable or needs only
minor changes**, which works out to **roughly 40% of the total web codebase**
(the other ~60% is UI that gets rewritten by design on any RN port). The single
biggest lever is replacing one file — the browser Supabase client factory —
after which the entire repository/command/realtime service layer ports nearly
unchanged. The backend (edge functions, RLS, RPCs) is reused 100% as-is since
RN speaks the same HTTP/realtime contracts.

Legend: ✅ directly reusable in React Native · ⚠️ reusable with minor
modifications · ❌ web-specific, rewrite for RN.

---

## 1. Layer-by-layer classification

### `packages/core` — ✅ 100% directly reusable (1,868 LOC)

Every file is pure TypeScript: domain types (`chat.ts`, `roles.ts`), pure
reducers and selectors for chat, call, and notification state, and
`presence/resolve.ts` with an injectable clock. Zero runtime dependencies
(only a TypeScript devDep), zero browser/DOM/React/Next imports — verified
file-by-file; the only "browser API" matches are in comments. This package was
explicitly built for "future native adapters" (per the README) and it
delivers: import it into RN wholesale.

### `packages/supabase` — ✅ reusable, one ⚠️ (2,892 LOC)

Pure type surface (generated `Database` type, ~30 `*Row` aliases) plus a
`Constants` enum table. It does **not** depend on `@supabase/supabase-js`. The
one caveat: `src/auth.ts` exports `authRedirects` with web URL paths
(`/sign-in`, `/home`, `/coach`) — the code ports fine, but RN needs navigation
route names instead of paths.

### `apps/web/lib/services` — the service layer (6,614 LOC, ~85% reusable)

This is where the architecture pays off. Everything is constructor-injected
with an `AppSupabaseClient` and uses only portable Supabase APIs (`.from`,
`.rpc`, `.storage`, `.functions.invoke`, realtime channels).

| Module | Class | Notes |
|---|---|---|
| `contracts.ts` | ✅ | 777 lines, ~100 pure interfaces/DTOs. **The anchor of the whole port** — RN implementations target these. |
| `errors.ts`, `container.ts`, `shared.ts`, `testing.ts`, `avatar-urls.ts` | ✅ | Result/error model and DI helpers, no platform coupling. |
| All 10 repositories (chat, chat-search, booking, friend, notification, presence, profile, navigation-attention) | ✅ | Pure query + snake↔camel mapping over the injected client, including signed-URL storage calls. |
| All mappers & hydration helpers (`chat-mapping`, `call-mapping`, `chat-message-hydration`, `chat-sender-profiles`) | ✅ | Pure functions. |
| `supabase/core.ts`, `runtime-services.ts`, `supabase/auth.ts` | ✅ | The DI seam: `createSupabaseServices(client)` accepts any client. An RN client slots straight in. (OAuth redirect URL needs an RN deep-link scheme.) |
| Command services (booking, call, friend, notification, presence, avatar, chat-images) | ✅ | Thin `functions.invoke` callers. `chat-images.ts` only computes upload URLs — no File/Blob/tus anywhere under `lib/` (verified). |
| Realtime services (chat, call, friend, notification, attention) | ⚠️ | Logic is fully portable Supabase realtime channels. Only change: they import `createBrowserSupabaseClient` — swap for an RN client factory. |
| `edge-function-transport.ts`, `env.ts` | ⚠️ | Raw `fetch` + `AbortController` (RN-safe); just swap the `NEXT_PUBLIC_*` env source (`validatePublicEnv` already takes an injectable source). |
| `chat-command-service.ts` | ⚠️ | Edge-function path is portable, but it imports the server-only local-RPC fallback directly. |
| `supabase/browser.ts` | ❌ | `@supabase/ssr` cookie-based client. **Highest-leverage replacement** — one RN factory here unlocks everything downstream. |
| `supabase/server.ts`, `proxy.ts`, `runtime/browser.ts`, `runtime/server.ts` | ❌ | Next-specific composition roots and middleware. RN writes its own ~100-line composition root using the same pattern. |
| `local-chat-commands.ts` | ❌ as written | 567 lines of platform-neutral RPC logic hard-bound to the Next server client. Parameterize it to accept an injected client and it becomes ✅. |
| `presence-realtime.ts` | ⚠️/❌ split | `subscribe()` + heartbeat logic is portable; `startSession()` activity tracking uses DOM events (`visibilitychange`, `pointerdown`, `online`) — rewrite with `AppState` + NetInfo. |

### `apps/web/lib` (other) — mixed (756 LOC)

- ✅ `observability/reporter.ts` and `service-observer.ts` — framework-agnostic
  error reporting core.
- ⚠️ `sentry-privacy.ts` / `sentry-options.ts` — pure PII scrubbers; retype
  from `@sentry/nextjs` to `@sentry/react-native`. `prefs/time-format.ts` —
  `Intl` formatting is portable; the DOM event bus isn't.
- ❌ `prefs/apply-prefs.ts`, `prefs/use-time-format-preference.ts` (DOM
  data-attribute theming), `sentry-reporter.ts` (small rewrite), `utils.ts`
  (`cn()` is Tailwind-only).

### `apps/web/features` — business logic, hooks, validation (7,671 LOC non-component, ~60–65% reusable)

The standout pattern: **every Next server action (`actions.ts`) has a
dependency-injected `action-handlers.ts` sibling containing the real logic
plus zod schemas.** The shells are ❌; the handlers are ✅.

**✅ Directly reusable:**

- All `contracts.ts` files, `profile/validation.ts` and
  `chat/server/schemas.ts` (zod), `booking/format.ts` (Intl date math)
- All `action-handlers.ts` (booking, chat, profile) and
  `auth/server/auth-use-cases.ts`
- **The zustand chat store** (`chat/model/store/chat-store.ts`) — zustand works
  in RN; all reduction delegates to `@fish/core`
- Chat models: `message-grouping.ts`, `direct-friend.ts`, `search/query.ts` +
  `search/types.ts`
- Platform-agnostic hooks: `use-chat-messages.ts`, `use-chat-read-state.ts`,
  `use-chat-realtime.ts` — pure React state/effect orchestration, no DOM
- Presentation logic: `notifications/model/presentation.ts`,
  `presence/model/presentation.ts`, `chat-day-label.ts`

**⚠️ Minor modifications:**

- `use-chat-composer.ts` — entire send/edit/react pipeline is portable; only
  the `KeyboardEvent<HTMLTextAreaElement>` handler needs an RN equivalent
- `gif-provider.ts`, `search/history.ts`, `video-quality-preference.ts` — swap
  `localStorage` → AsyncStorage/MMKV (and `navigator.language` → RN
  localization)
- `use-friends-refresh.ts` — coalescing state machine is portable;
  `visibilitychange` → `AppState`
- `page-data.ts` loaders — all `server-only`, but uniformly DI-shaped
  (`injected?: AppServices`), so the shaping logic reuses with a native
  services impl. One gap: `notifications/server/shell-data.ts` lacks the
  injectable-deps parameter its siblings have.

**❌ Web-specific rewrites:**

- Media: `calls/client/call-media.ts` and
  `booking/client/lesson-setup-media.ts` — `getUserMedia`, `AudioContext`,
  DOM element attachment, `livekit-client`
- Image pipeline: `profile/image/avatar-image.ts`, both `prepare-*.worker.ts`
  Web Workers, `prepare-chat-image.ts`, `use-chat-image-uploads.ts`,
  `use-avatar-upload.ts` (canvas/OffscreenCanvas/File/XHR — though its
  retry/backoff state machine is worth extracting)
- Scroll hooks: `use-stick-to-bottom.ts`, `use-load-older-messages.ts`
  (IntersectionObserver/ResizeObserver/scrollTop)

**Logic buried in components worth extracting:**
`call-provider/call-exit.ts` (already pure ✅), `visibleMessageBody` in
`message-presentation.ts` (split from the Tailwind class helper),
`sticker-catalog.ts` (portable data; remap asset paths).

### UI layers — ❌ by design (~19,600 LOC)

Feature components (14,187), shared UI kit (2,300), and the App Router tree
(3,108) are React DOM + Tailwind + Base UI — rewritten in RN as expected. What
matters is that they're thin: they consume the portable contracts, store, and
hooks above.

### `supabase/` backend — 100% reused, not as code

Migrations, RLS, RPCs, and the 10 Deno edge functions serve RN identically
over HTTPS/realtime. One finding worth acting on:
`supabase/functions/send-message/index.ts` **re-declares** `chatLimits`,
`SendMessageCommand`, and the sticker allowlist that exist canonically in
`@fish/core/chat` — drifting copies. The per-function zod command schemas
similarly mirror core enums. Hoisting these into `@fish/core` gives client and
server one validated contract (Deno can import it).

---

## 2. Blocking dependencies and RN alternatives

| Web dependency | Where | RN alternative |
|---|---|---|
| `@supabase/ssr` (cookie sessions) | `supabase/browser.ts`, `server.ts`, `proxy.ts` | `createClient` from `@supabase/supabase-js` with `auth.storage: AsyncStorage` |
| `next/navigation`, `next/headers`, server actions | action shells, redirects, page-data | Expo Router or React Navigation; call the `action-handlers` directly |
| `localStorage` | search history, GIF provider, video pref | AsyncStorage or MMKV |
| `document.visibilityState`, `online` events | presence session, friends refresh | `AppState` + `@react-native-community/netinfo` |
| IntersectionObserver / ResizeObserver / scroll DOM | chat list hooks | `FlatList` (inverted) with `onEndReached` + `maintainVisibleContentPosition` |
| `browser-image-compression`, Web Workers, OffscreenCanvas | image pipelines | `expo-image-manipulator` (no worker needed — native threads) |
| `tus-js-client` + `File`/XHR | chat image upload | tus-js-client's RN support with file URIs, or `expo-file-system` `uploadAsync` against the same `signedUploadUrl` the services already return |
| `livekit-client` + DOM media | calls, lesson setup | `@livekit/react-native` (+ `react-native-webrtc`); same `call-command` tokens work |
| `react-easy-crop` | avatar editor | `expo-image-manipulator` + a native crop UI |
| `@sentry/nextjs` | observability | `@sentry/react-native` (scrubbers port as-is) |
| Tailwind / `cn()` / `class-variance-authority` | all styling | NativeWind if you want to keep the token vocabulary, else `StyleSheet` |
| `matchMedia("prefers-reduced-motion")` | stick-to-bottom, prefs | `AccessibilityInfo.isReduceMotionEnabled()` |
| `NEXT_PUBLIC_*` env | `env.ts`, observability | `expo-constants` / app config (feed through the existing injectable `EnvSource`) |

Portable as-is: `zod`, `zustand`, `@supabase/supabase-js`,
`unicode-emoji-json`, `fetch`/`AbortController`/`URL`/`Intl`/
`crypto.randomUUID` (Hermes).

---

## 3. Recommended shared-package organization

Target workspace layout:

```
packages/
  core/          # (exists) — unchanged; ADD: shared zod command schemas
                 # hoisted from edge functions, booking/format.ts,
                 # presence/notification presentation helpers
  supabase/      # (exists) — unchanged types; authRedirects → move web
                 # paths to apps/web
  services/      # NEW — extracted from apps/web/lib/services:
                 #   contracts.ts, errors.ts, container.ts, shared.ts,
                 #   core.ts, all repositories, mappers, hydration,
                 #   command services, realtime services,
                 #   edge-function-transport, observability core
                 #   (reporter, service-observer, sentry-privacy)
                 # Platform ports it declares: EnvSource, KeyValueStorage,
                 #   ActivitySignal (visibility/online), SupabaseClientFactory
  features/      # NEW (or fold into services) — platform-agnostic app logic:
                 #   chat store + selectors, chat models, search query/history,
                 #   gif-provider, action-handlers + schemas, auth-use-cases,
                 #   portable hooks (use-chat-messages/read-state/realtime/composer)
apps/
  web/           # keeps: components, app routes, scroll hooks, web media/image
                 #   pipeline, browser/server composition roots, apply-prefs
  mobile/        # future RN app: screens, FlatList chat, native composition
                 #   root, native media/image/upload adapters
```

Migration order (each step is independently shippable and keeps the web app
green):

1. **Extract `lib/services` → `packages/services`.** It's already
   client-injected; mostly a file move plus making `env.ts` consume an
   injected `EnvSource`. Web keeps its `browser.ts`/`server.ts`/`proxy.ts`
   composition roots in `apps/web`.
2. **Parameterize `local-chat-commands.ts`** to accept an injected
   `AppSupabaseClient` instead of importing the Next server factory — this
   un-poisons `chat-command-service.ts`, currently the only command service
   dragging `next/headers` into the graph.
3. **Hoist canonical zod command schemas into `@fish/core`** and import them
   from the edge functions — fixes the existing `send-message` drift and gives
   RN typed, pre-validated requests for free.
4. **Move the chat store, models, action-handlers, and portable hooks** into
   `packages/features`, introducing the small `KeyValueStorage` and
   `ActivitySignal` ports where `localStorage`/`visibilitychange` are used
   today.
5. **When RN starts:** write the native composition root (Supabase client +
   AsyncStorage auth + service tree via the existing
   `createSupabaseServices(client)` seam), then build only the genuinely
   native pieces: screens, list virtualization, image picking/compression,
   and LiveKit RN media.

Two small pre-emptive fixes worth doing now regardless: give
`notifications/server/shell-data.ts` the same injectable-deps parameter as its
sibling loaders, and split `visibleMessageBody` out of the Tailwind-coupled
`message-presentation.ts`.

---

## 4. Reuse percentage estimate

Based on actual line counts of product source (excluding tests, stories, e2e):

| Layer | LOC | Reusable (✅+⚠️) |
|---|---|---|
| packages/core | 1,868 | ~100% |
| packages/supabase | 2,892 | ~100% |
| lib/services | 6,614 | ~85% |
| lib (prefs/observability/utils) | 756 | ~50% |
| features — non-component | 7,671 | ~60–65% |
| features — components | 14,187 | ~5% (extractable logic) |
| shared UI kit + app routes | 5,408 | ~0% |
| **Total web client** | **~39,400** | **~40%** |

Framed the way that matters for planning: **of the non-UI code (~19,800 LOC),
roughly 80% ports directly or with minor, mechanical changes** (client factory
swap, storage port, env source). The 20% that doesn't is concentrated in
exactly the places RN forces a rewrite anyway: media capture, image
processing, scroll physics, and session plumbing. Add the fully-reused backend
(2,481 LOC of edge functions plus all migrations/RLS), and the effective
new-code burden for an RN app is the UI plus a handful of native adapters —
the domain layer comes along for free.
