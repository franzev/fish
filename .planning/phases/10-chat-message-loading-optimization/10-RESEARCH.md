# Phase 10: Chat Message Loading Optimization - Research

**Researched:** 2026-07-09
**Domain:** Chat message pagination, realtime merge/reconnect, scroll-position preservation, portable chat-state protocol extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data fetching strategy (locked)**
- Initial load fetches only a bounded newest-messages window — never the full history. Exact
  batch size is research-tuned (expect the 30–50 range; must comfortably overfill one viewport).
- Older history uses **cursor-based (keyset) pagination**, not offset pagination — offsets skew
  when new messages arrive and get slower with depth. Cursor is derived from the stable message
  ordering already shipped in Phase 7 (creation time + id tiebreak, or the schema's equivalent).
- Paginated pages fetch `limit + 1` (or equivalent) to know whether more history exists without
  a second round trip; "has more" state is explicit, never guessed.
- Paginated older pages and the live head merge through ONE canonical merge path (the portable
  chat-state core), deduplicated by message id and `clientRequestId`.

**Real-time sync (locked)**
- New incoming messages arrive via the existing Supabase Realtime subscription and are merged
  into the loaded list in place (append/merge through the portable reducer) — never a full
  reload or history refetch on message receipt.
- On reconnect after a dropped subscription, backfill the gap: fetch messages newer than the
  newest locally-known message (bounded, cursor-based) and merge, rather than resubscribing
  blind or refetching everything. If the gap exceeds the backfill bound, prefer resetting to
  the newest window over unbounded catch-up fetching.
- Ordering conflicts resolve by the server-authoritative stable sort (created_at + id); the
  optimistic-send reconciliation shipped in Phases 8–9 (pending → confirmed via
  `clientRequestId`) must keep working unchanged with pagination active.

**Caching & state management (locked)**
- The portable chat-state core in `packages/core/src/chat-state` remains the single source of
  truth for merge/ordering/read rules. Pagination becomes new portable events/results (e.g.
  hydrate-window, older-page-loaded, gap-backfill) with cross-platform JSON fixture vectors,
  same discipline as CSTATE-04. Web, Android, iOS get the same contract; only web is
  implemented this phase.
- The Phase 9 Zustand adapter (conversation-keyed, web-only) is the client cache: loaded
  window, cursors/has-more, loading flags, and connection state live there so re-entering the
  chat within a session does not refetch what is already cached. Zustand still never holds
  auth truth, role permissions, or RLS-sensitive decisions (CSTATE-03 boundary).
- Scroll position is preserved when older messages prepend: the message the user was reading
  stays visually fixed (anchor by message id/offset before mutation; restore after). No
  browser-default scroll jump to top, no reliance on unsupported `overflow-anchor` alone.

**Performance techniques (locked intent, technique research-tuned)**
- Scroll-up detection uses an IntersectionObserver sentinel (or equivalent) — no per-pixel
  scroll handler doing layout work; any residual scroll listener must be passive and
  throttled/debounced.
- Loading affordances reserve their space (fixed-height row) so appearing/disappearing loaders
  never shift layout.
- Long-list strategy is a research decision with explicit trade-offs: full virtualization
  (windowing) vs `content-visibility`/DOM-cap hybrid vs none-yet. Constraint: variable-height
  message bubbles, scroll-position preservation on prepend, accessibility (focus order, screen
  readers), and reduced-motion must all survive the chosen technique. If research shows the
  bounded window + pagination keeps DOM size modest, virtualization may be explicitly deferred
  with a documented threshold for adopting it later.
- Prefetching the next older page (e.g. when the user is within a page of the top) is allowed
  as a polish task if it stays simple; it must not race or duplicate the sentinel-triggered load.

**Edge cases (locked)**
- No gaps: pagination cursors + reconnect backfill must guarantee the rendered history has no
  silent holes; fixture vectors cover out-of-order arrival, duplicate delivery, backfill
  overlap, and pagination-during-live-inserts.
- Offline/reconnect: match the existing calm offline treatment (notice tone, never red); on
  reconnect, backfill and resume realtime without user action and without disturbing the
  reading position.
- Read state: read/unread behavior (and any read-boundary UI) must stay consistent when the
  boundary message is not yet in the loaded window; loading older pages must not mark things
  read incorrectly or regress existing read-state logic. Typing/presence indicators (to the
  extent they exist today) must not be broken by pagination — but no NEW typing/read-receipt
  features are built this phase.

**UX / design constraints (locked — FISH design line)**
- No new primary action: send stays the one primary action on the chat screen. The "load
  earlier" affordance is quiet (ghost/secondary or an automatic sentinel with a subtle
  inline loader), min 56px if tappable.
- Calm states per `sketch-findings-fish` `references/states.md`: loading reassures, never
  alarms; monochrome tokens only; `--notice` tone for connection problems; no red, no spinner
  storms; skeleton/placeholder shapes match final content sizes (zero CLS).
- `prefers-reduced-motion` respected for any scroll/entrance animation; no animated scrolling
  for programmatic position restoration (instant restore).
- Spacing/typography/radius via existing `@theme` tokens only; no raw hex, no one-off spacing.
- Copy for any visible states is sentence-case, plain, non-scolding.

**Verification constraints (locked)**
- Portable-core changes are test-vector-backed (fixtures) like Phase 9; reducer/selector logic
  gets unit tests; `pnpm build`, `pnpm lint`, `pnpm typecheck`, and focused chat tests pass.
- Reads stay direct RLS-protected Supabase selects; writes stay on the Edge Function path
  (AGENTS.md API boundary). Any new index/RPC needed for keyset pagination is a migration with
  RLS intact.
- Do NOT use Claude Preview MCP / browser-preview tooling for verification in this phase's
  planning or execution flows; prove behavior with unit/fixture tests, build gates, and the
  existing Playwright e2e suite where cross-role behavior needs it.

### Claude's Discretion
- Exact initial batch size and page size (justify against viewport fill + payload size).
- Exact cursor encoding (composite created_at+id vs sequence) — align with the shipped schema
  and its indexes; add an index only if the query plan needs it.
- Whether virtualization lands now or is deferred with a threshold (per research).
- Skeleton vs subtle inline loader for each loading state, within the states.md language.
- Hook/store internal shape, as long as the portable-core boundary (CSTATE-01/-03) holds.
- Prefetch-ahead distance and whether prefetch ships at all.

### Deferred Ideas (OUT OF SCOPE)
- New typing indicators or read receipts as features (only *compatibility* with existing
  read-state is in scope) — future milestone per REQUIREMENTS.md.
- Message search, jump-to-date, jump-to-oldest navigation, pinned/starred messages.
- Attachments/voice-note loading strategy (media pagination is its own problem).
- Native Android/iOS implementations of the pagination contract (docs/fixtures only this phase).
- Conversation-LIST virtualization (only the message thread is in scope).
- Service-worker/offline persistence of message cache beyond in-session memory.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLOAD-01 | Opening the chat renders the newest messages from a bounded initial window (no full-history fetch) — minimal time-to-first-message on load and refresh | Architecture Patterns #1 (bounded keyset window using the existing `messages_conversation_created_id_idx` index); replaces `SupabaseChatRepository.getAssignedConversation()`'s current unbounded select — see Common Pitfall #2 for why this is the concrete file/line to change |
| CLOAD-02 | New incoming messages arrive through the realtime channel and merge into the loaded list in place — never a full reload or history refetch | Don't Hand-Roll #1 — the existing `mergeRemoteMessage` event + `mergeChatMessage` dedup primitive already implements this correctly; the actual bug today is the *reconnect* path doing a full refetch (Common Pitfall #2), not the live-insert path, which already works |
| CLOAD-03 | Older history loads on demand via cursor-based (keyset) pagination — a calm "load earlier" affordance plus auto-load as the user scrolls up (infinite scroll) | Architecture Patterns #1 (keyset query shape) + #4 (IntersectionObserver sentinel, Code Example C); new `olderPageLoaded`-style portable event (Architecture Patterns #6) |
| CLOAD-04 | Loading older messages preserves the reading position — no scroll jump and no layout shift; newest-message anchoring on send/receive is unchanged | Architecture Patterns #3 (manual scrollHeight-diff anchor restore, Code Example B) + Common Pitfall #1 (the existing `useStickToBottom` hook will misfire on prepend unless fixed — this is required work, not optional) + Common Pitfall #4 (`overflow-anchor` Safari gap) |
| CLOAD-05 | The merged list never shows duplicate messages across optimistic sends, realtime inserts, and paginated fetches — deduplicated by message id and `clientRequestId` | Don't Hand-Roll #1 — `mergeChatMessage`/`compareChatMessages` in `packages/core/src/chat-state/selectors.ts` already implements exactly this contract; reuse it for pagination and backfill merges instead of writing new dedup logic |
| CLOAD-06 | History stays gap-free and correctly ordered across offline/reconnect — messages missed while disconnected are backfilled on resubscribe, and read-state behavior stays consistent with pagination | Common Pitfall #3 (Supabase Realtime has no built-in gap recovery — CITED) + Architecture Patterns #2 (bounded backfill with reset-to-window fallback) + Common Pitfall #2 (consolidate the 3 channels' redundant full-refetch-on-reconnect calls) + Common Pitfall #6 (read-state marker outside the loaded window) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted from `AGENTS.md` / `.claude/CLAUDE.md` (both authoritative, checked into the repo):

