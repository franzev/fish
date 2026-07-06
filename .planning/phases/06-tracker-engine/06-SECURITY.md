---
phase: 6
slug: tracker-engine
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-06
updated: 2026-07-06T00:15:59Z
---

# Phase 6 - Security

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client browser to Server Action/RPC | Tracker draft and entry saves enter through validated Server Actions and Supabase RPCs. | Field id, field answer, authenticated user identity |
| Authenticated user to tracker RLS | Clients and coaches read tracker tables under row-level security. | Assignments, entries, drafts, progress rows |
| Edge Function to Supabase admin client | `assign-tracker` performs a service-role insert only after caller-scoped membership checks. | Client id request, derived coach id, derived tracker version id |
| Seed/service role to config tables | Neutral tracker configs and fields are seeded with DB checks and immutable used-version/field protections. | Tracker config, fields, assignment fixtures |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | Elevation of privilege | `tracker_assignments` | mitigate | No authenticated assignment write policy; assignment is through `assign-tracker` or seed/service role. | closed |
| T-06-02 | Spoofing / elevation | `assign-tracker` | mitigate | Function verifies JWT caller, requires coach role, filters `coach_clients` by `coach_id = caller.id` and `client_id`, and derives version server-side. | closed |
| T-06-03 | Information disclosure | `tracker_entry_drafts` | mitigate | Draft RLS is client-only. `verify:rls` proves assigned coach, unassigned coach, and another client see zero draft rows. | closed |
| T-06-04 | Information disclosure | saved entries / coach review | mitigate | Entry and coach progress reads are assignment/RLS scoped through `private.is_coach_of`; denial paths return zero rows. | closed |
| T-06-05 | Tampering | tracker config / answers | mitigate | zod validation plus `pg_jsonschema` and `private.tracker_answer_matches_config` reject malformed config/answers. Used versions/fields are protected from config-bearing mutation. | closed |
| T-06-06 | Repudiation / data integrity | saved entries | mitigate | Saved entries pin `version_id` and field snapshot data; draft commit deletes the matching private draft. | closed |
| T-06-07 | Tampering / product harm | progress model | mitigate | No score, grade, adherence percent, or streak schema; progress is read-time step state and current-step fill only. | closed |

## Accepted Risks Log

No accepted risks.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-06 | 7 | 7 | 0 | Codex |

## Security Audit 2026-07-06

| Metric | Count |
|--------|-------|
| Threats found | 7 |
| Closed | 7 |
| Open | 0 |

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks documented.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

Approval: verified 2026-07-06.
