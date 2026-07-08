---
status: resolved
trigger: "realtime chat not working properly i have 2 open tabs and I need to refresh in order to see latest messages"
created: 2026-07-08
updated: 2026-07-08
---

## Symptoms

DATA_START
- expected: With the chat open in two browser tabs, a message sent from one tab appears in the other tab immediately via Supabase realtime, without a manual refresh.
- actual: The other tab does not show new messages until the user manually refreshes the page. After refresh the latest messages appear, so persistence works — only live delivery fails.
- errors: None visible in browser console. Server-side: `ERROR P0001 invalid column for filter conversation_id` in Postgres logs from `realtime.subscription_check_filters()`.
- timeline: Deterministic on every full page load; realtime works after client-side navigation remounts.
- reproduction: Full-load /chat while logged in → subscription silently dead. Client-nav away and back → works.
DATA_END

## Current Focus

hypothesis: CONFIRMED — see root_cause
test: done
expecting: done
next_action: none — resolved

## Evidence

- 2026-07-08: Subscription code exists and is correct (realtime.ts, use-chat-realtime.ts); mergeChatMessage appends unknown messages; store/reducer path correct.
- 2026-07-08: DB publication + RLS correct; `messages` in supabase_realtime publication; policy `private.is_conversation_member` evaluates fine for authenticated claims.
- 2026-07-08: Node probe (minted JWT, explicit realtime.setAuth before subscribe) receives INSERT events → transport fine.
- 2026-07-08: Real app reproduction (preview browser, coach@fish.dev): full-load /chat → app store says realtime "connected" BUT `realtime.subscription` has 0 rows and events never arrive. Client-side remount → 5 rows, live delivery works.
- 2026-07-08: Realtime log: "Killing 5 transport pids with no channels open".
- 2026-07-08: Playwright from-t0 websocket capture on full load: phx_join sent WITH correct postgres_changes config → `phx_reply status:ok` (client sets SUBSCRIBED/"connected") → then async `system` event: "Unable to subscribe to changes... ERROR P0001". App ignores the system error; never retries.
- 2026-07-08: Postgres log: `ERROR: invalid column for filter conversation_id` at `realtime.subscription_check_filters()` line 26 (RAISE) — trigger only allows filter columns the claims role can SELECT.
- 2026-07-08: `has_column_privilege('anon','public.messages','conversation_id','SELECT')` = false; insert into realtime.subscription with `{"role":"anon"}` claims reproduces the exact error; with authenticated claims it succeeds.

## Eliminated

- hypothesis: No subscription code wired up — eliminated (full subscribe pipeline exists and is correct)
- hypothesis: Publication/RLS misconfiguration — eliminated (publication contains tables; authenticated RLS evaluates true)
- hypothesis: private schema USAGE blocking policy evaluation — eliminated (stored policy expressions bypass parse-time schema ACL check; SELECT works)
- hypothesis: Client merge/reducer drops remote messages — eliminated (mergeChatMessage appends; live delivery works after remount)
- hypothesis: React StrictMode double-mount race — eliminated (reactStrictMode:false still reproduces)
- hypothesis: navigator.locks auth deadlock — eliminated (no held/pending locks in broken state)
- hypothesis: Edge runtime down breaks sends — eliminated as root cause (sends fall back to send_chat_message RPC and persist; edge runtime being stopped is environmental noise)

## Resolution

root_cause: On initial full page load, chat channels subscribe during React hydration before supabase-js has propagated the user session JWT to the realtime connection. The phx_join therefore carries the anon publishable key as access token. Supabase realtime acks the join (client reports SUBSCRIBED → app shows "connected"), then the postgres_changes registration runs `realtime.subscription_check_filters()` which raises P0001 "invalid column for filter conversation_id" because role `anon` has no SELECT privilege on the chat tables. The subscription is rolled back server-side; the client receives an async `system` error event that the app's subscribe callback ignores, so the page sits forever in a believed-connected, actually-dead state. Client-side navigation remounts subscribe after setAuth has run, which is why realtime worked intermittently.
fix: Added `subscribeAfterAuth` helper in apps/web/app/(authenticated)/chat/realtime.ts. Every chat channel subscription (messages, read states, reactions, presence, typing, voice-recording) now awaits `supabase.auth.getSession()` and pushes the access token via `supabase.realtime.setAuth(token)` BEFORE building/subscribing the channel, with a disposal guard so unmounting before the session resolves never leaks a channel. Typing/voice send helpers no-op until the channel exists.
verification: Playwright full-page-load probe (the failing scenario) — login as coach@fish.dev, hard-load /chat, insert a message via SQL: message APPEARED live without refresh; realtime.subscription rows now register with claims_role=authenticated (was 0 rows / anon P0001). pnpm typecheck clean, 375/375 vitest tests pass, pnpm build passes. verify:chat-realtime script unchanged vs before fix (remaining failures are the stopped local edge runtime container, unrelated).
files_changed: apps/web/app/(authenticated)/chat/realtime.ts