- **No `tailwind.config.js`** — Tailwind v4 is CSS-first; all new tokens/utilities (e.g. a skeleton-pulse animation) go into `apps/web/app/globals.css` under `@theme`/`@utility`, matching the existing `animate-fade-in`/`animate-message-in`/`animate-typing` pattern.
- **Spacing tokens only** — no one-off numeric spacing (`mt-6`, `gap-5`, etc.); use the named `--spacing-*` scale already defined.
- **One primary action per screen** — send stays the only `Button variant="primary"`; "load earlier" must be ghost/secondary or a silent sentinel, never a second primary.
- **56px minimum tap targets** for anything tappable (a manual "load earlier" button, a retry-after-failed-backfill control).
- **Progress/loading is visual, never a grade; no spinner storms** — skeleton placeholders sized like real content (zero CLS), per `docs/ui-ux-agent-guidelines.md` ("Use skeleton screens for predictable loading structures... Show empty loading screens with no status" is a Do-Not).
- **Copy never scolds; `--notice` tone, never red** for offline/reconnect/backfill-failed states.
- **`prefers-reduced-motion` respected** — already global in `globals.css` (no per-animation guard needed); instant (non-animated) scroll restoration is required by CONTEXT.md regardless.
- **Reuse `apps/web/components/ui/` and `apps/web/components/chat/` base components**, extend rather than hand-roll; use the `cn()` helper for conditional classes.
- **Named exports; `forwardRef` + `displayName` for focusable controls.**
- **API boundary**: "Use Supabase directly for simple authorized reads protected by RLS. Use Supabase Edge Functions for command-style writes and sensitive logic." Pagination and gap-backfill are reads — see Common Pitfall #9 for why they should NOT be added to the `chat-command` Edge Function's switch statement.
- **No Express/Node API service; pnpm only; `pnpm build`/`lint`/`typecheck` must pass before any commit.**
- **Every table gets RLS** — not directly triggered this phase (no new table expected), but any new index migration must not touch RLS policies, and any new read path must stay under the existing `"members read messages"` policy.
- **Coach-first, code-second** — not applicable; this phase changes loading mechanics only, no new learning feature.

## Summary

FISH's chat today has no pagination at all: the server-rendered initial load
(`SupabaseChatRepository.getAssignedConversation()` in `apps/web/lib/services/supabase/core.ts`)
selects the conversation's **entire** message history with no `LIMIT`, and the realtime
reconnect path (`refresh-conversation` in `supabase/functions/chat-command/index.ts`, invoked
from all three of the conversation's realtime channels on every `SUBSCRIBED` event including the
very first one) re-fetches that same **entire** history again on top of the SSR data. The
project's own dev seed (`scripts/seed.ts::seedCommunityStressMessages`) now puts roughly 928
messages into the single reachable conversation surface (the "general" community channel — see
Common Pitfall/Open Question on why the seeded direct 1-on-1 threads are currently unreachable
through the UI), which is exactly the volume that turns this into a real, measurable problem
rather than a theoretical one.

The good news: the pieces this phase needs are almost all already in the repo. The composite
index required for keyset pagination (`messages_conversation_created_id_idx` on
`(conversation_id, created_at, id)`) has existed since the original chat schema migration
(0010). The exact dedup/merge contract CLOAD-05 asks for — reconcile by `id`, incoming
`clientRequestId`, or `localRequestId`, then re-sort — already exists and is already correct
(`mergeChatMessage`/`compareChatMessages` in `packages/core/src/chat-state/selectors.ts`). The
portable chat-state core (reducer + selectors + JSON fixtures + a written protocol doc) already
has the exact extension seam this phase needs: new events, new fixture cases, same discipline as
Phase 9. What's missing is: (1) bounding the two existing full-history queries, (2) a new
"older page" fetch + merge path, (3) fixing the one existing scroll hook
(`useStickToBottom`) so it doesn't misread a prepend as a new message, and (4) replacing the
triplicated full-refetch-on-reconnect behavior with a bounded, coalesced backfill. None of this
requires a new npm dependency.

