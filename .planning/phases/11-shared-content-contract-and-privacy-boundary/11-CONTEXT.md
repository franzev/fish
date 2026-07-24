# Phase 11: Shared-content contract and privacy boundary - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the verified correctness and privacy gaps in the already-built shared-content contract. Phase 11 owns server-authoritative eligibility, conversation membership, deterministic 40+1 cursor paging, source-message context, deletion fan-out, and one portable TypeScript/Kotlin/Swift behavior contract. This gap closure does not add gallery UI, new content or sending pipelines, preview/export features, search, bulk actions, or any other later-phase capability.

</domain>

<decisions>
## Implementation Decisions

### Safe shared-link identity
- **D-01:** Shared content is private-by-default: only verified conversation members may retrieve it, and any legacy, service-role, or newly written link row that cannot prove the same canonical public-link safety invariant must be rejected or omitted from every gallery projection.
- **D-02:** The first safe public URL posted in the source message is the stable gallery identity. Redirects may enrich that item only after every hop is independently proven public; a redirect must never replace the canonical URL/hostname pair or create inconsistent identity fields.
- **D-03:** A link that fails URL, hostname, credential, fragment, DNS-address, redirect, or rebinding validation remains unavailable. The contract must not fall back to displaying or fetching it merely to preserve legacy content.

### Deterministic conversation-owned state
- **D-04:** The existing four-field server order and 40-retained-plus-one-sentinel contract remain locked. Every reducer must reject content owned by another conversation, preserve server order, and prevent duplicate, late, or out-of-order page completions from regressing the active cursor, continuation flag, or visible position.
- **D-05:** Around-message context contains only real, nondeleted messages. Older/newer gap flags are calculated over that same visible set, so deleted neighbors cannot appear or create false continuity.

### Deletion convergence
- **D-06:** Attachments already bound to a tombstoned source message receive the same cleanup marker and retry-safe physical deletion path as newly deleted attachments. Legacy timing must not leave permanently unclaimable private objects.

### Cross-platform proof
- **D-07:** TypeScript, Kotlin, and Swift replay one canonical fixture corpus strictly. Unknown or missing fixture items must fail loudly, and assertions must compare complete normalized items, pages, cursors, capabilities, gallery states, identity purges, and deletion fan-out rather than silently dropping or partially checking data.
- **D-08:** The live adversarial verifier is evidence only when it compares C/codepoint order and complete normalized rows and proves bounded query behavior. ID-only, count-only, locale-sensitive, tautological, or shallow plan-text assertions are insufficient.

### the agent's Discretion
- Choose the concrete SQL migration/function structure, DNS-resolution and redirect-validation mechanism, and request-generation/cursor-sequencing design, while preserving the locked behavior above and the already-applied migration history.
- Choose focused fixture names and test organization. Keep the canonical JSON corpus as the single semantic source and keep platform implementations native and pure.
- Improve the ignored enrichment-write failure only if it fits naturally inside gap closure without broadening the shared-content product surface.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase scope
- `AGENTS.md` — Project architecture, native direct-chat-only boundary, privacy rules, and non-negotiable product constraints.
- `.planning/ROADMAP.md` — Phase 11 goal, requirements, success criteria, dependency, and completed-plan history.
- `.planning/REQUIREMENTS.md` — Normative definitions for DISC-03, PRIV-01, PAGE-01, PAGE-02, and PAR-01 plus later-phase exclusions.
- `.planning/PROJECT.md` — Milestone scope and durable product/architecture decisions.

### Gap evidence and deployed-state history
- `.planning/phases/11-shared-content-contract-and-privacy-boundary/11-VERIFICATION.md` — Authoritative gap list, affected artifacts, missing proofs, and human-verification needs for this closure pass.
- `.planning/STATE.md` — Recorded Phase 11 decisions, linked-schema state, and current blocking concerns.
- `.planning/phases/11-shared-content-contract-and-privacy-boundary/11-RESEARCH.md` — Technical research and validation architecture used by the original plans; verification findings take precedence where they conflict.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/0061_shared_content_contract.sql`: existing normalized RPCs, four-field keyset order, deletion/cleanup functions, and around-message contract to correct without inventing a parallel model.
- `supabase/functions/_shared/link-preview.ts`: existing first-link extraction, canonical persistence, fetch/enrichment, and redirect flow; the gap closure hardens this path rather than adding another link pipeline.
- `packages/core/src/shared-content/fixtures/shared-content-vectors.json`: canonical cross-language corpus to extend with ownership, stale-page, unsafe-link, deletion, and strict-projection cases.
- `packages/core/src/shared-content/state.ts` plus the matching Kotlin and Swift reducers: pure portable/native state machines that already share event and state vocabulary.
- `scripts/verify-shared-content.ts`: existing linked-schema adversarial harness and generated-type drift gate to strengthen with discriminating assertions.

### Established Patterns
- Supabase/RLS is the authorization boundary for reads; sensitive writes and cleanup use RPCs or Edge Functions with caller/service authority kept explicit.
- Provider-neutral portable state lives in `packages/core`; generated Supabase shapes stay in `packages/supabase`; native platforms replay shared fixtures rather than importing web state.
- Realtime and page recovery are bounded, conversation-owned, tombstone-wins, and identity-purged. Server order is authoritative; clients do not locale-sort results.
- Applied database history and generated types are verified together; schema proof must include the actual linked/local database, not source inspection alone.

### Integration Points
- Shared-content listing/category/context RPCs and cleanup claim/finish functions in the Supabase migration chain.
- Canonical link persistence/enrichment and deleted-bound Storage cleanup in shared Edge-function helpers.
- TypeScript, Android, and iOS shared-content reducers and their fixture-replay tests.
- Root `verify:shared-content`, build, lint, typecheck, native parity, and fixture-drift commands.

</code_context>

<specifics>
## Specific Ideas

- Treat the five blocker groups in `11-VERIFICATION.md` as one contract-hardening closure: safe links, legacy deletion cleanup, nondeleted source context, conversation-owned stale-safe reducers, and strict adversarial/native proof.
- Preserve the calm user outcome by making unsafe or unavailable content absent rather than presenting a risky fallback or a new choice.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 11 gap-closure scope. Gallery presentation, delivery URLs, offline cache, preview/export, source navigation, user-facing deletion, accessibility, and native UI remain assigned to Phases 12–15.

</deferred>

---

*Phase: 11-shared-content-contract-and-privacy-boundary*
*Context gathered: 2026-07-22*
