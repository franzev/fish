# Phase 10: Chat Message Loading Optimization - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Source:** Inline planning directive (user requirements passed to /gsd-plan-phase; treated as PRD express path)

<domain>
## Phase Boundary

Optimize how messages load in the existing FISH chat: fast initial conversation open (minimal
time-to-first-message), realtime updates that merge in place, cursor-based "load earlier" +
infinite scroll for older history, client-side caching that avoids redundant fetches, and a
jank-free experience (no layout shift, no scroll jumps, no duplicate messages) — hardened for
gaps, offline/reconnect, and ordering edge cases.

This phase changes **loading behavior and state architecture only**. It does NOT redesign the
chat UI, add client-facing choices, add new message features (search, attachments, editing), or
implement native Android/iOS clients. The visible chat stays the calm, assigned, monochrome
surface it is today — it just opens faster and scrolls deeper without jank.

**Caution for all agents:** the working tree has uncommitted chat changes (chat actions, hooks,
reducer/selectors, `chat-command` Edge Function, seed scripts) and STATE.md records a recent
quick task that seeded long-form community messages into a "general" channel. The docs may lag
the code. Read the CURRENT working tree as the source of truth for what the chat surface is
before proposing changes.
</domain>

<decisions>
## Implementation Decisions

### Data fetching strategy (locked)
- Initial load fetches only a bounded newest-messages window — never the full history. Exact
  batch size is research-tuned (expect the 30–50 range; must comfortably overfill one viewport).
- Older history uses **cursor-based (keyset) pagination**, not offset pagination — offsets skew
  when new messages arrive and get slower with depth. Cursor is derived from the stable message
  ordering already shipped in Phase 7 (creation time + id tiebreak, or the schema's equivalent).
- Paginated pages fetch `limit + 1` (or equivalent) to know whether more history exists without
  a second round trip; "has more" state is explicit, never guessed.
- Paginated older pages and the live head merge through ONE canonical merge path (the portable
  chat-state core), deduplicated by message id and `clientRequestId`.

### Real-time sync (locked)
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

### Caching & state management (locked)
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

### Performance techniques (locked intent, technique research-tuned)
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

### Edge cases (locked)
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

### UX / design constraints (locked — FISH design line)
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

### Verification constraints (locked)
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
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (client-facing screen — mandatory)
- `.claude/skills/sketch-findings-fish/SKILL.md` — settled design direction index
- `.claude/skills/sketch-findings-fish/references/chat.md` — chat/thread design decisions
- `.claude/skills/sketch-findings-fish/references/states.md` — loading/offline/lifecycle states (calm, never alarm)
- `docs/ui-ux-agent-guidelines.md` — consolidated UI/UX review reference (AGENTS.md requires reading before UI change)
- `AGENTS.md` — design rules #1–#6, spacing discipline, API boundary

### Chat state architecture (Phase 9 output — the foundation this phase extends)
- `packages/core/src/chat-state/` — portable reducer/selectors + fixtures (test-vector discipline)
- `packages/core/docs/chat-state-protocol.md` — cross-platform event/result contract; pagination events extend THIS document
- `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md` — Android/iOS mapping notes (keep contract implementable natively)
- `apps/web/app/(authenticated)/chat/` — live route: `actions.ts`, `hooks/use-chat-messages.ts`, `store/` (Zustand adapter), `chat-client.test.tsx`
- `apps/web/lib/services/supabase/core.ts` — Supabase service layer used by chat reads

### Persistence & realtime
- `supabase/functions/chat-command/index.ts` (and `supabase/functions/send-message/`) — command-write Edge Functions
- `supabase/migrations/` — chat schema: message ordering columns, indexes, RLS policies (Phase 7)
- `scripts/seed.ts` — seeded conversations/messages incl. long-form general-channel content (realistic volume for testing pagination)
</canonical_refs>

<specifics>
## Specific Ideas

- Reference points named in the directive: **Discord** (message chunking around an anchor,
  gateway-fed live appends), **Slack** (cursor pagination + cache-first channel switch),
  **Telegram** (windowed history around a focus point). Borrow the *patterns* — bounded
  chunks, cursor everything, cache-first re-entry, merge-not-refetch — not their scale
  machinery; FISH is one assigned conversation plus a small channel surface, so prefer the
  simplest architecture that hits the requirements.
- Deliverable style for PLAN.md files: structured architecture + step-by-step tasks, prose
  over code; code snippets only where a technique demands illustration (per directive).
- The directive explicitly demands: no full reloads on new messages, no duplicates during
  loading, scroll position preservation, and both a "load more" affordance AND auto-load on
  scroll-up. Treat each as a verifiable acceptance criterion, not a vibe.
</specifics>

<deferred>
## Deferred Ideas

- New typing indicators or read receipts as features (only *compatibility* with existing
  read-state is in scope) — future milestone per REQUIREMENTS.md.
- Message search, jump-to-date, jump-to-oldest navigation, pinned/starred messages.
- Attachments/voice-note loading strategy (media pagination is its own problem).
- Native Android/iOS implementations of the pagination contract (docs/fixtures only this phase).
- Conversation-LIST virtualization (only the message thread is in scope).
- Service-worker/offline persistence of message cache beyond in-session memory.
</deferred>

---

*Phase: 10-chat-message-loading-optimization*
*Context gathered: 2026-07-09 via inline planning directive (PRD express path analog)*
