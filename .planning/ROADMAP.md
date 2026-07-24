# Roadmap: FISH

**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

## Overview

v1.3 turns content already shared in a direct conversation into a private, bounded retrieval flow on Android and iOS. The milestone first fixes the shared contract and authorization boundary, then establishes identity-safe offline data behavior, adds the calm native gallery, completes item actions and source-message management, and closes with paired-platform accessibility, privacy, performance, and scope gates.

## Milestones

- ✅ **v1.0 Monochrome Foundations** — Phases 1-3 (shipped 2026-07-04) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 The Coaching Loop Foundation** — Phases 4, 7, 8 (completed 2026-07-06; closed informally during the re-scope — no separate archive; requirements archived inside [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md))
- ✅ **v1.2 Cross-platform Chat State Foundation** — Phases 9-10 (shipped 2026-07-11) — [archive](milestones/v1.2-ROADMAP.md)
- 🚧 **v1.3 Shared conversation content** — Phases 11-15 (planned)

## Phases

<details>
<summary>✅ v1.0 Monochrome Foundations (Phases 1-3) — SHIPPED 2026-07-04</summary>

- [x] Phase 1: Monochrome design system you can see (4/4 plans) — completed 2026-07-02
- [x] Phase 2: Secure account you can return to (8/8 plans) — completed 2026-07-03
- [x] Phase 3: Role-aware home (4/4 plans) — completed 2026-07-04

Full phase details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) · Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.1 The Coaching Loop Foundation (Phases 4, 7, 8) — COMPLETED 2026-07-06</summary>

- [x] Phase 4: Client Profiles (3/3 plans) — completed 2026-07-05
- [x] Phase 7: Chat Schema (1/1 plan) — completed 2026-07-05
- [x] Phase 8: Real Chat Route + send-message Edge Function (1/1 plan) — completed 2026-07-06

Removed 2026-07-06: the previously built learning-flow engines are no longer part of this milestone or the active product.

Closed informally during the 2026-07-06 re-scope (no dedicated v1.1 archive or
tag). The durable summary is in [MILESTONES.md](MILESTONES.md); phase details
and requirements remain summarized in
[milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) and
[milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md).

</details>

<details>
<summary>✅ v1.2 Cross-platform Chat State Foundation (Phases 9-10) — SHIPPED 2026-07-11</summary>

- [x] Phase 9: Cross-platform Chat State (19/19 plans) — completed 2026-07-10
- [x] Phase 10: Chat Message Loading Optimization (7/7 plans) — completed 2026-07-10

Full phase details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · Requirements: [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) · Audit: [milestones/v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)

</details>

### v1.3 Shared conversation content

- [x] **Phase 11: Shared-content contract and privacy boundary** — Establish one authorized, deterministic content model for every supported shared item. (gap closure in progress) (completed 2026-07-22)
- [x] **Phase 12: Cross-platform data, cache, and recovery** — Give both native apps private, bounded, offline-capable gallery state with calm recovery. (completed 2026-07-23)
- [x] **Phase 13: Calm gallery browsing** — Let clients and coaches reach and browse the focused per-conversation gallery on Android and iOS. (completed 2026-07-24)
- [ ] **Phase 14: Preview, native actions, source jump, and deletion** — Complete the item lifecycle without leaving the conversation's authority boundary.
- [ ] **Phase 15: Parity, privacy, performance, and release gates** — Prove equivalent, accessible, direct-chat-only behavior on both native platforms.

## Phase Details

### Phase 11: Shared-content contract and privacy boundary

**Goal**: Clients and coaches have one secure, deterministic definition of the content that belongs in a direct conversation's gallery.
**Depends on**: Phase 10
**Requirements**: DISC-03, PRIV-01, PAGE-01, PAGE-02, PAR-01
**Gap-closure scope**: `--skip-ui`; Phases 12-15 retain data/cache/recovery, gallery UI/navigation, preview/export/source/deletion, accessibility, offline, and release-surface work.
**Success Criteria** (what must be TRUE):

  1. A verified conversation member can retrieve photos, MP4 videos, GIFs, stickers, supported documents, the first safe public link per message, and voice messages, while pending, failed, deleted, unsupported, and other conversations' content is absent.
  2. Opening shared content returns the newest 40 eligible items plus a continuation signal without loading or scanning the transcript, and loading older items preserves deterministic order without gaps, duplicates, or position jumps.
  3. TypeScript, Kotlin, and Swift can replay the same fixtures and agree on content classification, ordering, pagination, permissions, gallery states, identity purging, and deletion fan-out.

