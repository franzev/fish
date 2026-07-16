# ADR 0002: Consolidate Android chat modules

- Status: Accepted
- Date: 2026-07-16
- Scope: Android one-to-one text messaging
- Amends: ADR 0001, decision 4 and its module-layout consequence

## Context

The first production-hardening pass created separate Gradle modules for shared
UI, testing fixtures, chat state, the chat repository interface, and its only
implementation. For the current one-feature application, those modules were
mostly pass-through interfaces: understanding or changing one chat flow
required crossing nine modules, while several modules had one implementation
or no consumers.

Android's official modularization guidance recommends high cohesion and low
coupling, but also warns that overly fine-grained modules add build and
maintenance overhead. The official Jetchat sample keeps a small chat app in a
compact structure, while Now in Android uses finer modules for a much larger
multi-feature codebase.

## Decision

Use the following Android Gradle modules:

1. `:app` for application composition.
2. `:core:designsystem` for tokens, theme, icons, and reusable branded Compose
   controls.
3. `:data:chat` for chat data models, the `ChatRepository` seam, Room, and the
   internal Supabase/Ktor adapter.
4. `:feature:chat` for chat screens, chat-specific controls, reducer, fixture
   parity tests, presentation state, and ViewModel.
5. `:benchmarks` for Baseline Profile generation and macrobenchmarks.

Keep `ChatRepository` as the interface consumed by the feature. Provider and
database types remain internal to `:data:chat`; consolidating Gradle modules
does not expose them. Add a new Gradle module only when there is a demonstrated
ownership seam, multiple applications or adapters, meaningful build isolation,
or a second feature that needs independently reusable logic.

Reserve the `Fish` prefix for the intentionally branded public UI interface,
such as `FishTheme`, `FishIcons`, and reusable Fish controls. Feature and
implementation types use direct domain names such as `ChatScreen`,
`ChatViewModel`, and `ChatDatabase`.

## Consequences

- The build graph drops from nine included modules to five, reducing navigation
  and configuration overhead.
- The repository seam, provider isolation, reducer fixture parity, and test
  coverage remain intact.
- Chat-specific code gains locality inside `:feature:chat`; reusable visual
  behavior gains locality inside `:core:designsystem`.
- If scale creates a real seam later, packages can be extracted into Gradle
  modules without changing feature-facing interfaces.

## References

- [Android modularization guide](https://developer.android.com/topic/modularization)
- [Common modularization patterns](https://developer.android.com/topic/modularization/patterns)
- [Jetchat Compose sample](https://github.com/android/compose-samples/tree/main/Jetchat)
- [Now in Android](https://github.com/android/nowinandroid)
