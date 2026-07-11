---
phase: 09
slug: cross-platform-chat-state
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 09 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser UI → web hooks/store | User input and server-pushed rows enter browser-local coordination state keyed by conversation. | Drafts, optimistic messages, read state, realtime status, pagination state. |
| Web store → portable core | Zustand dispatches deterministic events; neither layer is an authorization or persistence authority. | JSON-shaped `ChatEvent` and `ChatState` values. |
| Web hooks → server/Supabase | Server actions, Edge Functions, database functions, and RLS authorize durable reads and writes. | Authenticated commands, messages, membership-scoped rows. |
| Auth identity → module singleton | A soft account transition can retain the JavaScript module, so verified identity changes must purge volatile chat state. | Drafts, pending/failed rows, hydration keys, owner fingerprint. |
| Portable contract → native guidance | TypeScript types and JSON vectors are executable truth; protocol/native notes guide later Kotlin/Swift adapters. | Event names, state fields, selectors, fixture expected outputs. |
| Debug/browser evidence → repository | Live reproduction evidence must remain synthetic and token-safe. | Routes, roles, timestamps, channel names, redacted results. |
| Package manager → web workspace | The only phase dependency addition is audited `zustand`, installed and locked under `apps/web`. | Package metadata and lockfile integrity. |

---

## Threat Register