**Primary recommendation:** Bound the two existing full-history queries with keyset pagination
(reusing the existing composite index and the existing merge primitive), add a new portable
`hydrateWindow`/`olderPageLoaded`-style event pair (leaving the existing, fixture-locked
`hydrateConversation` event untouched), drive "load earlier" with a native `IntersectionObserver`
sentinel, and restore scroll position with the standard manual scrollHeight-diff technique (not
`overflow-anchor`, which Safari does not support at all). Defer virtualization; the bounded
window plus `content-visibility: auto` (Safari 18.1+ now supports it) should keep DOM size
manageable, with a documented threshold for revisiting react-virtuoso later if it isn't.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bounded initial message window fetch | Frontend Server (SSR) | Database/Storage | `getChatPageData()` → `getAssignedConversation()` is a Next.js Server Component data loader; the DB provides the indexed, RLS-scoped rows |
| Cursor-based "load earlier" fetch | Database/Storage | Browser/Client | The keyset predicate + index does the real work; the browser (or a thin Server Action) is just the invocation site |
| Realtime live-message merge | Browser/Client | Database/Storage | Subscription lifecycle and reducer merge are inherently client-side; Postgres/Realtime is the event source, filtered by RLS before it ever reaches the client |
| Reconnect gap-backfill orchestration | Browser/Client | Database/Storage | Detecting "I was disconnected, what did I miss" is a property of the client's own subscription lifecycle; the bounded catch-up query is served by the DB |
| Scroll-position anchor restore | Browser/Client | — | Pure DOM measurement (`scrollHeight`/`scrollTop`) local to the rendered viewport; no server involvement |
| IntersectionObserver sentinel / auto-load trigger | Browser/Client | — | Native browser API, DOM-local |
| Pagination cache (loaded window, cursors, hasMore, loading flags) | Browser/Client | — | CSTATE-03 explicitly assigns this to the web-only Zustand adapter, which wraps the portable reducer's output |
| Portable pagination events/reducer logic | Browser/Client (consumer) | — | Logically a framework-free shared module (`packages/core/src/chat-state`) consumed by the client tier this phase; future native tiers consume the same contract without importing web code |
| Reaction/sender-name enrichment for paginated pages | Frontend Server (SSR) / Browser (Server Action) | Database/Storage | Reuses the existing batched enrichment pattern already living in the SSR service layer and `actions.ts` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.110.0 pinned (2.110.2 latest on npm as of this research — trivial patch gap) [VERIFIED: apps/web/package.json, npm view] | PostgREST reads (keyset queries), Realtime channel subscriptions | Already the project's sole data/realtime client per AGENTS.md; no alternative needed |
| `zustand` | ^5.0.14 [VERIFIED: apps/web/package.json, npm view] | Web-only chat coordination/cache adapter (CSTATE-03) — extend with pagination/cursor/loading fields | Already the locked Phase 9 adapter; it wraps `reduceChatState()` output, so adding fields to the portable state shape is the only change needed here |
| `react` / `next` | 19.2.7 / 16.2.9 [VERIFIED: apps/web/package.json] | Component rendering, App Router SSR data loading | Existing project stack |
| Native `IntersectionObserver` | Browser built-in, no package | Scroll-up sentinel trigger for auto-load-older | Zero bundle cost; matches CONTEXT.md's explicit "no per-pixel scroll handler doing layout work" constraint; supported in all evergreen browsers since ~2019 [CITED: general web-platform baseline knowledge, not independently re-verified this session — treat browser-version specifics as MEDIUM] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS `content-visibility: auto` + `contain-intrinsic-size` | Browser built-in; Safari 18.1–26.3 full support, Chromium/Firefox full support [CITED: caniuse.com/css-content-visibility, web.dev/articles/content-visibility] | Lowers paint/layout cost of the accumulated off-screen history without a virtualization library | Apply once a loaded conversation regularly holds several hundred+ messages and profiling shows jank — see Common Pitfall #8 for the `contain-intrinsic-size` accuracy caveat before applying it broadly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled scroll math + bounded window (recommended default) | `react-virtuoso` (registry version 4.18.10, package created 2019-05-04) [existence/version VERIFIED via `npm view`; the `firstItemIndex` reverse-infinite-scroll technique CITED: virtuoso.dev official API reference + corroborated by multiple GitHub discussions in the maintainer's own repo and a production usage example in Stream Chat's open-source `stream-chat-react`] | Adds a real dependency and a bigger rendering-model change (virtualized DOM). Justified only once the bounded-window + `content-visibility` combo stops being enough — CONTEXT.md explicitly allows deferring this with a documented threshold (see Common Pitfall #8 / State of the Art) |
| `react-virtuoso` | `react-window` (registry version 2.2.7) [existence VERIFIED via `npm view`; comparison ASSUMED from WebSearch-aggregated community sources, not an official first-party doc] | Rejected as the primary pick if/when virtualization is adopted: FISH message bodies range from one-word replies to 3500+ character markdown essays (confirmed in `scripts/seed.ts`'s seeded stress data) — `react-window` requires callers to hand-measure variable item heights, which `react-virtuoso` does automatically |
| Hand-rolled scroll math / `react-virtuoso` | `@shadcn/react` `MessageScroller` primitive (registry version 0.2.1, package created **2026-06-26** [CITED: ui.shadcn.com/docs/changelog/2026-06-chat-components official changelog; existence/creation-date VERIFIED via `npm view`]) | A real, officially-announced headless primitive purpose-built for exactly this problem (its own description: "anchored turns, streamed replies, saved thread restore, prepended history, jump-to-message, scroll controls, and visibility tracking") and it explicitly supports Base UI, which FISH's `ScrollArea` already uses. **Not recommended this phase**: the package is under 3 weeks old at research time, with no production track record — too risky for a calm, reliability-first product. Worth re-evaluating in a future phase once it matures |

**Installation:** none required for the prescriptive path this phase — zero new npm packages.

**Version verification:** No new packages are being installed, so the standard `npm view <package> version` gate does not block this phase. The existing pinned versions above were confirmed current via direct `package.json` reads and `npm view` cross-checks during this research session (2026-07-09).

## Package Legitimacy Audit

> This phase's prescriptive path installs **no new packages**. The table below audits the
> deferred/alternative candidates surfaced in "Alternatives Considered" for the planner's future
> reference, in case a later phase (or this phase's discretion on virtualization) decides to
> adopt one of them.

`slopcheck` was not available in this research environment (`pip` itself is not installed on the
research host), so none of the candidates below can be marked `[VERIFIED: npm registry]` even
though their existence and versions were independently confirmed via `npm view` and, for two of
them, official first-party documentation. Per the graceful-degradation rule, they are tagged
`[ASSUMED]`/`[CITED]` as appropriate and none are being installed by this phase's plan.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `react-virtuoso` | npm | ~7 years (created 2019-05-04) | Not queried this session | github.com/petyosi/react-virtuoso | Not run (unavailable) | Not selected this phase — documented as the recommended future virtualization pick if the deferred threshold is crossed |
| `react-window` | npm | Mature, long-established | Not queried this session | (well-known Brian Vaughn / bvaughn maintained project) | Not run (unavailable) | Not selected this phase — considered and rejected in favor of `react-virtuoso` for this app's variable-height content |
| `@shadcn/react` | npm | **~2 weeks (created 2026-06-26)** | Not queried this session | github.com/shadcn-ui/ui | Not run (unavailable) | Not selected this phase — flagged `[SUS]`-equivalent by age alone; do not adopt without a fresh legitimacy pass and a maturity re-check in a future phase |

**Packages removed due to slopcheck `[SLOP]` verdict:** none — no packages were run through slopcheck (unavailable), and none are being installed.
**Packages flagged as suspicious `[SUS]`:** `@shadcn/react` — age-based caution only (real package, real vendor, but unproven); not being installed this phase so no `checkpoint:human-verify` task is needed now. If a future phase proposes installing it, gate that install behind `checkpoint:human-verify` and re-run the full Package Legitimacy Gate then.

## Architecture Patterns

### System Architecture Diagram

```
 Browser opens /channels/[id]                    Scroll up near top of list
          │                                                  │
          ▼                                                  ▼
 ┌────────────────────────┐                     ┌──────────────────────────┐
 │ SSR: getChatPageData()  │                     │ IntersectionObserver      │
 │  -> getAssignedConversation()                 │  sentinel fires            │
 │  bounded query:          │                     └──────────┬───────────────┘
 │  ORDER BY created_at DESC,│                                │
 │  id DESC LIMIT N+1,       │                                ▼
 │  reverse to ascending     │───► Postgres (RLS:   ┌──────────────────────────┐
 └───────────┬──────────────┘     is_conversation_  │ loadOlderMessages():      │
             │                    member) via        │ direct Supabase select,   │
             │ ClientChatData{                        │ WHERE conversation_id=?   │
             │  messages, hasMoreOlder,               │  AND (created_at,id) <    │
             │  oldestCursor }                        │  cursor, LIMIT N+1        │────► Postgres (same RLS,
             ▼                                        └──────────┬───────────────┘      messages_conversation_
 ┌────────────────────────┐                                      │                       created_id_idx)
 │ hydrateWindow (new       │                                      │ page of ≤N+1 rows
 │ portable event)          │◄─────────────────────────────────────┘
 │  -> reduceChatState()    │            olderPageLoaded (new portable event)
 │  (packages/core/src/     │             -> mergeChatMessage() loop, dedup by
 │  chat-state, framework-  │                id/clientRequestId, prepend + sort
 │  free)                   │             -> update cursor / hasMoreOlder
 └───────────┬──────────────┘             -> scrollHeight-diff anchor restore
             │                                (after DOM paints the new rows)
             ▼
 ┌────────────────────────┐
 │ Zustand store (web       │
 │ adapter, CSTATE-03) ──►  │
 │ ChatClient renders;      │
 │ useStickToBottom scrolls │
 │ to newest on first paint │
 └───────────┬──────────────┘
             │
             │            ┌─────────────────────────────────────────────────────────┐
             │            │ Realtime (parallel, always-on path)                       │
             │            │                                                            │
             └───────────►│ Supabase Realtime WS --INSERT/UPDATE--> onMessage callback │
                          │        │                                                    │
                          │        ▼                                                    │
                          │ mergeRemoteMessage (EXISTING event, unchanged)               │
                          │        │                                                    │
                          │        ▼                                                    │
                          │ reduceChatState() -> Zustand -> render                       │
                          │                                                            │
                          │ ── on dropped/restored subscription ──                       │
                          │        │                                                    │
                          │        ▼                                                    │
                          │ debounced/coalesced onReconnected (one call, not three)      │
                          │        │                                                    │
                          │        ▼                                                    │
                          │ gap-backfill: SELECT WHERE conversation_id=? AND             │
                          │   created_at > newestKnownCreatedAt LIMIT gapBound+1         │
                          │    │ within bound            │ exceeds bound                 │
                          │    ▼                          ▼                              │
                          │ merge each row via      reset: re-run the bounded-window     │
                          │ mergeRemoteMessage loop  fetch (same path as initial load)    │
                          └─────────────────────────────────────────────────────────┘
```

### Files touched (not a new module — this phase extends an existing route)
```
apps/web/lib/services/supabase/core.ts        # bound the SSR select; return hasMoreOlder/cursor
apps/web/lib/services/supabase/types.ts       # extend ClientChatData with pagination metadata
apps/web/app/(authenticated)/chat/actions.ts  # new direct-select action(s) for older-page + gap-backfill reads
apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts    # wire loadOlderMessages, expose hasMore/isLoadingOlder
apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts    # replace full refreshConversation() reconnect calls
apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts  # fix prepend-vs-append detection (Pitfall #1)
apps/web/app/(authenticated)/chat/hooks/                        # (new) use-load-older-messages.ts or similar — IO sentinel
apps/web/app/(authenticated)/chat/chat-client.tsx                # render sentinel/"load earlier" affordance + skeleton
apps/web/app/(authenticated)/chat/store/chat-store.ts            # expose new dispatch actions for the new events
apps/web/app/(authenticated)/chat/store/chat-selectors.ts        # selectors for hasMoreOlder/isLoadingOlder/cursor
packages/core/src/chat-state/types.ts          # extend ChatConversationState with pagination fields; new ChatEvent variants
packages/core/src/chat-state/reducer.ts        # new event handlers (additive, hydrateConversation untouched)
packages/core/src/chat-state/fixtures/chat-state-vectors.json  # new fixture cases (do not need to touch the existing 10)
packages/core/docs/chat-state-protocol.md      # document the new events/fields
supabase/migrations/                            # only if EXPLAIN shows the existing index insufficient (unlikely)
apps/web/vitest.setup.ts                        # add IntersectionObserver mock (Wave 0 gap)
```

### Pattern 1: Bounded Window + Keyset "Load Earlier" Pagination
**What:** Replace the two existing unbounded `select * from messages where conversation_id=... order by created_at, id` queries (SSR initial load and `refresh-conversation`) with a keyset query bounded by `LIMIT N+1`. Order **descending** for "give me the newest/oldest-before-cursor N", then reverse in application code back to the ascending order the reducer expects (it already sorts on `hydrateConversation`/merge, so a slightly-wrong order at the boundary self-heals, but sending pre-sorted data avoids an extra client-side sort pass on every page).
**When to use:** Initial window fetch, and every subsequent "load earlier" fetch.
**Example (PostgREST/`supabase-js`; composite cursor, MEDIUM confidence — see Open Question #1):**
```typescript
// Source: pattern confirmed via github.com/supabase/agent-skills (official Supabase repo,
// data-pagination.md: "(created_at, id) > ('2024-01-15 10:00:00', 12345)" row-wise comparison)
// and community-verified .or() composite syntax (github.com/orgs/supabase/discussions/21330,
// #3938). Verify the exact filter-string grammar against the installed supabase-js version
// (2.110.0) during implementation — the official docs page this session tried to fetch for a
// live code sample 404'd, so this is MEDIUM, not HIGH, confidence.
const pageSize = 40; // Claude's Discretion default — see rationale below

async function fetchOlderMessages(
  client: AppSupabaseClient,
  conversationId: string,
  cursor: { createdAt: string; id: string } | null
) {
  let query = client
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1); // fetch one extra row to know hasMore without a second round trip

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error || !data) return { messages: [], hasMoreOlder: false };

  const hasMoreOlder = data.length > pageSize;
  const page = (hasMoreOlder ? data.slice(0, pageSize) : data).reverse(); // back to ascending
  return { messages: page, hasMoreOlder };
}
```
**Batch size rationale (Claude's Discretion, `[ASSUMED]` — see Assumptions Log A1):** CONTEXT.md
expects 30–50. 40 sits in the middle, is a single reusable constant for both the initial window
and subsequent pages (simplest architecture), and — given FISH's grouped-bubble rendering and
56px-plus row heights — comfortably overfills any real viewport while staying well under
PostgREST's implicit page-size ceilings.

### Pattern 2: Reconnect Gap-Backfill with Bounded-Catch-Up-Then-Reset Fallback
**What:** On realtime reconnect, do NOT call the existing full-history `refresh-conversation`
action. Instead: fetch messages newer than the newest locally-known message, bounded by the same
kind of `LIMIT N+1` check. If the result is within bound, merge each row through the **existing**
`mergeRemoteMessage` event (no new reducer code needed for the merge itself — see Don't Hand-Roll
#1). If the result exceeds the bound (client was offline long enough to miss more than N+1
messages), abandon the catch-up and re-run the bounded-window fetch instead (Pattern 1's initial
load, applied again) — this is explicitly the locked fallback in CONTEXT.md.
**When to use:** Every realtime channel's `onReconnected` callback (`use-chat-realtime.ts`).
**Why this is safe to reuse `mergeRemoteMessage` for:** `mergeChatMessage`'s dedup key (`id` OR
`clientRequestId` OR `localRequestId`) already matches CLOAD-05's exact requirement, and it
already re-sorts the whole array on every merge — so out-of-order arrival, or a backfill batch
that partially overlaps what's already loaded, self-resolves without new logic.
**Consolidate the trigger, not just the query (see Common Pitfall #2):** today three separate
realtime channels (`messages`, `message_reads`, `message_reactions`) each independently call
`refreshConversation()` on their own reconnect. Route all three through one debounced/coalesced
backfill call instead of three concurrent full fetches.

### Pattern 3: Manual Scroll-Anchor Restore on Prepend
**What:** Before prepending older messages to the DOM, capture `scrollHeight` and `scrollTop` of
the scroll viewport. After the new rows paint, set
`scrollTop = newScrollHeight - previousScrollHeight + previousScrollTop`. This is the standard
technique confirmed across multiple independent sources, not project-specific folklore.
**When to use:** Every "load earlier" completion (sentinel-triggered or manual-button-triggered).
**Example (adapted to FISH's actual `viewportRef`/Base UI `ScrollArea` shape):**
```typescript
// Source: technique corroborated across tech.ikas.com, developer.vonage.com, and the
// TanStack Virtual maintainers' own discussion of the same problem (MEDIUM confidence —
// community-verified pattern, not a single canonical spec).
async function loadOlderAndRestoreScroll(viewport: HTMLDivElement, loadOlder: () => Promise<void>) {
  const previousScrollHeight = viewport.scrollHeight;
  const previousScrollTop = viewport.scrollTop;

  await loadOlder(); // dispatches olderPageLoaded -> reducer prepends + sorts -> React re-renders

  // Run after paint, not synchronously — the new rows must exist in the DOM first.
  requestAnimationFrame(() => {
    const newScrollHeight = viewport.scrollHeight;
    viewport.scrollTop = newScrollHeight - previousScrollHeight + previousScrollTop;
  });
}
```
**Required companion CSS (Common Pitfall #4):**
```css
/* apps/web/app/globals.css — on the chat log's ScrollArea viewport */
.chat-log-viewport {
  overflow-anchor: none; /* Chromium/Firefox auto-anchoring would otherwise fight this
                             manual restore; Safari has zero overflow-anchor support anyway
                             (caniuse.com/css-overflow-anchor), so the manual restore above
                             is the only mechanism that works everywhere. */
}
```

### Pattern 4: IntersectionObserver Sentinel for Auto-Load-Older
**What:** A near-zero-height sentinel element rendered above the oldest currently-loaded message;
observed via `IntersectionObserver`; its callback triggers `loadOlderMessages()` when it enters
the viewport (with a guard against re-firing while a load is already in flight or `hasMoreOlder`
is false).
**When to use:** Passive auto-load-older, alongside (not instead of) an explicit quiet "load
earlier" affordance for users who don't scroll fast enough to trigger it, or prefer a deliberate
tap (CONTEXT.md requires both).
**Example:**
```typescript
// Source: pattern synthesized from multiple corroborating community sources
// (dev.to/easyvipin, sitepoint.com/intersectionobserver-api, w3.org WAI-ARIA APG feed pattern
// for the accessibility notes below). MEDIUM confidence — no single canonical spec, but
// consistent across every source checked.
function useLoadOlderSentinel(
  sentinelRef: RefObject<HTMLElement>,
  { hasMoreOlder, isLoadingOlder, onLoadOlder }: {
    hasMoreOlder: boolean;
    isLoadingOlder: boolean;
    onLoadOlder: () => void;
  }
) {
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMoreOlder || isLoadingOlder) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadOlder();
      },
      { root: null, rootMargin: "200px 0px 0px 0px" } // fire slightly before it's visible
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [sentinelRef, hasMoreOlder, isLoadingOlder, onLoadOlder]);
}
```
**Accessibility notes (W3C WAI-ARIA APG, CITED — HIGH confidence, official source):**
- A screen-reader-usable equivalent (an explicit, focusable "Load earlier messages" button) must
  exist alongside the sentinel — CONTEXT.md already locks this in ("plus a calm 'load earlier'
  affordance"), and it happens to be the more broadly accessible pattern by default: it requires
  an explicit user action, so newly-inserted content can be announced predictably via
  `aria-live="polite"` rather than at an unpredictable scroll-triggered moment.
- Do not move focus when older messages load — focus should stay where the user left it (per
  W3C's feed pattern guidance and CONTEXT.md's own "no scroll jump" requirement, these two
  constraints reinforce each other).

### Pattern 5: Reuse the Existing Merge/Dedup Primitive for All Three Message Sources
**What:** Optimistic sends, realtime inserts, and paginated fetches must all funnel through
`mergeChatMessage`/`compareChatMessages` (`packages/core/src/chat-state/selectors.ts`) — never a
second, pagination-specific dedup implementation. See Don't Hand-Roll #1 for why this already
satisfies CLOAD-05 without new code.

### Pattern 6: Portable Protocol Extension Strategy — Additive, Not Mutating
**What:** Introduce new `ChatEvent` variants (naming anchored to CONTEXT.md's own suggested
names, adapted to the codebase's existing camelCase convention: `hydrateWindow`,
`olderMessagesRequested`, `olderPageLoaded`, `olderPageLoadFailed`) rather than changing the
existing `hydrateConversation` event's contract. Extend `ChatConversationState` with a new
`pagination` field (`oldestLoadedCursor`, `hasMoreOlder`, `isLoadingOlder`).
**Why additive, not mutating `hydrateConversation`:** see Common Pitfall #5 — the fixture file
asserts full-state equality per case; touching the existing event's contract means updating all
10 existing locked fixtures just to add a default value they don't otherwise care about. A new,
distinct event keeps those 10 cases completely untouched and adds new cases alongside them, per
CSTATE-04's own discipline ("same discipline as CSTATE-04").
**Where to document it:** `packages/core/docs/chat-state-protocol.md` gets a new `## Events`
table row per new event, exactly like the existing 11 rows; `09-NATIVE-CHAT-STATE-NOTES.md`'s
equivalent for this phase should record the same new event names so a future native
implementation stays in sync (docs-only this phase, per CONTEXT.md's deferred list).

### Anti-Patterns to Avoid
- **Routing pagination/backfill reads through the `chat-command` Edge Function:** it's the path
  of least resistance (the switch statement is already there and already returns
  reaction-enriched messages) but it drifts from AGENTS.md's explicit read/write boundary. See
  Common Pitfall #9.
- **Trusting Supabase Realtime to resume/replay missed events:** it does not, confirmed via
  Supabase's own troubleshooting docs. See Common Pitfall #3.
- **Relying on `overflow-anchor` alone:** zero support in Safari (macOS and iOS). See Common
  Pitfall #4.
- **Reworking `hydrateConversation`'s existing contract** instead of adding new events. See
  Common Pitfall #5.
- **A per-pixel `scroll` event handler doing layout reads** to detect "near top" — CONTEXT.md
  explicitly forbids this; use the sentinel (Pattern 4) instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dedup optimistic/realtime/paginated messages by id + `clientRequestId` | A new pagination-specific merge/dedup function | `mergeChatMessage`/`compareChatMessages` in `packages/core/src/chat-state/selectors.ts` | Already implements exactly the CLOAD-05 contract, already unit-tested, already fixture-covered; reusing it keeps the "ONE canonical merge path" CONTEXT.md requires |
| Reaction/sender-name enrichment per page of messages | A new enrichment query shape for paginated batches | The existing batched pattern (`addReactionAggregates`/`addSenderDisplayNames` in `actions.ts`; `enrichMessage` in `chat-command/index.ts`) | Already handles PostgREST's row-count caps via batching (1000-row pages, 25-id `.in()` chunks); proven in the currently-shipping edit/delete/reaction paths |
| Keyset cursor index | A new index migration | `messages_conversation_created_id_idx (conversation_id, created_at, id)`, already created in migration `0010_chat.sql` | Already covers `WHERE conversation_id = ? ORDER BY created_at, id` in both scan directions; Postgres supports efficient backward index scans, so a `DESC, DESC` keyset query uses the same index |
| Scroll-up detection | A `scroll` event handler doing per-pixel layout reads | `IntersectionObserver` (native browser API, Pattern 4) | CONTEXT.md explicitly forbids per-pixel scroll handlers doing layout work; `IntersectionObserver` is async/passive by design and has zero bundle cost |
| Reconnect "what did I miss" recovery | Trusting the realtime subscription itself to replay missed events | An app-level bounded backfill query keyed off the newest known message (Pattern 2) | Supabase's own docs confirm there is no built-in resume/replay mechanism — this must be implemented explicitly regardless of which project builds it |
| Variable-height list virtualization (only if/when the deferred threshold is crossed) | A hand-rolled windowing/recycling implementation | `react-virtuoso`'s `firstItemIndex` reverse-infinite-scroll pattern | Mature (created 2019), purpose-built for exactly this scenario (variable, unmeasured heights + prepend-without-jump); hand-rolled DOM windowing for variable-height content is a well-known multi-week trap that this project should not walk into for a "prefer the simplest architecture" phase |

**Key insight:** almost everything CLOAD-05 and CLOAD-02 ask for already exists and already
works correctly in `packages/core/src/chat-state`. The actual gap in this phase is almost
entirely about (a) bounding two queries that are currently unbounded, and (b) adding a genuinely
new "older page" capability — not about re-solving problems the portable core already solved for
optimistic sends and realtime merges.

## Common Pitfalls

### Pitfall 1: `useStickToBottom` will misread a prepend as "a new message arrived"
**What goes wrong:** `apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts` decides
whether to auto-scroll-to-bottom or show the "New messages" pill by comparing
`messages.length` to a `previousCountRef`. Prepending an older page **also** grows
`messages.length`, so loading history while scrolled up would incorrectly trigger a bottom-jump
or an irrelevant pill.
**Why it happens:** the length-comparison heuristic can't distinguish "grew at the tail" from
"grew at the head."
**How to avoid:** change the detection to key off the identity of the newest message (e.g.
compare the last element's `id`/`clientRequestId` before and after, not raw length) so a prepend
that doesn't change the newest message is inert to this hook. This is required work for CLOAD-04,
not optional polish — it will actively regress the existing "stick to bottom" UX the moment
pagination ships if left unfixed.
**Warning signs:** "load earlier" visually yanks the viewport to the bottom, or a spurious "New
messages" pill appears after scrolling up and loading history.
`[VERIFIED: apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts]`

### Pitfall 2: Reconnect handling is a full unbounded refetch today, and it's triplicated
**What goes wrong:** three separate realtime channels (`messages`, `message_reads`,
`message_reactions` — see `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts`) each
independently call `refreshConversation()` in their own `onReconnected` callback, **including on
the very first `SUBSCRIBED` event right after mount**, when SSR data is already fresh.
`refreshConversation()` calls the `chat-command` `refresh-conversation` action, which runs an
unbounded `select * from messages where conversation_id=... order by created_at, id` (no limit)
plus a full read-states fetch, enriching every returned message's reactions one-by-one. On a
single network blip, this can fire three times concurrently.
**Why it happens:** each `use-chat-*` realtime hook was written independently and each wires its
own "resync on reconnect" behavior against the same full-refetch action.
**How to avoid:** replace the reconnect behavior with the new bounded gap-backfill (Pattern 2),
and coalesce/debounce so near-simultaneous reconnects from the three channels trigger one
backfill call, not three. Consider explicitly skipping backfill on the very first post-mount
`SUBSCRIBED` event, since SSR data is already current at that point.
**Warning signs:** duplicate network requests firing together in the browser's Network tab right
after page load, or after toggling airplane mode/waking a laptop.
`[VERIFIED: apps/web/lib/services/supabase/core.ts, supabase/functions/chat-command/index.ts, apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts]`

### Pitfall 3: Supabase Realtime has no built-in gap recovery — confirmed, not assumed
**What goes wrong:** assuming the realtime subscription itself will "catch up" on events it
missed while disconnected.
**Why it happens:** Postgres Changes streams live WAL-derived events only; there is no
resume-since-timestamp primitive in the client SDK.
**How to avoid:** implement the bounded backfill explicitly (already CONTEXT.md's locked
decision) — this is confirmed as the officially correct approach, not just a project preference.
**Warning signs:** messages sent while a device was asleep/backgrounded never appear until a full
manual page reload.
`[CITED: supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794 — "The page does not address data backfilling or gap-recovery... Applications must independently implement their own strategy for detecting and backfilling lost data after reconnection."]`

### Pitfall 4: `overflow-anchor` cannot be the (sole) scroll-preservation mechanism
**What goes wrong:** relying on the browser's native scroll anchoring instead of (or in addition
to, without disabling it) the manual restore.
**Why it happens:** Chrome/Firefox/Edge support `overflow-anchor` and auto-adjust scroll offset
on prepend, which can make manual-anchor code look redundant during Chrome-only local
development — but Safari (macOS and iOS) ships **zero** support, so identical code silently
breaks for Safari users only.
**How to avoid:** implement the manual scrollHeight-diff restore (Pattern 3) as the actual
mechanism everywhere, and additionally set `overflow-anchor: none` on the scrollable message list
so Chromium/Firefox's native auto-adjustment doesn't also fire and fight the manual restore
(double-compensation risk called out explicitly in the source below).
**Warning signs:** scroll preservation works in local Chrome dev but jumps/jitters specifically
in Safari or during iOS testing.
`[CITED: developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_anchoring/Overview, caniuse.com/css-overflow-anchor — "apps that prepend new messages above the current view, such as Slack, Discord, and Telegram Web, can fight scroll anchoring... Setting overflow-anchor: none on the message list returns control to the script."]`

### Pitfall 5: Extending `ChatConversationState`'s shape silently breaks all 10 existing fixtures
**What goes wrong:** the fixture file (`chat-state-vectors.json`) asserts a full `expectedState`
object per case. Adding a new field to `ChatConversationState` (e.g. a `pagination` block) means
every one of the 10 existing cases' `expectedState` needs that field added with its default
value, or fixture replay fails on a structural mismatch — even for cases that never touch
pagination.
**Why it happens:** the fixture contract is a full-state equality check, not a partial/subset
match (confirmed by reading `chat-state-protocol.md`'s own description: "Fixtures include
expected output... A platform adapter is compatible only when it replays each fixture... and
matches either `expectedState`...").
**How to avoid:** prefer additive, new events (Pattern 6) over mutating `hydrateConversation`'s
existing contract, which avoids touching the 10 existing fixtures at all. If a `pagination` field
is still added to the shared state shape regardless (likely, since `ChatConversationState` is one
record per conversation), budget an explicit task to update all 10 existing fixtures' expected
output with the new field's default — don't let this be discovered mid-implementation as a wall
of unexplained fixture failures.
**Warning signs:** previously-passing fixture-replay tests fail after a state-shape change with
no logic change in the touched event handlers.
`[VERIFIED: packages/core/src/chat-state/fixtures/chat-state-vectors.json, packages/core/docs/chat-state-protocol.md]`

### Pitfall 6: Read-state markers can reference a message outside the currently-loaded window
**What goes wrong:** `getOutgoingMessageStatus`/`countUnreadMessages`
(`packages/core/src/chat-state/selectors.ts`) locate the read/delivered marker message by
searching the in-memory `messages` array (`messages.findIndex(...)`). Once the window is bounded
instead of full history, a marker id from an older, not-yet-loaded page won't be found, and
`isAtOrAfterMessage` returns `false` — the same value it returns when the marker genuinely hasn't
reached that message yet. These two very different situations ("not loaded" vs. "not yet read")
are currently indistinguishable.
**Why it happens:** today this always works because the entire history is always loaded;
pagination is precisely what breaks that assumption.
**How to avoid:** CONTEXT.md explicitly calls this out as an edge case that must stay correct —
treat "marker not found because its page isn't loaded" as a distinct, handled case, not silently
fall through to "not yet read/delivered."
**Warning signs:** read receipts or unread badges look wrong specifically for older messages once
"load earlier" ships, even though the underlying `message_reads` data is correct.
`[VERIFIED: packages/core/src/chat-state/selectors.ts — isAtOrAfterMessage, getOutgoingMessageStatus, countUnreadMessages]`

### Pitfall 7: Reply-to-message quote preview can silently disappear once history is windowed
**What goes wrong:** `chat-client.tsx` resolves a reply's quoted preview via
`messages.find((item) => item.id === message.replyToMessageId)` against the in-memory (now
windowed) array. If the replied-to message hasn't been paged in yet, the lookup returns `null`
and the quote silently doesn't render — today this only happens for genuinely deleted messages;
pagination turns "not yet loaded" into a common, everyday case for the same code path.
**Why it happens:** same root cause as Pitfall 6 — "not in `messages`" no longer implies "doesn't
exist" once windowing is introduced.
**How to avoid:** this is explicitly out of scope this phase (CONTEXT.md defers reply/jump
navigation enhancements). The honest, minimal bar is: confirm the current silent-fallback (no
quote shown, no crash) still degrades gracefully rather than regressing into an error, and treat
it as a documented known limitation rather than a bug to fix here.
**Warning signs:** replies to old, not-yet-loaded messages render with no quoted context.
`[VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx]`

### Pitfall 8: `content-visibility: auto` needs realistic per-message size estimates
**What goes wrong:** adopting `content-visibility: auto` as a cheap DOM-cost mitigation (instead
of full virtualization) is attractive, but FISH message bodies range from one word to 3500+
characters of rendered markdown (confirmed directly in `scripts/seed.ts`'s seeded stress
content). A single fixed `contain-intrinsic-size` placeholder height will be very wrong for many
messages, so scrolling near an off-screen-to-visible transition can still visibly shift layout —
exactly what CLOAD-04 forbids.
**Why it happens:** `content-visibility: auto` substitutes a placeholder box sized by
`contain-intrinsic-size` for unrendered content; the technique's entire value proposition depends
on that estimate being close to the real rendered height.
**How to avoid:** if adopted, bucket messages into a small number of height tiers (e.g.
short/medium/long, keyed off body length) for `contain-intrinsic-size` rather than one global
constant, and prefer applying it only to content already well outside the viewport, where a small
snap is less likely to be visible/felt.
**Warning signs:** subtle scroll jumps concentrated near long-form messages, worse than near short
ones.
`[MEDIUM: web.dev/articles/content-visibility, MDN content-visibility — mechanism is CITED; its
sufficiency for THIS app's actual content shape is First-Principles reasoning applied to
VERIFIED seed data, not independently benchmarked]`

### Pitfall 9: Pagination reads should not ride the `chat-command` write-oriented Edge Function
**What goes wrong:** it's tempting to add "load-older"/"gap-backfill" as new `action` cases
inside `chat-command`'s `Deno.serve` switch, mirroring how `refresh-messages`/
`refresh-conversation` already do this today.
**Why it happens:** it's the path of least resistance — the switch statement, the auth-header
plumbing, and the reaction-enrichment helper are all already there.
**How to avoid:** AGENTS.md's API boundary is explicit: "Use Supabase directly for simple
authorized reads protected by RLS. Use Supabase Edge Functions for command-style writes and
sensitive logic." New pagination reads should follow the `*ViaLocalRpc` pattern already present
in `actions.ts` (direct `.select()` calls) as the primary implementation, not something bolted
onto a write-oriented endpoint as a secondary case.
**Warning signs:** a new read-only `action` case appears in `chat-command`'s switch statement.
`[VERIFIED: AGENTS.md "API boundary" section; apps/web/app/(authenticated)/chat/actions.ts existing *ViaLocalRpc functions]`
Note: this is a recommendation, not a hard rule — the existing `refresh-messages`/
`refresh-conversation` actions already established the opposite precedent before this phase. See
Assumptions Log A5.

### Pitfall 10: `IntersectionObserver` has zero jsdom support — a test-infra gap, not a code gap
**What goes wrong:** assuming the existing test setup already covers this because
`ResizeObserver`/`matchMedia`/`scrollTo` are already stubbed in `apps/web/vitest.setup.ts`.
**Why it happens:** `IntersectionObserver` was never needed by the codebase before this phase
(zero existing usages found in a repo-wide grep), so no stub exists yet.
**How to avoid:** add an `IntersectionObserver` mock to `vitest.setup.ts` (Code Example D) before
writing the first sentinel-triggered "load older" test — this is a Wave 0 gap, not something to
discover mid-implementation.
**Warning signs:** `ReferenceError: IntersectionObserver is not defined` in a new component test.
`[VERIFIED: apps/web/vitest.setup.ts has no IntersectionObserver stub, confirmed via grep across apps/web]`

## Code Examples

Patterns A and B are shown inline under Architecture Patterns 1 and 3 above (keyset query shape,
scroll-anchor restore). The remaining two:

### C. IntersectionObserver sentinel hook
See Architecture Patterns → Pattern 4 for the full example.

### D. `IntersectionObserver` mock for `vitest.setup.ts`
```typescript
// Source: pattern synthesized from multiple corroborating sources (blog.itsjavi.com,
// aronschueler.de, jaketrent.com) — MEDIUM confidence, community-verified, not a single
// canonical spec. Add alongside the existing ResizeObserver stub in apps/web/vitest.setup.ts.
// A capture-and-trigger design (not a bare no-op) is needed so component tests can actually
// simulate "the sentinel scrolled into view" rather than only asserting the observer was
// constructed.
type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

const observedCallbacks = new Map<Element, IntersectionCallback>();

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class {
    constructor(private callback: IntersectionCallback) {}
    observe(target: Element) {
      observedCallbacks.set(target, this.callback);
    }
    unobserve(target: Element) {
      observedCallbacks.delete(target);
    }
    disconnect() {
      observedCallbacks.clear();
    }
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// Test helper (export from a shared test-utils file, not vitest.setup.ts itself):
export function triggerIntersection(target: Element, isIntersecting: boolean) {
  observedCallbacks.get(target)?.([{ isIntersecting, target } as IntersectionObserverEntry]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Full unbounded `select * from messages where conversation_id=... order by created_at, id` (today's SSR loader + reconnect refresh, both still live in this repo) | Bounded initial window + keyset "load earlier" pagination + bounded gap-backfill | This phase (CLOAD-01..06) | Removes an unbounded query that already returns ~928 rows in the seeded general channel and will only keep growing; also fixes the current "SSR loads everything, then the client's first `SUBSCRIBED` callback refetches everything again" double-fetch |
| Offset-based pagination (`.range(from, from+N)`) — already used internally for reaction/id batching (`fetchConversationReactions`, `addReactionAggregates`) | Keyset/cursor pagination specifically for the message timeline itself | Industry-standard practice for any live, growing feed/timeline; this project's message list had zero pagination of any kind before this phase | Avoids the classic "a new message pushes the offset window, page 2 duplicates page 1's last row" bug that offset pagination has on a live conversation — offset remains fine for the existing bounded id-set reaction/id batching loops, which aren't ordering a growing timeline |
| Manual reconnect = full-refetch, triplicated across 3 channels (current) | Manual reconnect = bounded "newer than newest known" backfill, coalesced across channels, reset-to-window fallback if the gap is too large | This phase | Matches Supabase's own documented guidance that the platform provides no automatic resume; removes redundant concurrent full-history fetches |
| `overflow-anchor` as the (implicit) scroll-stability mechanism | Manual scrollHeight-diff restore, with `overflow-anchor: none` set explicitly | This phase (a gap that would otherwise ship silently broken for Safari) | Cross-browser scroll-position preservation, including Safari/iOS |

**Deprecated/outdated:** none of the existing chat-state protocol (Phase 9's reducer/selectors/
events) is deprecated by this phase — it is extended, not replaced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Default page/batch size of 40 messages (single reusable constant for initial window, "load earlier" pages, and the gap-backfill bound) | Architecture Patterns #1 | Low — easily tunable constant; too small means choppier "load more" clicking, too large means slower initial paint. CONTEXT.md's own 30–50 range bounds the blast radius either way |
| A2 | Recommending a distinct new `hydrateWindow`-style event rather than extending `hydrateConversation`'s existing contract | Architecture Patterns #6, Common Pitfall #5 | Low-medium — this is my own architectural synthesis from reading the fixture file, not a locked decision. The planner may reasonably choose to extend `hydrateConversation` instead and budget the 10-fixture update cost; both are workable, but the additive path is strictly less risky |
| A3 | Gap-backfill bound reuses the same page-size constant as pagination page size | Architecture Patterns #2 | Low — a very chatty conversation reconnecting after a long offline period might reset-to-newest-window more eagerly than a larger, separately-tuned bound would, losing a small amount of "catch-up" history from view. This is an acceptable outcome per CONTEXT.md's own explicit fallback language, not a correctness bug |
| A4 | `content-visibility: auto` is recommended as the first-line DOM-cost mitigation before virtualization, and is expected to be "enough" at this app's current scale | Standard Stack, Common Pitfall #8 | Medium — if the general channel's full ~928-message history is regularly scrolled end-to-end by real users (not just QA), this may prove insufficient sooner than assumed, and `react-virtuoso` would need to land before the "documented threshold" the discretion note anticipates |
| A5 | Recommending pagination/backfill reads go through direct Supabase selects rather than the `chat-command` Edge Function | Common Pitfall #9 | Low-medium — reasoned from AGENTS.md's stated read/write boundary, but the EXISTING `refresh-messages`/`refresh-conversation` actions already set the opposite precedent (reads riding the Edge Function) before this phase. The planner may reasonably prioritize consistency with that existing pattern over strict boundary adherence for this narrow case |

## Open Questions

1. **Exact PostgREST `.or()` composite-cursor filter syntax against the pinned `@supabase/supabase-js` 2.110.0**
   - What we know: the row-wise tuple comparison shape `(created_at, id) > (X, Y)` is confirmed
     via Supabase's own official `agent-skills` repository; the `.or()` JS-client workaround
     (`created_at.lt.X,and(created_at.eq.X,id.lt.Y)`) is corroborated by multiple GitHub
     discussions but not by a single first-party Supabase docs code sample (the specific docs
     page this session tried to fetch for that returned a 404).
   - What's unclear: whether there's now a cleaner idiom in the current client version, or
     whether the `.or()` string-building approach remains the only option.
   - Recommendation: verify the exact filter-string syntax against the locally-running Supabase
     REST endpoint during implementation (a quick manual check, not a research-time blocker); if
     the JS query builder proves unable to express the composite predicate cleanly, fall back to
     a read-only `security definer` SQL function only as a last resort — attempt the direct
     `.select().or(...)` path first, per the AGENTS.md read boundary.

2. **Does pagination metadata (cursor, hasMore, isLoadingOlder) belong in the portable `ChatConversationState`, or purely in a web-only slice outside the fixture-tested reducer?**
   - What we know: CONTEXT.md's own directive text names portable event examples
     (`hydrate-window`, `older-page-loaded`, `gap-backfill`), implying the reducer should own this
     state — consistent with how `composer` and `realtime.status` already live inside
     `ChatConversationState` today.
   - What's unclear: no native (Android/iOS) implementer has weighed in on the specific cursor
     encoding yet, since native chat is documentation-only this phase.
   - Recommendation: keep it in the portable reducer (consistent with existing precedent and with
     CONTEXT.md's own event-name suggestions), and record any native-specific caveats in this
     phase's equivalent of `09-NATIVE-CHAT-STATE-NOTES.md`.

3. **Is the general/community channel truly the only practically-reachable conversation surface today, and should pagination logic assume that?**
   - What we know: `SupabaseChatRepository.getAssignedConversation()`
     (`apps/web/lib/services/supabase/core.ts`) always prefers the fixed demo-community
     conversation id when it exists in the database — which it always does after migration
     `0016_channels.sql` + `scripts/seed.ts` run — so the seeded direct 1-on-1 threads
     (~23 messages each, realistic coaching conversations) are currently unreachable through the
     UI. The route's own code comment confirms this is intentional: "Single-channel milestone:
     `[id]` is accepted for URL stability, but the only channel is `general`."
   - What's unclear: whether a future phase intends to re-enable direct 1-on-1 routing, and
     whether that matters for this phase's design.
   - Recommendation: implement pagination generically against `conversationId` (as the schema,
     RLS, and reducer already are) rather than hardcoding any general-channel-specific
     assumptions — it costs nothing extra and transparently supports direct conversations
     whenever they become reachable again. Use the general channel's real ~928-message volume for
     manual QA and fixture/stress scenarios, since it's the only surface with enough data to
     meaningfully exercise "load earlier" today.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/dev/scripts | ✓ | v25.9.0 | — |
| pnpm | package management, all scripts | ✓ | 11.7.0 (matches pinned `packageManager`) | — |
| Supabase CLI | local stack (`supabase start`), migrations | ✓ | 2.109.0 | — |
| Local Supabase stack (Postgres/Realtime/Edge Functions) | live pagination/realtime verification, `pnpm verify:chat-realtime`, Playwright e2e | Stopped at research time (checked via read-only `supabase status`; not started, per this phase's tooling constraints) | — | Run `pnpm supabase:start` (or `supabase start`) before executing/verifying this phase |
| `@playwright/test` | `apps/web/e2e/chat-send.spec.ts` | ✓ (package + local binary present) | 1.61.1 | Browser binaries not verified this session — run `pnpm --filter @fish/web exec playwright install` if e2e fails locally |
| `IntersectionObserver` (browser API) | Scroll-up sentinel (CLOAD-03) | ✓ native in all evergreen browsers | — | jsdom test environment needs an explicit mock — see Common Pitfall #10 / Code Example D |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**
- Local Supabase stack — start it on demand before execution/verification; this research session
  deliberately did not start it (tooling constraint: "do NOT start dev servers, do NOT run the
  app").
- Playwright browser binaries — install on demand if e2e fails locally.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 (unit/component, jsdom) + `@testing-library/jest-dom/vitest`, plus `@playwright/test` 1.61.1 (e2e), plus a third tier: a live-DB Node integration script (`scripts/verify-chat-realtime.ts`) |
| Config file | `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm --filter @fish/web test -- chat` (targets chat-related unit/component specs) |
| Full suite command | `pnpm --filter @fish/web test` (all vitest) → `pnpm verify:chat-realtime` (live integration, requires local Supabase running) → `pnpm --filter @fish/web e2e` (Playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLOAD-01 | Bounded initial window fetch, no full-history select | unit | `pnpm --filter @fish/web test -- core.test.ts` | ✅ Extend `apps/web/lib/services/supabase/core.test.ts` |
| CLOAD-02 | Realtime insert merges in place, no reload | unit + integration | `pnpm --filter @fish/web test -- chat-store.test.ts`; `pnpm verify:chat-realtime` | ✅ Existing — `apps/web/app/(authenticated)/chat/store/chat-store.test.ts`, `scripts/verify-chat-realtime.ts` |
| CLOAD-03 | Cursor pagination + sentinel auto-load + "load earlier" affordance | unit (fixture) + component | new fixture case in `chat-state-vectors.json`; `pnpm --filter @fish/web test -- chat-client.test.tsx` | ❌ Wave 0 — new fixture case; extend existing component test |
| CLOAD-04 | Scroll position preserved on prepend, no layout shift | component (jsdom `scrollTop`/`scrollHeight` assertions) | `pnpm --filter @fish/web test -- use-stick-to-bottom` | ❌ Wave 0 — no dedicated `use-stick-to-bottom.test.ts` exists today |
| CLOAD-05 | No duplicates across optimistic/realtime/paginated sources | unit (fixture) | new fixture case exercising all three merge paths in one sequence | ❌ Wave 0 — new fixture case, same file/discipline as the existing 10 |
| CLOAD-06 | Gap-free ordering across offline/reconnect; read-state consistent with pagination | integration + unit | extend `scripts/verify-chat-realtime.ts`'s "Reconnect backfill..." check; new unit test for the reset-to-newest-window fallback | ✅ Extend existing `scripts/verify-chat-realtime.ts` (currently asserts via the full-refresh action at the "Reconnect backfill finds messages sent while unsubscribed" check — this needs a paired bounded-backfill assertion) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @fish/web test -- <touched-spec>` and `pnpm typecheck`
- **Per wave merge:** `pnpm --filter @fish/web test` (full vitest suite) + `pnpm build` + `pnpm lint`
- **Phase gate:** full vitest suite green, `pnpm verify:chat-realtime` green against a freshly
  seeded local stack, Playwright `chat-send.spec.ts` green, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/vitest.setup.ts` — add an `IntersectionObserver` mock (Common Pitfall #10, Code
      Example D); a setup-file edit, not a new test file
- [ ] `apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts` — does not exist yet;
      needed to cover CLOAD-04's prepend-vs-append distinction in isolation (Pitfall #1) before
      wiring it into the full `chat-client.test.tsx`
- [ ] New fixture cases in `packages/core/src/chat-state/fixtures/chat-state-vectors.json` for
      the new pagination events — none exist yet; author alongside the reducer changes per
      CSTATE-04 discipline (Architecture Patterns #6)
- [ ] `apps/web/app/(authenticated)/chat/actions.test.ts` — the existing "refreshes a full
      conversation snapshot through the chat command Edge Function" test (around line 461) needs
      a paired case for the new bounded backfill path once introduced, so the old full-refresh
      behavior and the new bounded behavior are both covered intentionally rather than one
      silently regressing the other

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No new surface | Existing Supabase JWT session reused unchanged; realtime backfill reuses the existing `subscribeAfterAuth`-style wait-for-session pattern already in `realtime.ts` |
| V3 Session Management | No new surface | n/a — no session lifecycle change this phase |
| V4 Access Control | Yes | RLS policy `"members read messages"` (`private.is_conversation_member`) already scopes every row regardless of added `WHERE`/keyset filters or `LIMIT` — no new RPC or bypass needed for reads, consistent with the AGENTS.md read boundary |
| V5 Input Validation | Yes | Clamp any client-suppliable `limit`/page-size value to an application-code hard ceiling (e.g. never pass a raw client-desired value straight to PostgREST unclamped); validate cursor shape (well-formed timestamp + uuid) before using it in a query filter |
| V6 Cryptography | No new surface | n/a |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted large `limit` value on a keyset request | Denial of Service — low severity, since RLS still scopes the result to the caller's own conversation, so this is a self-resource-use issue, not a cross-tenant one | Application-code hard ceiling on page size (e.g. `Math.min(requested, 100)`), never pass a client-suppliable value straight through |
| Realtime channel authorized with a stale/expired token before a backfill fetch fires | Tampering / Information Disclosure — fails toward missing data, not toward leaking other users' data, since RLS applies per-request regardless | Reuse the existing `subscribeAfterAuth` wait-for-fresh-session pattern before any backfill fetch, matching the current message-subscribe flow in `realtime.ts` |
| Forged/malformed cursor value used to probe row boundaries | Information Disclosure | RLS enforcement is independent of the `WHERE`-clause shape — a forged cursor can only ever return rows already visible to that conversation member. Unaffected by this phase's changes, but worth an explicit regression assertion (extend `scripts/verify-rls.ts` or `scripts/verify-chat-realtime.ts` with a case proving a keyset-paginated fetch against a conversation the caller is NOT a member of returns zero rows) |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads (primary grounding source for this entire document): `apps/web/lib/services/supabase/core.ts`, `core.test.ts`, `types.ts`; `apps/web/lib/auth/server.ts`; `apps/web/app/(authenticated)/chat/*` (actions, hooks, store, chat-client, chat-state, realtime, presence); `packages/core/src/chat-state/*` (types, reducer, selectors, index, fixtures); `packages/core/docs/chat-state-protocol.md`; `supabase/migrations/0010_chat.sql`, `0011_messages_realtime.sql`, `0013_realtime_chat_features.sql`, `0014_demo_community_conversation.sql`, `0016_channels.sql`; `supabase/functions/chat-command/index.ts`, `send-message/index.ts`; `scripts/seed.ts`, `verify-chat-realtime.ts`; `apps/web/vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`; `apps/web/components/ui/scroll-area/scroll-area.tsx`; `apps/web/app/globals.css`; `.claude/skills/sketch-findings-fish/{SKILL.md,references/chat.md,references/states.md}`; `docs/ui-ux-agent-guidelines.md`; `AGENTS.md`, `.claude/CLAUDE.md`; `.planning/{REQUIREMENTS.md,STATE.md,config.json}`
- [Supabase Realtime — Handling Silent Disconnections in Backgrounded Applications](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) — confirms no built-in gap recovery
- [MDN — Overview of scroll anchoring](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_anchoring/Overview) and [MDN — overflow-anchor](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-anchor)
- [caniuse — CSS overflow-anchor](https://caniuse.com/css-overflow-anchor) and [caniuse — CSS content-visibility](https://caniuse.com/css-content-visibility)
- [web.dev — content-visibility: the new CSS property that boosts your rendering performance](https://web.dev/articles/content-visibility) and [MDN — content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)
- [Supabase official `agent-skills` repo — data-pagination.md](https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/references/data-pagination.md) — composite/row-wise keyset cursor query shape
- [virtuoso.dev — official API reference](https://virtuoso.dev/react-virtuoso/api-reference/virtuoso/) and [VirtuosoProps interface](https://virtuoso.dev/virtuoso-api/interfaces/VirtuosoProps/) — `firstItemIndex` prepend technique
- [ui.shadcn.com — June 2026 changelog: Components for Chat Interfaces](https://ui.shadcn.com/docs/changelog/2026-06-chat-components) — `@shadcn/react` MessageScroller (confirmed real, confirmed very new)
- [W3C WAI-ARIA APG — Infinite Scrolling Feed Example](https://www.w3.org/WAI/ARIA/apg/patterns/feed/examples/feed/) and [Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
- [Slack Developer Docs — conversations.history](https://docs.slack.dev/reference/methods/conversations.history/) and [Pagination](https://docs.slack.dev/apis/web-api/pagination/)
- `npm view` registry checks (this session) for `@supabase/supabase-js`, `zustand`, `react-virtuoso`, `react-window`, `@shadcn/react`

### Secondary (MEDIUM confidence)
- GitHub discussions in `petyosi/react-virtuoso`'s own repo (#1032, #1177, #248, #885) corroborating the `firstItemIndex` prepend technique, plus [GetStream/stream-chat-react commit dd53d5c](https://github.com/GetStream/stream-chat-react/commit/dd53d5c1fe2707d8807cfec341fbbdd612ff7cfd) as a real production usage example
- [GitHub — supabase/supabase Discussion #21330](https://github.com/orgs/supabase/discussions/21330) and [#3938](https://github.com/orgs/supabase/discussions/3938) — `.or()` composite-cursor JS-client syntax
- [tech.ikas.com — How to Keep Chat Scroll Stable While Loading Older Messages](https://tech.ikas.com/how-to-keep-chat-scroll-stable-while-loading-older-messages-8a2f0040aed7) and [developer.vonage.com — Chat Pagination with Infinite Scrolling](https://developer.vonage.com/en/blog/chat-pagination-with-infinite-scrolling-dr) — scrollHeight-diff restore technique, corroborated across multiple independent sources
- Multiple community sources on `IntersectionObserver` infinite-scroll patterns and jsdom mocking (blog.itsjavi.com, aronschueler.de, jaketrent.com, sitepoint.com, dev.to)
- Deque, GEL (BBC), and human-centred.nz articles on infinite-scroll/load-more accessibility trade-offs

### Tertiary (LOW confidence)
- Discord's precise "message chunking around an anchor" mechanism, as named in the phase directive's reference points — search returned general Discord Gateway/member-chunking and cache-management documentation, not a precise match to the specific "windowed history around an anchor" pattern described. Treated as general inspiration only (bounded local cache, update-from-live-events), not independently verified in detail.
- Telegram's windowed-history pattern, named as a reference point — not independently searched this session; treated as a named inspiration point from the phase directive only, not verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages needed for the prescriptive path; all existing pinned versions verified directly against `package.json` and cross-checked via `npm view`
- Architecture: HIGH — deeply grounded in direct reads of the actual current implementation (SSR loader, realtime hooks, reducer, fixtures, migrations, seed data), cross-verified against official Supabase docs and multiple independent community sources for every external technique recommended
- Pitfalls: HIGH — 8 of 10 pitfalls are directly verified against the current codebase (not inferred); the remaining 2 (`content-visibility` sizing, Edge Function boundary) are explicitly flagged MEDIUM/discretionary with reasoning shown

**Research date:** 2026-07-09
**Valid until:** ~2026-08-08 (30 days) for the stable patterns (keyset pagination, scroll anchoring, IntersectionObserver). Re-check sooner if reused: Supabase's Realtime Broadcast-vs-Postgres-Changes scaling guidance moves periodically, and `@shadcn/react`'s maturity status (2 weeks old at research time) will change quickly either direction.
