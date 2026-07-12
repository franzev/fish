# Real-time calling: local setup

The call control plane runs entirely on the local Supabase stack. A hosted
account is **not** required for database, authorization, UI, or lifecycle work.
Audio can use either LiveKit Cloud credentials or the open-source local server.

## One-time setup

1. Start Supabase and apply the schema:

   ```bash
   pnpm supabase:start
   pnpm db:reset
   pnpm seed
   ```

2. Copy `supabase/functions/.env.example` to
   `supabase/functions/.env.local`. Either keep its development credentials and
   install `livekit-server`, or replace all three values with credentials from
   an isolated LiveKit Cloud development project. `pnpm dev` loads `.env.local`.

## Run locally

For the open-source local server, use separate terminals from the repository
root:

```bash
pnpm dev:livekit
pnpm dev
```

When `.env.local` uses LiveKit Cloud, run only `pnpm dev`.

The checked-in `livekit.local.yaml` sends signed room and participant events to
the local webhook function, keeping durable call state synchronized. The web
app and Supabase Edge Functions start together under `pnpm dev`. Sign
in as `coach@fish.dev` and `client1@fish.dev` in two browser profiles to place
a voice or video call. Allow microphone access for voice; allow both camera and
microphone access for video. Browser tabs cannot share the same Supabase
session reliably for this test.

Run the control-plane verification independently of LiveKit:

```bash
pnpm verify:calls
```

## Cloud setup

A LiveKit Cloud account is needed only for deployment with the recommended
managed media plane. Create one project, then configure these Edge Function
secrets:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Configure its signed webhook to call the deployed `livekit-webhook` function.
Keep the API secret server-only. The browser receives only a short-lived,
single-room participant token from `call-command`.

Self-hosting LiveKit remains possible, but then FISH owns deployment, TLS,
UDP/TURN reachability, capacity, upgrades, and monitoring. Discord and Preply
operate versions of this media infrastructure at much larger scale; FISH can
replicate the user experience and protocol architecture without reproducing
their private global networks.
