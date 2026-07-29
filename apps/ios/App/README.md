# FISH iOS app

This target is the production chat host. It keeps the first release focused
on direct messages: sign-in, assigned conversation list, live conversation
transport, message search within the open conversation, attachments, and
direct-message notifications.

Conversation search is session-only and remains scoped to the authorized
conversation on screen. It uses the deployed `search_chat_messages` RPC for
trimmed body search, newest-first cursor pages, and lightweight result rows;
selecting a result returns to the canonical transcript and focuses the
authoritative message by ID. Search terms and result content are not persisted
or logged by the iOS host.

## Local build

Generate the project when `project.yml` changes:

```sh
xcodegen generate --spec project.yml
```

Pass the Supabase and optional Klipy values as Xcode build settings (or set
`FISH_SUPABASE_URL`, `FISH_SUPABASE_ANON_KEY`, `FISH_KLIPY_API_KEY`,
`FISH_KLIPY_CLIENT_KEY`, `FISH_WEB_BASE_URL`, and `FISH_FRIENDS_ENABLED` in
the environment), then build the `Fish` scheme. Release builds require an
HTTPS web origin; debug builds may use an explicitly configured local HTTP
origin.

APNs delivery is configured only in the deployment environment. Set the
`APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`, and
`APNS_ENDPOINT` Edge Function secrets before testing notifications on a real
device. The simulator can verify the app shell and deep-link routing, but it
cannot receive a production APNs device token.

Call PushKit/CallKit delivery and lesson flows are intentionally outside this
target until direct chat has been validated end to end.

## Friends

`FISH_FRIENDS_ENABLED` becomes the `FRIENDS_ENABLED` Info.plist value that
`FishAppConfiguration` reads. Only `true` — the word itself, give or take
surrounding whitespace — turns on adding a friend by username and reviewing
friend requests; unset, unsubstituted, differently cased, and anything else
leave every friends surface out of the build: no top-bar action, no requests
row, no realtime subscription, and no change to today's screens. Turning it
on also requires `FRIENDS_ENABLED=true` in the target project's Edge Function
environment; the server refuses friend commands without it. Entry points
additionally require a client account, so a coach never sees them however the
build is configured.

Friends still owes a two-device pass before it is enabled for anyone. It needs
a backend nobody has stood up locally yet, so it rides the outstanding
release-verification track with the other native features. On two client
accounts of a project whose Edge environment has `FRIENDS_ENABLED=true`, with
`FISH_FRIENDS_ENABLED=true` builds on both devices:

1. Device A: **Add a friend** → search device B's exact username → **Add
   friend**.
2. Device B: the requests row appears in the inbox without a relaunch → open
   it → **Accept request**.
3. Both devices show the new conversation without a relaunch, and messages,
   typing, and presence work in it immediately.
4. Device A declines a later request from device B: device B sees no change,
   and searching device A again returns the plain "isn't available" copy.
5. Both send to each other simultaneously (crossed requests): the second
   sender is offered **Review request** rather than a duplicate send, and
   taking it opens that request's review.
6. A coach account sees no add-friend action, no requests row, and the
   unchanged empty state.
7. A build with the flag off behaves exactly as it does today.

On iPad regular width, also check the rail: with a conversation open, the
rail's add-friend action still opens the sheet, and a request that arrives
while the conversation is on screen still turns into a conversation in the
rail without a relaunch.

## Search validation

Before a target-environment release, validate search with both authorized
conversation members and an unrelated account: deleted-message exclusion,
same-timestamp cursor ordering, page boundaries at 25/26 rows, retry after
network loss, and focusing a result outside the initial transcript window.
Also check the sheet, keyboard Search action, VoiceOver, Dynamic Type, RTL,
dark mode, Reduce Motion, swipe dismissal, and iPad width on the target
Supabase project and a physical device.
