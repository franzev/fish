# Stack Research

**Domain:** Coaching product (client profiles + data-driven onboarding + config-driven tracker engine + persistent 1-on-1 chat) on an existing Supabase + Next.js 16 / React 19 stack
**Researched:** 2026-07-04
**Confidence:** HIGH

> Scope note: this is a **subsequent-milestone** stack study. The validated v1.0 stack (Next.js 16.2.9, React 19.2.7, Tailwind v4.3.1, `@supabase/supabase-js` 2.110.0 + `@supabase/ssr` 0.12.0, Deno Edge Functions, pnpm 11.7.0, Vitest 4.1.9) is **locked and not re-litigated**. This file recommends only the *additions and patterns* the four v1.1 features need, and — just as importantly — states what to **not** add. Everything here is weighed against the project's three governing laws: **remove choices**, **minimal dependencies**, and **RLS is the sole read-authorization boundary**.

## Headline Recommendation

**Add exactly one runtime dependency this milestone: `zod` (v4). Everything else the four features need is already in the box** — Supabase migrations/RLS, Edge Functions, the service-abstraction layer, and the client-component + service-layer form pattern already shipped for auth. The only *dev* additions worth considering are `@playwright/test` (E2E, optional-but-recommended for the chat/onboarding round-trips) and enabling the **`pg_jsonschema`** Postgres extension (no npm cost — it ships with Supabase) as a database-level backstop for tracker/question-bank config.

The reason the dependency list is this short is structural: the codebase already solved the hard integration problems in v1.0 (SSR client factories, a DI service container, a `ServiceResult` error envelope, a raw-Deno Edge Function convention, an RLS verification harness). v1.1 is mostly **new tables + new RLS + new service methods + new routes**, not new infrastructure.

## Recommended Stack

