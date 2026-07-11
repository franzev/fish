---
phase: 09-cross-platform-chat-state
status: issues_found
depth: standard
files_reviewed: 31
files_reviewed_list:
  - ".claude/skills/sketch-findings-fish/references/states.md"
  - "apps/web/app/(authenticated)/chat/chat-client.test.tsx"
  - "apps/web/app/(authenticated)/chat/chat-client.tsx"
  - "apps/web/app/(authenticated)/chat/chat-state.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-presence.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts"
  - "apps/web/app/(authenticated)/chat/message-grouping.test.ts"
  - "apps/web/app/(authenticated)/chat/message-grouping.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-selectors.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-store.test.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-store.ts"
  - "apps/web/components/auth/logout-button.test.tsx"
  - "apps/web/components/auth/logout-button.tsx"
  - "apps/web/components/shell/app-shell.test.tsx"
  - "apps/web/components/shell/app-shell.tsx"
  - "apps/web/e2e/chat-send.spec.ts"
  - "apps/web/package.json"
  - "apps/web/tests/chat-state-boundary.test.ts"
  - "apps/web/tests/chat-state-fixtures.test.ts"
  - "packages/core/docs/chat-state-protocol.md"
  - "packages/core/package.json"
  - "packages/core/src/chat-state/fixtures/chat-state-vectors.json"
  - "packages/core/src/chat-state/index.ts"
  - "packages/core/src/chat-state/reducer.ts"
  - "packages/core/src/chat-state/selectors.ts"
  - "packages/core/src/chat-state/types.ts"
  - "packages/core/src/index.ts"
findings:
  critical: 1
  warning: 10
  info: 1
  total: 12
reviewed_at: "2026-07-10T06:48:04Z"
diff_base: b605c2a318726cb067dab9cdae56aa1d3b41af94
---

# Phase 09: Code Review Report

## Summary

The settled-error retry path from Plan 09-12 is bounded and its manual recovery control follows the required calm tone and 56px floor. The implementation is not ready to close, however: one auth-lifecycle gap can expose account A's local chat content to account B, and ten warning-level defects cover async message ordering, pagination conversation races, reaction loss, false read receipts, stale transient state, layout stability, an unusable E2E assertion, a sub-56px shell control, and a malformed-Unicode protocol edge.

Passing tests do not disprove these findings. Several defects require deliberately reordered promises or an auth/conversation transition that the current suites do not exercise.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01 — Chat cache cleanup is not bound to a verified account transition

**Evidence:** `apps/web/app/(authenticated)/chat/store/chat-store.ts:257-269`; `apps/web/components/auth/logout-button.tsx:15-24`; `apps/web/components/auth/logout-button.test.tsx:34-66`; imported dependency `apps/web/lib/auth/use-logout.ts:18-22`.

`chatStore` is a module-global singleton keyed only by `conversationId`. The only production reset is the explicit `useLogout` path; there is no auth-state/identity listener that clears or namespaces the store when a session expires, is revoked, or is signed out in another tab. A soft navigation to `/login` followed by account B signing in can therefore retain account A's draft, reply/edit targets, and failed/pending local messages for the shared community conversation. The manual path is unsafe in the opposite direction too: `signOut()` returns `ServiceResult`, but `useLogout` ignores `ok`; an `ok: false` result still clears the draft and navigates even though the authenticated session remains active. The regression test supplies only `{ ok: true }` and covers only the button path.

**Impact:** Sensitive unsent chat content can cross account boundaries in the same tab, while a recoverable sign-out failure can erase local work and cause a login/authenticated redirect bounce without guidance.

**Recommendation:** Put cache ownership at the auth identity boundary: namespace volatile chat state by verified user id or clear it whenever the verified user changes or becomes signed out, including cross-tab/session-expiry transitions. Separately branch on `signOut().ok`; on failure preserve state, reset loading, and show calm retry guidance. Add account-A → non-button sign-out/session expiry → account-B coverage plus an `ok: false` logout test.

