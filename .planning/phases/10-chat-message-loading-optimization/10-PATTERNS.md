# Phase 10: Chat Message Loading Optimization - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 27 (24 modified / self-analog, 2 new files with sibling analogs, 1 conditional migration)
**Analogs found:** 27 / 27 (24 exact/self, 2 role-match for new files, 1 conditional analog for the maybe-migration)

**Source-of-truth caveat:** this phase's canonical files are already mid-edit in the working
tree (`git status` shows `actions.ts`, `use-chat-messages.ts`, `chat-store.test.ts`, `core.ts`,
`core.test.ts`, `reducer.ts`, `selectors.ts` as modified, uncommitted). Every excerpt below was
read directly from the **current on-disk working tree**, not git HEAD — this is the same
discipline CONTEXT.md requires of every downstream agent.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/lib/services/supabase/core.ts` | service/repository (SSR loader) | CRUD (read) | self — sibling method on `SupabaseChatRepository` | exact (self) |
| `apps/web/lib/services/supabase/types.ts` | model/types | transform | self — `ClientChatData` interface | exact (self) |
| `apps/web/lib/services/supabase/core.test.ts` | test | CRUD | self — existing `getAssignedConversation` tests | exact (self) |
| `apps/web/app/(authenticated)/chat/actions.ts` | route/server-action controller | request-response (read) | self — `refreshMessagesViaLocalRpc`/`refreshConversationViaLocalRpc` | exact (self) |
| `apps/web/app/(authenticated)/chat/actions.test.ts` | test | request-response | self — "refreshes a full conversation snapshot" test | exact (self) |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` | hook | CRUD/state-merge | self — `refreshMessages`/`refreshConversation` callbacks | exact (self) |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` | hook | event-driven (realtime) | self — per-channel `useEffect` + `onReconnected` pattern | exact (self) |
| `apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts` | hook | transform (DOM/scroll) | self — length-comparison effect to be replaced | exact (self) |
| `apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts` **(NEW)** | test | transform | no direct hook-unit-test precedent exists — nearest structural analog is `apps/web/tests/chat-state-fixtures.test.ts`'s vitest conventions | role-match (Wave 0 gap) |
| `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts` **(NEW, name at planner's discretion)** | hook | event-driven (IntersectionObserver) | `use-chat-realtime.ts` (subscription/cleanup lifecycle) + `use-stick-to-bottom.ts`'s `ResizeObserver` effect (lines 75-89) | role-match (no literal `IntersectionObserver` precedent in repo) |
| `apps/web/app/(authenticated)/chat/chat-client.tsx` | component (container) | request-response/render | self — `ScrollArea`/message-list block + existing `Alert`/pill patterns | exact (self) |
| `apps/web/app/(authenticated)/chat/chat-client.test.tsx` | test | render | self — existing describe blocks (e.g. "displays new messages received through realtime") | exact (self) |
| `apps/web/app/(authenticated)/chat/store/chat-store.ts` | store (Zustand adapter) | event-driven (dispatch) | self — existing dispatch-wrapper methods | exact (self) |
| `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` | test | event-driven | self — "chat store actions"/"chat store authority boundary" blocks | exact (self) |
| `apps/web/app/(authenticated)/chat/store/chat-selectors.ts` | store/selector | transform | self — narrow selector functions | exact (self) |
| `packages/core/src/chat-state/types.ts` | model/types (portable) | transform | self — `ChatEvent` discriminated union | exact (self) |
| `packages/core/src/chat-state/reducer.ts` | service (pure reducer) | event-driven | self — `mergeRemoteMessage`/`hydrateConversation` case handlers | exact (self) |
| `packages/core/src/chat-state/selectors.ts` | utility/selector | transform | self — `isAtOrAfterMessage`/`getOutgoingMessageStatus`/`countUnreadMessages` | exact (self) |
| `packages/core/src/chat-state/fixtures/chat-state-vectors.json` | test fixture data | batch | self — existing `hydrateConversation`/`mergeRemoteMessage` case shape | exact (self) |
| `apps/web/tests/chat-state-fixtures.test.ts` | test | batch | self — fixture-replay harness | exact (self) |
| `packages/core/docs/chat-state-protocol.md` | docs | n/a | self — existing `## Events` table row format | exact (self) |
| `.planning/phases/10-chat-message-loading-optimization/10-NATIVE-CHAT-STATE-NOTES.md` **(NEW, docs-only)** | docs | n/a | `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md` | exact (template) |
| `apps/web/vitest.setup.ts` | config/test-setup | n/a | self — existing `ResizeObserver` no-op stub | exact (self) |
| `supabase/migrations/00XX_*.sql` **(NEW, conditional)** | migration | CRUD (DDL) | `supabase/migrations/0010_chat.sql` (index creation) | conditional — only if `EXPLAIN` shows the existing index insufficient (unlikely per RESEARCH) |
| `supabase/functions/chat-command/index.ts` **(discretionary, likely NOT modified)** | Edge Function controller | request-response (writes + 2 legacy reads) | self — `refresh-messages`/`refresh-conversation` cases | anti-pattern reference, not a positive analog (see Pitfall #9 below) |
| `scripts/verify-chat-realtime.ts` | test (live integration script) | event-driven | self — "Reconnect backfill finds messages sent while unsubscribed" check | exact (self) |
| `apps/web/app/globals.css` | config/styles | n/a | self — `@keyframes message-in` / `@utility animate-message-in` pattern | exact (self) |

## Pattern Assignments

### A. SSR bounded initial window — `apps/web/lib/services/supabase/core.ts` + `types.ts` + `core.test.ts`

**Analog:** the file itself. `SupabaseChatRepository.getAssignedConversation()` (`core.ts:578-840`)
already assembles `ClientChatData` from seven sequential Supabase reads; the message query is the
one to bound.

**The exact unbounded query to replace** (`core.ts:706-714`):
```typescript
const { data: messages, error: messageError } = (await this.client
  .from("messages")
  .select("*")
  .eq("conversation_id", conversation.id)
  .order("created_at", { ascending: true })
  .order("id", { ascending: true })) as {
  data: MessageRow[] | null;
  error: SupabaseResponse<unknown>["error"];
};
```
No `.limit()` — confirmed directly, matches RESEARCH's claim. Every other read in this method
(`profiles`, `conversations`, `message_reads`) follows the identical
`(await this.client.from(...).select(...)... ) as { data: T[] | null; error: ... }` cast shape —
copy that shape for the bounded version, add `.order(..., {ascending:false}).order(...,
{ascending:false}).limit(pageSize + 1)` then reverse in application code (RESEARCH Pattern 1), and
route the same `mapSupabaseError({ operation: "chat.getAssignedConversation.messages", ... })`
error path (`core.ts:716-725`) on failure — every branch in this method uses that identical
`serviceFailure(mapSupabaseError(error, { code, fallbackMessage, operation, recoverable: true }))`
shape; new failure branches must match it verbatim, not invent a new error shape.

**Presence query already demonstrates a `.limit()` + `.order()` pattern in this same method**
(`core.ts:791-799`, the `presence_sessions` read) — closer precedent than searching elsewhere:
```typescript
const { data: presenceSessions, error: presenceError } = (await this.client
  .from("presence_sessions")
  .select("*")
  .eq("user_id", participant.id)
  .order("last_heartbeat_at", { ascending: false })
  .limit(20)) as { ... };
```

**Return shape to extend** — `ClientChatData` (`types.ts:150-169`) already uses the
optional-field style (`readStates?`, `participantPresence?`); add `hasMoreOlder`/cursor fields the
same way, not as a required field that forces updates to every other `ClientChatData` construction
site:
```typescript
export interface ClientChatData {
  conversationId: string;
  // ...unchanged...
  messages: ClientChatMessage[];
  readStates?: ClientChatReadState[];
  participantPresence?: ClientChatPresence;
}
```

**Factory/DI seam is unaffected** — `createSupabaseServices()` (`core.ts:963-973`) just wires the
repository class; no change needed there.

**Test analog** — `core.test.ts:179-266` (`getAssignedConversation` tests) already uses a
`createChainStub`/queued-table-response harness (`tables`/`queues` records keyed by table name,
consumed per `from()` call). A bounded-window test should seed more than `pageSize + 1` rows in
the `messages` queue and assert the returned `hasMoreOlder`/cursor, following the exact
`createSupabaseServices(client).database.chat.getAssignedConversation()` call shape already used
at line 203-205 and 252-254.

---

### B. Pagination + gap-backfill reads — `apps/web/app/(authenticated)/chat/actions.ts` + `actions.test.ts`

**Analog:** the file's own `refreshMessagesViaLocalRpc`/`refreshConversationViaLocalRpc` pair
(`actions.ts:487-581`) — this is the established "direct Supabase select, no Edge Function" read
pattern already living beside the Edge-Function-first `refreshMessagesAction`/
`refreshConversationAction` pair (`actions.ts:800-900`). New pagination/backfill functions should
mirror this pair's shape exactly:

```typescript
async function refreshConversationViaLocalRpc(
  values: z.infer<typeof refreshConversationSchema>
): Promise<{ status: "sent" | "notice"; values: unknown; notice?: string;
  messages?: ClientChatMessage[]; readStates?: ClientChatReadState[]; }> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: sendNotice };
  }

  const { data: messageRows, error: messageError } = await context.services.client
    .from("messages")
    .select("*")
    .eq("conversation_id", values.conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  // ...error branch identical shape to core.ts's mapSupabaseError, but action-local: mapChatErrorNotice(error, sendNotice)

  const messages = await addReactionAggregates(context, messageRows as MessageResponseRow[]);
  const messagesWithSenders = await addSenderDisplayNames(context, messages);
  return { status: "sent", values, messages: messagesWithSenders.map(toClientChatMessage), readStates: ... };
}
```

**IMPORTANT — this is the file's convention, not `ChatRepository`:** these two functions query
`context.services.client.from("messages")` directly; they do **not** go through the
`ChatRepository` interface/`SupabaseChatRepository` class in `core.ts`. The new "load older page"
and "gap backfill" functions should follow this same direct-client-query convention in
`actions.ts`, not add methods to `ChatRepository` — that interface currently has exactly one
method (`getAssignedConversation`) and extending it would ripple into `types.ts`'s
`ChatRepository` interface and every test double that implements it.

**Reaction/sender enrichment — reuse, do not reinvent** (`actions.ts:285-370`,
`addReactionAggregates`/`addSenderDisplayNames`): already batches `.in("message_id", batchIds)`
(25-id chunks) and pages `.range(from, from + reactionPageSize - 1)` (1000-row pages) to work
around PostgREST's row caps. Every new paginated/backfilled message batch must be piped through
both of these exactly as `refreshMessagesViaLocalRpc`/`refreshConversationViaLocalRpc` already do
— do not write a second enrichment query shape (Don't-Hand-Roll, RESEARCH table row 2).

**Public action wrapper shape** (`actions.ts:800-846`, `refreshMessagesAction`): parse with `zod`
`.safeParse()` → `getAccessToken()` → `postEdgeFunction("chat-command", ...)` → on no-response or
`isLocalEdgeUnavailable(response)`, fall back to the `*ViaLocalRpc` function. New pagination/
backfill actions can skip the Edge-Function-first half of this chain entirely (Pitfall #9 below)
and call the local-rpc-style function directly — still export it as an `async function
xAction(input: unknown): Promise<...>` with the same `{status: "sent"|"notice", values, notice?}`
envelope shape every other action in this file returns, so `use-chat-messages.ts` callers can
treat it uniformly.

**Test analog** — `actions.test.ts:461-509` ("refreshes a full conversation snapshot through the
chat command Edge Function") is the direct analog for a new "loads an older page" /
"backfills after reconnect" test: `mockSignedIn()` → `fetchMock.mockResolvedValueOnce({ ok: true,
json: async () => ({...}) })` → call the action → assert `result.status`/`result.messages` →
assert `fetchMock` was called with the exact JSON body. If the new action bypasses
`chat-command` per Pitfall #9, the fetch-mock assertion is replaced by asserting against the
Supabase client stub instead (same stub style as `core.test.ts`'s `createChainStub`).

---

### C. `use-chat-messages.ts` — wiring `loadOlderMessages`/backfill into the hook

**Analog:** the file itself (231 lines, read in full). `refreshMessages`/`refreshConversation`
(`use-chat-messages.ts:142-222`) are the two existing async callbacks that call an injected
Server Action, then loop `dispatchChatEvent({ type: "mergeRemoteMessage", message })` for every
returned row:
```typescript
const result = await refreshConversationAction({ conversationId: chat.conversationId }).catch(() => null);
if (result?.status !== "sent") return;
if (result.messages) {
  for (const message of result.messages) {
    dispatchChatEvent({ type: "mergeRemoteMessage", message });
  }
}
```
A new `loadOlderMessages`/`applyGapBackfill` callback should follow this exact shape but dispatch
the **new** portable event (`olderPageLoaded`/`gapBackfillApplied`, see Section I) instead of
reusing `mergeRemoteMessage` for the paginated-page case (gap-backfill rows, by contrast, SHOULD
reuse `mergeRemoteMessage` verbatim per RESEARCH Pattern 2 — same merge primitive, no new event
needed for that path). `refreshMessagesActionState`/`RefreshConversationActionState` interfaces
(`use-chat-messages.ts:29-38`) are the prop-typing precedent for a new
`LoadOlderMessagesActionState` interface.

**Cooldown/in-flight-guard precedent** — `refreshMessages`'s `refreshingMessageIdsRef` +
`lastMessageRefreshAtRef` + `refreshMessageCooldownMs` guard (`use-chat-messages.ts:40,
142-165`) is the existing "don't double-fire the same request" idiom; the new hook's "don't
re-trigger while a page load is in flight" guard (`isLoadingOlder`) should follow the same
ref-based guard shape rather than introducing a different debouncing mechanism.

---

### D. `use-chat-realtime.ts` — consolidating triplicated reconnect refetches

**Analog:** the file itself — and this file is where Pitfall #2's "triplicated full-refetch"
claim is directly verifiable. Three separate `useEffect` blocks each independently call
`refreshConversation()` on their own channel's connect/reconnect callback:
```typescript
// messages channel (lines 43-61)
return subscribeToConversationMessages(chat.conversationId,
  (message) => { dispatchChatEvent({ type: "mergeRemoteMessage", message }); },
  () => { setRealtimeStatus(chat.conversationId, "connected"); void refreshConversation(); }
);
// read-states channel (lines 63-78)
return subscribeToConversationReadStates(chat.conversationId,
  (readState) => { ...; mergeReadState(readState); },
  () => { void refreshConversation(); }
);
// reaction-changes channel (lines 80-90)
return subscribeToConversationReactionChanges(chat.conversationId,
  (messageId) => { void refreshMessages([messageId]); },
  () => { void refreshConversation(); }
);
```
All three `onReconnected` callbacks — including the messages channel's, which fires on the very
first post-mount `SUBSCRIBED` event when SSR data is already fresh — call the SAME
`refreshConversation()` prop. Per RESEARCH Pattern 2, replace this prop's underlying
implementation (in `use-chat-messages.ts`, Section C) with the bounded gap-backfill, and add a
debounce/coalesce guard (e.g. a shared `useRef<Promise<...> | null>` "already backfilling"
lock) so near-simultaneous reconnects across these three effects trigger one backfill call, not
three — the guard should live in this hook (it owns all three subscriptions) rather than being
re-implemented per channel. The `typingSubscriptionRef`/cleanup pattern at lines 92-125 is the
existing precedent for a ref-guarded "only one in flight" idiom in this same file if a
`Promise`-based lock feels heavier than needed.

---

### E. `use-stick-to-bottom.ts` — prepend-vs-append fix + new unit test

**Analog:** the file itself (110 lines, read in full) — and the bug is directly visible, not
inferred. The "new message" detection (`use-stick-to-bottom.ts:93-107`):
```typescript
useEffect(() => {
  const previousCount = previousCountRef.current;
  previousCountRef.current = messages.length;
  if (messages.length <= previousCount) return;

  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.senderId === currentUserId || isNearBottomRef.current) {
    scrollToBottom();
    return;
  }
  setShowNewMessages(true);
}, [messages, currentUserId, scrollToBottom]);
```
compares raw `messages.length` — a prepended older page grows this identically to an appended
live message, so this must change to compare the **identity of the newest message**
(`messages[messages.length - 1]?.id` before vs. after) rather than length, exactly as RESEARCH
Pitfall #1 specifies. The `ResizeObserver`-based re-pin effect (`use-stick-to-bottom.ts:75-89`) is
unaffected (it only re-pins while already `isNearBottomRef.current`) and is the closest
in-file precedent for the new sentinel hook's observer lifecycle (Section F).

**New test file** — no existing hook has an isolated `*.test.ts` in `hooks/`; every hook's
behavior today is exercised indirectly through `chat-client.test.tsx`. The nearest structural
analog for vitest conventions (not hook-testing conventions) is
`apps/web/tests/chat-state-fixtures.test.ts`'s plain `describe`/`it`/`expect` shape (no React
Testing Library needed there). For `use-stick-to-bottom.test.ts`, use `@testing-library/react`'s
`renderHook` (already available via the project's `@testing-library/jest-dom/vitest` setup in
`vitest.setup.ts:1`) against a minimal `ref.current` DOM stub, asserting `scrollTop`/`scrollHeight`
math the same way RESEARCH's Phase-Requirements → Test Map table specifies for CLOAD-04.

---

### F. New sentinel hook — `use-load-older-messages.ts`

**Analog:** no literal `IntersectionObserver` precedent exists anywhere in the repo (RESEARCH
Pitfall #10, independently re-confirmed this session — no matches for `IntersectionObserver` or
`skeleton` repo-wide). Borrow **structure**, not a literal pattern, from two files:
- `use-chat-realtime.ts`'s effect shape (create subscription in `useEffect`, store in a `useRef`,
  clean up via the returned function; guard conditions before subscribing) — lines 43-61, 92-125.
- `use-stick-to-bottom.ts`'s `ResizeObserver` effect (`use-stick-to-bottom.ts:75-89`) as the
  closest "construct a browser Observer, `.observe(node)`, return `() => observer.disconnect()`"
  shape already in this codebase:
```typescript
useEffect(() => {
  const viewport = viewportRef.current;
  const content = viewport?.firstElementChild;
  if (!viewport || !content) return;
  const observer = new ResizeObserver(() => { /* ... */ });
  observer.observe(content);
  return () => observer.disconnect();
}, []);
```
RESEARCH's own Code Example C (`IntersectionObserver` sentinel hook, full listing in
`10-RESEARCH.md` under Architecture Pattern 4) is the concrete implementation to adapt into this
shape — guard on `hasMoreOlder`/`isLoadingOlder` before observing, exactly like this
`ResizeObserver` effect guards on `viewport`/`content` existing.

---

### G. `chat-client.tsx` — sentinel + "load earlier" affordance + notice/skeleton slotting

**Analog:** the file itself. The message-list render block (`chat-client.tsx:226-265`):
```tsx
<ScrollArea className="flex-1" viewportRef={viewportRef} viewportClassName="px-md py-md">
  <div role="log" aria-label={isCommunity ? "Community messages" : "Conversation messages"}
       className="flex min-h-full flex-col">
    {filteredMessages.length === 0 && !participantTyping ? (
      <div className="flex flex-1 items-center justify-center text-center text-copy text-body">
        {/* empty-state copy */}
      </div>
    ) : (
      <ol className="flex flex-col">
        {filteredMessages.map((message, index) => { /* bubble rendering */ })}
      </ol>
    )}
  </div>
</ScrollArea>
```
The sentinel element and/or a quiet "Load earlier" `Button` belong **above** the `<ol>`, inside
the same `role="log"` container, before the first rendered message — matching CONTEXT.md's
requirement for both an automatic sentinel AND an explicit affordance (RESEARCH Pattern 4's
accessibility note: the explicit button must exist alongside the sentinel, not instead of it).

**Two existing conditional-render idioms in this same file are the exact patterns to copy for
the new loading/notice states**, not new ones to invent:
- The floating "New messages" pill (`chat-client.tsx:~510-520`, driven by `showNewMessages` from
  `useStickToBottom`) — `absolute inset-x-0 bottom-sm ... rounded-pill border border-border
  bg-surface ... shadow-popover` — same positioning idiom for a "Reconnecting…" quiet-tone pill if
  one is added.
- The notice banner (`chat-client.tsx:523-527`):
  ```tsx
  {notice && (
    <Alert tone="notice" className="mx-md mb-xs">{notice}</Alert>
  )}
  ```
  This is the exact pattern for the offline/gap-backfill-failed banner — reuse `Alert
  tone="notice"` verbatim (never a new color/tone), per `alert.tsx`'s own tone system
  (`apps/web/components/ui/alert/alert.tsx:11-24`, `notice` is the only monochrome tier).

**"Load earlier" button** — use `Button variant="secondary"` (or `"ghost"`) from
`apps/web/components/ui/button/button.tsx`; it already has a built-in `loading` prop that dims and
overlays a spinner **without resizing the button** (`button.tsx:104-113`, `loading` renders an
absolutely-positioned overlay over a width-preserving hidden label) — this satisfies the "loading
affordance reserves its space" rule for the manual-tap case for free. Never `variant="primary"` —
send stays the only primary action on the screen (AGENTS.md rule #1).

---

### H. Zustand store + selectors — `store/chat-store.ts` + `store/chat-selectors.ts`

**Analog:** the file itself. Every existing store action is a thin dispatch wrapper
(`chat-store.ts:149-166`):
```typescript
mergeRemoteMessage: (message, localRequestId) => {
  dispatchChatEvent({ type: "mergeRemoteMessage", message, localRequestId });
},
mergeReadState: (conversationId, readState) => {
  dispatchChatEvent({ type: "mergeReadState", conversationId, readState });
},
```
New store methods (`loadOlderMessages`/`applyGapBackfill`/whatever name) should follow this exact
one-line dispatch-wrapper shape, added to both the `ChatStoreState` interface
(`chat-store.ts:14-57`) and the `createChatStoreState()` return object
(`chat-store.ts:106-179`). If a new method needs extra bookkeeping beyond a plain dispatch (e.g.
tracking `isLoadingOlder` outside the portable reducer), `hydrateConversation`'s richer
implementation (`chat-store.ts:110-134`, which also updates `hydrationKeys` alongside
`conversations`) is the precedent for a store method that touches more than one state slice in one
`set()` call.

**Selectors** — `chat-selectors.ts` (65 lines, read in full) is uniformly narrow single-purpose
functions returning a referentially-stable empty fallback for SSR safety
(`chat-selectors.ts:19-20`, `emptyMessages`/`emptyReadStates` module-level constants — required
because "Selectors run as `useSyncExternalStore` snapshots (zustand v5): fallbacks must be
referentially stable or React's `getServerSnapshot` loop guard fires on SSR" per the file's own
comment at line 17-18). New selectors (`selectHasMoreOlderForConversation`,
`selectIsLoadingOlderForConversation`, `selectOldestCursorForConversation`) must follow this exact
shape, including a module-level stable fallback if the return type is an object/array:
```typescript
export function selectRealtimeStatusForConversation(
  state: Pick<ChatStoreState, "conversations">,
  conversationId: ChatConversationId
): RealtimeConnectionState {
  return selectConversationState(state, conversationId)?.realtime.status ?? "idle";
}
```

**Web-only boundary test** — `chat-store.test.ts`'s "chat store authority boundary" describe block
(lines 54-89, "keeps Zustand web-only and reducer-backed" / "does not expose auth, role,
assignment, service-role, or Supabase authority fields") is the CSTATE-03 conformance test; any
new pagination field added to the store must still pass this boundary check — extend it with an
assertion that pagination fields (`hasMoreOlder`, cursor, `isLoadingOlder`) are plain
JSON-serializable client-cache values, never auth/permission data.

---

### I. Portable chat-state core — additive events (`types.ts`, `reducer.ts`, `selectors.ts`, fixtures, docs)

**Analog:** the files themselves — this is the CSTATE-04-discipline extension seam RESEARCH
Pattern 6 describes, and every piece needed to copy is already in the same three files.

**`packages/core/src/chat-state/types.ts`** — `ChatEvent` is a flat discriminated union
(`types.ts:67-122`); add new variants the same way each existing one is shaped (`type` literal +
whatever payload it needs):
```typescript
| {
    type: "mergeRemoteMessage";
    message: ChatMessageState;
    localRequestId?: string;
  }
```
`ChatConversationState` (`types.ts:53-61`) is where a new `pagination` field would go, alongside
the existing `composer`/`realtime` sub-objects — same nesting convention.

**`packages/core/src/chat-state/reducer.ts`** — every `case` in the `reduceChatState` switch
(`reducer.ts:36-131`) either calls `updateConversation(state, conversationId, (conversation) =>
({...conversation, ...patch}))` for a simple field update, or (for message-touching events) the
shared `mergeMessage()` helper (`reducer.ts:133-153`) which itself calls `mergeChatMessage()` from
`selectors.ts`. A new `olderPageLoaded` case should follow the `mergeRemoteMessage` case's shape
(`reducer.ts:72-77`) for merging returned rows, and a `hydrateWindow` case should follow
`hydrateConversation`'s shape (`reducer.ts:38-46`) for the initial-window replace. New default
state fields belong in `getConversation()`'s fallback object (`reducer.ts:210-223`, where
`composer`/`realtime` defaults already live) so every conversation gets a well-formed `pagination`
default without a null-check at every call site.

**`packages/core/src/chat-state/selectors.ts`** — the merge/dedup primitive to reuse everywhere
(never reimplement, per Don't-Hand-Roll):
```typescript
export function mergeChatMessage<T extends ChatMessageState>(
  current: T[], incoming: T, localRequestId = incoming.clientRequestId
): T[] {
  const existingIndex = current.findIndex((message) =>
    message.id === incoming.id ||
    message.clientRequestId === incoming.clientRequestId ||
    message.clientRequestId === localRequestId);
  if (existingIndex === -1) return [...current, incoming].sort(compareChatMessages);
  // ...reconcile + re-sort...
}
```
**Pitfall #6's fix lands here**: `isAtOrAfterMessage` (`selectors.ts:115-128`) currently returns
`false` both when a marker message genuinely hasn't been reached AND when the marker id simply
isn't in the (now-windowed) `messages` array — these must become distinguishable. The function
signature and its two callers (`getOutgoingMessageStatus` at 130-156, `countUnreadMessages` at
158-172) are the exact three functions to touch; `apps/web/app/(authenticated)/chat/hooks/
use-chat-read-state.ts` (not in RESEARCH's explicit file list, but the direct consumer of
`countUnreadMessages` at its own line 6/92) is worth a read-only check once this selector's
contract changes, even though it isn't itself a required edit.

**Fixtures** — `chat-state-vectors.json` case shape (lines 1-90, the `hydrateConversation` case)
is `{ name, initialState, events, expectedState }` (or `expectedSelectors` for selector-only
cases, per `chat-state-protocol.md:83-89`). Append new cases; never edit the 10 existing ones
(Pitfall #5).

**CRITICAL linkage the fixture-JSON edit alone will NOT satisfy** —
`apps/web/tests/chat-state-fixtures.test.ts:141-152` hardcodes the full list of expected fixture
case names as an exact-array assertion:
```typescript
expect(cases.map((item) => item.name)).toEqual([
  "hydrateConversation", "sendOptimisticMessage", "confirmSentMessage", "markMessageFailed",
  "mergeRemoteMessage", "duplicateClientRequestIdReconciliation", "mergeReadState",
  "unreadCount", "deletedMessageSnippet", "replyPreview",
]);
```
Adding new fixture cases to the JSON **without** adding their names to this array will fail this
test even though the reducer/fixture logic itself is correct — this is a second, distinct trap
beyond Pitfall #5's "full-state-equality" concern, specific to this web-side consumer test. Budget
an explicit task for it.

**`packages/core/docs/chat-state-protocol.md`** — `## Events` table row format
(`chat-state-protocol.md:41-53`, one `| Event | Required behavior |` row per event) and the
"current fixture case names" bullet list (lines 96-107) both need a new line per new
event/fixture — same file, same day this phase's reducer work happens, not a follow-up.

**`.planning/phases/10-.../10-NATIVE-CHAT-STATE-NOTES.md`** — full-file template match against
`09-NATIVE-CHAT-STATE-NOTES.md` (168 lines, read in full): "Scope Boundary" section (lines 14-18,
no native production chat screens touched), "Shared Contract Inputs" bullet list (lines 34-50,
needs the new event names appended), "Selector Parity" list (lines 142-155, needs a new bullet for
whatever pagination-adjacent selector behavior is added), "Delivery Notes" closing section
(160-167). Copy this file's structure and Kotlin/Swift sketch style; do not invent a new doc shape.

---

### J. Test infrastructure — `vitest.setup.ts` + fixture-consumer wiring

**Analog:** the file itself (40 lines, read in full). The existing no-op-stub idiom
(`vitest.setup.ts:6-12`):
```typescript
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
```
is the shape to copy for the new `IntersectionObserver` mock (RESEARCH Code Example D provides the
capture-and-trigger version needed so component tests can actually simulate "the sentinel scrolled
into view", not just assert construction — a bare no-op like the `ResizeObserver` stub above is
insufficient here because tests need to fire `isIntersecting: true`).

---

### K. `scripts/verify-chat-realtime.ts` — reconnect backfill assertion to extend

**Analog:** the file itself. The existing check (`verify-chat-realtime.ts:653-693`, "Reconnect
backfill finds messages sent while unsubscribed") already: closes the client's realtime
collector, sends a message while "offline," re-opens a collector, calls
`chatCommand<{...}>(client, { action: "refresh-conversation", conversationId })`, and asserts the
offline-sent message is present in the response. This is the existing full-refetch precedent
(Pitfall #2) — add a **paired** assertion alongside it (not a replacement, so both the old and new
behavior are intentionally covered) that exercises the new bounded backfill path directly (a new
`action`/direct-select call, per whichever boundary decision Section B lands on) and asserts it
returns only messages newer than the last known one, bounded by the gap-backfill limit.

---

### L. `apps/web/app/globals.css` — skeleton utility + scroll-anchor override

**Analog:** the file itself. Every chat-specific animation follows the same three-part shape
(comment explaining the calm-motion rationale → `@keyframes` → `@utility animate-*`):
```css
/* Chat: new-message entrance. Small opacity + translate settle so incoming
   bubbles feel calm, never a bounce/attention-grab. Reduced-motion clamp is
   the existing global rule above — no per-animation guard needed here. */
@keyframes message-in {
  from { opacity: 0; transform: translateY(var(--spacing-motion-enter)); }
  to { opacity: 1; transform: translateY(0); }
}
@utility animate-message-in {
  animation: message-in var(--duration-message) ease-out;
}
```
A new skeleton-pulse utility (opacity-oscillation only, never a shimmer sweep, to stay calm per
`states.md`) should follow this exact shape and rely on the same global reduced-motion clamp
already in place at `globals.css:265-271` (`animation-iteration-count: 1 !important` under
`prefers-reduced-motion: reduce`) — no new per-animation guard needed, matching every other
animation in this file.

**Required companion rule (RESEARCH Pattern 3's "Required companion CSS", not yet present):**
```css
.chat-log-viewport {
  overflow-anchor: none;
}
```
must be added (scoped to the chat log's `ScrollArea` viewport class) so Chromium/Firefox's native
scroll anchoring doesn't fight the manual scrollHeight-diff restore.

---

### M. Migration — conditional, `supabase/migrations/0010_chat.sql` is the analog if needed

The keyset index this phase needs already exists (`0010_chat.sql:26-27`):
```sql
create index messages_conversation_created_id_idx
  on public.messages (conversation_id, created_at, id);
```
Only add a new migration if `EXPLAIN` on the actual `DESC, DESC` keyset query shows this index
insufficient (RESEARCH considers this unlikely — Postgres supports efficient backward index
scans on the same index). If one is needed, copy `0010_chat.sql`'s header-comment + bare `create
index` statement style — this schema file otherwise deliberately avoids `DROP`/destructive
statements and keeps RLS policies untouched by index-only migrations.

---

### N. `supabase/functions/chat-command/index.ts` — reference for what NOT to imitate

**Not a positive analog.** RESEARCH Pitfall #9 and Assumption A5 flag genuine tension here: the
existing `refresh-messages`/`refresh-conversation` cases (`chat-command/index.ts:262-354`)
already prove reads CAN ride this write-oriented Edge Function (that's literally what they do
today), but AGENTS.md's API boundary says reads should be direct Supabase selects. The
recommended default is: do not add a new `action` case here for pagination/backfill (follow
`actions.ts`'s `*ViaLocalRpc` direct-select convention instead, Section B). If a future
maintainer decides consistency with the existing precedent matters more, `enrichMessage`
(`chat-command/index.ts:102-158`) is this file's own reaction-enrichment implementation — it
duplicates `actions.ts`'s `addReactionAggregates`, so extending this file would mean maintaining
enrichment logic in two places, which is itself a reason to prefer `actions.ts`.

## Shared Patterns

### Merge/dedup primitive (apply to every new message-touching path)
**Source:** `packages/core/src/chat-state/selectors.ts:16-48` (`mergeChatMessage`,
`compareChatMessages`)
**Apply to:** `reducer.ts` new event handlers, `use-chat-messages.ts` pagination/backfill
callbacks, `use-chat-realtime.ts` reconnect merge loop. Never write a second dedup function —
CLOAD-05 is already satisfied by this primitive; pagination/backfill just need to call it.

### Direct-select read pattern (API boundary)
**Source:** `apps/web/app/(authenticated)/chat/actions.ts:487-581`
(`refreshMessagesViaLocalRpc`/`refreshConversationViaLocalRpc`)
**Apply to:** new `loadOlderMessagesAction`/`backfillMessagesAction`-style functions. Contrast
with the anti-pattern in Section N.

### Reaction/sender enrichment batching
**Source:** `apps/web/app/(authenticated)/chat/actions.ts:285-370` (`addReactionAggregates`,
`addSenderDisplayNames`)
**Apply to:** any new function that returns a batch of raw message rows to the client.

### Additive portable-event pattern + its two doc/test linkages
**Source:** `packages/core/src/chat-state/{types,reducer}.ts` switch/union shape +
`packages/core/docs/chat-state-protocol.md:41-53,96-107` + `apps/web/tests/
chat-state-fixtures.test.ts:141-152`
**Apply to:** every new `ChatEvent` variant. Three files move together per new event: the type
union, the reducer case, and the protocol doc's table row — plus a fourth touch
(`chat-state-fixtures.test.ts`'s hardcoded name array) whenever a new fixture case name is added,
which is easy to miss because it is not the fixture JSON file itself.

### Calm notice tone (`Alert` component)
**Source:** `apps/web/components/ui/alert/alert.tsx` (whole file) +
`apps/web/app/(authenticated)/chat/chat-client.tsx:523-527` (existing `{notice && <Alert
tone="notice">...}` usage)
**Apply to:** offline banner, reconnecting state, backfill-failed notice. Never `tone="error"` or
raw red for anything client-facing (AGENTS.md rule #6 / `states.md`).

### Reduced-motion-safe animation utility
**Source:** `apps/web/app/globals.css:258-271` (global clamp) + `:290-306` (`message-in` example)
**Apply to:** new skeleton-pulse utility. No per-animation reduced-motion guard needed — the
global rule already covers any new `@utility animate-*`.

### `Button` component's built-in non-resizing loading state
**Source:** `apps/web/components/ui/button/button.tsx:32-35,104-113`
**Apply to:** the manual "Load earlier" tap affordance — `variant="secondary"` or `"ghost"`,
never `"primary"`; the built-in `loading` prop already satisfies "loading affordances reserve
their space."

### jsdom test-environment stub idiom
**Source:** `apps/web/vitest.setup.ts:6-12`
**Apply to:** new `IntersectionObserver` mock (must be capture-and-trigger, not bare no-op — see
Section J).

### Portable-core web-boundary purity test
**Source:** `apps/web/app/(authenticated)/chat/store/chat-store.test.ts:54-89`
**Apply to:** any PR that adds fields to `ChatConversationState`/`ChatStoreState` — extend this
describe block's assertions to cover the new pagination fields.

## No Analog Found

Every top-level file in this phase has at least a structural analog (see table above); the gaps
are at the sub-component/technique level:

| Gap | Role | Data Flow | Reason |
|---|---|---|---|
| Skeleton/loading-placeholder visual primitive | component | render | No `skeleton` anything exists anywhere in the repo (`grep -rl skeleton apps/web` returns zero files). Nearest available material is `Alert`'s tone system + `animate-fade-in`/`animate-message-in` utilities + `states.md`'s "a soft skeleton of what's coming" copy guidance — the planner must design the shape (fixed-height rows sized like real message bubbles, per the zero-CLS requirement) from tokens, not copy an existing component. |
| `IntersectionObserver` sentinel technique | hook | event-driven | Zero existing usage repo-wide (RESEARCH Pitfall #10, independently reconfirmed). Section F's hook-lifecycle analogs are structural only — the actual observer wiring must come from RESEARCH's Code Example C. |
| Isolated hook unit test file | test | n/a | No `hooks/*.test.ts` file exists today; all hook behavior is currently tested indirectly through `chat-client.test.tsx`. `use-stick-to-bottom.test.ts` will be the first — treat it as a new precedent, not an extension of an existing one. |

## Conventions

Derived via the shared deterministic module (`gsd-tools.cjs verify conventions --derive`), same
tool `gsd-code-reviewer` uses. The chat route directory itself
(`apps/web/app/(authenticated)/chat/`) contains a parenthesized Next.js route-group segment and
was rejected by the tool's scope-safety guard (`"skipped": true, "reason": "unsafe-scope"`), so
the table below is the **repo-wide** derivation (`--scope` omitted); two phase-relevant subtrees
were derived separately and are called out beneath it.

| Axis | Dominant | Share | Entropy | Status |
|---|---|---|---|---|
| File-name casing | no single style — leading variant `other` (144/255), then `camel` (73), `kebab` (36) | 57% | 0.868 | contested hotspot |
| Identifier casing | no single style — leading variant `camel` (1370/2227), then `Pascal` (652), `CONSTANT` (144), `other` (61) | 62% | 0.674 | contested hotspot |
| Export style | `esm` | 100% | 0.000 | named contract |
| Import style | `esm` | 100% | 0.000 | named contract |

Phase-relevant subtree checks (both too small a sample for file-name/export/import axes to clear
the tool's sampling floor — reported `insufficient-data` for those, omitted here):
`packages/core/src/chat-state` — identifier casing `camel` at **100%** (21/21, named contract, no
ambiguity for reducer/selector/type work); `apps/web/lib/services/supabase` — identifier casing
`camel` at **71%** (20/28, named contract, just above the 70% line).

The repo-wide "File-name casing" `other` bucket is very likely inflated by Next.js
framework-reserved filenames (`page.tsx`, `layout.tsx`, `route.ts`), dotted test/config suffixes
(`core.test.ts`, `eslint.config.mjs`), and numbered SQL migrations (`0010_chat.sql`) — none of
which are an authored style choice available to this phase's planner. Every file this phase
actually touches inside `apps/web/app/(authenticated)/chat/hooks/` and `.../store/` is already
uncontested kebab-case (`use-chat-messages.ts`, `use-stick-to-bottom.ts`, `chat-store.ts`,
`chat-selectors.ts`) with camelCase functions/values and PascalCase types inside them — match that
local convention for the two new files in this phase (`use-load-older-messages.ts`,
`use-stick-to-bottom.test.ts`), regardless of the contested repo-wide number.

**Contested hotspots (author's choice).** The prototype example of an intentionally-contested,
per-directory-consistent split is the gsd-plugin tooling's own **CJS<->SDK dual resolver**:
`bin/lib/**` is CommonJS (`module.exports`/`require`) while `sdk/src/**` is ESM
(`export`/`import`) — each half is internally consistent within its own directory, and the split
reads as "contested" only when measured repo-wide across both halves at once. FISH has no
equivalent `bin/lib`/`sdk/src` split (this is a general calibration reference, not a claim about
this repository's structure), but the same reasoning applies to FISH's own contested axes above:
reviewers and planners should match whatever style is already locally consistent in the specific
directory being touched, rather than trying to resolve the repo-wide contested number.

## Metadata

**Analog search scope:** `apps/web/app/(authenticated)/chat/**` (incl. `hooks/`, `store/`),
`apps/web/lib/services/supabase/**`, `packages/core/src/chat-state/**`,
`packages/core/docs/chat-state-protocol.md`, `supabase/functions/chat-command/index.ts`,
`supabase/migrations/0010_chat.sql`, `scripts/verify-chat-realtime.ts`,
`apps/web/components/ui/{alert,button,scroll-area}/**`, `apps/web/vitest.setup.ts`,
`apps/web/tests/chat-state-fixtures.test.ts`, `.claude/skills/sketch-findings-fish/references/
{states,chat}.md`, `.planning/phases/09-cross-platform-chat-state/
09-NATIVE-CHAT-STATE-NOTES.md`.
**Files scanned:** ~34 (27 classified files + 7 supporting reference files read for pattern
extraction only: `alert.tsx`, `button.tsx`, `scroll-area.tsx`, `chat-state.ts` local barrel,
`states.md`, `chat.md`, `09-NATIVE-CHAT-STATE-NOTES.md`).
**Pattern extraction date:** 2026-07-09.
