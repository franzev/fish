# Phase 7: Chat Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 7-Chat Schema
**Areas discussed:** Write posture and sender trust, Conversation lifecycle, Read-state footprint, Message integrity guardrails

---

## Write Posture and Sender Trust

| Option | Description | Selected |
|--------|-------------|----------|
| DB Function | Expose a SECURITY DEFINER `send_chat_message` RPC that derives sender identity from `auth.uid()` and enforces membership in one place; Phase 8 Edge Function calls it. | Yes |
| RLS Direct Insert | Allow authenticated members to insert directly into `messages` under RLS; simpler verification, but more client surfaces can attempt writes. | |
| Edge Only | No authenticated insert/RPC path except service-role Edge Function later; strictest surface, but Phase 7 cannot fully prove member writes without Phase 8. | |

**User's choice:** Recommended route authorized by the user's instruction to avoid interruption and always choose the recommended option.
**Notes:** This keeps Phase 7 capable of proving member writes now while keeping Phase 8's Edge Function thin and consistent with the database integrity layer.

---

## Conversation Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Seed one per assignment | Create one conversation for every seeded coach-client assignment and enforce uniqueness on the pair. | Yes |
| Create lazily | Create the conversation only when the first message is sent later in Phase 8. | |
| Multi-thread ready | Allow several conversations per pair now to support future topics. | |

**User's choice:** Recommended route.
**Notes:** The roadmap calls for one shared conversation and no UI complexity. Seeded one-per-assignment keeps Phase 7 verifiable and avoids introducing a thread chooser.

---

## Read-State Footprint

| Option | Description | Selected |
|--------|-------------|----------|
| Last-read pointer | Store one row per member with `last_read_message_id`/`read_at`; quiet, compact, and realtime-ready. | Yes |
| Per-message receipts | Store one row per message/member read event; richer later, more surface now. | |
| Defer table | Skip read-state table until read-receipt UI exists. | |

**User's choice:** Recommended route.
**Notes:** The roadmap explicitly names `message_reads`, but visible read receipts remain out of scope. Last-read pointer matches the calm minimal product line.

---

## Message Integrity Guardrails

| Option | Description | Selected |
|--------|-------------|----------|
| Strict DB guardrails | Enforce trimmed non-empty, max 4000 chars, required `client_request_id`, idempotent duplicate returns, and immutable messages in the database. | Yes |
| App-only validation | Keep body and idempotency handling mostly in the future Edge Function/UI. | |
| Future-proof mutation fields | Add soft-delete/redaction/edit metadata now for later moderation. | |

**User's choice:** Recommended route.
**Notes:** The highest-risk chat surface benefits from database proof first. Edit/delete/redaction belongs to a future privacy/moderation design.

---

## the agent's Discretion

- Exact SQL function names, migration number, trigger/function implementation details, and verifier helper names.
- Exact seed fixture text, provided it stays neutral and does not encode coaching technique.
- Exact generated type alias names, provided legacy handwritten chat DB contracts are removed.

## Deferred Ideas

- Realtime subscriptions, presence, typing, read-receipt UI, unread badges, search, reactions, edit/delete/redaction, attachments, notifications, group chat, community, and AI replies.
- Assignment/reassignment UI and historical archive rules.
- Phase 8 web route and real `send-message` persistence integration.