## Warnings

### WR-01 — An in-flight older-page request can poison the next conversation's retry gate and scroll

**Evidence:** `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts:119`, `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts:227-260`; `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts:29-35`, `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts:37-55`; `apps/web/app/(authenticated)/chat/chat-client.test.tsx:1456-1503`.

The load lock is one hook-level ref, not conversation-scoped. If conversation A is still loading when the component is rerendered for B, B's first sentinel callback returns `"skipped"` because A left the ref true. A visible sentinel does not have to emit another entry when A later settles, so B can miss automatic loading. Worse, A's old wrapper still calls `setHasOlderLoadError(...)` and runs a `requestAnimationFrame` against the captured viewport after the switch; an A failure can display/gate B's history and an A completion can restore B to A's scroll coordinates. The reset test switches only after A's failure has fully settled, so it cannot catch this race.

**Impact:** A newly opened conversation can appear failed or stop auto-loading even though no request for it failed, and its reading position can jump.

**Recommendation:** Pass an explicit `conversationId`/reset key into the pagination hook, scope the in-flight lock by conversation, and capture a request generation. Ignore error/scroll completions whose generation no longer matches; cancel pending animation frames on reset/unmount. Add a deferred A request test that rerenders to B before resolving A, covering both A failure and success.

### WR-02 — Rehydration can delete unresolved local sends and their failure-recovery body

**Evidence:** `apps/web/app/(authenticated)/chat/store/chat-store.ts:89-115`, `apps/web/app/(authenticated)/chat/store/chat-store.ts:157-189`; `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts:120-149`, `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts:307-318`; `packages/core/src/chat-state/reducer.ts:138-151`, `packages/core/src/chat-state/reducer.ts:229-253`.

The hydration key changes for read-state-only prop updates, and both ordinary hydration and reconnect reset replace the complete message array with the server window. Any local `pending`/`sending`/`failed` row absent from that snapshot disappears. If its request later fails, `markMessageFailed` cannot find the removed row's body, so it cannot restore the draft as promised by CSTATE-06.

**Impact:** A server refresh, read-state refresh, or reconnect reset racing a send can make the optimistic message vanish and permanently lose the text that failure recovery was supposed to preserve.

**Recommendation:** Reconcile authoritative hydration with unresolved local rows instead of replacing them: retain local pending/sending/failed messages until confirmed or explicitly discarded, while replacing authoritative sent rows/read state. Add tests for read-state-only rehydration and `hydrateWindow` reset during an in-flight send, followed by both success and failure.

### WR-03 — A late transport failure downgrades a message already confirmed by realtime

**Evidence:** `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:98-107`; `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts:112-133`; `packages/core/src/chat-state/reducer.ts:222-255`.

Realtime may observe the committed server row before the initiating request reports a timeout or lost response. `mergeRemoteMessage` then marks the optimistic row `sent`, but the later catch/notice dispatches `markMessageFailed`. That reducer matches only `clientRequestId` and unconditionally overwrites the already-authoritative row to `failed` and restores its body to the draft.

**Impact:** A message that really sent is presented as failed and retryable, encouraging duplicate text and undermining delivery confidence.

**Recommendation:** Make failure a valid transition only from `pending`/`sending`; if the row is already `sent`, return the existing state. Add a parity vector and component regression for optimistic send → realtime confirmation → delayed action failure.

### WR-04 — Bare realtime message updates erase existing reactions

**Evidence:** `packages/core/src/chat-state/types.ts:20-35`; `packages/core/src/chat-state/reducer.ts:300-311`; `packages/core/src/chat-state/selectors.ts:16-47`; inspected caller `apps/web/app/(authenticated)/chat/realtime.ts:107-124`.

`reactions` is optional in the portable message contract, but normalization converts absence to `[]` before `mergeChatMessage` spreads the incoming row over the existing row. The web realtime adapter also emits `reactions: []` for bare message INSERT/UPDATE rows. An edit update for a message that already has reactions therefore replaces the known reaction snapshot with an empty array.

