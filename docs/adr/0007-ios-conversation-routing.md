# ADR 0007: Route assigned iOS conversations without a chooser

Status: accepted  
Date: 2026-07-18

## Context

FISH removes choices for clients. A conventional inbox shown to a user with one
authorized coaching conversation would add a decision with no value. Coaches
and users with friend DMs can legitimately have several conversations.

## Decision

Routing depends only on the authorized `list_direct_conversation_previews`
result:

- zero conversations shows a calm empty state;
- exactly one conversation opens it directly and never renders a list;
- more than one renders the conversation list in server order.

Rows are navigation targets, not selectable plans. They show identity, the
server-parity snippet, relative time, and a quiet unread count.

## Consequences

The rule is deterministic and unit tested at the 0/1/many boundaries. New
conversation categories must enter the authorized preview RPC rather than add a
client-side gallery or picker.
