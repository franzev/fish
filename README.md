# FISH

English coaching that fits how your brain works: a calm ChatHub for neurodivergent professionals.

## What this is

FISH turns a live English-coaching practice into a focused app. Coaches run real sessions, spot what works, and only then is it built into the product. The first product surface is 1-on-1 chat: one coach, one client, one assigned next step.

The product stays deliberately minimal. For this audience, too much choice causes overwhelm, so the coach assigns the experience and the app keeps the next action obvious.

## Tech stack

- `apps/web` — Next.js App Router + React + TypeScript + Tailwind CSS v4
- `apps/ios` — native SwiftUI
- `apps/android` — native Kotlin + Jetpack Compose
- `packages/core` — shared product contracts
- `packages/supabase` — shared Supabase auth/database contracts
- `supabase/functions` — Edge Functions for command-style API logic

Supabase is the backend of record for auth, database, storage, and realtime. There is no separate Express API service unless the product proves it needs one.

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3001. The root route redirects by auth state; the design
system preview is at http://localhost:3001/kit.

## Commands

```bash
pnpm dev          # run the web app
pnpm build        # build/typecheck all pnpm workspace packages
pnpm lint         # lint all pnpm workspace packages
pnpm typecheck    # typecheck all pnpm workspace packages
```

Native apps are opened with their platform tools:

- iOS: open `apps/ios/FISH.xcodeproj` in Xcode.
- Android: open `apps/android` in Android Studio.

## Product rules

- Coach-first, code-second.
- One primary action per screen.
- Assigned, never chosen.
- Progress is visual, never a grade.
- Reward returning; never punish a gap.
- Copy explains and guides; it does not scold.

## For AI agents

See [AGENTS.md](./AGENTS.md) for build commands, conventions, and the design rules every screen must follow.

## Project docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Recent changes](./docs/recent-changes.md)
- [UI/UX agent guidelines](./docs/ui-ux-agent-guidelines.md)
- [Unpublished Linear follow-up draft](./docs/linear-recent-changes-tickets-draft.md)