**Impact:** Reaction chips disappear after an unrelated edit/update and remain wrong until a separate enriched refresh happens.

**Recommendation:** Distinguish "reaction snapshot absent" from "authoritatively empty." Preserve existing reactions when an incoming payload does not carry an enriched snapshot, or refresh/enrich message updates before merging. Add a reducer/store test for editing a reacted message.

### WR-05 — Messages are marked read even while the UI says they are unseen

**Evidence:** `apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts:96-126`; `apps/web/app/(authenticated)/chat/chat-client.tsx:151-156`, `apps/web/app/(authenticated)/chat/chat-client.tsx:613-621`.

Every new participant message immediately writes both delivered and read markers from an effect. The effect does not check document visibility, the scroll position, or `showNewMessages`. When the user is reading older history and the UI displays the `New messages` control, the newest hidden message has already been marked read.

**Impact:** Senders receive a false read receipt and unread state is cleared for content the recipient has not actually seen.

**Recommendation:** Advance delivered state on receipt, but advance read state only when the message is actually visible (for example, document visible and the log at bottom/latest message intersecting). Add a regression where a user scrolled away from the bottom receives a message: `New messages` remains and the read action is withheld until the user reveals it.

### WR-06 — Conversation switches retain old realtime transient UI indefinitely

**Evidence:** `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:52-63`, `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:159-192`; `apps/web/app/(authenticated)/chat/chat-client.tsx:171-179`, `apps/web/app/(authenticated)/chat/chat-client.tsx:601-607`.

`participantTyping` is initialized once. On a conversation change, the typing effect cleanup cancels the old four-second reset timeout but never sets the state back to false; without a broadcast in the new room, the old participant's typing indicator can remain forever. `localTypingRef` and `hasConnected` are likewise not reset by conversation id, so the first local typing event may be suppressed and an ordinary first connection may be labeled as reconnecting.

**Impact:** A new conversation can show the wrong person typing indefinitely, fail to broadcast the user's first typing state, or display misleading reconnect copy.

**Recommendation:** Reset conversation-scoped transient state and refs in an id-keyed transition (or remount/key the hook by conversation id), and add prop-switch tests while typing/connected states are active.

### WR-07 — The older-load failure affordance does not preserve layout height

**Evidence:** `apps/web/app/(authenticated)/chat/chat-client.tsx:293-318`; `apps/web/app/(authenticated)/chat/chat-client.test.tsx:1302-1350`.

The loading state inserts two fixed-height skeleton rows, while the failure state replaces them with one Alert/button row; there is no stable-height wrapper or overlay. Both are in normal flow before the message list. The committed tests assert presence, tone, and classes only, so they do not verify Plan 09-12's explicit "does not shove the message list" claim.

**Impact:** The transcript moves vertically as loading becomes failure/success, disrupting the reading position for the audience this product is designed to keep oriented.

**Recommendation:** Reserve one token-backed, state-invariant pagination feedback region (or overlay feedback without changing transcript geometry) and verify the first message's bounding position across idle → loading → failure → retry success in Playwright.

### WR-08 — Message lifecycle contracts conflict, and the community send E2E cannot pass

**Evidence:** `.claude/skills/sketch-findings-fish/references/states.md:7-13`; `apps/web/app/(authenticated)/chat/chat-client.tsx:358-368`, `apps/web/app/(authenticated)/chat/chat-client.tsx:568-595`; `apps/web/app/(authenticated)/chat/chat-client.test.tsx:617-641`; `apps/web/e2e/chat-send.spec.ts:13-21`.

The validated state reference requires visible `sending → sent → seen → failed` feedback, the unit suite explicitly requires no `Sending` feedback, and `ChatClient` hides every successful status in community rooms. The browser smoke test opens the community room and waits for a visible `Sent|Delivered|Read` image, so a successful implementation times out. It also selects `.last()` for the body, allowing duplicate optimistic/server rows to pass unnoticed.

