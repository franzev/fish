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
`FISH_KLIPY_CLIENT_KEY`, and `FISH_WEB_BASE_URL` in the environment), then
build the `Fish` scheme. Release builds require an HTTPS web origin; debug
builds may use an explicitly configured local HTTP origin.

APNs delivery is configured only in the deployment environment. Set the
`APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`, and
`APNS_ENDPOINT` Edge Function secrets before testing notifications on a real
device. The simulator can verify the app shell and deep-link routing, but it
cannot receive a production APNs device token.

Call PushKit/CallKit delivery and lesson flows are intentionally outside this
target until direct chat has been validated end to end.

## Search validation

Before a target-environment release, validate search with both authorized
conversation members and an unrelated account: deleted-message exclusion,
same-timestamp cursor ordering, page boundaries at 25/26 rows, retry after
network loss, and focusing a result outside the initial transcript window.
Also check the sheet, keyboard Search action, VoiceOver, Dynamic Type, RTL,
dark mode, Reduce Motion, swipe dismissal, and iPad width on the target
Supabase project and a physical device.