Plan-specific context is included for repeated IDs so all 77 authored rows remain independently auditable.

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|-----------------------|--------|
| T-09-01 | Elevation of privilege | Portable core | mitigate | Dependency guard rejects React/Next/Zustand/Supabase/browser/native references (`apps/web/tests/chat-state-boundary.test.ts:10-45`); focused suite passed 2026-07-11. | closed |
| T-09-02 | Information disclosure | Fixtures/state | mitigate | Protocol requires synthetic fixture content and forbids credentials/JWTs/service-role keys/passwords (`packages/core/docs/chat-state-protocol.md:158-166`); fixture replay passed. | closed |
| T-09-03 | Tampering | Optimistic reconciliation | mitigate | Reducer handles confirmation/remote merge and request IDs (`packages/core/src/chat-state/reducer.ts:68-89,227-269`); duplicate vectors begin at `chat-state-vectors.json:526`. | closed |
| T-09-04 | Repudiation | Failure/confirmation results | mitigate | Failure preserves the row/draft and confirmation is fixture-backed (`reducer.ts:271-311`; `chat-state-vectors.json:190,288,376`); tests passed. | closed |
| T-09-05 | Information disclosure | Web compatibility shim | mitigate | Shim imports only `@fish/core/chat-state` (`apps/web/app/(authenticated)/chat/chat-state.ts:1-9`) and contains no Supabase/action/session/Zustand import. | closed |
| T-09-SC (09-01) | Tampering | Package installs | accept | No install in Plan 09-01; recorded as AR-09-01-SC. | closed |
| T-09-06 | Elevation of privilege | Composer/read hooks | mitigate | Hooks accept command dependencies and dispatch cache events (`use-chat-composer.ts:13-31,112-223`; `use-chat-read-state.ts:45-73`); store authority exclusions are tested. | closed |
| T-09-07 | Information disclosure | Hook/store lifetime | mitigate | State is conversation-scoped (`chat-store.ts:20-73`; `chat-selectors.ts:25-99`) and identity purging is implemented (`chat-identity-guard.tsx:30-45`). | closed |
| T-09-08 | Tampering | Realtime callbacks | mitigate | Message/read callbacks use the portable-backed merge paths (`use-chat-realtime.ts:175-235`). | closed |
| T-09-09 | Denial of service | Realtime/presence subscriptions | mitigate | Effects unsubscribe and clean up (`use-chat-realtime.ts:212-214,276-278,311-316`; `use-chat-presence.ts:63-76`). | closed |
| T-09-10 | Repudiation | Edit/delete/reaction/retry | mitigate | Composer calls injected existing actions with message/request identifiers and merges only returned results (`use-chat-composer.ts:112-223`). | closed |
| T-09-SC (09-02) | Tampering | Package installs | accept | No install in Plan 09-02; recorded as AR-09-02-SC. | closed |
| T-09-11 | Elevation of privilege | Zustand store | mitigate | Static/runtime tests reject auth, role, assignment, service-role, Supabase and server-action authority (`chat-store.test.ts:67-95`). | closed |
| T-09-12 | Information disclosure | Global store lifetime | mitigate | Store is keyed by conversation, supports slice clearing, resets in tests, and purges on identity change (`chat-store.ts:119-247,277-296`; `chat-store.test.ts:419-584`). | closed |
| T-09-13 | Tampering | Optimistic store actions | mitigate | Store actions dispatch `ChatEvent` through one portable reducer (`chat-store.ts:119-126,191-239`); store/fixture tests passed. | closed |
| T-09-14 | Repudiation | Retry/confirmation | mitigate | Composer carries `clientRequestId` through optimistic, failure and confirmation flows (`use-chat-composer.ts:82-137`); exact-count persistence proof exists (`chat-send.spec.ts:23-36`). | closed |
| T-09-15 | Denial of service | Store selectors | mitigate | Narrow conversation selectors exist (`chat-selectors.ts:25-99`) and `ChatClient` subscribes to scoped slices (`chat-client.tsx:103-108`). | closed |
| T-09-SC (09-03) | Tampering | Zustand install | mitigate | Legitimacy audit records version 5.0.14, upstream, MIT and no postinstall (`09-RESEARCH.md:123-134`); lockfile pins 5.0.14 (`pnpm-lock.yaml:68-70`). | closed |
| T-09-16 | Elevation of privilege | Protocol docs | mitigate | Protocol keeps auth/assignment/membership/writes with server/Supabase (`chat-state-protocol.md:8-13,170-174`). | closed |
| T-09-17 | Tampering | Fixture interpretation | mitigate | Protocol requires ordered replay and `expectedState`/`expectedSelectors` equality (`chat-state-protocol.md:116-130`); replay suite passed. | closed |
| T-09-18 | Information disclosure | Native notes | mitigate | Native notes are architecture-only and preserve server authority (`09-NATIVE-CHAT-STATE-NOTES.md:23-39`); examples contain no credential material. | closed |
| T-09-19 | Scope expansion | Native production source | mitigate | Plan 09-04 commits are documentation-only and its summary records zero Android/iOS source changes (`09-04-SUMMARY.md:24-31,62-70`). | closed |
| T-09-SC (09-04) | Tampering | Package installs | accept | No install in Plan 09-04; recorded as AR-09-04-SC. | closed |
| T-09-05-01 | Spoofing | Two-session reproduction | mitigate | Evidence records distinct sender/receiver identities, roles, routes and backing IDs (`.planning/debug/loading-new-messages.md:186-200`). | closed |
| T-09-05-02 | Information disclosure | Browser evidence | mitigate | Protocol mandates synthetic copy and complete token/password/cookie redaction (`loading-new-messages.md:98-107`); evidence contains only needed result fields. | closed |
| T-09-05-03 | Tampering | Delivery result | mitigate | Evidence used the existing chat UI and persisted authorized rows, with no production/RLS change (`loading-new-messages.md:203-205`; `09-05-SUMMARY.md:80-87`). | closed |
| T-09-05-04 | Repudiation | Debug classification | mitigate | Both attempts record timestamps, routes, channels, results and capture limitations (`loading-new-messages.md:186-209`). | closed |
| T-09-05-05 | Elevation of privilege | Realtime diagnosis | mitigate | Result remains `inconclusive`, root cause not established, and no auth/membership fix inferred (`loading-new-messages.md:213-227`). | closed |
| T-09-SC (09-05) | Tampering | Package installs | accept | Diagnostic plan installed no package; recorded as AR-09-05-SC. | closed |
| T-09-06-01 | Tampering | Protocol/fixture documentation | mitigate | Remediated 2026-07-11: both canonical docs now document `hasLoadError` (field, default, atomic set-on-failure/clear-on-retry semantics) and the `olderPageRetryClearsError` fixture (`chat-state-protocol.md` state shape, event table, and fixture list; `09-NATIVE-CHAT-STATE-NOTES.md` shared contract, Android, and iOS mappings). A new exact-name doc-sync test enforces the update-together rule: every fixture name and pagination field must appear in both docs (`apps/web/tests/chat-state-fixtures.test.ts`, "keeps the canonical protocol and native docs in sync with the executable contract"). Full web suite 61 files / 504 tests passed. | closed |
| T-09-06-02 | Repudiation | Canonical ownership | mitigate | Ownership/pointer chain exists in protocol, Phase 09 notes, Phase 10 notes and UAT (`chat-state-protocol.md:16-29`; `09-NATIVE-CHAT-STATE-NOTES.md:14-21`; `10-NATIVE-CHAT-STATE-NOTES.md:5-18`; `09-UAT.md:26-31`). | closed |
| T-09-06-03 | Elevation of privilege | Native guidance | mitigate | Native guidance keeps auth/membership/assignment/writes/persistence/durable reads outside adapters (`09-NATIVE-CHAT-STATE-NOTES.md:38-39,179-181`). | closed |
| T-09-06-04 | Information disclosure | Docs/fixtures | mitigate | Protocol expressly prohibits credentials/JWTs/service-role keys/seeded passwords (`chat-state-protocol.md:165-166`); fixtures are synthetic. | closed |
| T-09-06-05 | Scope expansion | Android/iOS source | mitigate | Canonical notes explicitly exclude native production source (`09-NATIVE-CHAT-STATE-NOTES.md:23-27`); documentation plan changed documentation only. | closed |
| T-09-SC (09-06) | Tampering | Package installs | accept | Documentation plan installed no package; recorded as AR-09-06-SC. | closed |
| T-09-71 | Information disclosure | Store across accounts | mitigate | `clearChatStore` empties conversations/hydration keys and owner guard purges on identity change (`chat-store.ts:277-296`); regression coverage at `chat-store.test.ts:419-584`. | closed |
| T-09-72 | Tampering | Leftover account-A draft | mitigate | Cross-owner regression seeds draft/pending data then verifies purge for account B (`chat-store.test.ts:517-545`); SIGNED_OUT guard also clears (`chat-identity-guard.tsx:37-45`). | closed |
| T-09-73 | Elevation of privilege | Store authority | accept/mitigate | Cache-only compromise is accepted as AR-09-07-73; forbidden authority keys/imports remain enforced (`chat-store.test.ts:67-95,566-584`). | closed |
| T-09-SC (09-07) | Tampering | Package installs | accept | No dependency change in Plan 09-07; recorded as AR-09-07-SC. | closed |
| T-09-81 | Information disclosure | Removed `/chat` route | accept | Route-removal exposure accepted as AR-09-08-81; canonical `/channels/:id` server/RLS boundary remains unchanged. | closed |
| T-09-82 | Tampering | Supersede notes | mitigate | Canonical notes preserve dated ownership/history pointers rather than rewriting source history (`10-NATIVE-CHAT-STATE-NOTES.md:5-18`; `09-UAT.md:26-31`). | closed |
| T-09-SC (09-08) | Tampering | Package installs | accept | No dependency change in Plan 09-08; recorded as AR-09-08-SC. | closed |
| T-09-91 | Integrity/data loss | Post-failure clear | mitigate | Reducer restores failed body only into an empty draft (`reducer.ts:271-311`); fixture/test coverage exists (`chat-state-vectors.json:288,376`). | closed |
| T-09-92 | Integrity/data loss | Delayed failure/newer draft | mitigate | Conditional restoration preserves newer text; component regression at `chat-client.test.tsx:703-744` and fixture at `chat-state-vectors.json:376`. | closed |
| T-09-93 | Repudiation | Retry resend | accept | Original request-ID reuse/idempotency reliance recorded as AR-09-09-93; composer reuses request identifiers (`use-chat-composer.ts:82-137`). | closed |
| T-09-SC (09-09) | Tampering | Package installs | accept | No dependency change in Plan 09-09; recorded as AR-09-09-SC. | closed |
| T-09-101 | Integrity | Realtime lifecycle | mitigate | Conversation change resets transient state and cleanup returns realtime status to idle (`use-chat-realtime.ts:115-150,212-214`); regressions at `chat-client.test.tsx:2204-2275`. | closed |
| T-09-102 | Integrity | Duplicate read dispatch | mitigate | Realtime read callback has one injected merge path (`use-chat-realtime.ts:232-241`); focused tests passed. | closed |
| T-09-103 | Information disclosure | RLS-scoped read payload | accept | Browser cache handling of already RLS-scoped rows recorded as AR-09-10-103; hook only dispatches merge state (`use-chat-read-state.ts:69-73`). | closed |
| T-09-SC (09-10) | Tampering | Package installs | accept | No dependency change in Plan 09-10; recorded as AR-09-10-SC. | closed |
| T-09-111 | Integrity/UX accuracy | Offline copy | mitigate | UI and design reference both say “Reconnect, then try again,” with no queue promise (`chat-client.tsx:670`; `states.md:27-30`). | closed |
| T-09-112 | Denial of service/accessibility | Message actions | mitigate | Action controls are 56px and coarse pointers reveal the bar (`chat-client.tsx:482-521`); assertions at `chat-client.test.tsx:2139-2140`. | closed |
| T-09-113 | Tampering | Message rendering | accept | React text rendering/no-new-HTML surface accepted as AR-09-11-113; message body is interpolated as text (`chat-client.tsx:547-552`) and no `dangerouslySetInnerHTML` is present. | closed |
| T-09-SC (09-11) | Tampering | Package installs | accept | No dependency change in Plan 09-11; recorded as AR-09-11-SC. | closed |
| T-09-12-01 | Denial of service | Older-message sentinel | mitigate | Observer is gated by loading/error state (`use-load-older-messages.ts:101-119`); browser-faithful regression proves exactly one automatic attempt (`chat-client.test.tsx:1455-1493`). | closed |
| T-09-12-02 | Information disclosure | Failure copy | mitigate | UI exposes only calm generic copy and retry (`chat-client.tsx:329-336`), with no raw server/error detail. | closed |
| T-09-12-SC | Tampering | Package installs | accept | No packages added; existing UI/test helpers reused; recorded as AR-09-12-SC. | closed |
| T-09-13-01 | Tampering | Late failure transition | mitigate | Reducer ignores failure for a row already `sent` (`reducer.ts:279-289`); regression at `chat-client.test.tsx:2432`. | closed |
| T-09-13-02 | Information disclosure | Reducer cache | accept | Conversation-local cache/no-authority exposure recorded as AR-09-13-02; boundary/store authority tests passed. | closed |
| T-09-13-SC | Tampering | Package installs | accept | No package change and core boundary remains tested; recorded as AR-09-13-SC. | closed |
| T-09-14-01 | Information disclosure | Singleton account boundary | mitigate | Verified-owner changes and auth events purge the store (`chat-store.ts:288-296`; `chat-identity-guard.tsx:30-45`); tests passed. | closed |
| T-09-14-02 | Elevation of privilege | Owner fingerprint | mitigate | Owner value is module-private purge metadata, absent from store state; forbidden authority-key regression at `chat-store.test.ts:566-584`. | closed |
| T-09-14-03 | Repudiation | Failed sign-out | mitigate | Logout clears/navigates only after `ok` success (`use-logout.ts:24-39`); `ok:false` regression at `logout-button.test.tsx:75-97`. | closed |
| T-09-14-SC | Tampering | Package installs | accept | No dependency change in Plan 09-14; recorded as AR-09-14-SC. | closed |
| T-09-15-01 | Tampering | Cross-conversation async completion | mitigate | Per-conversation lock plus latest-callback generation guard drops stale completion/scroll work (`use-chat-messages.ts:127,246-279`; `use-load-older-messages.ts:50-96`). | closed |
| T-09-15-02 | Denial of service | Conversation-B first load | mitigate | Lock is a `Set<ChatConversationId>` (`use-chat-messages.ts:127,246-279`); deferred A→B regression at `chat-client.test.tsx:1688`. | closed |
| T-09-15-SC | Tampering | Package installs | accept | No dependency change in Plan 09-15; recorded as AR-09-15-SC. | closed |
| T-09-16-01 | Spoofing | Stale typing/recording | mitigate | Conversation transition resets indicators/timers (`use-chat-realtime.ts:115-150`); prop-switch regressions at `chat-client.test.tsx:2204-2275`. | closed |
| T-09-16-02 | Tampering | Pagination geometry | accept | UX-only trust classification recorded as AR-09-16-02; reserved slot is implemented (`chat-client.tsx:293-340`). | closed |
| T-09-16-SC | Tampering | Package installs | accept | No dependency change in Plan 09-16; recorded as AR-09-16-SC. | closed |
| T-09-17-01 | Repudiation | Send persistence/dedup | mitigate | E2E asserts exactly one matching row before and after reload, without `.last()` (`chat-send.spec.ts:23-36`). | closed |
| T-09-17-SC | Tampering | Package installs | accept | No dependency change in Plan 09-17; recorded as AR-09-17-SC. | closed |
| T-09-18-01 | Denial of service/accessibility | Shell logo | mitigate | Logo anchor uses `min-h-control min-w-control` and deterministic label (`app-shell.tsx:134-138`); unit assertions at `app-shell.test.tsx:160-162`. | closed |
| T-09-18-SC | Tampering | Package installs | accept | No dependency change in Plan 09-18; recorded as AR-09-18-SC. | closed |
| T-09-19-01 | Denial of service | Duplicate auto retry | mitigate | Failure and loading flags commit atomically (`reducer.ts:199-218`); browser-faithful observer and one-attempt regression (`intersection-observer.ts:31-125`; `chat-client.test.tsx:1455-1493`). | closed |
| T-09-19-02 | Tampering | Cross-conversation error | mitigate | Error is per-conversation selector state (`chat-selectors.ts:85-92`) and stale completion is generation-guarded (`use-load-older-messages.ts:50-96`); switch regressions passed. | closed |
| T-09-19-SC | Tampering | Package installs | accept | No dependency change in Plan 09-19; recorded as AR-09-19-SC. | closed |

