# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## phase-10-reconnect-lifecycle — stale subscription callbacks retained reconnect ownership after conversation switches
- **Date:** 2026-07-11
- **Error patterns:** stale callback, SUBSCRIBED, first-subscribe tracker, reconnect lock, conversation switch, disconnected status
- **Root cause:** Subscription effect generations had no synchronous callback-ownership revocation; asynchronous unsubscribe left stale A callbacks authoritative over refs and state already reassigned to B.
- **Fix:** Added effect-local active guards to messages, reads, and reactions data/status callbacks, revoked ownership before unsubscribe, retained promise-identity settlement, and added a full public lifecycle regression matrix.
- **Files changed:** apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts, apps/web/app/(authenticated)/chat/chat-client.test.tsx
---
