// PresenceData is the provider-neutral presence control plane: the domain
// models of the shared presence contract (migrations 0034/0035/0048 and the
// `presence-command` Edge Function), the repository that owns the one
// per-process session — heartbeats, retries, revision-ordered merges, subject
// revocation, and realtime recovery — and the protocols feature code depends
// on. The live adapter speaks Supabase (PostgREST, Functions, Realtime) and
// is constructed only at the app boundary — feature code sees the protocols.
// This module never imports SwiftUI, DesignSystem, or UIComponents.
