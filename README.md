# FISH

FISH is a calm coaching hub for neurodivergent professionals learning English.
Coaches assign the experience; the product removes choices and keeps the next
action clear.

## Current product

The web application currently includes:

- Email/password authentication, recovery, verified sessions, and client/coach roles.
- Client profiles and coach-visible client details protected by Supabase RLS.
- A shared monochrome UI system with accessible light and dark themes.
- Focused single-lesson booking with coach availability, conflict-safe writes,
  local timezone display, 12/24-hour preferences, confirmation, and upcoming lessons.
- A single seeded community channel at `/channels/:id` with persisted messages,
  replies, reactions, read state, presence, typing, bounded history loading, and
  realtime recovery.
- A platform-neutral chat-state reducer with fixture vectors for future native
  adapters.

Learning exercises, gamification, and AI coaching remain out of scope until a
coach validates the technique manually.

## Stack

- `apps/web` — Next.js App Router, React, TypeScript, and Tailwind CSS v4.
- `packages/core` — backend-neutral roles, chat contracts, and chat state.
- `packages/supabase` — generated database types and Supabase-specific contracts.
- `supabase` — Auth, Postgres, RLS, Realtime, migrations, and Edge Functions.

Supabase is the backend of record. There is no separate Express API.

## Local development

```bash
pnpm install
pnpm supabase:start
pnpm db:reset
pnpm seed
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001). The root route redirects by
authentication and role; the design-system reference is available at
`/kit`.

## Quality commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm --filter @fish/web test run
pnpm test:storybook
pnpm build-storybook
pnpm verify:rls
pnpm verify:chat-realtime
pnpm verify:friends
pnpm verify:bookings
```

`verify:friends` exercises both database/RLS behavior and the production Edge
Function command path. To use the friends surface locally, set
`FRIENDS_ENABLED=true` in both `apps/web/.env.local` and
`supabase/functions/.env.local`, then run `pnpm seed`. The seed command keeps
the authoritative database gate aligned with the web flag.

## Product rules

- Coach-first, code-second.
- One primary action per screen.
- Assigned, never chosen.
- Progress is visual, never a grade.
- Reward returning; never punish a gap.
- Copy explains and guides; it never scolds.

See [AGENTS.md](./AGENTS.md) for the binding engineering and product rules.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Hosted Supabase deploy checklist](./docs/deploy-checklist.md)
- [UI/UX agent guidelines](./docs/ui-ux-agent-guidelines.md)
- [Chat-state protocol](./packages/core/docs/chat-state-protocol.md)
- [Project state](./.planning/STATE.md)
- [Milestone history](./.planning/MILESTONES.md)