*Status: open · closed*  
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01-SC | T-09-SC (09-01) | Plan changed portable source only; package installation was isolated to audited Plan 09-03. | Phase 09 plan author | 2026-07-11 |
| AR-09-02-SC | T-09-SC (09-02) | Hook extraction required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-04-SC | T-09-SC (09-04) | Documentation-only plan required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-05-SC | T-09-SC (09-05) | Evidence-only diagnostic required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-06-SC | T-09-SC (09-06) | Documentation synchronization required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-07-73 | T-09-73 | A browser cache may coordinate UI state; residual risk is accepted because every durable operation remains authorized by RLS/Edge Functions and authority fields are forbidden. | Phase 09 plan author | 2026-07-11 |
| AR-09-07-SC | T-09-SC (09-07) | Account-boundary hardening required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-08-81 | T-09-81 | Removing a redirect surface exposes no data; the remaining channel route retains its existing server/RLS protections. | Phase 09 plan author | 2026-07-11 |
| AR-09-08-SC | T-09-SC (09-08) | Route/documentation cleanup required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-09-93 | T-09-93 | Retry reuses the original client request ID; residual duplicate-request risk is accepted behind existing server idempotency. | Phase 09 plan author | 2026-07-11 |
| AR-09-09-SC | T-09-SC (09-09) | Draft-failure correction required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-10-103 | T-09-103 | Read rows are already RLS-scoped; merging them into local cache adds no new server-side disclosure boundary. | Phase 09 plan author | 2026-07-11 |
| AR-09-10-SC | T-09-SC (09-10) | Realtime lifecycle correction required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-11-113 | T-09-113 | Presentation changes retain React text-node rendering and introduce no HTML injection API. | Phase 09 plan author | 2026-07-11 |
| AR-09-11-SC | T-09-SC (09-11) | UI correction required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-12-SC | T-09-12-SC | Pagination retry fix reused existing components and test infrastructure. | Phase 09 plan author | 2026-07-11 |
| AR-09-13-02 | T-09-13-02 | Hydration preservation carries only conversation-local display/cache state and no auth/role/assignment authority. | Phase 09 plan author | 2026-07-11 |
| AR-09-13-SC | T-09-13-SC | Reducer hardening required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-14-SC | T-09-14-SC | Identity-boundary hardening required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-15-SC | T-09-15-SC | Async race hardening required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-16-02 | T-09-16-02 | Pagination geometry is a UX/stability concern rather than a data trust boundary; reserved layout space addresses it. | Phase 09 plan author | 2026-07-11 |
| AR-09-16-SC | T-09-16-SC | Transient-state/layout correction required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-17-SC | T-09-17-SC | E2E assertion rewrite required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-18-SC | T-09-18-SC | Shell tap-target correction required no dependency change. | Phase 09 plan author | 2026-07-11 |
| AR-09-19-SC | T-09-19-SC | Atomic pagination-state correction required no dependency change. | Phase 09 plan author | 2026-07-11 |

