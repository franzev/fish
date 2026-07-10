---
phase: 10-chat-message-loading-optimization
verified: 2026-07-10T22:24:17Z
status: gaps_found
score: "4/6 requirements passed; CLOAD-01 and CLOAD-06 have blocking implementation gaps"
has_blocking_gaps: true
re_verification: true
head_verified: 8e193bd35f331b7b612d95f61f1ca314069ecdf9
requirements:
  CLOAD-01: failed
  CLOAD-02: passed
  CLOAD-03: passed
  CLOAD-04: passed
  CLOAD-05: passed
  CLOAD-06: failed
requirements_verified:
  - CLOAD-02
  - CLOAD-03
  - CLOAD-04
  - CLOAD-05
requirements_failed:
  - CLOAD-01
  - CLOAD-06
schema_drift: false
gaps:
  - id: WR-01
    requirement: CLOAD-06
    summary: "Reconnect backfill uses the last local row as a server cursor and returns early for an empty transcript."
  - id: WR-02
    requirement: CLOAD-01
    summary: "The 40-message SSR window still fetches every reaction in the conversation."
human_verification:
  - id: HV-01
    test: "After the blocking gaps are fixed, load at least three older pages in a real seeded conversation using both the sentinel and the button."
    expected: "The message under the reader's eye does not move; the two-row skeleton transitions into final rows without a visible jump; no duplicate appears."
    why_human: "Real scroll geometry, paint timing, and perceptual layout stability are not measurable in jsdom."
---

# Phase 10: Chat Message Loading Optimization Verification

**Phase goal:** Opening a conversation renders the newest messages near-instantly from a bounded initial window; older history arrives through cursor-based load earlier and infinite scroll with reading position preserved; realtime messages merge into the loaded list in place without full reloads, duplicates, or layout shift; reconnect recovery stays gap-free and ordered.

**Verdict:** `gaps_found`. Plans 10-01 through 10-05 are implemented and their declared artifacts are substantive and wired, including the 10-05 skeleton gap closure. However, direct inspection confirms both warnings in `10-REVIEW.md` still exist. WR-02 prevents the initial load from being bounded by conversation history, and WR-01 can permanently omit messages missed during a reconnect. These failures block the phase goal and CLOAD-01/CLOAD-06 respectively.

## Requirement Results

| Requirement | Status | Evidence |
|---|---|---|
| CLOAD-01 | **FAILED** | `getAssignedConversation` correctly limits messages to 41 and retains 40, but then calls `fetchConversationReactions(client, conversation.id)`. That helper filters only by `conversation_id` and paginates through every reaction row. Initial SSR work therefore still grows with complete conversation history, contrary to the bounded-load/near-instant goal. |
| CLOAD-02 | PASSED | Realtime message INSERTs dispatch `mergeRemoteMessage`; reconnect handling no longer performs three full-history refreshes. The shared reducer merges in place. |
| CLOAD-03 | PASSED | `loadOlderMessagesAction` performs bounded composite `(created_at,id)` keyset reads; `useChatMessages` guards requests; the observer sentinel and quiet ghost button both call the same load-and-preserve callback. |
| CLOAD-04 | PASSED at source/test level | `useLoadOlderMessages` captures `scrollHeight`/`scrollTop` and restores by height delta in `requestAnimationFrame`; `.chat-log-viewport` disables browser anchoring; `useStickToBottom` keys off newest identity so prepends are inert. Plan 10-05 adds a fixed 112px slot and shared final/skeleton row geometry. Final perceptual confirmation remains HV-01. |
| CLOAD-05 | PASSED | `olderPageLoaded`, optimistic confirmation, and realtime delivery all reuse `mergeChatMessage`, deduplicating by id/clientRequestId and sorting by `(createdAt,id)`. Fixture/store tests pass. |
| CLOAD-06 | **FAILED** | `applyGapBackfill` selects `currentMessages[currentMessages.length - 1]` without requiring `localStatus === "sent"`, and returns without reset when there is no local message. An empty transcript or trailing pending/failed optimistic row can therefore provide no authoritative server cursor and skip missed messages. Read-marker-outside-window and ordering fixtures pass, but they do not repair this reconnect hole. |

## Plan Must-Haves

