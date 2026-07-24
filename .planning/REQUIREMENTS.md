# Requirements: FISH v1.3 Shared conversation content

**Defined:** 2026-07-22
**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

## v1.3 Requirements

### Discovery

- [x] **DISC-01**: Clients and coaches can open Shared content from both the conversation header and conversation details on Android and iOS.
- [x] **DISC-02**: The gallery shows populated-only categories in the fixed order Media, Files, Links, Voice; the category control is hidden when only one category has content.
- [x] **DISC-03**: The gallery includes currently supported photos, MP4 videos, GIFs, stickers, documents, the first safe public link per message, and voice messages; pending, failed, deleted, and unsupported content is excluded.

### Privacy

- [x] **PRIV-01**: Only verified members of a conversation can list or open its shared content; outsiders and members of other conversations are denied server-side.
- [x] **PRIV-02**: Short-lived delivery URLs are refreshed only when needed and are never persisted or logged.
- [x] **PRIV-03**: Cached gallery data is isolated by account and conversation and purged whenever the verified identity changes.

### Paging and performance

- [x] **PAGE-01**: Opening the gallery loads the newest 40 items plus one continuation sentinel without scanning or loading the transcript.
- [x] **PAGE-02**: Older content loads through deterministic cursor pagination without gaps, duplicates, or position jumps.
- [x] **PAGE-03**: Delivery URLs and heavy previews load only for visible or selected content in bounded batches of at most 50.

### Preview

- [ ] **VIEW-01**: Each supported content type opens in an appropriate native preview with sender and localized date context.
- [ ] **VIEW-02**: Gallery media never autoplays and provides a calm unavailable/retry state when previewing fails.

### Share, save, and download

- [ ] **XFER-01**: Users can share, save, or download eligible content through native platform actions using locally verified bytes.
- [ ] **XFER-02**: Cancelling a native action returns to the same gallery position without an error; temporary files are removed when safe.
- [ ] **XFER-03**: GIFs and stickers support preview and source navigation, but export actions remain unavailable until redistribution rights are verified.

### Source navigation

- [ ] **NAV-01**: Users can jump from a gallery item to its source message, including when that message is outside the loaded transcript window.
- [ ] **NAV-02**: Returning from the conversation restores the previous category, scroll position, and focused gallery item.
- [ ] **NAV-03**: If a source message no longer exists, the gallery stays usable and explains that the message is unavailable.

### Deletion

- [ ] **DEL-01**: Only the original sender sees the Delete message action; recipients cannot delete shared content.
- [ ] **DEL-02**: Confirmation explains that deletion removes the entire source message and every gallery item derived from it.
- [ ] **DEL-03**: Content remains visible until server acceptance, then disappears everywhere through realtime reconciliation.
- [ ] **DEL-04**: Accepted deletion immediately revokes access and tombstones the message, followed by idempotent permanent storage cleanup.

### Offline and recovery

- [x] **OFF-01**: Cached metadata remains browsable offline while the interface clearly distinguishes cached, incomplete, and unavailable content.
- [x] **OFF-02**: Reconnection merges additions and deletions without duplicates; failed refreshes receive one automatic retry before showing a manual retry action.

### Cross-platform parity

- [x] **PAR-01**: Shared fixtures define classification, ordering, pagination, permissions, states, identity purging, and deletion fan-out for TypeScript, Kotlin, and Swift.
- [ ] **PAR-02**: Android and iOS provide equivalent behavior and permissions while retaining platform-native presentation.

### Accessibility

- [ ] **A11Y-01**: The complete gallery flow works with TalkBack and VoiceOver using explicit item and action labels with predictable focus order.
- [ ] **A11Y-02**: The gallery supports large text, RTL, reduced motion, non-color state cues, and interaction targets of at least 44x44px.

### Scope protection

- [ ] **SCOPE-01**: Shared content is retrieval-only and adds no sending, capture, upload, MIME-expansion, or transcoding pipeline.
- [ ] **SCOPE-02**: v1.3 adds no global gallery, search, bulk actions, albums, favorites, AI/OCR, autoplay, web gallery, or mobile dashboard.

## Future Requirements

### Discovery enhancements

- **DISC-04**: Users can search a conversation's shared content after real usage shows that categories and source navigation are insufficient.
- **DISC-05**: Users can retrieve more than the first safe public link from a source message after link extraction and security semantics are expanded deliberately.

### Content management

- **XFER-04**: Users can select multiple compatible items for a single native share or save operation after repeated one-by-one usage demonstrates the need.
- **DISC-06**: Users can pin or favorite frequently revisited content after coaches and clients validate the retrieval need.

## Out of Scope

| Feature | Reason |
|---------|--------|
| New video, audio-file, voice, document, link, GIF, or sticker sending pipelines | v1.3 retrieves already-supported content only; new sending adds capture, upload, storage, moderation, and accessibility scope. |
| Global or cross-conversation gallery | Conflicts with direct-chat-only mobile scope and increases cross-conversation privacy risk. |
| Search, sorting controls, filters, favorites, albums, and bulk actions | Adds choices before real gallery volume proves the need. |
| Attachment-level or recipient deletion | Existing authority is sender-only source-message deletion; finer-grained mutation would create divergent histories. |
| Automatic permanent downloads | Consumes storage and data without an explicit user action and broadens privacy exposure. |
| AI, OCR, transcripts, semantic search, or summaries | Requires separate coach validation, privacy design, and evaluation work. |
| Web gallery, mobile home/dashboard, lessons, assignments, community, or marketplace | Outside the native direct-chat-only product boundary. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 13 | Complete |
| DISC-02 | Phase 13 | Complete |
| DISC-03 | Phase 11 | Complete |
| PRIV-01 | Phase 11 | Complete |
| PRIV-02 | Phase 12 | Complete |
| PRIV-03 | Phase 12 | Complete |
| PAGE-01 | Phase 11 | Complete |
| PAGE-02 | Phase 11 | Complete |
| PAGE-03 | Phase 12 | Complete |
| VIEW-01 | Phase 14 | Pending |
| VIEW-02 | Phase 14 | Pending |
| XFER-01 | Phase 14 | Pending |
| XFER-02 | Phase 14 | Pending |
| XFER-03 | Phase 14 | Pending |
| NAV-01 | Phase 14 | Pending |
| NAV-02 | Phase 14 | Pending |
| NAV-03 | Phase 14 | Pending |
| DEL-01 | Phase 14 | Pending |
| DEL-02 | Phase 14 | Pending |
| DEL-03 | Phase 14 | Pending |
| DEL-04 | Phase 14 | Pending |
| OFF-01 | Phase 12 | Complete |
| OFF-02 | Phase 12 | Complete |
| PAR-01 | Phase 11 | Complete |
| PAR-02 | Phase 15 | Pending |
| A11Y-01 | Phase 15 | Pending |
| A11Y-02 | Phase 15 | Pending |
| SCOPE-01 | Phase 15 | Pending |
| SCOPE-02 | Phase 15 | Pending |
| DISC-04 | Future / unscheduled | Future |
| DISC-05 | Future / unscheduled | Future |
| XFER-04 | Future / unscheduled | Future |
| DISC-06 | Future / unscheduled | Future |

**Coverage:**

- v1.3 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 after roadmap creation*