---

## Unregistered Flags

None. The `## Threat Flags` sections in summaries 09-02, 09-03, and 09-04 explicitly report none. No other summary registered a new implementation threat flag.

---

## Verification Performed

- Extracted all 77 threat rows from the 19 plan-time `<threat_model>` blocks; repeated supply-chain IDs were retained in plan context.
- Read all 19 plan and summary artifacts plus `09-VERIFICATION.md` and `09-REVIEW.md` before verification.
- Verified mitigations against current implementation, tests, protocol/native docs, evidence logs, lockfile, and plan-specific documentation.
- Ran focused security-relevant tests on 2026-07-11: 7 files, 123 tests, all passed (`chat-state-boundary`, fixture replay, store, ChatClient, identity guard, logout, app shell).
- Re-audited T-09-06-01 on 2026-07-11 at the user's request. The executable contract still declares `hasLoadError` (`packages/core/src/chat-state/types.ts:63-67`), atomically sets/clears it (`packages/core/src/chat-state/reducer.ts:161-217`), and includes/replays `olderPageRetryClearsError` (`packages/core/src/chat-state/fixtures/chat-state-vectors.json:2065-2159`; `apps/web/tests/chat-state-fixtures.test.ts:139-180`). The canonical protocol still lists only three pagination fields and omits the fixture (`packages/core/docs/chat-state-protocol.md:42-46,132-156`), while the native notes do the same (`09-NATIVE-CHAT-STATE-NOTES.md:52-74,116-123,164-176`). The mitigation remains absent.
- Did not modify implementation files.

