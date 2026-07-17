// Presence is the feature layer over PresenceData: the 15-second
// presentation clock, the local stale/expiry rules, label and last-seen
// formatting, optimistic status commands with calm rollback, and the
// account/status/duration sheet. Views stay stateless where possible; the
// one `@Observable` model binds the repository to presentations. This module
// never imports Supabase — the data boundary stays in PresenceData.