### Core Technologies (additions only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **zod** | **4.4.3** (`^4.4.3`) | Runtime schema validation + static type inference for: question-bank config, tracker config, onboarding answers, and the `SendMessageCommand` body | The one genuinely new capability v1.1 needs. Three of the four features (onboarding question-bank, tracker config, tracker entries) are **data-driven**: their shape lives in the DB as JSONB/rows and is *read back and rendered dynamically*. The current Edge Function hand-parses `command.body?.trim()` and hand-writes `if (!x)` guards — that pattern does not scale to a branching question-bank or a versioned tracker config with per-field validation. Zod turns "is this config well-formed?" and "is this answer valid for this field type?" into one declarative schema shared across web, Edge Function, and tests, with the *inferred TypeScript type as a free byproduct*. Verified current: npm `latest` = 4.4.3. |
| **pg_jsonschema** (Postgres extension) | ships with Supabase | DB-level `CHECK` constraint that a tracker-config / question-bank JSONB column matches a JSON Schema, enforced at INSERT/UPDATE inside the transaction | **Not an npm dependency — zero supply-chain cost.** It is the RLS-first instinct applied to config integrity: the same way RLS (not app code) is the authorization boundary, `jsonb_matches_schema(...)` in a `CHECK` constraint makes malformed config *impossible to persist* even via seed script, `psql`, or a future admin path — closing the gap Zod alone leaves (Zod only guards the code paths that remember to call it). Use it as a **backstop**, with Zod as the primary developer-facing validator. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` (`/mini` subpath) | 4.4.3 | Tree-shakable variant of the same package, imported as `zod/mini`, for the **Edge Function bundle only** | Only if the `send-message` (and future tracker-assign) Edge Function bundle size becomes a cold-start concern. `zod/mini` is ~1.9 kB gzipped vs the full package's larger footprint, using standalone functions instead of chained methods so bundlers eliminate unused validators. **Recommendation: start with the standard `zod` import everywhere for readability; switch the Edge Function to `zod/mini` only if cold-start measurement justifies it.** Same package, same version — no new dependency. |
| `@playwright/test` | 1.61.1 | Browser E2E for the flows that only exist as full round-trips (onboarding resume, live chat send→coach-read, tracker render-from-config) | **Dev dependency, recommended but scoping-flexible.** Vitest (already present, 227 tests) covers units/components/service-boundary well, but three v1.1 flows are inherently multi-step and cross-role — exactly what GAP-047 flags for Playwright. Add it when the first live-chat route lands; keep the suite tiny (the critical paths in the gap analysis: signup→onboarding→resume, client-send→coach-read, tracker-assign→client-render). Do **not** let it balloon into a second component-test framework. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI migrations (already in use) | New tables + RLS for profiles fields, question-bank, responses, tracker config/assignments/entries, conversations/messages/read-state | Continue the established convention: numbered SQL files (`0007_…` onward), table-level `grant`s **before** RLS, recursion-safe `private.*` `SECURITY DEFINER` helpers, one policy per operation. This is a pattern, not a new tool. |
| `pnpm verify:rls` (already in use) | Extend the existing live-assertion harness to cover the new tables | The v1.0 harness proves policies live (8/8). Every new table this milestone must add assertions here — this is the project's stated authorization contract, not optional. |
| `supabase gen types` (Supabase CLI) | Regenerate `packages/supabase/src/database.types.ts` after each migration | Keeps the service-layer `Database` generic honest. Already the source of `ProfileRow`/`CoachClientRow`. |

## Where Each Addition Lives (and why it earns its keep)

This is the load-bearing section for the roadmapper/planner. Placement is deliberate.

### zod — placement decision

**Do NOT add `zod` to `packages/core`.** `packages/core` is currently **zero-runtime-dependency, pure types** (verified: its `package.json` has no `dependencies` block, only a TypeScript devDep). Its whole value is being importable by web, Edge Functions (via relative path), and native clients without dragging a runtime library in. Putting Zod there would poison that property for a Swift/Kotlin consumer that only wants the type shapes.

Instead:

| Location | What Zod does there | Why here |
|----------|--------------------|----------|
| **`packages/core`** (no dep) | Keep hand-written **type contracts** (`ChatMessage`, a new `TrackerConfig`, `OnboardingQuestion`, `ClientProfile`, etc.) as today. Optionally, define the **Zod schemas in a sibling file that the web app / Edge Function owns**, and derive the core types via `z.infer` *in the consumer* — but the published `@fish/core` surface stays pure-type. | Preserves the pure-types guarantee; native clients still get shapes. |
| **`apps/web`** (`zod` as a dependency of `@fish/web`) | Validate onboarding answers and tracker entries **before** calling the service layer; parse/validate config **after** reading it from the DB so the renderer never sees malformed config; back client-component form submission. | This is where forms and dynamic rendering live. |
| **Edge Function** (`supabase/functions/*`, imported via `npm:zod@4` or `zod/mini`) | Replace the hand-rolled `if (!command.conversationId || !body)` block in `send-message` with a `SendMessageCommand` Zod schema; validate the tracker-assignment command; validate that a stored config is well-formed before acting on it. | The Edge Function is the trust boundary for command-style writes; Deno imports npm packages natively (`npm:zod`). |

**Net:** one logical schema definition, authored once (co-located with `packages/core` types but not exported as a runtime dep from core), consumed by both the browser and the Edge runtime. That single-source-of-truth is the entire reason Zod beats hand-written guards — the guards would otherwise be duplicated and drift between web and Edge.

**Why Zod beats "just keep hand-writing guards":** the v1.0 `send-message` stub's manual validation is fine for *one* field. The v1.1 question-bank has steps, answer types, branching, and immutable versions; the tracker config has fields, cadence, validation rules, and versioning. Hand-validating a *dynamic, data-driven* structure is exactly the case where a schema library stops being optional and starts being the difference between a maintainable engine and a pile of nested `if`s. It also gives the renderer a typed, parsed object instead of `any`-from-JSONB.

### pg_jsonschema — placement decision

Lives in a **migration** (`create extension pg_jsonschema with schema extensions;` then a `CHECK (jsonb_matches_schema('{…}', config))` on the config columns). It is the DB-layer twin of RLS: config integrity enforced by the database, not trusted to app code. Keep the JSON Schema string minimal (structural shape only); let Zod own the rich, developer-facing validation. Use it specifically for **tracker config** and **question-bank config** JSONB columns, which are the immutable-once-used, seed-authored structures where a bad write is a latent rendering bomb.

### Playwright — placement decision

Dev-only, in `apps/web` (or a top-level `e2e/` workspace). Runs against the local Supabase stack + seeded users. Scope to launch-critical cross-role/multi-step flows only.

## Form Handling: keep the shipped pattern; do NOT introduce Server Actions wholesale

This was an explicit question, and the answer is **stay the course, with one surgical exception.**

**What v1.0 does (verified in `apps/web/app/login/login-form.tsx`):** forms are **client components** (`"use client"`) that call a **service-layer function** (`signInWithPassword` from `@/lib/auth/browser`), branch on the `ServiceResult` `{ ok, error }` envelope, and drive local `useState` for loading/error, routing on success. No Server Actions are used anywhere in the app today (`grep "use server"` finds only build artifacts).

**Recommendation for v1.1 forms (profile edit, onboarding step, tracker entry):**

- **Reuse the existing client-component + service-layer pattern.** It already satisfies the design law (one primary action, calm `notice` errors via the `Input` component, `ServiceResult` error codes → calm copy) and is battle-tested by 227 tests and a boundary test that forbids UI importing Supabase directly. Introducing React 19 `useActionState` + Next 16 Server Actions *for these forms* would fork the app's form idiom for no product gain and would route writes through a *third* path (neither "direct RLS read" nor "Edge Function command") that the current architecture doesn't model.
- **Add Zod validation inside this existing flow**, client-side before the service call (instant calm feedback) and again in the service/Edge layer (trust boundary). This is the standard 2026 pattern (validate at the edge, never let the handler see invalid data) applied *within* the codebase's own idiom rather than importing the whole Server-Actions ceremony.
- **The one exception:** command-style writes that already belong on the server per the AGENTS.md API boundary — **sending a message, assigning a tracker** — go through **Edge Functions**, not Server Actions. This is already the locked rule; v1.1 just makes the `send-message` function real and adds a tracker-assign function.

**Why not adopt Server Actions / `useActionState` now:** they're a legitimate Next 16 / React 19 pattern, but adopting them here would (a) create a second write path competing with the Edge-Function command boundary the architecture is built on, (b) fork the form idiom mid-product, and (c) add cognitive surface for zero user-facing benefit. The "remove choices / minimal surface" ethos applies to *architecture* too. Revisit only if a future feature needs progressive-enhancement forms that work without JS — not a v1.1 requirement.

## Idempotency: `clientRequestId` + a `UNIQUE` constraint (NOT blind upsert)

The `SendMessageCommand` already carries an optional `clientRequestId` (verified in `packages/core/src/chat.ts`), and the coaching UI for an anxious/ADHD audience *will* retry on flaky connections (GAP-020 offline-retry queue depends on this). Recommended pattern:

- **Store `client_request_id` on `messages` with a partial `UNIQUE (conversation_id, sender_id, client_request_id)` constraint** (partial: `WHERE client_request_id IS NOT NULL`).
- In the real `send-message` Edge Function, **`INSERT … ON CONFLICT (…) DO NOTHING RETURNING *`**; if the insert returned no row, `SELECT` the existing message by the same key and return it. Both the first send and the retry return the *same* persisted message — a true idempotent result, matching the existing `SendMessageResult { message }` contract.
- **Prefer this over a plain `upsert`.** A blind `upsert` on message content would let a retry *mutate* a message body (messages should be immutable per GAP-016's "immutable except allowed metadata"). Insert-on-conflict-do-nothing preserves immutability *and* idempotency. It also keeps the DB (unique constraint) as the enforcement point rather than trusting the function to check-then-insert (which races under concurrent sends).

This is a pure-SQL + one-Edge-Function-change solution. **No idempotency library.**

## Rate Limiting: in-memory token bucket now; do NOT add Upstash/Redis this milestone

- **Supabase's official example recommends Upstash Redis** for *distributed* per-user limiting, because each Edge Function isolate has its own memory heap — an in-memory counter only limits within one warm isolate, not across isolates.
- **But for v1.1, do not add Upstash/Redis.** It's a new hosted dependency + secret + failure mode for a single-coach↔single-client persistent-chat milestone with no public traffic. The threat this milestone actually needs to blunt is a *single client hammering send* (accidental double-fire, a stuck retry loop), not a distributed abuse campaign.
- **Recommended for now:** a **lightweight in-memory sliding-window / token-bucket keyed by authenticated `user_id`** inside the Edge Function (cheap, zero-dependency, good enough against a runaway client on a warm isolate), **plus** the idempotency constraint above (which already neutralizes duplicate `clientRequestId` retries at the DB regardless of isolate). Optionally add a coarse DB-side guard (e.g. reject if the same sender has inserted > N messages in the last few seconds) for a cross-isolate floor without new infrastructure.
- **Defer Upstash Redis to the production/scale milestone** (it's already implied by GAP-043 performance work and the pre-launch hardening pass). Note it as the known upgrade path so no one re-derives it.

## Realtime: keep it OUT, but make the schema realtime-READY

v1.1 ships **persistent send/read only** (realtime is explicitly deferred, GAP-019). Do not add any subscription code, presence, or typing indicators. The service layer already stubs a `SupabaseRealtimeService` (`channel(...)`) — **leave it stubbed; do not wire it.**

Design the chat schema so the *next* milestone can turn on `postgres_changes` with a migration, not a redesign:

- Put messages in their own table with a stable **primary key** and `created_at` — this is all `postgres_changes` needs to stream INSERTs.
- **RLS on `messages` is what makes realtime safe later** — Supabase Realtime respects RLS on the broadcast path, so the same `is_coach_of` / `is_client_of`-style policies that protect reads will protect the future subscription. Getting RLS right *now* is the realtime-readiness work.
- Note for the future migration (do NOT run it now): if the later realtime layer needs *old* row values on UPDATE/DELETE, it will set `REPLICA IDENTITY FULL` on `messages` — but under RLS the old record only exposes the primary key, which is fine. Capturing this here means the deferral is a one-line migration, not a schema change.
- Model a **read-state** table (per-participant last-read pointer) now — v1.1 uses it for persistent "read" state; the realtime milestone reuses it for live read receipts. No subscription needed to populate it.

## Storage: keep it OUT

No chat attachments, no audio, no avatars this milestone (GAP-021 is P2 and gated on coach validation). The service layer already stubs `SupabaseStorageService` — leave it stubbed. Consent metadata and accessibility prefs on the profile are plain columns/JSONB, not files. **Do not enable or touch Storage unless a profile field trivially needs an image, which nothing in the v1.1 scope does.**

## Installation

```bash
# Core (the ONE new runtime dependency) — add to apps/web
pnpm --filter @fish/web add zod

# Edge Functions import Zod via Deno's npm specifier — no pnpm install needed:
#   import { z } from "npm:zod@4";          // or
#   import { z } from "npm:zod@4/mini";     // if bundle size matters

# Dev dependency (recommended, when the first live chat route lands)
pnpm --filter @fish/web add -D @playwright/test
pnpm --filter @fish/web exec playwright install --with-deps chromium

# pg_jsonschema — NOT an install; enabled in a migration:
#   create extension if not exists pg_jsonschema with schema extensions;
```

**Do NOT** add `zod` to `packages/core` or `packages/supabase` (keep them dependency-light / pure-type).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **zod 4** | valibot / arktype | If Edge Function bundle size were the *dominant* constraint and `zod/mini` still weren't small enough — valibot is more aggressively tree-shakable. Not worth a second validation idiom here; `zod/mini` already gets to ~1.9 kB, and Zod's ecosystem familiarity + `z.infer` ergonomics win for a small team. |
| **zod 4** | `pg_jsonschema` *alone* (no app-side validation) | Never alone — DB constraints give great integrity but terrible developer feedback (a Postgres error, not a typed parse result). Use both: Zod for DX/rendering, `pg_jsonschema` as the un-bypassable backstop. |
| **Client-component + service-layer forms** | React 19 Server Actions + `useActionState` | If a future feature needs no-JS progressive enhancement, or if the team decides to migrate *all* forms to Server Actions as a deliberate architecture change. Not for v1.1 — it would fork the form idiom and add a third write path. |
| **In-memory + idempotency rate limiting** | Upstash Redis (`@upstash/ratelimit`) | The production/public-launch milestone, when there's real multi-tenant traffic and distributed isolates make in-memory insufficient (GAP-043). Documented as the known upgrade path. |
| **`ON CONFLICT DO NOTHING` idempotency** | Dedicated idempotency-key table / library | If idempotency were needed across *many* command types with complex replay semantics. For one message-send command, a partial unique constraint is simpler and races-safe. |
| **Playwright** | Cypress | Team/tooling preference only; Playwright is already the tool the gap analysis (GAP-047) names, has better parallelism, and matches the Next.js ecosystem default. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| A client-state library (Redux / Zustand / Jotai) | v1.1 state is server-owned (RLS reads) + local form state. Adding a global store contradicts "remove choices / minimal deps" and there's no cross-tree client state to manage. | React `useState`/`useContext` + server components, exactly as v1.0. |
| React Query / SWR | Tempting for chat, but v1.1 has **no realtime and no polling** — reads are server-component loads. A data-fetching cache layer is premature and adds a dependency for a problem that doesn't exist yet. | Server-component reads through the service layer; revisit only when realtime/polling arrives. |
| An ORM (Prisma / Drizzle) | Breaks the locked architecture: reads go **direct through Supabase under RLS**; writes go through **Edge Functions**. An ORM would bypass RLS and duplicate the schema source-of-truth (migrations + generated types already exist). | Supabase client + `supabase gen types` + SQL migrations. |
| A Node/Express API service | Explicitly barred by AGENTS.md. Every server-side need here is a Supabase Edge Function. | Edge Functions for commands; direct RLS reads for queries. |
| `react-hook-form` | For one-question-at-a-time onboarding and small profile/tracker forms, it's more machinery than the screens need, and it competes with the shipped client-component form idiom. The design law caps each screen at one primary action and few fields — RHF's array/perf features are unused. | Existing controlled-input + `useState` + Zod pattern. |
| A realtime/websocket library, presence/typing lib | Realtime is deferred this milestone by explicit scope. | Nothing — leave the `SupabaseRealtimeService` stub untouched; design schema realtime-ready. |
| Upstash Redis / any hosted cache **now** | New secret, new dependency, new failure mode for a private single-pair-chat milestone. | In-memory per-isolate limiter + DB idempotency constraint now; Redis at scale later. |
| Adding `zod` to `packages/core` | Poisons the pure-types guarantee that lets native (Swift/Kotlin) consumers import shapes without a JS runtime dep. | Keep core pure-type; own Zod schemas in `apps/web` / Edge Function; derive types via `z.infer` in consumers. |

## Stack Patterns by Variant

**If validating a *stored* config (tracker config, question-bank version):**
- Validate with **both** Zod (in the code that reads/renders it) **and** a `pg_jsonschema` `CHECK` constraint (at write time in the DB). Config is immutable-once-used and seed-authored, so a bad write is a latent rendering failure — belt and suspenders is warranted here specifically.

**If validating a *submitted* value (onboarding answer, tracker entry, message body):**
- Zod at the client (instant calm feedback) **and** Zod at the trust boundary (service layer for direct writes, Edge Function for command writes). Skip `pg_jsonschema` for high-volume per-submission values; the value-shape is simple and column types + Zod suffice.

**If the write is a "command" (send message, assign tracker):**
- Edge Function, JWT-verified (`verify_jwt = true` already set for `send-message` in `config.toml`), membership-checked via the same `private.*` helper style, Zod-validated body, idempotent via `clientRequestId` + unique constraint, calm error copy. **Not** a Server Action, **not** a direct client write.

**If the read is a "query" (load profile, load thread, load assigned tracker):**
- Direct Supabase read through the service layer, authorized **solely by RLS**. No manual `id` filtering in app code (the v1.0 rule).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `zod@4.4.3` | Next 16.2.9 / React 19.2.7 / TS 5.7.3 | Zod is framework-agnostic; no React/Next coupling. TS 5.7 well above Zod 4's floor. Verified npm `latest` = 4.4.3. |
| `zod@4` (`npm:zod@4`) | Deno Edge runtime | Zod publishes to JSR (`@zod/zod`) and works via Deno's `npm:` specifier; use `zod/mini` subpath if bundle size matters. |
| `zod@4` | `zod@3` | **Breaking**: error-customization API unified (`message`→`error`, `invalid_type_error`/`required_error` dropped), `.strict()`/`.passthrough()` → `z.strictObject()`/`z.looseObject()`, defaults now apply inside optional fields. Greenfield in this repo, so no migration cost — just author v4-native. Pin to avoid a `zod@3`-published-`zod/v4` ambiguity; `^4.4.3` is safe. |
| `@playwright/test@1.61.1` | Next 16 / Node | Standard; runs against the local Supabase stack. Pin the browser via `playwright install chromium`. |
| `pg_jsonschema` | Supabase Postgres (local + hosted) | First-party Supabase extension; enable with `create extension … with schema extensions`. No version pin needed. |
| `@supabase/supabase-js@2.110.0` + `@supabase/ssr@0.12.0` | unchanged | Already the validated pair; v1.1 adds no Supabase-client version change. Realtime/Storage classes stay stubbed. |

## Sources

- npm registry (`npm view zod`, `@playwright/test`, `vitest`, `@supabase/supabase-js`, `@supabase/ssr`) — verified current versions: zod 4.4.3, Playwright 1.61.1, Vitest 4.1.9, supabase-js 2.110.0, ssr 0.12.0 — HIGH
- https://zod.dev/v4 and https://zod.dev/packages/mini — Zod 4 release, `zod/mini` ~1.9 kB tree-shakable, breaking-change surface — HIGH
- https://supabase.com/docs/guides/functions/examples/rate-limiting — Supabase officially demonstrates Upstash Redis; confirms in-memory is per-isolate only — HIGH
- https://supabase.com/docs/guides/database/extensions/pg_jsonschema and https://github.com/supabase/pg_jsonschema — `jsonb_matches_schema` in `CHECK` constraints, enable-in-migration — HIGH
- https://supabase.com/docs/guides/realtime/postgres-changes — realtime respects RLS; `REPLICA IDENTITY FULL` behavior under RLS (old record = PK only) — HIGH
- https://nextjs.org/docs/app/guides/forms + https://react.dev/reference/react/useActionState — Next 16 / React 19 Server Actions + `useActionState` form pattern (evaluated and deliberately *not* adopted for v1.1) — HIGH
- Codebase inspection: `packages/core/package.json` (zero runtime deps — the Zod-placement constraint), `apps/web/app/login/login-form.tsx` (shipped client-component + service-layer form idiom), `supabase/functions/send-message/index.ts` (hand-rolled validation the Zod schema replaces), `supabase/config.toml` (`verify_jwt = true`), `apps/web/lib/services/supabase/{core,types}.ts` (stubbed Realtime/Storage services), `packages/core/src/chat.ts` (`clientRequestId` already on `SendMessageCommand`) — HIGH
- `docs/product-gap-analysis-2026-07-04.md` GAP-005..GAP-020 — corroborates idempotency (`clientRequestId`), realtime-deferral, Playwright/UAT (GAP-047), config versioning/immutability — HIGH (in-repo prior)

---
*Stack research for: FISH v1.1 "The Coaching Loop" — additions to an existing Supabase + Next.js 16 stack*
*Researched: 2026-07-04*
