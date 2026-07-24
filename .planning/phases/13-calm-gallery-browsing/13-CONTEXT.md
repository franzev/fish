# Phase 13: Calm gallery browsing - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Give clients and coaches a calm, per-conversation Shared content destination in the Android and iOS direct-chat apps. This phase owns the two required entry paths, native navigation and return behavior, populated-only category presentation, category-appropriate browsing layouts, bounded older-page discovery, and honest loading/cached/empty/offline/failure states. It does not add preview, export, source-message navigation, deletion, search, sorting, filters, favorites, albums, bulk actions, new sending pipelines, a global gallery, or any non-chat mobile surface.

</domain>

<decisions>
## Implementation Decisions

### Entry and navigation
- Add one dedicated 44px gallery control to the conversation header with the accessible label “Shared content.” Keep the participant identity path to conversation details intact.
- Add one full-width “Shared content” row below participant identity and before safety actions in conversation details. Do not add a count, badge, or competing primary treatment.
- Present Shared content as a full-screen native destination pushed onto the existing navigation stack, not as a sheet or embedded details section.
- Preserve the entry path through ordinary native navigation: header → gallery → conversation; details → gallery → details → conversation.

### Categories and gallery layout
- Use plain text tabs in the fixed order Media, Files, Links, Voice. Render only populated categories and remove the category control entirely when only one category is populated.
- On first open, select the first populated category in fixed order. Preserve the selected category while the gallery remains on the navigation stack; do not persist this choice across app launches.
- Use a compact thumbnail grid for Media and single-column rows for Files, Links, and Voice. Do not force every content type into one generic geometry.
- Keep the browsing surface scan-focused: Media is primarily visual; Files show filename plus type/size; Links show title and hostname; Voice shows duration. Sender and localized date context belongs to the Phase 14 preview.

### State and interaction behavior
- On first open without eligible cache, show structure-matched skeletons. During refresh, keep accepted cached items visible beneath the single gallery-level cached/stale notice defined by Phase 12; do not blank, dim, or badge every item.
- Show “No shared content yet” only after an authoritative successful empty response. Offline with no eligible cache is unavailable, not empty. Failure copy remains calm and shows the existing single manual retry only after the bounded recovery cycle permits it.
- Expose older pages through one quiet “Show earlier content” secondary control at the retained-history boundary. Preserve current category and scroll position while loading; a failed older-page request retains visible content and offers one calm retry.
- Each item exposes one selection intent reserved for Phase 14 preview. Phase 13 adds no inline action menu, long-press menu, swipe action, multi-select mode, autoplay, or destructive/export affordance.
- Keep controls at least 44×44px, expose category selection and loading state programmatically, use descriptive item labels, preserve visible focus, support large text and RTL reflow, and avoid motion beyond native navigation continuity.

### the agent's Discretion
- Choose the exact native gallery icon, tab implementation, adaptive Media grid column calculation, skeleton count, and category-specific row composition while reusing each platform’s design system and preserving the locked behaviors above.
- Choose the state-holder/view-model split and navigation route types, provided provider details stay inside existing data boundaries and both platforms expose equivalent presentation behavior.
- Choose concise platform-localized copy variants when required by grammar or OS conventions, while keeping the terms “Shared content,” “Media,” “Files,” “Links,” and “Voice” consistent.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Android `ChatTopBar`, `FishTopBar`, `FishIconButton`, `ParticipantDetailsSheet`, `FishNotice`, `FishEmptyState`, `FishSkeleton`, Material text tabs, and lazy grids already provide the required header, details, feedback, and category/layout primitives.
- iOS `PersonalChatTopBar`, `TopBar`, `IconButton`, `EmptyState`, design-system spacing/type/palette tokens, and existing SwiftUI lazy grids provide matching native presentation seams.
- Android and iOS `SharedContentStore` implementations already expose bounded recovery, cached/stale/unavailable truth, manual retry state, identity ownership, visible-item planning, and the underlying ordered shared-content state.
- The canonical TypeScript/Kotlin/Swift shared-content contract already defines category order, item kinds, server order, 40+1 paging, tombstone behavior, and delivery/cache boundaries.

### Established Patterns
- Native mobile remains direct-chat-only. New destinations are conversation-owned and must not create a dashboard, global gallery, or unrelated navigation surface.
- Provider and persistence details remain behind Android `:data:chat` and iOS `ChatData`; feature/UI code consumes provider-neutral models and stores.
- Supabase/RLS and accepted server order remain authoritative. Local state is a disposable identity-and-conversation-scoped read cache.
- FISH uses monochrome hierarchy, native navigation, sentence-case copy, 44px interaction targets, no shadows or decorative effects, one obvious intent per control, and calm non-scolding recovery.

### Integration Points
- Add Shared content entry callbacks to Android `ChatTopBar`/`ParticipantDetailsSheet` and the corresponding route composition in `ChatRoute`.
- Add the equivalent iOS header control, conversation-details presentation, and navigation destination in `FishApp`/`PersonalChat`.
- Adapt accepted shared-content items and Phase 12 presentation truth into feature-owned gallery UI models without exposing delivery URLs, provider rows, or storage paths.
- Connect visible-item reporting, gallery-open recovery, manual retry, and older-page requests to the existing native shared-content stores and repositories.

</code_context>

<specifics>
## Specific Ideas

- “Shared content” is the one stable product term across the header, details, screen title, accessibility labels, and recovery copy.
- Populated-only categories remove empty choices. A single populated category removes the tab row rather than showing a one-option selector.
- The user explicitly approved all autonomous recommendations for the remaining milestone; these defaults are locked unless implementation evidence reveals a direct conflict with an existing invariant.

</specifics>

<deferred>
## Deferred Ideas

- Preview/open behavior, sender/date context, native share/save/download, source-message navigation, return restoration from preview, and sender-only deletion remain Phase 14.
- Cross-platform release parity, TalkBack/VoiceOver completion, exhaustive large-text/RTL/reduced-motion proof, performance budgets, hosted evidence, and scope gates remain Phase 15.
- Search, sorting, filters, favorites, albums, bulk actions, global galleries, and new sending pipelines remain outside v1.3.

</deferred>

---

*Phase: 13-calm-gallery-browsing*
*Context gathered: 2026-07-24*