**Plans**: 12 plans
Plans:
**Wave 1**

- [x] 11-01-PLAN.md — Establish, push, and type the authorized normalized Supabase contract
- [x] 11-03-PLAN.md — Define the portable TypeScript contract and canonical fixture corpus

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-02-PLAN.md — Wire safe-link persistence and deleted-attachment cleanup behavior
- [x] 11-04-PLAN.md — Replay the canonical contract on Android and iOS

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-05-PLAN.md — Pass the live adversarial and generated-contract drift gate

**Wave 4** *(gap closure: independent database and portable-contract corrections)*

- [x] 11-06-PLAN.md — Apply and push forward-only privacy/schema corrections through migration 0062
- [x] 11-08-PLAN.md — Add portable conversation ownership and request-sequenced pagination

**Wave 5** *(blocked on the corresponding Wave 4 correction)*

- [x] 11-07-PLAN.md — DNS-validate canonical links, disable preview egress, and capture deployed revisions
- [x] 11-09-PLAN.md — Replay strict ownership and request sequencing on Android
- [x] 11-10-PLAN.md — Replay strict ownership and request sequencing on iOS

**Wave 6** *(blocked on all implementation corrections)*

- [x] 11-11-PLAN.md — Pass strict local/linked adversarial and cross-platform proof

**Wave 7** *(blocked on complete automated proof)*

- [x] 11-12-PLAN.md — Human-confirm the intended iOS simulator parity target

### Phase 12: Cross-platform data, cache, and recovery

**Goal**: Users retain useful, private gallery context across loading, offline use, reconnects, and account changes on Android and iOS.
**Depends on**: Phase 11
**Requirements**: PRIV-02, PRIV-03, PAGE-03, OFF-01, OFF-02
**Success Criteria** (what must be TRUE):

  1. A user can browse cached metadata offline and can distinguish cached, incomplete, and unavailable content without the app implying that stale data is current.
  2. Returning online merges new and deleted items without duplicates; one failed refresh retries automatically once, then leaves a calm manual retry action.
  3. Delivery URLs and heavy previews load only for visible or selected content in batches of at most 50, refresh only when needed, and are never persisted or logged.
  4. Changing the verified account removes the prior account's gallery metadata, delivery state, decoded media, and temporary files so no conversation content crosses identities.

**Plans**: 16 plans

Plans:

**Wave 0**

- [x] 12-01-PLAN.md — Create portable and strict native parity RED tests
- [x] 12-02-PLAN.md — Create Android Room and repository RED tests
- [x] 12-03-PLAN.md — Create Android delivery, recovery, and identity RED tests
- [x] 12-04-PLAN.md — Create iOS cache, delivery, recovery, and identity RED tests

**Wave 1**

- [x] 12-05-PLAN.md — Establish the portable cache, recovery, delivery-intent, and generation contract

**Wave 2**

- [x] 12-06-PLAN.md — Implement Android Room persistence, pruning, purge, and backup exclusion
- [x] 12-07-PLAN.md — Implement iOS Core Data persistence, pruning, purge, and backup exclusion

**Wave 3**

- [x] 12-08-PLAN.md — Implement Android authorized listing and cache reconciliation
- [x] 12-11-PLAN.md — Implement iOS authorized listing, cache reconciliation, and network policy

**Wave 4**

- [x] 12-09-PLAN.md — Implement Android network, ephemeral delivery, and displayed thumbnails
- [x] 12-12-PLAN.md — Implement iOS ephemeral delivery, displayed thumbnails, and image loading

**Wave 5**

- [x] 12-10-PLAN.md — Implement Android recovery and presentation-state orchestration
- [x] 12-13-PLAN.md — Implement iOS recovery and presentation-state orchestration

**Wave 6**

- [x] 12-14-PLAN.md — Enforce Android purge-before-bind identity transitions
- [x] 12-15-PLAN.md — Enforce iOS purge-before-bind identity transitions

**Wave 7**

- [x] 12-16-PLAN.md — Validate cross-platform cache, recovery, privacy, and OS data-saving behavior

### Phase 13: Calm gallery browsing

