# Chat attachment operations

Chat attachments use private Supabase Storage, a dedicated cleanup credential,
and a fail-closed document scanner. Images do not leave the Supabase processing
boundary; documents cannot become `ready` unless the scanner returns `clean`.

## Production secrets

Generate independent random values for the cleanup and scanner credentials.
Configure the Edge runtime:

```bash
supabase secrets set \
  CHAT_ATTACHMENT_CLEANUP_SECRET='<32+ character random value>' \
  CHAT_ATTACHMENT_SCANNER_URL='https://scanner.example.com/scan' \
  CHAT_ATTACHMENT_SCANNER_TOKEN='<scanner bearer token>'
```

Store the same cleanup value and the public Supabase project origin in Vault by
calling `configure_chat_attachment_cleanup` with the service-role credential.
The `cleanup-chat-attachments` cron job is installed by migration and wakes up
as soon as these Vault values exist.

```bash
curl --fail-with-body "$SUPABASE_URL/rest/v1/rpc/configure_chat_attachment_cleanup" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  --data "{\"p_project_url\":\"$SUPABASE_URL\",\"p_cleanup_secret\":\"$CHAT_ATTACHMENT_CLEANUP_SECRET\"}"
```

The scanner receives the document bytes in a `POST` request, the source MIME as
`content-type`, the SHA-256 digest as `x-content-sha256`, and its token as a
Bearer credential. It must return JSON shaped as either
`{"verdict":"clean","reference":"…"}` or
`{"verdict":"malicious","reference":"…"}`. Timeouts, malformed responses,
and unavailable scanners keep the attachment quarantined for a bounded retry.

## Verification

With the local stack running and migrated:

```bash
pnpm verify:chat-attachments
```

This verifies authorization and limits, ordered atomic binding, cleanup claims,
signed PUT ingress, and the iOS JPEG-to-private-WebP processing path.

## iOS live lab

Generate the Catalog project with the seeded client and conversation values:

```bash
FISH_SUPABASE_URL='http://127.0.0.1:54321' \
FISH_SUPABASE_ANON_KEY='<local publishable key>' \
FISH_SUPABASE_EMAIL='client1@fish.dev' \
FISH_SUPABASE_PASSWORD='fish-client-dev' \
FISH_SUPABASE_CONVERSATION_ID='11111111-1111-4111-8111-111111111111' \
FISH_SUPABASE_RECIPIENT_NAME='Coach' \
xcodegen generate --spec apps/ios/Catalog/project.yml
```

Open **Live attachment lab** in the Catalog to exercise photo/file selection,
upload, send, hydration, signed-URL refresh, and web-to-iOS polling.