| Plan | Result | Direct verification |
|---|---|---|
| 10-01 portable contract | PASSED | Four pagination events and pagination state/default are present; `olderPageLoaded` calls `mergeChatMessage`; out-of-window read/delivered markers are handled independently; fixture replay passes. Later Phase 9 hardening adds `hasLoadError` and extra vectors without invalidating the Phase 10 contract. |
| 10-02 bounded reads | **PARTIAL / BLOCKING** | Initial/older/backfill/newest message queries are bounded and keyset-based, action inputs are Zod-validated, page reads enrich only returned message ids, and no read was added to `chat-command`. The SSR reaction side query remains unbounded (WR-02). |
| 10-03 store/reconnect wiring | **PARTIAL / BLOCKING** | Conversation-keyed pagination actions/selectors, `hydrateWindow`, one shared reconnect in-flight lock, per-channel first-subscribe tracking, reset-to-newest handling, and disconnected status wiring exist. The chosen reconnect cursor is unsafe or absent in valid states (WR-01). |
| 10-04 pagination UI | PASSED | Sentinel/button share `loadOlderAndPreserveScroll`; prepend does not trigger stick-to-bottom; failure gating is per-conversation and atomic; action props are threaded from `/channels/[id]`; calm notice states and reduced-motion-compatible opacity animation are present. |
| 10-05 skeleton gap closure | PASSED | Visible loading copy/spinner/generic bars are removed. Two skeleton rows and final community rows use `CommunityMessageRowLayout`; the slot is `h-pagination-slot` backed by `--size-pagination-slot: 112px`; the log exposes `aria-busy`, visual atoms are hidden, and one sr-only status announces loading. Focus is not moved. This closes the cosmetic gap recorded in `10-UAT.md` at source/test level. |

## Blocking Gaps

### WR-01 — authoritative reconnect cursor

`apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` derives the backfill marker from the final local array entry. That array may be empty or end in `pending`, `sending`, or `failed` client-only state. The empty case returns without fetching; the optimistic case sends a client timestamp/id to the server action. Either can exclude messages sent during the offline interval.

Required closure: search backward for the newest server-confirmed (`localStatus === "sent"`) message. If none exists, call the bounded newest-window action and `hydrateWindow`. Add regressions asserting exact action inputs for an empty transcript and for a confirmed row followed by optimistic/failed rows.

### WR-02 — bounded reaction enrichment

`apps/web/lib/services/supabase/core.ts` limits the initial message query but `fetchConversationReactions` subsequently retrieves all reaction pages for the conversation. Reactions belonging to unloaded messages are discarded after transfer, so latency and row volume still scale with full history.

Required closure: enrich only the retained window's message ids, using batched `.in("message_id", ids)` reads as the page actions already do. Add a service test proving an excluded 41st message's reactions are not queried or included.

## Verification Evidence

- Directly inspected every plan's declared implementation surface and key links rather than relying on summaries.
- Focused verification rerun: 6 Vitest files, **139/139 tests passed** (`core`, chat actions, store, stick-to-bottom, chat client, portable fixtures).
- Existing integration evidence supplied to this pass: `pnpm build` passed; full web Vitest suite passed **61 files / 499 tests**; schema drift is false.
- `10-UAT.md`: calm offline/reconnect presentation and channel error recovery passed; plan 10-05 closes the recorded skeleton issue. Reconnect-call counting and >40-message reset UAT remained blocked and do not override the source-confirmed WR-01 defect.
- `10-REVIEW.md`: both warnings independently reproduced in current HEAD; neither was fixed after the review commit.

## Tracking Consistency

`.planning/ROADMAP.md` is internally inconsistent: the Phase 10 detail heading says `4/5 plans executed`, while all five plan rows are checked and the progress table says `5/5 Complete`. This is a documentation/tracking defect, not an implementation gap; actual plan execution is 5/5. Separately, `REQUIREMENTS.md` and the progress table mark all CLOAD requirements complete even though this verification finds CLOAD-01 and CLOAD-06 blocking. Completion tracking should be corrected when gap-closure work is planned or completed.

## Human Verification

Only HV-01 requires actual observation: pixel-level reading-position preservation and the visual transition from the layout-matched skeleton to real rows. Reconnect cursor selection, backfill coalescing, and reaction-query bounds are deterministic code/test concerns and are not deferred to human judgment.

## Verification Complete

**Status:** `gaps_found`

**Score:** 4/6 requirements passed

**Blocking:** WR-01 (CLOAD-06 reconnect gap) and WR-02 (CLOAD-01 unbounded initial reaction fetch)

**Gap closure confirmed:** Plan 10-05 implements the UAT-requested message-shaped skeleton with shared geometry and a fixed semantic slot.
