# Phase 12: Cross-platform data, cache, and recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 12-cross-platform-data-cache-and-recovery
**Areas discussed:** Offline footprint, Cached-state truth, Recovery and fetching

---

## Offline footprint

### Persisted metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Browsed pages, bounded | Keep the newest 40 items plus older pages the user explicitly loaded, then evict the oldest metadata at a fixed cap. | ✓ |
| Newest 40 only | Keep the smallest predictable offline window; previously browsed older content disappears after restart. | |
| The agent decides | Leave the retention model to planning while preserving privacy and bounded storage. | |

**User's choice:** Browsed pages, bounded.
**Notes:** Persist only history the user actually reached; do not prefetch unvisited older pages for offline storage.

### Persisted visual content

| Option | Description | Selected |
|--------|-------------|----------|
| Displayed thumbnails only | Retain small thumbnails already shown under the account/conversation cache boundary; never persist delivery URLs or full previews. | ✓ |
| Metadata only | Use type placeholders offline for the smallest and most private footprint. | |
| All visible-window thumbnails | Cache thumbnails as soon as they enter the visible loading window, even if not displayed. | |

**User's choice:** Displayed thumbnails only.
**Notes:** Lookahead may fetch an ephemeral thumbnail, but it becomes persistent only after display.

### Cache expiry

| Option | Description | Selected |
|--------|-------------|----------|
| Size cap plus inactivity expiry | Remove least-recent thumbnails and older browsed pages when storage is full or inactive for a defined period; preserve newest active-conversation metadata. | ✓ |
| Size cap only | Keep cached private content indefinitely until space, deletion, or identity change forces removal. | |
| Inactivity expiry only | Clear old content on a schedule but allow active cache growth without a strict storage ceiling. | |

**User's choice:** Size cap plus inactivity expiry.
**Notes:** Exact byte/item/time thresholds remain a measurable planning decision.

### Backup and migration

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude all gallery cache | Keep metadata and thumbnails device-local and disposable; rebuild only after the verified account reconnects. | ✓ |
| Back up metadata only | Allow protected OS backup to carry item context while excluding thumbnails and temporary data. | |
| The agent decides | Let planning apply the strictest practical platform backup policy. | |

**User's choice:** Exclude all gallery cache.
**Notes:** A restored or new device does not inherit offline gallery state.

---

## Cached-state truth

### Offline with cache

| Option | Description | Selected |
|--------|-------------|----------|
| One persistent cached notice | Keep items normally browsable and mark the whole gallery as device-saved and possibly out of date. | ✓ |
| Mark every cached item | Put a stale indicator on each item for explicit provenance at the cost of visual noise. | |
| Replace content with offline state | Hide cached items until connectivity returns. | |

**User's choice:** One persistent cached notice.
**Notes:** Do not dim or badge every item.

### Partial cached history

| Option | Description | Selected |
|--------|-------------|----------|
| Explain at the cached boundary | Show retained items normally and explain at the end that more may be available online. | ✓ |
| Gallery-wide incomplete notice | Disclose missing older history before the user reaches it. | |
| Missing-page placeholders | Insert uncertain rows for absent pages. | |

**User's choice:** Explain at the cached boundary.
**Notes:** The retained cache must never imply that it represents the complete gallery.

### Offline without cache

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct unavailable state | Explain that shared content needs a connection; reserve empty for a server-confirmed empty gallery. | ✓ |
| Empty state with offline note | Reuse empty presentation while adding connectivity copy. | |
| Category placeholders | Preserve a gallery shell without evidence that categories contain content. | |

**User's choice:** Distinct unavailable state.
**Notes:** `empty` is authoritative; `unavailable` means the app cannot currently know.

### Refreshing cached content

| Option | Description | Selected |
|--------|-------------|----------|
| Keep cache visible throughout | Mark the gallery as updating and apply only accepted server/realtime results; retain stale cache after failure. | ✓ |
| Replace with loading | Remove cached content until the authoritative request completes. | |
| Hide after failure | Keep cache during loading, then remove it if refresh fails. | |

**User's choice:** Keep cache visible throughout.
**Notes:** Refresh failure must not turn useful cached context into a blank screen.

---

## Recovery and fetching

### Refresh triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Open, foreground, and reconnect | Refresh on gallery open, meaningful foreground return, and restored connectivity; coalesce overlapping triggers. | ✓ |
| Gallery open only | Refresh only on entry, leaving an already-open gallery stale after reconnect. | |
| Reconnect only | Depend on cache and realtime outside reconnect events. | |

**User's choice:** Open, foreground, and reconnect.
**Notes:** One bounded cycle owns overlapping lifecycle and realtime signals.

### Delivery and thumbnail window

| Option | Description | Selected |
|--------|-------------|----------|
| Visible plus one-screen lookahead | Fetch thumbnails just ahead of scrolling and full bytes only on selection. | ✓ |
| Strictly visible | Minimize data use but allow placeholder churn on each scroll. | |
| Entire newest page | Fetch all 40 initial thumbnails even if most are never inspected. | |

**User's choice:** Visible plus one-screen lookahead.
**Notes:** Every request batch remains at most 50 items; lookahead bytes remain ephemeral until display.

### Data-saving behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Respect the operating system | Allow visible thumbnails but pause lookahead under Android Data Saver or iOS Low Data Mode; add no setting. | ✓ |
| Wi-Fi-only lookahead | Disable lookahead on all cellular connections. | |
| Treat all networks equally | Keep lookahead enabled regardless of system data-saving state. | |

**User's choice:** Respect the operating system.
**Notes:** Full content is selection-only on every network.

### Automatic retry

| Option | Description | Selected |
|--------|-------------|----------|
| One retry per recovery cycle | Retry after a short backoff while still online; after another failure retain stale cache and show manual retry. | ✓ |
| Immediate retry | Make the second attempt without delay. | |
| Retry on every connectivity signal | Permit later callbacks to start repeated automatic attempts. | |

**User's choice:** One retry per recovery cycle.
**Notes:** No further automatic attempt until a genuinely new gallery-open, meaningful-foreground, or reconnect cycle.

---

## the agent's Discretion

- Exact cache item/byte limits and inactivity duration.
- Native persistence/protection details, cache keys, transaction structure, cleanup schedule, and backup-exclusion implementation.
- Meaningful-foreground threshold, retry backoff/jitter, trigger-coalescing window, and delivery-URL freshness margin.
- Test/vector organization that proves the locked behavior on both platforms.

## Deferred Ideas

None. The discussion stayed within Phase 12.