**Impact:** The release-level send smoke test is unusable, duplicate-reconciliation regressions can be masked, and users have no canonical in-flight/success confirmation behavior.

**Recommendation:** Choose and document one community lifecycle. A coherent option is quiet `Sending`/`Sent` feedback while omitting participant-specific delivered/read states; otherwise update the reference and make E2E prove persistence by reloading. In either case assert exactly one matching message row instead of selecting `.last()`.

### WR-09 — The shell logo link is below the mandatory 56px target

**Evidence:** `apps/web/components/shell/app-shell.tsx:134-153`.

The home link has only `shrink-0`; its contents are a 32×32 mobile image or 40×40 desktop image. Header padding is outside the anchor and does not enlarge its clickable area.

**Impact:** A persistent navigation control violates FISH's non-negotiable 56px interaction floor and is harder to tap for the target audience.

**Recommendation:** Give the link `inline-flex min-h-control min-w-control items-center justify-center` while retaining the visual logo size, and add a rendered-class/geometry regression assertion.

### WR-10 — Snippet truncation can emit malformed Unicode and violates the documented length

**Evidence:** `packages/core/src/chat-state/selectors.ts:191-201`; `packages/core/docs/chat-state-protocol.md:105-108`; `apps/web/tests/chat-state-fixtures.test.ts:213-217`.

Long snippets use `body.slice(0, 95) + "..."`. For ASCII the result is 98 characters despite the protocol's 96-character rule. Because `slice` counts UTF-16 code units, a surrogate pair crossing offset 95 is split; for example, 94 ASCII characters followed by an emoji produces a lone surrogate/replacement glyph. Existing snippet parity coverage exercises only the deleted-message case.

**Impact:** Reply previews can display corrupted text, and Kotlin/Swift implementations can follow the stated 96-character contract yet disagree with web fixtures.

**Recommendation:** Define the portable counting unit (prefer user-perceived grapheme clusters), truncate without splitting a grapheme, and make the final ellipsis fit within 96 characters. Add long ASCII and emoji parity fixtures.

## Info

### IN-01 — Out-of-order read-state rows can move markers backward

**Evidence:** `packages/core/src/chat-state/selectors.ts:50-65`; `packages/core/docs/chat-state-protocol.md:69`, `packages/core/docs/chat-state-protocol.md:91-104`.

`mergeReadState` replaces the entire user's row whenever any field differs. A delayed older action response or multi-tab realtime row can therefore overwrite newer delivered/read markers and temporarily downgrade message statuses. Current parity vectors cover forward replacement and out-of-window markers, not a newer row followed by a stale row.

**Impact:** Delivered/read indicators and unread counts can regress until another refresh corrects them.

**Recommendation:** Specify monotonic ordering in the protocol and merge delivered/read dimensions independently by their timestamps, rejecting stale values. Add parity vectors for newer → stale and independently advancing delivered/read fields.

## Scope and Verification

- Reviewed the 31 explicitly scoped files at standard depth against `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, Phase 09 context, and Plan 09-12. Imported callers were inspected only where needed to prove a scoped call-chain defect.
- Explicitly traced Plan 09-12's observer creation/cleanup, callback identity reset, `loaded`/`failed`/`skipped` outcomes, duplicate triggers, manual retry, scroll restoration, conversation changes, tone/copy, and the 56px retry control.
- `pnpm test -- run ...` from `apps/web` completed with 60 files and 468 tests passing, including the focused chat/store/fixture/boundary/shell/logout files.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed from the repository root.
- E2E execution was not run because it requires the seeded local Supabase/Edge runtime and mutates chat data; its contradictory assertion was verified statically against the rendered community branch. No source file was modified by this review.

---

_Reviewed: 2026-07-10T06:48:04Z_
_Reviewer: gsd-code-reviewer_
_Completion: REVIEW_COMPLETE_
