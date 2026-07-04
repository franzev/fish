---
quick_id: 260704-keb
status: planned
created: 2026-07-04
type: refactor
must_haves:
  truths:
    - "Each of the 22 chat COMPONENTS lives in its own folder apps/web/components/chat/<name>/ containing <name>.tsx, <name>.stories.tsx, and index.ts — mirroring the existing apps/web/components/ui/<name>/ structure"
    - "types.ts, story-data.ts, index.ts (barrel), and chat.test.tsx stay at the apps/web/components/chat/ root — they are shared, not components"
    - "No component behavior changes — this is a pure move + import-path refactor"
    - "The barrel and every external consumer keep importing from @/components/chat unchanged; the barrel's ./name specifiers resolve through each folder's index.ts"
    - "typecheck, vitest (205 tests), the Next build, AND storybook build all still pass"
  artifacts:
    - path: "apps/web/components/chat/avatar/index.ts"
      provides: "Folder barrel re-exporting the avatar component (representative of all 22)"
      contains: "export"
---

# Quick Task 260704-keb Plan

Reorganize the flat chat component kit under `apps/web/components/chat/` into one folder
per component, matching the `apps/web/components/ui/` layout that was just applied. Stories
already exist for every component (task 260704-k50); this task ONLY moves files and fixes
relative imports. **No behavioral changes.**

## Fixed facts (do not re-derive)

**The 22 components to fold** (each `chat/<name>.tsx` + `chat/<name>.stories.tsx` → `chat/<name>/`):
attachments, avatar, bubble, chat-container, chat-header, chat-input, conversation-list,
empty-state, link-preview, message, message-actions, message-list, message-meta,
message-status, notification-badge, presence-indicator, quoted-message, reactions,
skeleton, typing-indicator, unread-divider, voice-player

**Stay at `chat/` root, do NOT move:** `types.ts`, `story-data.ts`, `index.ts` (barrel),
`chat.test.tsx`.

**Storybook glob is recursive** (`components/**/*.stories.*`) — foldered stories are still
discovered. Do not touch `.storybook/`.

**Do NOT touch:** `apps/web/app/kit/chat/page.tsx`, `apps/web/app/kit/chat/mock-data.ts`,
or anything importing from `@/components/chat` — they use the barrel, which stays stable.

## Tasks

### Task 1 — Move each component into its own folder + add index.ts

For EACH of the 22 components `<name>`:
1. `mkdir apps/web/components/chat/<name>`
2. `git mv apps/web/components/chat/<name>.tsx apps/web/components/chat/<name>/<name>.tsx`
3. `git mv apps/web/components/chat/<name>.stories.tsx apps/web/components/chat/<name>/<name>.stories.tsx`
4. Create `apps/web/components/chat/<name>/index.ts` containing exactly:
   `export * from "./<name>";`
   (`export *` is used rather than named re-exports because several modules also export
   types e.g. `conversation-list` exports `ConversationSummary`, `message-status`/`types`
   export `MessageStatus`; `export *` re-exports all of them and keeps the barrel + test
   working unchanged. This is functionally identical to the ui/ named pattern.)

### Task 2 — Fix relative imports inside the moved files ONLY

The files are now one directory deeper, so their relative specifiers must gain one `../`.
Be careful: `./message` is a prefix of `./message-meta`, `./message-list`,
`./message-actions`, `./message-status` — rewrite whole specifiers, never by blind
substring/sed.

- In each moved `chat/<name>/<name>.tsx`: rewrite EVERY import whose specifier starts with
  `./` to start with `../` instead. (e.g. `from "./types"` → `from "../types"`;
  `from "./avatar"` → `from "../avatar"`, which resolves to `../avatar/index.ts`.) A
  component never imports itself, so all `./` become `../`.
- In each moved `chat/<name>/<name>.stories.tsx`: the self-import of its own component
  stays same-folder — `import { <Name> } from "./<name>"` is UNCHANGED. Every OTHER `./`
  specifier gains a `../`: `./story-data` → `../story-data`, `./types` → `../types`, and any
  `./<sibling-component>` → `../<sibling-component>`.

Do NOT edit `index.ts` (barrel), `chat.test.tsx`, `types.ts`, or `story-data.ts` — their
`./<name>` specifiers now resolve through the new folder `index.ts` files and must keep
working AS-IS. If typecheck reports one of these fails to resolve, the fix is a missing or
wrong folder `index.ts` (Task 1), NOT an edit to these root files.

### Task 3 — Verify (all must pass before commit)

```bash
cd apps/web
pnpm exec tsc --noEmit                         # typecheck: no unresolved imports
pnpm exec vitest run                           # 205 tests still green (chat.test.tsx unchanged)
pnpm build-storybook                           # storybook still builds (foldered stories discovered)
cd /Users/franz/Work/Personal/fish && pnpm --filter web build   # Next prod build passes
```
Plus sanity greps:
```bash
# every component folder has exactly the 3 files
for d in apps/web/components/chat/*/; do ls "$d" | tr '\n' ' '; echo "<- $d"; done
# nothing still references a flat chat component path that no longer exists
test -z "$(ls apps/web/components/chat/*.tsx 2>/dev/null | grep -v chat.test.tsx || true)" && echo "OK: no stray flat component .tsx" || echo "check remaining flat files"
```

## Constraints

- Pure refactor — zero behavior changes, zero new dependencies, zero token/CSS changes.
- Do not modify component logic, JSX, props, or exports — only file location and the `../`
  depth of relative imports.
- Do not stage or commit `apps/web/app/icon.svg` (pre-existing unrelated change) or
  `apps/web/storybook-static/` (build output, gitignored).
- Commit the code move atomically. Do NOT commit docs (PLAN/SUMMARY/STATE) — the
  orchestrator handles that.
- Create `.planning/quick/260704-keb-organize-chat-components-into-per-compon/260704-keb-SUMMARY.md`
  with `status: complete` in frontmatter.
