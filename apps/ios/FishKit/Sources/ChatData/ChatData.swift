// ChatData is the FISH-owned data boundary: provider-neutral value types and
// the protocols feature code depends on. Live adapters (KLIPY today, Supabase
// in the data milestone) also live here, but callers only construct them at
// the app boundary — feature code sees the protocols. This module never
// imports SwiftUI, DesignSystem, UIComponents, or PersonalChat.
