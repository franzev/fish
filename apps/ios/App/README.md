# FISH iOS app

This target is the production chat host. It keeps the first release focused
on direct messages: sign-in, assigned conversation list, live conversation
transport, attachments, and direct-message notifications.

## Local build

Generate the project when `project.yml` changes:

```sh
xcodegen generate --spec project.yml
```

Pass the Supabase and optional Klipy values as Xcode build settings (or set
`FISH_SUPABASE_URL`, `FISH_SUPABASE_ANON_KEY`, `FISH_KLIPY_API_KEY`, and
`FISH_KLIPY_CLIENT_KEY` in the environment), then build the `Fish` scheme.

APNs delivery is configured only in the deployment environment. Set the
`APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`, and
`APNS_ENDPOINT` Edge Function secrets before testing notifications on a real
device. The simulator can verify the app shell and deep-link routing, but it
cannot receive a production APNs device token.

Call PushKit/CallKit delivery and lesson flows are intentionally outside this
target until direct chat has been validated end to end.