## Open Threat Detail

None. All 77 threats are closed.

### T-09-06-01 — Canonical protocol/native documentation drift (resolved 2026-07-11)

The executable contract required `ChatPaginationState.hasLoadError` and included the `olderPageRetryClearsError` vector, but the canonical human-readable protocol and native companion omitted both, violating their own update-together control.

Remediation applied exactly as specified: both `packages/core/docs/chat-state-protocol.md` and `09-NATIVE-CHAT-STATE-NOTES.md` now document `hasLoadError` (state-shape field with default, `olderMessagesRequested` atomic clear, `olderPageLoaded` reset, `olderPageLoadFailed` atomic set alongside `isLoadingOlder: false`) and list the `olderPageRetryClearsError` fixture. Exact-name documentation assertions were added (`apps/web/tests/chat-state-fixtures.test.ts`): every fixture name in `chat-state-vectors.json` and every pagination field must appear verbatim in both canonical docs, so a future contract change cannot land without updating them together. Focused fixture suite 27/27 and full web suite 61 files / 504 tests passed on 2026-07-11.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 77 | 76 | 1 | Codex / gsd-security-auditor |
| 2026-07-11 | 77 | 76 | 1 | Codex / gsd-security-auditor (T-09-06-01 re-audit) |
| 2026-07-11 | 77 | 77 | 0 | Claude (T-09-06-01 remediation: docs synced + exact-name doc-sync test added; 61 files / 504 tests passed) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** T-09-06-01 remediated and closed 2026-07-11; all 77 threats closed.