**Goal**: Clients and coaches can reach and scan a calm, per-conversation shared-content gallery on Android and iOS without unrelated product surfaces or unnecessary choices.
**Depends on**: Phase 12
**Requirements**: DISC-01, DISC-02
**Success Criteria** (what must be TRUE):

  1. On Android and iOS, a client or coach can open Shared content from both the conversation header and conversation details, then return through normal native navigation.
  2. The gallery shows only populated categories in the fixed order Media, Files, Links, Voice, and removes the category control entirely when only one category has content.

**Plans**: TBD
**UI hint**: yes

### Phase 14: Preview, native actions, source jump, and deletion

**Goal**: Users can inspect, transfer, locate, and sender-delete shared items through safe native actions while remaining oriented to the source conversation.
**Depends on**: Phase 13
**Requirements**: VIEW-01, VIEW-02, XFER-01, XFER-02, XFER-03, NAV-01, NAV-02, NAV-03, DEL-01, DEL-02, DEL-03, DEL-04
**Success Criteria** (what must be TRUE):

  1. Every supported item opens in an appropriate native preview with sender and localized date context; media never autoplays, and failed previews retain a calm unavailable or retry state.
  2. A user can share, save, or download eligible content from locally verified bytes; cancelling returns to the same gallery position without an error, temporary files are cleaned when safe, and GIF/sticker export remains unavailable until rights are verified.
  3. A user can go to an item's source message even outside the loaded transcript window, return to the prior category, position, and focused item, and keep using the gallery if the source message is gone.
  4. Only the source-message sender sees Delete message, and confirmation states that acceptance removes the whole source message and every gallery item derived from it.
  5. Shared content stays visible until deletion is accepted, then disappears everywhere through realtime reconciliation while access is revoked, the message is tombstoned, and permanent storage cleanup remains idempotent.

**Plans**: TBD
**UI hint**: yes

### Phase 15: Parity, privacy, performance, and release gates

**Goal**: Android and iOS users receive equivalent, accessible shared-content behavior that is safe to release and remains strictly inside direct chat.
**Depends on**: Phase 14
**Requirements**: PAR-02, A11Y-01, A11Y-02, SCOPE-01, SCOPE-02
**Success Criteria** (what must be TRUE):

  1. Android and iOS provide equivalent conversation membership, ordering, loading, offline, recovery, preview, transfer, navigation, and deletion behavior while retaining platform-native presentation.
  2. A client or coach can complete the gallery flow with TalkBack or VoiceOver using explicit item and action labels and a predictable focus order.
  3. The complete flow remains usable with large text, RTL, reduced motion, non-color state cues, and interaction targets of at least 44 by 44 pixels.
  4. The released apps remain retrieval-only and per-conversation: they add no send, capture, upload, MIME-expansion, transcoding, global gallery, search, bulk action, album, favorite, AI/OCR, autoplay, web gallery, or mobile dashboard surface.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phase 11 → Phase 12 → Phase 13 → Phase 14 → Phase 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Monochrome design system you can see | v1.0 | 4/4 | Complete | 2026-07-02 |
| 2. Secure account you can return to | v1.0 | 8/8 | Complete | 2026-07-03 |
| 3. Role-aware home | v1.0 | 4/4 | Complete | 2026-07-04 |
| 4. Client Profiles | v1.1 | 3/3 | Complete | 2026-07-05 |
| 7. Chat Schema | v1.1 | 1/1 | Complete | 2026-07-05 |
| 8. Real Chat Route + send-message Edge Function | v1.1 | 1/1 | Complete | 2026-07-06 |
| 9. Cross-platform Chat State | v1.2 | 19/19 | Complete | 2026-07-10 |
| 10. Chat Message Loading Optimization | v1.2 | 7/7 | Complete | 2026-07-10 |
| 11. Shared-content contract and privacy boundary | v1.3 | 12/12 | Complete    | 2026-07-22 |
| 12. Cross-platform data, cache, and recovery | v1.3 | 16/16 | Complete   | 2026-07-23 |
| 13. Calm gallery browsing | v1.3 | 13/13 | Complete   | 2026-07-24 |
| 14. Preview, native actions, source jump, and deletion | v1.3 | 0/TBD | Not started | - |
| 15. Parity, privacy, performance, and release gates | v1.3 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-02 · v1.0 archived: 2026-07-04 · v1.1 re-scoped: 2026-07-06 · v1.2 opened: 2026-07-07 · v1.2 archived: 2026-07-11 · v1.3 roadmap added: 2026-07-22*
